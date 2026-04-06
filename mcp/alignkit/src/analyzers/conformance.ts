/**
 * Conformance checking: classifies rules by type and verifies them against the codebase.
 *
 * Rule types:
 * - file-structure: verify with glob for expected paths
 * - import-dependency: verify with grep for import patterns
 * - tool-constraint: verify by checking config files and scripts
 * - naming: verify by listing files and checking names
 * - architecture: verify by grep for cross-boundary imports
 * - config: verify by reading config files
 * - style: mark as unverifiable (requires human review)
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { glob } from 'tinyglobby';

import type { ParsedRule, InstructionFile } from './discovery.js';

export type RuleType =
  | 'file-structure'
  | 'import-dependency'
  | 'tool-constraint'
  | 'naming'
  | 'architecture'
  | 'config'
  | 'style';

export type Verdict = 'conforms' | 'violates' | 'unverifiable';

export interface RuleVerdict {
  text: string;
  type: RuleType;
  verdict: Verdict;
  evidence: string;
}

// --- Rule classification ---

const CLASSIFICATION_PATTERNS: Array<{ type: RuleType; patterns: RegExp[] }> = [
  {
    type: 'file-structure',
    patterns: [
      /\bplace\b.+\bfiles?\b/i,
      /\btest files?\b.+\bnext to\b/i,
      /\bin .+\/ directory/i,
      /\bfile.+\blocation/i,
      /\bco-?locate/i,
    ],
  },
  {
    type: 'tool-constraint',
    patterns: [
      /\brun\b.+\b(vitest|jest|pytest|eslint|prettier|tsc|npm|cargo|go)\b/i,
      /\bbefore\s+(committing|pushing|merging|deploying)\b/i,
      /\bafter\s+(editing|creating|modifying)\b/i,
    ],
  },
  {
    type: 'naming',
    patterns: [
      /\b(camelCase|PascalCase|kebab-case|snake_case)\b/i,
      /\bname\b.+\b(convention|pattern|format)\b/i,
      /\bprefix\b/i,
      /\bsuffix\b/i,
    ],
  },
  {
    // Architecture must be checked before import-dependency since both match "import"
    type: 'architecture',
    patterns: [
      /\bmust not import\b/i,
      /\bnever import\b/i,
      /\bdon'?t import\b/i,
      /\bboundary\b/i,
      /\blayer\b/i,
      /\bno .+ imports? in\b/i,
      /\bcomponents?.+\bmust not\b/i,
    ],
  },
  {
    type: 'config',
    patterns: [
      /\bstrict\b.+\b(TypeScript|mode|type)\b/i,
      /\btsconfig\b/i,
      /\bconfig\b.+\b(require|set|enable)\b/i,
      /\bstrict mode\b/i,
    ],
  },
  {
    // Import-dependency is last among specific types since it has broad patterns
    type: 'import-dependency',
    patterns: [
      /\bimport/i,
      /\bexport/i,
      /\bdefault export/i,
      /\babsolute import/i,
      /\brelative import/i,
      /\bbarrel file/i,
    ],
  },
];

export function classifyRule(text: string): RuleType {
  for (const { type, patterns } of CLASSIFICATION_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return type;
      }
    }
  }
  return 'style'; // Default: unverifiable
}

// --- Conformance checks ---

const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.git/**',
];

async function readFileOrNull(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return null;
  }
}

async function grepFiles(cwd: string, pattern: RegExp, fileGlob: string): Promise<Array<{ path: string; line: number; text: string }>> {
  const files = await glob(fileGlob, { cwd, ignore: IGNORE_PATTERNS, absolute: false });
  const matches: Array<{ path: string; line: number; text: string }> = [];

  for (const filePath of files) {
    try {
      const content = await readFile(join(cwd, filePath), 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
          matches.push({ path: filePath, line: i + 1, text: lines[i].trim() });
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  return matches;
}

async function checkConfigRule(rule: ParsedRule, cwd: string): Promise<RuleVerdict> {
  const text = rule.text;
  const result: RuleVerdict = {
    text: rule.text,
    type: 'config',
    verdict: 'unverifiable',
    evidence: '',
  };

  // Check strict TypeScript
  if (/\bstrict\b/i.test(text) && /\btypescript\b|\btsconfig\b|\btype\b/i.test(text)) {
    const tsconfig = await readFileOrNull(join(cwd, 'tsconfig.json'));
    if (tsconfig) {
      try {
        const parsed = JSON.parse(tsconfig);
        if (parsed.compilerOptions?.strict === true) {
          result.verdict = 'conforms';
          result.evidence = 'tsconfig.json has strict: true';
        } else {
          result.verdict = 'violates';
          result.evidence = 'tsconfig.json does not have strict: true';
        }
      } catch {
        result.evidence = 'tsconfig.json exists but failed to parse';
      }
    } else {
      result.verdict = 'violates';
      result.evidence = 'No tsconfig.json found';
    }
    return result;
  }

  return result;
}

async function checkImportRule(rule: ParsedRule, cwd: string): Promise<RuleVerdict> {
  const text = rule.text;
  const result: RuleVerdict = {
    text: rule.text,
    type: 'import-dependency',
    verdict: 'conforms',
    evidence: '',
  };

  // Check "no default exports" / "never use default exports"
  if (/\b(no|never|don'?t)\b.+\bdefault export/i.test(text)) {
    const matches = await grepFiles(cwd, /export\s+default\b/, '**/*.{ts,tsx,js,jsx}');
    if (matches.length > 0) {
      result.verdict = 'violates';
      const fileList = matches.map(m => m.path).join(', ');
      result.evidence = `${matches.length} default export(s) found in: ${fileList}`;
    } else {
      result.evidence = 'No default exports found in source files';
    }
    return result;
  }

  // Check "use absolute imports" / "no relative imports"
  if (/\babsolute import/i.test(text) || /\b(no|never)\b.+\brelative import/i.test(text)) {
    const matches = await grepFiles(cwd, /from\s+['"]\.\.\//, '**/*.{ts,tsx,js,jsx}');
    if (matches.length > 0) {
      result.verdict = 'violates';
      const fileList = [...new Set(matches.map(m => m.path))].join(', ');
      result.evidence = `${matches.length} relative import(s) found in: ${fileList}`;
    } else {
      result.evidence = 'No relative imports with ../ found in source files';
    }
    return result;
  }

  // Check "use named exports" / "named exports only"
  if (/\bnamed export/i.test(text)) {
    const defaults = await grepFiles(cwd, /export\s+default\b/, '**/*.{ts,tsx,js,jsx}');
    if (defaults.length > 0) {
      result.verdict = 'violates';
      const fileList = defaults.map(m => m.path).join(', ');
      result.evidence = `${defaults.length} default export(s) found instead of named: ${fileList}`;
    } else {
      result.evidence = 'All exports are named exports';
    }
    return result;
  }

  result.verdict = 'unverifiable';
  result.evidence = 'Import rule pattern not recognized for automated checking';
  return result;
}

async function checkArchitectureRule(rule: ParsedRule, cwd: string): Promise<RuleVerdict> {
  const text = rule.text;
  const result: RuleVerdict = {
    text: rule.text,
    type: 'architecture',
    verdict: 'unverifiable',
    evidence: 'Architecture rule pattern not recognized for automated checking',
  };

  // Pattern: "X must not import from Y" or "no Y imports in X"
  const boundaryMatch = text.match(/\b(\w+)\b.+\b(?:must not|never|don'?t|no)\b.+\bimport.+\b(?:from\s+)?(\w+)/i);
  if (boundaryMatch) {
    const sourceDir = boundaryMatch[1].toLowerCase();
    const targetDir = boundaryMatch[2].toLowerCase();
    const matches = await grepFiles(
      cwd,
      new RegExp(`from\\s+['"].*${targetDir}`, 'i'),
      `**/${sourceDir}/**/*.{ts,tsx,js,jsx}`
    );
    if (matches.length > 0) {
      result.verdict = 'violates';
      result.evidence = `${matches.length} import(s) from ${targetDir} found in ${sourceDir}/`;
    } else {
      result.verdict = 'conforms';
      result.evidence = `No imports from ${targetDir} found in ${sourceDir}/`;
    }
  }

  return result;
}

async function checkToolConstraintRule(rule: ParsedRule, cwd: string): Promise<RuleVerdict> {
  const result: RuleVerdict = {
    text: rule.text,
    type: 'tool-constraint',
    verdict: 'unverifiable',
    evidence: 'Tool constraint rules are best verified by observing session behavior, not static code analysis',
  };

  // Check if the tool exists in package.json
  const pkg = await readFileOrNull(join(cwd, 'package.json'));
  if (pkg) {
    try {
      const parsed = JSON.parse(pkg);
      const allDeps = { ...parsed.dependencies, ...parsed.devDependencies };
      const allScripts = parsed.scripts || {};

      // Check if the tool is available
      const toolMatch = rule.text.match(/\b(vitest|jest|pytest|eslint|prettier|tsc)\b/i);
      if (toolMatch) {
        const tool = toolMatch[1].toLowerCase();
        if (allDeps[tool] || Object.values(allScripts).some(s => typeof s === 'string' && s.includes(tool))) {
          result.verdict = 'conforms';
          result.evidence = `${tool} is available in project (found in package.json)`;
        } else {
          result.verdict = 'violates';
          result.evidence = `${tool} not found in package.json dependencies or scripts`;
        }
      }
    } catch {
      // Parse error
    }
  }

  return result;
}

async function checkFileStructureRule(rule: ParsedRule, cwd: string): Promise<RuleVerdict> {
  const result: RuleVerdict = {
    text: rule.text,
    type: 'file-structure',
    verdict: 'unverifiable',
    evidence: 'File structure rule pattern not recognized for automated checking',
  };

  // Check "co-locate test files" / "test files next to source"
  if (/\btest\b.+\b(next to|co-?locate|adjacent|alongside)\b/i.test(rule.text) ||
      /\b(co-?locate|adjacent)\b.+\btest/i.test(rule.text)) {
    const testFiles = await glob(['**/*.test.*', '**/*.spec.*'], {
      cwd,
      ignore: IGNORE_PATTERNS,
      absolute: false,
    });
    const sourceFiles = await glob(['**/*.{ts,tsx,js,jsx}'], {
      cwd,
      ignore: [...IGNORE_PATTERNS, '**/*.test.*', '**/*.spec.*', '**/*.d.ts'],
      absolute: false,
    });

    const misplaced: string[] = [];
    for (const testFile of testFiles) {
      let dir = testFile.replace(/[^/]+$/, '');
      // For __tests__/ subdirectories, check the parent directory for adjacent source
      if (dir.endsWith('__tests__/')) {
        dir = dir.replace(/__tests__\/$/, '');
      }
      // A test is "co-located" if there's a source file in the same (or parent) directory
      const hasAdjacentSource = sourceFiles.some(sf => {
        const sfDir = sf.replace(/[^/]+$/, '');
        return sfDir === dir;
      });
      if (!hasAdjacentSource) {
        misplaced.push(testFile);
      }
    }

    if (misplaced.length > 0) {
      result.verdict = 'violates';
      result.evidence = `${misplaced.length} test file(s) not co-located: ${misplaced.join(', ')}`;
    } else if (testFiles.length > 0) {
      result.verdict = 'conforms';
      result.evidence = `${testFiles.length} test file(s) found, all co-located with source`;
    } else {
      result.evidence = 'No test files found to check';
    }
  }

  return result;
}

export async function checkConformance(rules: ParsedRule[], cwd: string): Promise<RuleVerdict[]> {
  const results: RuleVerdict[] = [];

  for (const rule of rules) {
    const type = classifyRule(rule.text);

    switch (type) {
      case 'config':
        results.push(await checkConfigRule(rule, cwd));
        break;
      case 'import-dependency':
        results.push(await checkImportRule(rule, cwd));
        break;
      case 'architecture':
        results.push(await checkArchitectureRule(rule, cwd));
        break;
      case 'tool-constraint':
        results.push(await checkToolConstraintRule(rule, cwd));
        break;
      case 'file-structure':
        results.push(await checkFileStructureRule(rule, cwd));
        break;
      case 'naming':
        results.push({
          text: rule.text,
          type: 'naming',
          verdict: 'unverifiable',
          evidence: 'Naming convention rules require reading file contents and declarations -- partial automation only',
        });
        break;
      case 'style':
      default:
        results.push({
          text: rule.text,
          type: 'style',
          verdict: 'unverifiable',
          evidence: 'Style rule -- requires human review',
        });
        break;
    }
  }

  return results;
}

// --- Tool declaration checking for skill files ---

// Built-in Claude Code tool names (case-sensitive to avoid false positives on common English words)
const BUILTIN_TOOLS = new Set([
  'Read', 'Glob', 'Grep', 'Bash', 'Edit', 'Write', 'Agent',
  'WebSearch', 'WebFetch', 'AskUserQuestion',
  'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet',
  'NotebookEdit', 'NotebookRead',
]);

/**
 * Parse allowed-tools from YAML frontmatter.
 * Returns the tool list and the body text (everything after frontmatter).
 */
function parseFrontmatterTools(content: string): { tools: string[]; body: string } | null {
  const lines = content.split('\n');
  if (lines[0]?.trim() !== '---') return null;

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endIndex = i;
      break;
    }
  }
  if (endIndex === -1) return null;

  const frontmatterLines = lines.slice(1, endIndex);
  const body = lines.slice(endIndex + 1).join('\n');

  const tools: string[] = [];
  let inToolsSection = false;

  for (const line of frontmatterLines) {
    if (/^allowed-tools:\s*$/.test(line)) {
      inToolsSection = true;
      continue;
    }
    if (inToolsSection) {
      const toolMatch = line.match(/^\s+-\s+(.+)$/);
      if (toolMatch) {
        tools.push(toolMatch[1].trim());
      } else {
        inToolsSection = false;
      }
    }
  }

  return { tools, body };
}

/**
 * Extract the short tool name from an MCP tool identifier.
 * e.g., "mcp__lenskit__lenskit_graph" -> "lenskit_graph"
 */
function mcpShortName(tool: string): string | null {
  const match = tool.match(/^mcp__\w+__(\w+)$/);
  return match ? match[1] : null;
}

/**
 * Bidirectional tool-declaration check for skill files.
 *
 * (a) Declared MCP tools must be referenced in the skill body (catches stale declarations).
 * (b) Tool references in the body must be declared in allowed-tools (catches undeclared usage).
 *
 * Built-in tools (Read, Glob, etc.) are only checked in direction (b) since skills use
 * them implicitly through instructions without naming them.
 */
export function checkToolDeclarations(files: InstructionFile[]): RuleVerdict[] {
  const verdicts: RuleVerdict[] = [];

  for (const file of files) {
    if (file.type !== 'skill') continue;

    const parsed = parseFrontmatterTools(file.content);
    if (!parsed || parsed.tools.length === 0) continue;

    const { tools, body } = parsed;
    const declaredSet = new Set(tools);

    // Direction (a): declared MCP tools must appear in body
    for (const tool of tools) {
      if (!tool.startsWith('mcp__')) continue;

      const shortName = mcpShortName(tool);
      const inBody = body.includes(tool) || (shortName !== null && body.includes(shortName));

      if (!inBody) {
        verdicts.push({
          text: `[${file.relativePath}] declared tool "${tool}" not referenced in skill body`,
          type: 'tool-constraint',
          verdict: 'violates',
          evidence: `Tool "${tool}" is in allowed-tools but never mentioned in the skill instructions`,
        });
      }
    }

    // Direction (b): MCP tool references in body must be declared
    const mcpPattern = /\bmcp__\w+__\w+\b/g;
    const seenMcp = new Set<string>();
    let match;
    while ((match = mcpPattern.exec(body)) !== null) {
      const toolName = match[0];
      if (!seenMcp.has(toolName) && !declaredSet.has(toolName)) {
        seenMcp.add(toolName);
        verdicts.push({
          text: `[${file.relativePath}] references undeclared tool "${toolName}"`,
          type: 'tool-constraint',
          verdict: 'violates',
          evidence: `Tool "${toolName}" is used in skill body but missing from allowed-tools`,
        });
      }
    }

    // Direction (b): built-in tool references in body must be declared
    for (const tool of BUILTIN_TOOLS) {
      if (declaredSet.has(tool)) continue;
      const regex = new RegExp(`\\b${tool}\\b`);
      if (regex.test(body)) {
        verdicts.push({
          text: `[${file.relativePath}] references undeclared tool "${tool}"`,
          type: 'tool-constraint',
          verdict: 'violates',
          evidence: `Tool "${tool}" appears in skill body but missing from allowed-tools`,
        });
      }
    }
  }

  return verdicts;
}
