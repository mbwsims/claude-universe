# Phase 1: Navigate (alignkit) -- Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Navigate subsystem from B to A- by building a bundled alignkit-local MCP server, fixing skill/agent/reference content gaps, and adding comprehensive tests.

**Architecture:** A new `mcp/alignkit/` server provides three tools (`alignkit_local_lint`, `alignkit_local_check`, `alignkit_local_status`) that perform static instruction quality analysis and conformance checking with zero external dependencies. The skills (`/discover`, `/lint`, `/check`) and agent (`instruction-advisor`) receive targeted content fixes addressing threshold inconsistencies, missing fallback procedures, and incomplete guidance. The external `alignkit` MCP server remains in `.mcp.json` for session-based adherence tracking; the new local server handles lint and conformance only.

**Tech Stack:** TypeScript (ES2022, NodeNext, strict), `@modelcontextprotocol/sdk@^1.28.0`, `globby@^14.1.0`, `zod@^3.24.0`, vitest

---

### Task 1: Create alignkit-local MCP server scaffold

**Files:**
- Create: `mcp/alignkit/package.json`
- Create: `mcp/alignkit/tsconfig.json`
- Create: `mcp/alignkit/bin/mcp-server.mjs`

This task creates the project structure matching the pattern used by testkit, shieldkit, lenskit, and timewarp.

- [ ] **Step 1: Create directory structure**

Run: `mkdir -p mcp/alignkit/{bin,src/{analyzers/__tests__,mcp/tools}}`

- [ ] **Step 2: Create package.json**

Create `mcp/alignkit/package.json`:

```json
{
  "name": "alignkit-local-mcp",
  "version": "0.1.0",
  "description": "MCP server for local instruction quality analysis and conformance checking",
  "type": "module",
  "bin": {
    "alignkit-local-mcp": "./bin/mcp-server.mjs"
  },
  "files": [
    "dist",
    "bin"
  ],
  "engines": {
    "node": ">=18"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "author": {
    "name": "Matt Sims",
    "url": "https://github.com/mbwsims"
  },
  "license": "MIT",
  "keywords": [
    "mcp",
    "instructions",
    "lint",
    "claude-code"
  ],
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.28.0",
    "globby": "^14.1.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0",
    "vitest": "USE_PHASE_0_RESOLVED_VERSION"
  }
}
```

**Important:** Replace `USE_PHASE_0_RESOLVED_VERSION` with the exact vitest version that Phase 0 Task 1 pinned across all servers (e.g., `"~3.2.4"` or the pinned `^4.x` if it resolved). Check `mcp/testkit/package.json` for the version Phase 0 set.

- [ ] **Step 3: Create tsconfig.json**

Create `mcp/alignkit/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "sourceMap": true,
    "declaration": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 4: Create bin entry point**

Create `mcp/alignkit/bin/mcp-server.mjs`:

```javascript
#!/usr/bin/env node
import '../dist/mcp/server.js';
```

- [ ] **Step 5: Install dependencies**

Run: `cd mcp/alignkit && npm install`
Expected: Clean install, `node_modules/` created with `@modelcontextprotocol/sdk`, `globby`, `zod`, `vitest`

- [ ] **Step 6: Verify TypeScript compilation works (empty project)**

We need a placeholder file to verify the toolchain before building real analyzers.

Create `mcp/alignkit/src/mcp/server.ts`:

```typescript
// Placeholder — will be replaced in Task 5
console.log('alignkit-local server placeholder');
```

Run: `cd mcp/alignkit && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit scaffold**

```bash
git add mcp/alignkit/package.json mcp/alignkit/tsconfig.json mcp/alignkit/bin/mcp-server.mjs mcp/alignkit/src/mcp/server.ts
git commit -m "feat: scaffold alignkit-local MCP server project"
```

---

### Task 2: Build instruction file discovery analyzer

**Files:**
- Create: `mcp/alignkit/src/analyzers/discovery.ts`
- Test: `mcp/alignkit/src/analyzers/__tests__/discovery.test.ts`

This analyzer discovers instruction files (CLAUDE.md, .claude/rules/*, .claude/agents/*, .claude/skills/*) and parses individual rules from each file.

- [ ] **Step 1: Write the failing test**

Create `mcp/alignkit/src/analyzers/__tests__/discovery.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { discoverInstructionFiles, parseRules } from '../discovery.js';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';

const TMP_DIR = join(import.meta.dirname, '..', '..', '..', '__test-tmp-discovery');

function setupFixture() {
  rmSync(TMP_DIR, { recursive: true, force: true });
  mkdirSync(join(TMP_DIR, '.claude', 'rules'), { recursive: true });
  mkdirSync(join(TMP_DIR, '.claude', 'agents'), { recursive: true });
  mkdirSync(join(TMP_DIR, '.claude', 'skills', 'test-skill'), { recursive: true });

  writeFileSync(join(TMP_DIR, 'CLAUDE.md'), [
    '# Project Instructions',
    '',
    '## Code Style',
    '',
    '- Use TypeScript strict mode',
    '- Always use named exports',
    '- No default exports except in pages/',
    '',
    '## Testing',
    '',
    '1. Run `vitest run` before committing',
    '2. Write tests for all new functions',
    '3. Use describe/it blocks, not standalone test()',
  ].join('\n'));

  writeFileSync(join(TMP_DIR, '.claude', 'rules', 'test-patterns.md'), [
    '---',
    'globs: "**/*.test.ts"',
    '---',
    '',
    '- Co-locate test files next to source',
    '- Use vi.fn() for mocks, not manual stubs',
  ].join('\n'));

  writeFileSync(join(TMP_DIR, '.claude', 'agents', 'reviewer.md'), [
    '---',
    'name: reviewer',
    'description: Reviews code for quality',
    'model: sonnet',
    '---',
    '',
    '# Code Reviewer',
    '',
    '- Check for proper error handling',
    '- Verify type safety',
  ].join('\n'));

  writeFileSync(join(TMP_DIR, '.claude', 'skills', 'test-skill', 'SKILL.md'), [
    '---',
    'name: test-skill',
    'description: A test skill',
    '---',
    '',
    '# Test Skill',
    '',
    '- Step one of the skill',
    '- Step two of the skill',
  ].join('\n'));
}

function cleanupFixture() {
  rmSync(TMP_DIR, { recursive: true, force: true });
}

describe('discoverInstructionFiles', () => {
  beforeAll(() => setupFixture());
  afterAll(() => cleanupFixture());

  it('finds CLAUDE.md at project root', async () => {
    const files = await discoverInstructionFiles(TMP_DIR);
    const paths = files.map(f => f.relativePath);
    expect(paths).toContain('CLAUDE.md');
  });

  it('finds files in .claude/rules/', async () => {
    const files = await discoverInstructionFiles(TMP_DIR);
    const paths = files.map(f => f.relativePath);
    expect(paths).toContain('.claude/rules/test-patterns.md');
  });

  it('finds files in .claude/agents/', async () => {
    const files = await discoverInstructionFiles(TMP_DIR);
    const paths = files.map(f => f.relativePath);
    expect(paths).toContain('.claude/agents/reviewer.md');
  });

  it('finds SKILL.md files in .claude/skills/', async () => {
    const files = await discoverInstructionFiles(TMP_DIR);
    const paths = files.map(f => f.relativePath);
    expect(paths).toContain('.claude/skills/test-skill/SKILL.md');
  });

  it('returns content for each file', async () => {
    const files = await discoverInstructionFiles(TMP_DIR);
    const claudeMd = files.find(f => f.relativePath === 'CLAUDE.md');
    expect(claudeMd).toBeDefined();
    expect(claudeMd!.content).toContain('Use TypeScript strict mode');
  });

  it('returns empty array when no instruction files exist', async () => {
    const emptyDir = join(TMP_DIR, '__empty');
    mkdirSync(emptyDir, { recursive: true });
    const files = await discoverInstructionFiles(emptyDir);
    expect(files).toEqual([]);
    rmSync(emptyDir, { recursive: true });
  });
});

describe('parseRules', () => {
  it('extracts bullet-point rules from markdown', () => {
    const content = [
      '# Section',
      '',
      '- Rule one',
      '- Rule two',
      '- Rule three',
    ].join('\n');
    const rules = parseRules(content);
    expect(rules).toHaveLength(3);
    expect(rules[0].text).toBe('Rule one');
    expect(rules[1].text).toBe('Rule two');
    expect(rules[2].text).toBe('Rule three');
  });

  it('extracts numbered-list rules', () => {
    const content = [
      '# Testing',
      '',
      '1. Run vitest before committing',
      '2. Write tests for new functions',
    ].join('\n');
    const rules = parseRules(content);
    expect(rules).toHaveLength(2);
    expect(rules[0].text).toBe('Run vitest before committing');
    expect(rules[1].text).toBe('Write tests for new functions');
  });

  it('assigns section headings to rules', () => {
    const content = [
      '## Code Style',
      '',
      '- Use strict mode',
      '',
      '## Testing',
      '',
      '- Run tests first',
    ].join('\n');
    const rules = parseRules(content);
    expect(rules[0].section).toBe('Code Style');
    expect(rules[1].section).toBe('Testing');
  });

  it('tracks line numbers for each rule', () => {
    const content = [
      '# Header',        // line 1
      '',                 // line 2
      '- First rule',    // line 3
      '',                 // line 4
      '- Second rule',   // line 5
    ].join('\n');
    const rules = parseRules(content);
    expect(rules[0].line).toBe(3);
    expect(rules[1].line).toBe(5);
  });

  it('strips frontmatter before parsing', () => {
    const content = [
      '---',
      'globs: "*.ts"',
      '---',
      '',
      '- Actual rule',
    ].join('\n');
    const rules = parseRules(content);
    expect(rules).toHaveLength(1);
    expect(rules[0].text).toBe('Actual rule');
  });

  it('returns empty array for file with no rules', () => {
    const content = [
      '# Just a header',
      '',
      'Some paragraph text without rules.',
    ].join('\n');
    const rules = parseRules(content);
    expect(rules).toEqual([]);
  });

  it('handles multi-line rules (continuation indented lines)', () => {
    const content = [
      '- First rule that spans',
      '  multiple lines here',
      '- Second rule',
    ].join('\n');
    const rules = parseRules(content);
    expect(rules).toHaveLength(2);
    expect(rules[0].text).toBe('First rule that spans multiple lines here');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp/alignkit && npx vitest run src/analyzers/__tests__/discovery.test.ts 2>&1 | tail -10`
Expected: FAIL -- cannot resolve `../discovery.js`

- [ ] **Step 3: Write the implementation**

Create `mcp/alignkit/src/analyzers/discovery.ts`:

```typescript
/**
 * Discovers instruction files and parses individual rules from markdown content.
 *
 * Instruction files include:
 * - CLAUDE.md (project root)
 * - .claude/rules/*.md
 * - .claude/agents/*.md
 * - .claude/skills/*/SKILL.md
 */

import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { globby } from 'globby';

export interface InstructionFile {
  relativePath: string;
  absolutePath: string;
  content: string;
  type: 'claude-md' | 'rule' | 'agent' | 'skill';
}

export interface ParsedRule {
  text: string;
  section: string | null;
  line: number;
  sourceFile: string;
}

const INSTRUCTION_PATTERNS = [
  'CLAUDE.md',
  '.claude/rules/**/*.md',
  '.claude/agents/**/*.md',
  '.claude/skills/**/SKILL.md',
];

const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.git/**',
];

function classifyFile(relativePath: string): InstructionFile['type'] {
  if (relativePath === 'CLAUDE.md' || relativePath.endsWith('/CLAUDE.md')) return 'claude-md';
  if (relativePath.includes('.claude/rules/')) return 'rule';
  if (relativePath.includes('.claude/agents/')) return 'agent';
  if (relativePath.includes('.claude/skills/')) return 'skill';
  return 'claude-md'; // fallback
}

export async function discoverInstructionFiles(cwd: string): Promise<InstructionFile[]> {
  const paths = await globby(INSTRUCTION_PATTERNS, {
    cwd,
    ignore: IGNORE_PATTERNS,
    absolute: false,
    dot: true,
  });

  const files: InstructionFile[] = [];

  for (const relativePath of paths) {
    const absolutePath = join(cwd, relativePath);
    try {
      const content = await readFile(absolutePath, 'utf-8');
      files.push({
        relativePath,
        absolutePath,
        content,
        type: classifyFile(relativePath),
      });
    } catch {
      // File not readable -- skip
    }
  }

  return files;
}

function stripFrontmatter(content: string): { body: string; frontmatterLineCount: number } {
  const lines = content.split('\n');
  if (lines[0]?.trim() !== '---') {
    return { body: content, frontmatterLineCount: 0 };
  }

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    return { body: content, frontmatterLineCount: 0 };
  }

  // +1 because endIndex is zero-based and we skip the closing ---
  const frontmatterLineCount = endIndex + 1;
  return {
    body: lines.slice(frontmatterLineCount).join('\n'),
    frontmatterLineCount,
  };
}

export function parseRules(content: string, sourceFile = ''): ParsedRule[] {
  const { body, frontmatterLineCount } = stripFrontmatter(content);
  const lines = body.split('\n');
  const rules: ParsedRule[] = [];
  let currentSection: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track headings for section assignment
    const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      currentSection = headingMatch[1].trim();
      continue;
    }

    // Bullet-point rules: - or *
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      let ruleText = bulletMatch[1].trim();

      // Check for continuation lines (indented by 2+ spaces under a bullet)
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j];
        // Continuation: line starts with 2+ spaces and is not a new bullet/number
        if (/^\s{2,}\S/.test(nextLine) && !/^\s*[-*]\s/.test(nextLine) && !/^\s*\d+\.\s/.test(nextLine)) {
          ruleText += ' ' + nextLine.trim();
          j++;
        } else {
          break;
        }
      }

      rules.push({
        text: ruleText,
        section: currentSection,
        line: i + 1 + frontmatterLineCount,
        sourceFile,
      });
      continue;
    }

    // Numbered-list rules: 1. 2. 3. etc.
    const numberedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (numberedMatch) {
      let ruleText = numberedMatch[1].trim();

      // Check for continuation lines
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j];
        if (/^\s{2,}\S/.test(nextLine) && !/^\s*[-*]\s/.test(nextLine) && !/^\s*\d+\.\s/.test(nextLine)) {
          ruleText += ' ' + nextLine.trim();
          j++;
        } else {
          break;
        }
      }

      rules.push({
        text: ruleText,
        section: currentSection,
        line: i + 1 + frontmatterLineCount,
        sourceFile,
      });
      continue;
    }
  }

  return rules;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mcp/alignkit && npx vitest run src/analyzers/__tests__/discovery.test.ts 2>&1 | tail -15`
Expected: All tests pass (13 tests across 2 describe blocks)

- [ ] **Step 5: Commit**

```bash
git add mcp/alignkit/src/analyzers/discovery.ts mcp/alignkit/src/analyzers/__tests__/discovery.test.ts
git commit -m "feat(alignkit): add instruction file discovery and rule parser"
```

---

### Task 3: Build lint diagnostics analyzer

**Files:**
- Create: `mcp/alignkit/src/analyzers/diagnostics.ts`
- Test: `mcp/alignkit/src/analyzers/__tests__/diagnostics.test.ts`

This analyzer runs the 7 diagnostic checks: VAGUE, CONFLICT, REDUNDANT, ORDERING, PLACEMENT, WEAK_EMPHASIS, METADATA.

- [ ] **Step 1: Write the failing test**

Create `mcp/alignkit/src/analyzers/__tests__/diagnostics.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { runDiagnostics, type Diagnostic } from '../diagnostics.js';
import type { ParsedRule } from '../discovery.js';

function makeRule(text: string, overrides: Partial<ParsedRule> = {}): ParsedRule {
  return {
    text,
    section: null,
    line: 1,
    sourceFile: 'CLAUDE.md',
    ...overrides,
  };
}

describe('VAGUE diagnostic', () => {
  it('flags rules with "try to"', () => {
    const rules = [makeRule('Try to write tests when possible')];
    const diags = runDiagnostics(rules, []);
    const vague = diags.filter(d => d.code === 'VAGUE');
    expect(vague).toHaveLength(1);
    expect(vague[0].ruleText).toBe('Try to write tests when possible');
  });

  it('flags rules with "when possible"', () => {
    const rules = [makeRule('Use named exports when possible')];
    const diags = runDiagnostics(rules, []);
    const vague = diags.filter(d => d.code === 'VAGUE');
    expect(vague).toHaveLength(1);
  });

  it('flags rules with "generally"', () => {
    const rules = [makeRule('Generally prefer functional components')];
    const diags = runDiagnostics(rules, []);
    const vague = diags.filter(d => d.code === 'VAGUE');
    expect(vague).toHaveLength(1);
  });

  it('flags rules with "consider"', () => {
    const rules = [makeRule('Consider adding error handling')];
    const diags = runDiagnostics(rules, []);
    const vague = diags.filter(d => d.code === 'VAGUE');
    expect(vague).toHaveLength(1);
  });

  it('flags rules with "as needed"', () => {
    const rules = [makeRule('Add documentation as needed')];
    const diags = runDiagnostics(rules, []);
    const vague = diags.filter(d => d.code === 'VAGUE');
    expect(vague).toHaveLength(1);
  });

  it('flags rules with "should probably"', () => {
    const rules = [makeRule('You should probably run tests first')];
    const diags = runDiagnostics(rules, []);
    const vague = diags.filter(d => d.code === 'VAGUE');
    expect(vague).toHaveLength(1);
  });

  it('does not flag concrete rules', () => {
    const rules = [makeRule('Run `vitest run` before every commit')];
    const diags = runDiagnostics(rules, []);
    const vague = diags.filter(d => d.code === 'VAGUE');
    expect(vague).toHaveLength(0);
  });
});

describe('CONFLICT diagnostic', () => {
  it('detects "always X" vs "never X" conflicts', () => {
    const rules = [
      makeRule('Always use default exports', { line: 1 }),
      makeRule('Never use default exports', { line: 5 }),
    ];
    const diags = runDiagnostics(rules, []);
    const conflicts = diags.filter(d => d.code === 'CONFLICT');
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
  });

  it('does not flag unrelated always/never rules', () => {
    const rules = [
      makeRule('Always run tests before committing', { line: 1 }),
      makeRule('Never use var declarations', { line: 5 }),
    ];
    const diags = runDiagnostics(rules, []);
    const conflicts = diags.filter(d => d.code === 'CONFLICT');
    expect(conflicts).toHaveLength(0);
  });
});

describe('REDUNDANT diagnostic', () => {
  it('detects highly similar rules', () => {
    const rules = [
      makeRule('Use absolute imports for all source files', { line: 1 }),
      makeRule('Always use absolute imports in source files', { line: 5 }),
    ];
    const diags = runDiagnostics(rules, []);
    const redundant = diags.filter(d => d.code === 'REDUNDANT');
    expect(redundant.length).toBeGreaterThanOrEqual(1);
  });

  it('does not flag different rules', () => {
    const rules = [
      makeRule('Use absolute imports', { line: 1 }),
      makeRule('Run tests before committing', { line: 5 }),
    ];
    const diags = runDiagnostics(rules, []);
    const redundant = diags.filter(d => d.code === 'REDUNDANT');
    expect(redundant).toHaveLength(0);
  });
});

describe('ORDERING diagnostic', () => {
  it('flags tool constraints appearing after style rules', () => {
    const rules = [
      makeRule('Use camelCase for variables', { line: 1, section: 'Style' }),
      makeRule('ALWAYS run vitest run before committing', { line: 20, section: 'Process' }),
    ];
    const diags = runDiagnostics(rules, []);
    const ordering = diags.filter(d => d.code === 'ORDERING');
    expect(ordering.length).toBeGreaterThanOrEqual(1);
  });
});

describe('PLACEMENT diagnostic', () => {
  it('flags file-pattern rules that belong in .claude/rules/', () => {
    const rules = [
      makeRule('In test files, always use describe/it blocks', {
        sourceFile: 'CLAUDE.md',
      }),
    ];
    const diags = runDiagnostics(rules, []);
    const placement = diags.filter(d => d.code === 'PLACEMENT');
    expect(placement.length).toBeGreaterThanOrEqual(1);
    expect(placement[0].suggestion).toContain('.claude/rules/');
  });

  it('flags automation rules that should be hooks', () => {
    const rules = [
      makeRule('Always run eslint --fix after editing TypeScript files', {
        sourceFile: 'CLAUDE.md',
      }),
    ];
    const diags = runDiagnostics(rules, []);
    const placement = diags.filter(d => d.code === 'PLACEMENT');
    expect(placement.length).toBeGreaterThanOrEqual(1);
    expect(placement[0].suggestion).toContain('hook');
  });
});

describe('WEAK_EMPHASIS diagnostic', () => {
  it('flags tool constraints without emphasis', () => {
    const rules = [
      makeRule('Run tests before committing'),
    ];
    const diags = runDiagnostics(rules, []);
    const weak = diags.filter(d => d.code === 'WEAK_EMPHASIS');
    expect(weak.length).toBeGreaterThanOrEqual(1);
  });

  it('does not flag rules with ALWAYS/NEVER/MUST', () => {
    const rules = [
      makeRule('ALWAYS run tests before committing'),
    ];
    const diags = runDiagnostics(rules, []);
    const weak = diags.filter(d => d.code === 'WEAK_EMPHASIS');
    expect(weak).toHaveLength(0);
  });
});

describe('METADATA diagnostic', () => {
  it('flags agent files missing required frontmatter fields', () => {
    const rules: ParsedRule[] = [];
    const files = [{
      relativePath: '.claude/agents/broken.md',
      absolutePath: '/fake/.claude/agents/broken.md',
      content: '# No frontmatter agent\n\n- Do stuff',
      type: 'agent' as const,
    }];
    const diags = runDiagnostics(rules, files);
    const meta = diags.filter(d => d.code === 'METADATA');
    expect(meta.length).toBeGreaterThanOrEqual(1);
  });

  it('does not flag agent files with valid frontmatter', () => {
    const rules: ParsedRule[] = [];
    const files = [{
      relativePath: '.claude/agents/valid.md',
      absolutePath: '/fake/.claude/agents/valid.md',
      content: '---\nname: valid\ndescription: A valid agent\nmodel: sonnet\n---\n\n# Valid Agent\n\n- Do stuff',
      type: 'agent' as const,
    }];
    const diags = runDiagnostics(rules, files);
    const meta = diags.filter(d => d.code === 'METADATA');
    expect(meta).toHaveLength(0);
  });

  it('flags skill files missing required frontmatter fields', () => {
    const rules: ParsedRule[] = [];
    const files = [{
      relativePath: '.claude/skills/broken/SKILL.md',
      absolutePath: '/fake/.claude/skills/broken/SKILL.md',
      content: '# No frontmatter skill\n\n- Step one',
      type: 'skill' as const,
    }];
    const diags = runDiagnostics(rules, files);
    const meta = diags.filter(d => d.code === 'METADATA');
    expect(meta.length).toBeGreaterThanOrEqual(1);
  });
});

describe('runDiagnostics summary', () => {
  it('returns structured summary with totals by code and severity', () => {
    const rules = [
      makeRule('Try to write tests when possible', { line: 1 }),
      makeRule('Always use default exports', { line: 3 }),
      makeRule('Never use default exports', { line: 5 }),
    ];
    const result = runDiagnostics(rules, []);
    // Should have at least VAGUE (1) and CONFLICT (1)
    expect(result.length).toBeGreaterThanOrEqual(2);
    // Each diagnostic has the required shape
    for (const d of result) {
      expect(d).toHaveProperty('code');
      expect(d).toHaveProperty('severity');
      expect(d).toHaveProperty('message');
      expect(d).toHaveProperty('ruleText');
      expect(['warning', 'error']).toContain(d.severity);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp/alignkit && npx vitest run src/analyzers/__tests__/diagnostics.test.ts 2>&1 | tail -10`
Expected: FAIL -- cannot resolve `../diagnostics.js`

- [ ] **Step 3: Write the implementation**

Create `mcp/alignkit/src/analyzers/diagnostics.ts`:

```typescript
/**
 * Runs diagnostic checks on parsed instruction rules.
 *
 * Diagnostic codes:
 * - VAGUE: weasel words or hedging language
 * - CONFLICT: contradicting rules
 * - REDUNDANT: near-duplicate rules
 * - ORDERING: high-priority rules buried late
 * - PLACEMENT: rules that belong in a different mechanism
 * - WEAK_EMPHASIS: critical rules missing emphasis markers
 * - METADATA: malformed frontmatter in agent/skill files
 */

import type { ParsedRule, InstructionFile } from './discovery.js';

export type DiagnosticCode =
  | 'VAGUE'
  | 'CONFLICT'
  | 'REDUNDANT'
  | 'ORDERING'
  | 'PLACEMENT'
  | 'WEAK_EMPHASIS'
  | 'METADATA';

export type Severity = 'warning' | 'error';

export interface Diagnostic {
  code: DiagnosticCode;
  severity: Severity;
  message: string;
  ruleText: string;
  line: number;
  sourceFile: string;
  suggestion?: string;
  relatedRuleText?: string;
}

// --- VAGUE detection ---

const VAGUE_PATTERNS: RegExp[] = [
  /\btry to\b/i,
  /\bwhen possible\b/i,
  /\bgenerally\b/i,
  /\bconsider\b/i,
  /\bas needed\b/i,
  /\bshould probably\b/i,
  /\bwhere appropriate\b/i,
  /\bif applicable\b/i,
  /\bwhen appropriate\b/i,
  /\bideally\b/i,
  /\bpreferable\b/i,
];

function detectVague(rules: ParsedRule[]): Diagnostic[] {
  const results: Diagnostic[] = [];
  for (const rule of rules) {
    for (const pattern of VAGUE_PATTERNS) {
      if (pattern.test(rule.text)) {
        results.push({
          code: 'VAGUE',
          severity: 'warning',
          message: `Rule uses hedging language ("${rule.text.match(pattern)?.[0]}"): be specific about what to do and when`,
          ruleText: rule.text,
          line: rule.line,
          sourceFile: rule.sourceFile,
        });
        break; // One VAGUE per rule
      }
    }
  }
  return results;
}

// --- CONFLICT detection ---

function extractAction(text: string): string | null {
  // Normalize: strip emphasis markers, lowercase
  const normalized = text.replace(/\b(ALWAYS|NEVER|MUST|MUST NOT)\b/gi, '').trim().toLowerCase();
  // Extract the core verb + object: "use default exports" from "Always use default exports"
  const words = normalized.split(/\s+/).filter(w => w.length > 2);
  return words.slice(0, 5).join(' ') || null;
}

function detectConflicts(rules: ParsedRule[]): Diagnostic[] {
  const results: Diagnostic[] = [];
  const alwaysRules: Array<{ rule: ParsedRule; action: string }> = [];
  const neverRules: Array<{ rule: ParsedRule; action: string }> = [];

  for (const rule of rules) {
    const text = rule.text;
    if (/\balways\b/i.test(text)) {
      const action = extractAction(text);
      if (action) alwaysRules.push({ rule, action });
    }
    if (/\bnever\b/i.test(text) || /\bmust not\b/i.test(text) || /\bdon'?t\b/i.test(text)) {
      const action = extractAction(text);
      if (action) neverRules.push({ rule, action });
    }
  }

  for (const a of alwaysRules) {
    for (const n of neverRules) {
      // Check word overlap between the two actions
      const aWords = new Set(a.action.split(/\s+/));
      const nWords = new Set(n.action.split(/\s+/));
      const overlap = [...aWords].filter(w => nWords.has(w));
      const overlapRatio = overlap.length / Math.min(aWords.size, nWords.size);

      if (overlapRatio >= 0.6) {
        results.push({
          code: 'CONFLICT',
          severity: 'warning',
          message: `Potential conflict: "${a.rule.text}" vs "${n.rule.text}"`,
          ruleText: a.rule.text,
          relatedRuleText: n.rule.text,
          line: a.rule.line,
          sourceFile: a.rule.sourceFile,
        });
      }
    }
  }

  return results;
}

// --- REDUNDANT detection ---

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2);
}

function tokenOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter(w => setB.has(w));
  return intersection.length / Math.min(setA.size, setB.size);
}

function detectRedundant(rules: ParsedRule[]): Diagnostic[] {
  const results: Diagnostic[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const key = `${i}-${j}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const tokensA = tokenize(rules[i].text);
      const tokensB = tokenize(rules[j].text);
      const overlap = tokenOverlap(tokensA, tokensB);

      if (overlap >= 0.7) {
        results.push({
          code: 'REDUNDANT',
          severity: 'warning',
          message: `Redundant: "${rules[i].text}" and "${rules[j].text}" have ${Math.round(overlap * 100)}% overlap`,
          ruleText: rules[i].text,
          relatedRuleText: rules[j].text,
          line: rules[i].line,
          sourceFile: rules[i].sourceFile,
          suggestion: 'Merge into a single, stronger rule to save token budget',
        });
      }
    }
  }

  return results;
}

// --- ORDERING detection ---

const TOOL_CONSTRAINT_PATTERNS = [
  /\brun\b.*\b(vitest|jest|pytest|cargo test|go test|npm test|eslint|prettier|tsc)\b/i,
  /\bbefore\s+(committing|pushing|merging|deploying)\b/i,
  /\bafter\s+(editing|creating|modifying|deleting)\b/i,
];

const STYLE_PATTERNS = [
  /\b(camelCase|PascalCase|kebab-case|snake_case)\b/i,
  /\bindentation\b/i,
  /\bsemicolon/i,
  /\bquotes?\b/i,
];

function isToolConstraint(text: string): boolean {
  return TOOL_CONSTRAINT_PATTERNS.some(p => p.test(text));
}

function isStyleRule(text: string): boolean {
  return STYLE_PATTERNS.some(p => p.test(text));
}

function detectOrdering(rules: ParsedRule[]): Diagnostic[] {
  const results: Diagnostic[] = [];

  // Find tool constraints that appear after style rules
  let firstStyleLine = Infinity;
  for (const rule of rules) {
    if (isStyleRule(rule.text) && rule.line < firstStyleLine) {
      firstStyleLine = rule.line;
    }
  }

  for (const rule of rules) {
    if (isToolConstraint(rule.text) && rule.line > firstStyleLine) {
      results.push({
        code: 'ORDERING',
        severity: 'warning',
        message: `Tool constraint rule appears after style rules (line ${rule.line}). Move it earlier for higher priority.`,
        ruleText: rule.text,
        line: rule.line,
        sourceFile: rule.sourceFile,
        suggestion: 'Move tool constraints and process ordering rules to the top of the file',
      });
    }
  }

  return results;
}

// --- PLACEMENT detection ---

const SCOPED_RULE_PATTERNS = [
  /\bin test files?\b/i,
  /\bin component/i,
  /\bin (?:API |api )routes?\b/i,
  /\bfor \*\.test\./i,
  /\bfor test files/i,
];

const HOOK_PATTERNS = [
  /\balways run\b.+\bafter\b/i,
  /\balways run\b.+\bbefore\b/i,
  /\bautomatically\b/i,
  /\brun .+ after editing/i,
  /\brun .+ before committing/i,
];

function detectPlacement(rules: ParsedRule[]): Diagnostic[] {
  const results: Diagnostic[] = [];

  for (const rule of rules) {
    // Only flag rules in CLAUDE.md (not already in .claude/rules/)
    if (rule.sourceFile !== 'CLAUDE.md') continue;

    for (const pattern of SCOPED_RULE_PATTERNS) {
      if (pattern.test(rule.text)) {
        results.push({
          code: 'PLACEMENT',
          severity: 'warning',
          message: `Rule applies to specific file patterns and would be better in .claude/rules/ with a glob`,
          ruleText: rule.text,
          line: rule.line,
          sourceFile: rule.sourceFile,
          suggestion: 'Move to .claude/rules/ with an appropriate glob pattern to save CLAUDE.md token budget',
        });
        break;
      }
    }

    for (const pattern of HOOK_PATTERNS) {
      if (pattern.test(rule.text)) {
        // Don't double-report if already caught by scoped-rule
        if (!results.some(r => r.ruleText === rule.text && r.code === 'PLACEMENT')) {
          results.push({
            code: 'PLACEMENT',
            severity: 'warning',
            message: `Rule describes deterministic automation and would be better as a hook`,
            ruleText: rule.text,
            line: rule.line,
            sourceFile: rule.sourceFile,
            suggestion: 'Convert to a Claude Code hook (PreToolUse or PostToolUse) for guaranteed enforcement',
          });
        }
        break;
      }
    }
  }

  return results;
}

// --- WEAK_EMPHASIS detection ---

const EMPHASIS_MARKERS = /\b(MUST|NEVER|ALWAYS|IMPORTANT|CRITICAL|REQUIRED)\b/;

function detectWeakEmphasis(rules: ParsedRule[]): Diagnostic[] {
  const results: Diagnostic[] = [];

  for (const rule of rules) {
    if (isToolConstraint(rule.text) && !EMPHASIS_MARKERS.test(rule.text)) {
      results.push({
        code: 'WEAK_EMPHASIS',
        severity: 'warning',
        message: `High-priority rule lacks emphasis markers (MUST, NEVER, ALWAYS)`,
        ruleText: rule.text,
        line: rule.line,
        sourceFile: rule.sourceFile,
        suggestion: `Add emphasis: "${rule.text}" -> "ALWAYS ${rule.text.charAt(0).toLowerCase()}${rule.text.slice(1)}"`,
      });
    }
  }

  return results;
}

// --- METADATA detection ---

interface FrontmatterResult {
  hasFrontmatter: boolean;
  fields: Record<string, string>;
}

function parseFrontmatter(content: string): FrontmatterResult {
  const lines = content.split('\n');
  if (lines[0]?.trim() !== '---') {
    return { hasFrontmatter: false, fields: {} };
  }

  const fields: Record<string, string> = {};
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      return { hasFrontmatter: true, fields };
    }
    const match = lines[i].match(/^(\w[\w-]*)\s*:\s*(.+)$/);
    if (match) {
      fields[match[1]] = match[2].trim();
    }
  }

  return { hasFrontmatter: false, fields: {} }; // Unclosed frontmatter
}

function detectMetadata(files: InstructionFile[]): Diagnostic[] {
  const results: Diagnostic[] = [];

  for (const file of files) {
    if (file.type === 'agent') {
      const fm = parseFrontmatter(file.content);
      const requiredFields = ['name', 'description', 'model'];
      if (!fm.hasFrontmatter) {
        results.push({
          code: 'METADATA',
          severity: 'error',
          message: `Agent file "${file.relativePath}" is missing frontmatter (requires name, description, model)`,
          ruleText: '',
          line: 1,
          sourceFile: file.relativePath,
        });
      } else {
        for (const field of requiredFields) {
          if (!fm.fields[field]) {
            results.push({
              code: 'METADATA',
              severity: 'error',
              message: `Agent file "${file.relativePath}" is missing required frontmatter field: ${field}`,
              ruleText: '',
              line: 1,
              sourceFile: file.relativePath,
            });
          }
        }
      }
    }

    if (file.type === 'skill') {
      const fm = parseFrontmatter(file.content);
      const requiredFields = ['name', 'description'];
      if (!fm.hasFrontmatter) {
        results.push({
          code: 'METADATA',
          severity: 'error',
          message: `Skill file "${file.relativePath}" is missing frontmatter (requires name, description)`,
          ruleText: '',
          line: 1,
          sourceFile: file.relativePath,
        });
      } else {
        for (const field of requiredFields) {
          if (!fm.fields[field]) {
            results.push({
              code: 'METADATA',
              severity: 'error',
              message: `Skill file "${file.relativePath}" is missing required frontmatter field: ${field}`,
              ruleText: '',
              line: 1,
              sourceFile: file.relativePath,
            });
          }
        }
      }
    }
  }

  return results;
}

// --- Main entry point ---

export function runDiagnostics(rules: ParsedRule[], files: InstructionFile[]): Diagnostic[] {
  return [
    ...detectVague(rules),
    ...detectConflicts(rules),
    ...detectRedundant(rules),
    ...detectOrdering(rules),
    ...detectPlacement(rules),
    ...detectWeakEmphasis(rules),
    ...detectMetadata(files),
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mcp/alignkit && npx vitest run src/analyzers/__tests__/diagnostics.test.ts 2>&1 | tail -20`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add mcp/alignkit/src/analyzers/diagnostics.ts mcp/alignkit/src/analyzers/__tests__/diagnostics.test.ts
git commit -m "feat(alignkit): add lint diagnostic analyzer with 7 diagnostic codes"
```

---

### Task 4: Build conformance check analyzer

**Files:**
- Create: `mcp/alignkit/src/analyzers/conformance.ts`
- Test: `mcp/alignkit/src/analyzers/__tests__/conformance.test.ts`

This analyzer classifies each rule by type and runs verifiable checks against the codebase using glob/grep patterns.

- [ ] **Step 1: Write the failing test**

Create `mcp/alignkit/src/analyzers/__tests__/conformance.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { classifyRule, checkConformance, type RuleVerdict } from '../conformance.js';
import type { ParsedRule } from '../discovery.js';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';

const TMP_DIR = join(import.meta.dirname, '..', '..', '..', '__test-tmp-conformance');

function makeRule(text: string, overrides: Partial<ParsedRule> = {}): ParsedRule {
  return {
    text,
    section: null,
    line: 1,
    sourceFile: 'CLAUDE.md',
    ...overrides,
  };
}

function setupFixture() {
  rmSync(TMP_DIR, { recursive: true, force: true });
  mkdirSync(join(TMP_DIR, 'src', 'utils'), { recursive: true });
  mkdirSync(join(TMP_DIR, 'src', 'services'), { recursive: true });
  mkdirSync(join(TMP_DIR, 'src', 'components'), { recursive: true });
  mkdirSync(join(TMP_DIR, 'tests'), { recursive: true });

  // Source files with named exports (no default exports)
  writeFileSync(join(TMP_DIR, 'src', 'utils', 'helpers.ts'), [
    'export function slugify(text: string): string {',
    '  return text.toLowerCase().replace(/\\s+/g, "-");',
    '}',
    '',
    'export function truncate(text: string, max: number): string {',
    '  return text.length > max ? text.slice(0, max) + "..." : text;',
    '}',
  ].join('\n'));

  writeFileSync(join(TMP_DIR, 'src', 'services', 'user-service.ts'), [
    'export class UserService {',
    '  async getUser(id: string) {',
    '    return { id, name: "Alice" };',
    '  }',
    '}',
  ].join('\n'));

  // A component WITH a default export (violation for "no default exports")
  writeFileSync(join(TMP_DIR, 'src', 'components', 'Button.tsx'), [
    'const Button = () => <button>Click</button>;',
    'export default Button;',
  ].join('\n'));

  // Test file in correct location (co-located)
  writeFileSync(join(TMP_DIR, 'src', 'utils', 'helpers.test.ts'), [
    'import { describe, it, expect } from "vitest";',
    'import { slugify } from "./helpers";',
    '',
    'describe("slugify", () => {',
    '  it("converts spaces to hyphens", () => {',
    '    expect(slugify("hello world")).toBe("hello-world");',
    '  });',
    '});',
  ].join('\n'));

  // Test file in wrong location (NOT co-located)
  writeFileSync(join(TMP_DIR, 'tests', 'user-service.test.ts'), [
    'import { describe, it, expect } from "vitest";',
    '',
    'describe("UserService", () => {',
    '  it("exists", () => {',
    '    expect(true).toBe(true);',
    '  });',
    '});',
  ].join('\n'));

  // tsconfig with strict mode
  writeFileSync(join(TMP_DIR, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      strict: true,
      target: 'ES2022',
      module: 'NodeNext',
    },
  }, null, 2));

  // package.json
  writeFileSync(join(TMP_DIR, 'package.json'), JSON.stringify({
    name: 'test-project',
    devDependencies: { vitest: '^3.0.0' },
  }, null, 2));
}

function cleanupFixture() {
  rmSync(TMP_DIR, { recursive: true, force: true });
}

describe('classifyRule', () => {
  it('classifies file structure rules', () => {
    expect(classifyRule('Place test files next to source files')).toBe('file-structure');
  });

  it('classifies import/dependency rules', () => {
    expect(classifyRule('Use absolute imports for all source files')).toBe('import-dependency');
  });

  it('classifies tool constraint rules', () => {
    expect(classifyRule('Run vitest run before committing')).toBe('tool-constraint');
  });

  it('classifies naming convention rules', () => {
    expect(classifyRule('Use PascalCase for React components')).toBe('naming');
  });

  it('classifies architecture boundary rules', () => {
    expect(classifyRule('Components must not import from db/ directly')).toBe('architecture');
  });

  it('classifies config requirement rules', () => {
    expect(classifyRule('Use strict TypeScript mode')).toBe('config');
  });

  it('classifies style/behavioral rules as unverifiable', () => {
    expect(classifyRule('Write clean, readable code')).toBe('style');
  });
});

describe('checkConformance', () => {
  beforeAll(() => setupFixture());
  afterAll(() => cleanupFixture());

  it('checks config rules against real config files', async () => {
    const rules = [makeRule('Use strict TypeScript mode')];
    const results = await checkConformance(rules, TMP_DIR);
    expect(results).toHaveLength(1);
    expect(results[0].verdict).toBe('conforms');
    expect(results[0].evidence).toContain('strict');
  });

  it('marks style rules as unverifiable', async () => {
    const rules = [makeRule('Write clean, readable code')];
    const results = await checkConformance(rules, TMP_DIR);
    expect(results).toHaveLength(1);
    expect(results[0].verdict).toBe('unverifiable');
  });

  it('detects import pattern violations via grep', async () => {
    const rules = [makeRule('Never use default exports')];
    const results = await checkConformance(rules, TMP_DIR);
    expect(results).toHaveLength(1);
    expect(results[0].verdict).toBe('violates');
    expect(results[0].evidence).toContain('Button.tsx');
  });

  it('returns evidence for each checked rule', async () => {
    const rules = [makeRule('Use strict TypeScript mode')];
    const results = await checkConformance(rules, TMP_DIR);
    expect(results[0]).toHaveProperty('text');
    expect(results[0]).toHaveProperty('verdict');
    expect(results[0]).toHaveProperty('evidence');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp/alignkit && npx vitest run src/analyzers/__tests__/conformance.test.ts 2>&1 | tail -10`
Expected: FAIL -- cannot resolve `../conformance.js`

- [ ] **Step 3: Write the implementation**

Create `mcp/alignkit/src/analyzers/conformance.ts`:

```typescript
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
import { globby } from 'globby';

import type { ParsedRule } from './discovery.js';

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
  const files = await globby(fileGlob, { cwd, ignore: IGNORE_PATTERNS, absolute: false });
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
    const testFiles = await globby(['**/*.test.*', '**/*.spec.*'], {
      cwd,
      ignore: IGNORE_PATTERNS,
      absolute: false,
    });
    const sourceFiles = await globby(['**/*.{ts,tsx,js,jsx}'], {
      cwd,
      ignore: [...IGNORE_PATTERNS, '**/*.test.*', '**/*.spec.*', '**/*.d.ts'],
      absolute: false,
    });

    const misplaced: string[] = [];
    for (const testFile of testFiles) {
      const dir = testFile.replace(/[^/]+$/, '');
      // A test is "co-located" if there's a source file in the same directory
      const hasAdjacentSource = sourceFiles.some(sf => sf.startsWith(dir) && !sf.includes('/'));
      if (!hasAdjacentSource && !testFile.startsWith('src/')) {
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mcp/alignkit && npx vitest run src/analyzers/__tests__/conformance.test.ts 2>&1 | tail -15`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add mcp/alignkit/src/analyzers/conformance.ts mcp/alignkit/src/analyzers/__tests__/conformance.test.ts
git commit -m "feat(alignkit): add conformance check analyzer with rule classification"
```

---

### Task 5: Build MCP server with 3 tools

**Files:**
- Modify: `mcp/alignkit/src/mcp/server.ts`
- Create: `mcp/alignkit/src/mcp/tools/lint.ts`
- Create: `mcp/alignkit/src/mcp/tools/check.ts`
- Create: `mcp/alignkit/src/mcp/tools/status.ts`

- [ ] **Step 1: Create the lint tool**

Create `mcp/alignkit/src/mcp/tools/lint.ts`:

```typescript
/**
 * alignkit_local_lint -- Static instruction quality analysis.
 *
 * Discovers instruction files, parses rules, runs diagnostics,
 * and returns structured results.
 */

import { discoverInstructionFiles, parseRules, type InstructionFile, type ParsedRule } from '../../analyzers/discovery.js';
import { runDiagnostics, type Diagnostic, type DiagnosticCode, type Severity } from '../../analyzers/diagnostics.js';

export interface LintResult {
  files: Array<{
    path: string;
    type: string;
    ruleCount: number;
  }>;
  rules: ParsedRule[];
  diagnostics: Diagnostic[];
  summary: {
    totalFiles: number;
    totalRules: number;
    totalDiagnostics: number;
    byCode: Record<string, number>;
    bySeverity: Record<Severity, number>;
  };
}

export async function lintTool(args: { file?: string }, cwd: string): Promise<LintResult> {
  const instructionFiles = await discoverInstructionFiles(cwd);

  if (instructionFiles.length === 0) {
    return {
      files: [],
      rules: [],
      diagnostics: [],
      summary: {
        totalFiles: 0,
        totalRules: 0,
        totalDiagnostics: 0,
        byCode: {},
        bySeverity: { warning: 0, error: 0 },
      },
    };
  }

  // If a specific file was requested, filter to it
  const filesToAnalyze = args.file
    ? instructionFiles.filter(f => f.relativePath === args.file || f.absolutePath === args.file)
    : instructionFiles;

  if (filesToAnalyze.length === 0 && args.file) {
    return {
      files: [],
      rules: [],
      diagnostics: [],
      summary: {
        totalFiles: 0,
        totalRules: 0,
        totalDiagnostics: 0,
        byCode: {},
        bySeverity: { warning: 0, error: 0 },
      },
    };
  }

  // Parse rules from all files
  const allRules: ParsedRule[] = [];
  for (const file of filesToAnalyze) {
    const rules = parseRules(file.content, file.relativePath);
    allRules.push(...rules);
  }

  // Run diagnostics
  const diagnostics = runDiagnostics(allRules, filesToAnalyze);

  // Build summary
  const byCode: Record<string, number> = {};
  const bySeverity: Record<Severity, number> = { warning: 0, error: 0 };

  for (const diag of diagnostics) {
    byCode[diag.code] = (byCode[diag.code] ?? 0) + 1;
    bySeverity[diag.severity]++;
  }

  return {
    files: filesToAnalyze.map(f => ({
      path: f.relativePath,
      type: f.type,
      ruleCount: allRules.filter(r => r.sourceFile === f.relativePath).length,
    })),
    rules: allRules,
    diagnostics,
    summary: {
      totalFiles: filesToAnalyze.length,
      totalRules: allRules.length,
      totalDiagnostics: diagnostics.length,
      byCode,
      bySeverity,
    },
  };
}
```

- [ ] **Step 2: Create the check tool**

Create `mcp/alignkit/src/mcp/tools/check.ts`:

```typescript
/**
 * alignkit_local_check -- Conformance checking (no session history).
 *
 * For each instruction rule, classifies by type and runs verifiable
 * checks against the codebase. Returns structured verdicts with evidence.
 */

import { discoverInstructionFiles, parseRules, type ParsedRule } from '../../analyzers/discovery.js';
import { checkConformance, type RuleVerdict } from '../../analyzers/conformance.js';

export interface CheckResult {
  rules: RuleVerdict[];
  summary: {
    totalRules: number;
    conforms: number;
    violates: number;
    unverifiable: number;
  };
}

export async function checkTool(args: { file?: string }, cwd: string): Promise<CheckResult> {
  const instructionFiles = await discoverInstructionFiles(cwd);

  if (instructionFiles.length === 0) {
    return {
      rules: [],
      summary: { totalRules: 0, conforms: 0, violates: 0, unverifiable: 0 },
    };
  }

  // If a specific file was requested, filter to it
  const filesToAnalyze = args.file
    ? instructionFiles.filter(f => f.relativePath === args.file || f.absolutePath === args.file)
    : instructionFiles;

  // Parse rules from all files
  const allRules: ParsedRule[] = [];
  for (const file of filesToAnalyze) {
    const rules = parseRules(file.content, file.relativePath);
    allRules.push(...rules);
  }

  // Run conformance checks
  const verdicts = await checkConformance(allRules, cwd);

  // Build summary
  const summary = {
    totalRules: verdicts.length,
    conforms: verdicts.filter(v => v.verdict === 'conforms').length,
    violates: verdicts.filter(v => v.verdict === 'violates').length,
    unverifiable: verdicts.filter(v => v.verdict === 'unverifiable').length,
  };

  return { rules: verdicts, summary };
}
```

- [ ] **Step 3: Create the status tool**

Create `mcp/alignkit/src/mcp/tools/status.ts`:

```typescript
/**
 * alignkit_local_status -- Quick summary combining lint + check counts.
 */

import { lintTool } from './lint.js';
import { checkTool } from './check.js';

export interface StatusResult {
  instructionFiles: number;
  totalRules: number;
  lintIssues: number;
  lintErrors: number;
  lintWarnings: number;
  conformance: {
    conforms: number;
    violates: number;
    unverifiable: number;
  };
  quickSummary: string;
}

export async function statusTool(cwd: string): Promise<StatusResult> {
  const [lintResult, checkResult] = await Promise.all([
    lintTool({}, cwd),
    checkTool({}, cwd),
  ]);

  const parts: string[] = [];
  parts.push(`${lintResult.summary.totalFiles} instruction file(s), ${lintResult.summary.totalRules} rule(s)`);
  parts.push(`Lint: ${lintResult.summary.totalDiagnostics} issue(s) (${lintResult.summary.bySeverity.error} errors, ${lintResult.summary.bySeverity.warning} warnings)`);
  parts.push(`Conformance: ${checkResult.summary.conforms} conform, ${checkResult.summary.violates} violate, ${checkResult.summary.unverifiable} unverifiable`);

  return {
    instructionFiles: lintResult.summary.totalFiles,
    totalRules: lintResult.summary.totalRules,
    lintIssues: lintResult.summary.totalDiagnostics,
    lintErrors: lintResult.summary.bySeverity.error,
    lintWarnings: lintResult.summary.bySeverity.warning,
    conformance: {
      conforms: checkResult.summary.conforms,
      violates: checkResult.summary.violates,
      unverifiable: checkResult.summary.unverifiable,
    },
    quickSummary: parts.join(' | '),
  };
}
```

- [ ] **Step 4: Write the MCP server**

Replace `mcp/alignkit/src/mcp/server.ts` with:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { lintTool } from './tools/lint.js';
import { checkTool } from './tools/check.js';
import { statusTool } from './tools/status.js';

const server = new McpServer({
  name: 'alignkit-local',
  version: '0.1.0',
});

const cwd = process.cwd();

server.tool(
  'alignkit_local_lint',
  'Static instruction quality analysis. Discovers instruction files (CLAUDE.md, .claude/rules/*, .claude/agents/*, .claude/skills/*), parses rules, and runs diagnostics: VAGUE, CONFLICT, REDUNDANT, ORDERING, PLACEMENT, WEAK_EMPHASIS, METADATA. Returns structured JSON with file list, diagnostics, and summary counts.',
  {
    file: z.string().optional().describe(
      'Path to a specific instruction file to analyze. If omitted, discovers and analyzes all instruction files in the project.'
    ),
  },
  async (args) => {
    try {
      const result = await lintTool({ file: args.file }, cwd);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  }
);

server.tool(
  'alignkit_local_check',
  'Conformance check: for each instruction rule, classifies by type (file structure, import-dependency, tool constraint, naming, architecture, config, style) and runs verifiable checks against the codebase using Glob/Grep. Returns verdicts (conforms/violates/unverifiable) with specific evidence.',
  {
    file: z.string().optional().describe(
      'Path to a specific instruction file to check. If omitted, discovers and checks all instruction files.'
    ),
  },
  async (args) => {
    try {
      const result = await checkTool({ file: args.file }, cwd);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  }
);

server.tool(
  'alignkit_local_status',
  'Quick instruction health summary combining lint issue counts and conformance check counts into a single overview.',
  {},
  async () => {
    try {
      const result = await statusTool(cwd);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('alignkit-local-mcp server failed to start:', error);
  process.exit(1);
});
```

- [ ] **Step 5: Build and verify compilation**

Run: `cd mcp/alignkit && npx tsc`
Expected: Clean compilation, `dist/` directory created with all files

- [ ] **Step 6: Run all analyzer tests to verify nothing broke**

Run: `cd mcp/alignkit && npx vitest run 2>&1 | tail -20`
Expected: All tests pass (discovery, diagnostics, conformance)

- [ ] **Step 7: Commit**

```bash
git add mcp/alignkit/src/mcp/server.ts mcp/alignkit/src/mcp/tools/lint.ts mcp/alignkit/src/mcp/tools/check.ts mcp/alignkit/src/mcp/tools/status.ts
git commit -m "feat(alignkit): add MCP server with lint, check, and status tools"
```

---

### Task 6: Register alignkit-local in .mcp.json

**Files:**
- Modify: `.mcp.json`

- [ ] **Step 1: Update .mcp.json to add alignkit-local**

In `.mcp.json`, add the `alignkit-local` entry alongside the existing `alignkit` entry. The existing `alignkit` entry (external npx) stays for session-based adherence tracking. The new `alignkit-local` entry points to the bundled server.

Replace the entire contents of `.mcp.json` with:

```json
{
  "mcpServers": {
    "testkit": {
      "command": "node",
      "args": ["mcp/testkit/dist/mcp/server.js"]
    },
    "shieldkit": {
      "command": "node",
      "args": ["mcp/shieldkit/dist/mcp/server.js"]
    },
    "lenskit": {
      "command": "node",
      "args": ["mcp/lenskit/dist/mcp/server.js"]
    },
    "timewarp": {
      "command": "node",
      "args": ["mcp/timewarp/dist/mcp/server.js"]
    },
    "alignkit": {
      "command": "npx",
      "args": ["-y", "alignkit-mcp"]
    },
    "alignkit-local": {
      "command": "node",
      "args": ["mcp/alignkit/dist/mcp/server.js"]
    }
  }
}
```

- [ ] **Step 2: Verify the server starts**

Run: `cd $(git rev-parse --show-toplevel) && echo '{}' | node mcp/alignkit/dist/mcp/server.js 2>&1 & sleep 1 && kill %1 2>/dev/null; echo "Server started successfully"`

Expected: No crash errors. The server starts and waits for stdio input.

- [ ] **Step 3: Update root package.json to include alignkit**

If a root `package.json` exists (created by Phase 0), add alignkit to the test and build scripts. If it does not exist yet, create it.

Add these scripts to the existing root `package.json`:
- `"test:alignkit": "cd mcp/alignkit && npx vitest run"`
- `"build:alignkit": "cd mcp/alignkit && npm run build"`

Update the aggregate `test` and `build` scripts to include the new entries.

- [ ] **Step 4: Commit**

```bash
git add .mcp.json
git commit -m "feat: register alignkit-local MCP server in .mcp.json"
```

---

### Task 7: Fix /discover skill content

**Files:**
- Modify: `skills/discover/SKILL.md`

- [ ] **Step 1: Update the evidence threshold to tiered approach**

In `skills/discover/SKILL.md`, find the Guidelines section and replace the 80% threshold with the tiered approach that matches the reference file.

Find this text:

```
- **Evidence threshold**: Only report conventions with strong evidence (pattern appears in
  80%+ of relevant files). Weak patterns are noise, not conventions.
```

Replace with:

```
- **Evidence threshold** -- use a tiered approach:
  - **90%+ consistency**: Strong convention, high-confidence rule. Include with full confidence.
  - **70-89% consistency**: Likely convention with exceptions. Include but explicitly note the
    exceptions found and whether they appear intentional.
  - **Below 70%**: Not a convention -- do not report it. This is noise, not signal.
```

- [ ] **Step 2: Add guidance for projects with no existing CLAUDE.md**

In `skills/discover/SKILL.md`, find the "### 6. Offer to Apply" section. Immediately before that section, add a new section:

Find this text:

```
### 6. Offer to Apply
```

Insert before it:

```
### Handling Special Cases

**Projects with no existing CLAUDE.md:**
When no instruction files exist, this is a greenfield opportunity. Focus on the highest-value
conventions first:
1. Architecture boundaries (import restrictions, layer separation)
2. Error handling patterns (consistent shapes, validation approaches)
3. Testing conventions (framework, file location, assertion style)

After presenting discoveries, offer to create a new CLAUDE.md with the selected rules
organized by category. Use this structure:
```
# Project Instructions

## Architecture
{architecture boundary rules}

## Code Style
{naming, import, export rules}

## Testing
{test framework, file location, assertion rules}

## Workflow
{tool constraints, process rules}
```

**Small projects (fewer than 8 source files):**
Reduce sampling -- read all source files instead of a sample. Adjust evidence thresholds
downward since the sample IS the population:
- 100% consistency: Strong convention (all files follow it)
- 75%+ consistency: Likely convention (most files follow it)
- Below 75%: Not enough evidence with such a small sample

Note to the user: "This is a small project -- conventions may solidify as it grows.
These rules reflect what exists now."

```

- [ ] **Step 3: Verify the file is valid markdown**

Run: `wc -l skills/discover/SKILL.md`
Expected: Line count increased from 174 to approximately 210-215

- [ ] **Step 4: Commit**

```bash
git add skills/discover/SKILL.md
git commit -m "fix(discover): reconcile threshold with tiered approach, add greenfield and small project guidance"
```

---

### Task 8: Fix /lint skill content

**Files:**
- Modify: `skills/lint/SKILL.md`

- [ ] **Step 1: Rewrite the manual fallback to be self-contained**

In `skills/lint/SKILL.md`, find the manual fallback section and replace it with a fully self-contained version.

Find this text:

```
**If `alignkit_lint` is unavailable** (MCP server not running or alignkit not installed),
perform manual analysis instead:

1. Find instruction files using Glob: `**/CLAUDE.md`, `.claude/rules/**/*.md`, etc.
2. Read each file and parse rules (lines starting with `-` or numbered items under headings)
3. Collect project context: read `package.json` for dependencies, `tsconfig.json` for config,
   list top-level directories for structure
4. Apply the analysis methodology from steps 2-5 below using this manually gathered data
5. Note to the user: "Running without alignkit — token counts are estimated. Install
   alignkit (`npm install -g alignkit`) for precise analysis and adherence tracking via `/check`."
```

Replace with:

```
**If `alignkit_lint` is unavailable** (MCP server not running or tool call fails),
perform manual analysis instead. This fallback is fully self-contained:

1. **Find instruction files** using Glob:
   - `CLAUDE.md` (project root)
   - `.claude/rules/**/*.md`
   - `.claude/agents/**/*.md`
   - `.claude/skills/**/SKILL.md`

2. **Read each file and parse rules**: lines starting with `-`, `*`, or `N.` under headings.
   Count total rules. Strip YAML frontmatter (between `---` markers) before parsing.

3. **Collect project context**: read `package.json` (dependencies, scripts), `tsconfig.json`
   (strict mode, path aliases), and list top-level directories using Glob.

4. **Run manual diagnostics** on each rule:
   - **VAGUE**: Flag rules containing "try to", "when possible", "generally", "consider",
     "as needed", "should probably". Suggest concrete rewrites.
   - **CONFLICT**: Scan for "always X" paired with "never X" where X overlaps. Note false
     positives from different scopes.
   - **REDUNDANT**: Flag pairs of rules with >70% word overlap. Suggest merges with token savings.
   - **ORDERING**: Flag tool constraints (run X before Y) appearing after style rules. Suggest
     moving them earlier.
   - **PLACEMENT**: Flag rules in CLAUDE.md that mention specific file patterns (belong in
     `.claude/rules/`) or describe automation (belong as hooks).
   - **WEAK_EMPHASIS**: Flag tool constraints missing MUST/NEVER/ALWAYS markers.
   - **METADATA**: Check agent files for required frontmatter (name, description, model) and
     skill files for required frontmatter (name, description).

5. **Estimate token count**: Roughly 1 token per 4 characters. Calculate total across all
   instruction files. Context window percentage = tokens / 200000 * 100.

6. Proceed to steps 2-5 below (Deep Effectiveness, Coverage Gaps, Consolidation) using the
   manually gathered project context.

7. Note to the user: "Running without alignkit MCP server -- token counts are estimated.
   For precise token counting and session-based adherence tracking via `/check`, ensure the
   alignkit MCP server is running."

**If `alignkit_lint` returns an error or empty result**, check:
- Whether any instruction files exist (suggest creating CLAUDE.md if none)
- Whether the `file` argument path is correct
- Fall back to manual analysis above if the tool is non-functional
```

- [ ] **Step 2: Add multi-file report guidance**

In `skills/lint/SKILL.md`, find the section "### 2. Present the Issues Summary". After the report format code block and before "Then list each diagnostic", add multi-file guidance.

Find this text:

```
Then list each diagnostic with the specific rule text and actionable guidance.
```

Replace with:

```
**When multiple instruction files are found**, present a per-file summary first:

```
### Files Analyzed

| File | Rules | Issues |
|------|-------|--------|
| CLAUDE.md | 12 | 3 |
| .claude/rules/test-patterns.md | 4 | 1 |
| .claude/agents/reviewer.md | 2 | 0 |
```

Then list each diagnostic with the specific rule text and actionable guidance.
```

- [ ] **Step 3: Add error handling guidance**

In `skills/lint/SKILL.md`, at the end of the "## Guidelines" section (before "## Related Skills"), add:

Find this text:

```
## Related Skills

- **`/discover`** — Use to find conventions in the codebase that should become rules
- **`/check`** — Use to verify whether the rules are actually being followed
```

Replace with:

```
- Handle tool call edge cases:
  - **Error response**: Report the error to the user and fall back to manual analysis
  - **Empty result (zero files)**: The project has no instruction files -- suggest creating
    a CLAUDE.md and offer to run `/discover` to find conventions to populate it
  - **Tool not found**: The MCP server is not running -- fall back to manual analysis

## Related Skills

- **`/discover`** -- Use to find conventions in the codebase that should become rules
- **`/check`** -- Use to verify whether the rules are actually being followed
```

- [ ] **Step 4: Update the allowed-tools list to include alignkit_local_lint**

In `skills/lint/SKILL.md`, find the frontmatter and add the local tool.

Find this text:

```
allowed-tools:
  - mcp__alignkit__alignkit_lint
  - Read
  - Glob
  - Grep
```

Replace with:

```
allowed-tools:
  - mcp__alignkit__alignkit_lint
  - mcp__alignkit_local__alignkit_local_lint
  - Read
  - Glob
  - Grep
```

- [ ] **Step 5: Update step 1 to try local tool first**

In `skills/lint/SKILL.md`, find:

```
Call the `alignkit_lint` tool. Pass the `file` argument if the user specified one; otherwise
omit it for auto-discovery of instruction files.

If no instruction files are found, explain that the project has no CLAUDE.md or similar
files and suggest creating one.
```

Replace with:

```
Call the `alignkit_local_lint` tool first (bundled, no external dependency). If unavailable,
fall back to `alignkit_lint` (external). Pass the `file` argument if the user specified one;
otherwise omit it for auto-discovery of instruction files.

If no instruction files are found, explain that the project has no CLAUDE.md or similar
files and suggest creating one. Offer to run `/discover` to find conventions.
```

- [ ] **Step 6: Verify the file structure is valid**

Run: `wc -l skills/lint/SKILL.md`
Expected: Line count increased from 174 to approximately 220-230

- [ ] **Step 7: Commit**

```bash
git add skills/lint/SKILL.md
git commit -m "fix(lint): rewrite manual fallback to be self-contained, add multi-file and error handling guidance"
```

---

### Task 9: Fix /check skill content

**Files:**
- Modify: `skills/check/SKILL.md`

- [ ] **Step 1: Replace "run /check again" with prioritized batch approach**

In `skills/check/SKILL.md`, find the text about batching unresolved rules.

Find this text:

```
If more than 8 unresolved rules exist, note the remainder: "{N} additional unresolved rules —
run `/check` again for next batch."
```

Replace with:

```
If more than 8 unresolved rules exist, prioritize the 8 highest-impact unresolved rules
(those with the most associated session action data). Note the remainder: "{N} additional
unresolved rules not evaluated in this pass -- these had less session evidence available."
Do not tell the user to run `/check` again for more. The 8 with the most evidence are the
most meaningful to evaluate.
```

- [ ] **Step 2: Add explicit alignkit_local_status usage in Step 5**

In `skills/check/SKILL.md`, find the Step 5 section.

Find this text:

```
### 5. Trend (When Available)

If the data warrants it, call `alignkit_status` and include a trend line:

```
**Trend:** {up|down|stable} over {sessionCount} sessions
```

Only include when 5+ sessions exist and the trend is meaningful.
```

Replace with:

```
### 5. Trend (When Available)

Call `alignkit_status` (or `alignkit_local_status` if using the local server) to get summary
data. Include a trend line when the data warrants it:

```
**Trend:** {up|down|stable} over {sessionCount} sessions
```

Only include when 5+ sessions exist and the trend is **meaningful**: at least 10 percentage
points change over 5+ sessions. A shift from 72% to 74% over 6 sessions is "stable", not
"up". A shift from 65% to 78% over 5 sessions is genuinely "up".

For conformance-only mode (no session history), call `alignkit_local_status` and report the
current lint + conformance snapshot instead of a trend.
```

- [ ] **Step 3: Update allowed-tools to include local tools**

In `skills/check/SKILL.md`, find the frontmatter:

Find this text:

```
allowed-tools:
  - mcp__alignkit__alignkit_check
  - mcp__alignkit__alignkit_status
  - Read
  - Glob
  - Grep
```

Replace with:

```
allowed-tools:
  - mcp__alignkit__alignkit_check
  - mcp__alignkit__alignkit_status
  - mcp__alignkit_local__alignkit_local_check
  - mcp__alignkit_local__alignkit_local_status
  - Read
  - Glob
  - Grep
```

- [ ] **Step 4: Update step 1 to prefer local tool**

In `skills/check/SKILL.md`, find:

```
Call the `alignkit_check` tool. Pass the `file` argument if the user specified one; otherwise
omit it for auto-discovery. Optionally pass `since_days` to narrow the analysis window.

**If `alignkit_check` is unavailable** (MCP server not running or alignkit not installed),
perform a **conformance check** instead — verify whether the codebase currently complies
with each rule by reading the code directly.
```

Replace with:

```
Call `alignkit_local_check` first (bundled, conformance-only). For session-based adherence
tracking, also call `alignkit_check` if available. Pass the `file` argument if the user
specified one; otherwise omit it for auto-discovery. Optionally pass `since_days` to
`alignkit_check` to narrow the analysis window.

**If neither tool is available**, perform a **manual conformance check** -- verify whether
the codebase currently complies with each rule by reading the code directly.
```

- [ ] **Step 5: Verify the file structure is valid**

Run: `wc -l skills/check/SKILL.md`
Expected: Line count increased from 200 to approximately 215-220

- [ ] **Step 6: Commit**

```bash
git add skills/check/SKILL.md
git commit -m "fix(check): replace batch-next with priority approach, add local tool usage, define meaningful trend"
```

---

### Task 10: Fix instruction-advisor agent

**Files:**
- Modify: `agents/instruction-advisor.md`

- [ ] **Step 1: Add Bash to tools list**

In `agents/instruction-advisor.md`, find the tools list in the frontmatter:

Find this text:

```
tools:
  - mcp__alignkit__alignkit_lint
  - mcp__alignkit__alignkit_check
  - mcp__alignkit__alignkit_status
  - Read
  - Glob
  - Grep
```

Replace with:

```
tools:
  - mcp__alignkit__alignkit_lint
  - mcp__alignkit__alignkit_check
  - mcp__alignkit__alignkit_status
  - mcp__alignkit_local__alignkit_local_lint
  - mcp__alignkit_local__alignkit_local_check
  - mcp__alignkit_local__alignkit_local_status
  - Read
  - Glob
  - Grep
  - Bash
```

- [ ] **Step 2: Add MCP fallback procedure**

In `agents/instruction-advisor.md`, find Phase 2:

Find this text:

```
### Phase 2: Static Quality Analysis

Call `alignkit_lint` to get structured diagnostic data for the primary instruction file.
Analyze the results:
```

Replace with:

```
### Phase 2: Static Quality Analysis

Call `alignkit_local_lint` first (bundled server, no external dependency). If unavailable,
fall back to `alignkit_lint` (external server). If neither tool is available, perform manual
lint analysis:

1. Find instruction files using Glob: `CLAUDE.md`, `.claude/rules/**/*.md`, `.claude/agents/**/*.md`, `.claude/skills/**/SKILL.md`
2. Read each file and parse rules (lines starting with `-`, `*`, or `N.` under headings). Strip YAML frontmatter first.
3. Collect project context: read `package.json` for dependencies, `tsconfig.json` for config, list top-level directories.
4. Run manual diagnostics on each rule:
   - **VAGUE**: "try to", "when possible", "generally", "consider", "as needed"
   - **CONFLICT**: "always X" paired with "never X" where X overlaps
   - **REDUNDANT**: >70% word overlap between two rules
   - **ORDERING**: tool constraints appearing after style rules
   - **PLACEMENT**: file-pattern rules in CLAUDE.md (belong in .claude/rules/) or automation rules (belong as hooks)
   - **WEAK_EMPHASIS**: tool constraints missing MUST/NEVER/ALWAYS markers
   - **METADATA**: agent/skill files missing required frontmatter fields

The primary instruction file is the project root `CLAUDE.md` (or the single instruction file
if only one exists). When multiple files exist, analyze all of them but present `CLAUDE.md`
as the primary with others as supplementary.

Analyze the results:
```

- [ ] **Step 3: Add Phase 5 guardrails from discover skill**

In `agents/instruction-advisor.md`, find Phase 5:

Find this text:

```
### Phase 5: Convention Discovery

Go beyond coverage gaps — actively reverse-engineer conventions from the codebase. Sample
8-12 source files across the project and identify consistent patterns: import styles, naming
conventions, error handling, API shapes, data access patterns, architecture boundaries.

For each discovered convention that isn't already documented:
1. Describe the pattern with evidence (file counts, specific paths)
2. Draft a paste-ready rule
3. Note any exceptions

This phase often produces the highest-value findings — conventions the developer follows
unconsciously but hasn't documented.
```

Replace with:

```
### Phase 5: Convention Discovery

Go beyond coverage gaps -- actively reverse-engineer conventions from the codebase. Sample
8-12 source files across the project and identify consistent patterns: import styles, naming
conventions, error handling, API shapes, data access patterns, architecture boundaries.

For each discovered convention that isn't already documented:
1. Describe the pattern with evidence (file counts, specific paths)
2. Draft a paste-ready rule
3. Note any exceptions

**Value filtering -- apply before including any convention:**

Before including a convention, ask: "If Claude violated this, would it cause a real problem?"

- **High value**: Violations cause bugs, inconsistency, or architectural damage. Architecture
  boundaries, security patterns, API contracts, import conventions affecting build/tooling.
  Always include these.
- **Medium value**: Violations cause inconsistency but not breakage. Naming conventions,
  type organization, export style. Include but mark as medium.
- **Low value -- OMIT**: Patterns Claude would follow anyway from reading existing code
  (function vs arrow syntax, logging format). Also omit implementation details and patterns
  that might be gaps rather than intentional choices.

**Aim for 8-12 high/medium conventions, not 17+ with filler.** Fewer, stronger rules are
more valuable than a comprehensive list that dilutes signal.

**Evidence threshold** -- use a tiered approach:
- 90%+ consistency: Strong convention, high-confidence rule
- 70-89% consistency: Likely convention with exceptions -- note the exceptions
- Below 70%: Not a convention, do not report

This phase often produces the highest-value findings -- conventions the developer follows
unconsciously but hasn't documented.
```

- [ ] **Step 4: Add "primary instruction file" definition to Phase 4**

In `agents/instruction-advisor.md`, find Phase 4:

Find this text:

```
### Phase 4: Adherence Analysis

Call `alignkit_check` to get session history adherence data. Analyze:
```

Replace with:

```
### Phase 4: Adherence Analysis

Call `alignkit_local_check` first for conformance data. Then call `alignkit_check` for
session history adherence data (if available). Analyze:
```

- [ ] **Step 5: Verify the file structure is valid**

Run: `wc -l agents/instruction-advisor.md`
Expected: Line count increased from 137 to approximately 190-200

- [ ] **Step 6: Commit**

```bash
git add agents/instruction-advisor.md
git commit -m "fix(instruction-advisor): add MCP fallback, Bash tool, discover guardrails, define primary file"
```

---

### Task 11: Fix convention-categories.md reference

**Files:**
- Modify: `skills/discover/references/convention-categories.md`

- [ ] **Step 1: Update threshold section to match tiered approach**

In `skills/discover/references/convention-categories.md`, find the "Analysis Tips" threshold section:

Find this text:

```
**Threshold for reporting:**
- 90%+ consistency → Strong convention, high-confidence rule
- 70-89% consistency → Likely convention with exceptions, note the exceptions
- Below 70% → Not a convention, don't report it
```

Replace with:

```
**Threshold for reporting (tiered approach):**
- **90%+ consistency**: Strong convention, high-confidence rule. Include with full confidence
  and note the exact percentage (e.g., "12/12 files" or "34/36 files").
- **70-89% consistency**: Likely convention with exceptions. Include but explicitly list the
  exceptions found. Assess whether exceptions are intentional (e.g., framework-required
  deviations) or accidental (e.g., older code predating the convention).
- **Below 70%**: Not a convention -- do not report it. If the pattern seems important but
  falls below 70%, note it as an observation without a suggested rule.
```

- [ ] **Step 2: Remove duplicate "What NOT to report" section**

In `skills/discover/references/convention-categories.md`, find the "What NOT to report" section and replace it with a consolidated version that eliminates duplication.

Find this text:

```
**What NOT to report:**
- Framework-imposed patterns (Next.js routing structure is not a "convention")
- Obvious language features (using TypeScript interfaces in a TypeScript project)
- Single-instance patterns (one file does something unique — not a convention)
- Patterns already documented in CLAUDE.md or .claude/rules/
```

Replace with:

```
**What NOT to report:**
- Framework-imposed patterns (Next.js routing structure, Rails directory layout)
- Obvious language features (using TypeScript interfaces in a TypeScript project)
- Single-instance patterns (one file does something unique -- not a convention)
- Patterns already documented in CLAUDE.md or .claude/rules/
- Implementation details masquerading as conventions (e.g., "SSE uses TextEncoder" describes
  how something was built, not a rule to follow)
- Absence-as-convention (e.g., "no Zod for API inputs" might be a gap, not a convention)

**Monorepo / multi-language projects:**
- Analyze each package or language separately -- a convention in `packages/api/` may not
  apply to `packages/web/`.
- When a convention exists across multiple packages, note it as a project-wide convention
  with the packages it spans.
- For multi-language projects, categorize conventions by language. A Python naming convention
  does not apply to TypeScript files and vice versa.
- Check for cross-package conventions: shared config files, workspace-level scripts, or
  import boundaries between packages.
```

- [ ] **Step 3: Verify the file structure is valid**

Run: `wc -l skills/discover/references/convention-categories.md`
Expected: Line count increased from 398 to approximately 415-420

- [ ] **Step 4: Commit**

```bash
git add skills/discover/references/convention-categories.md
git commit -m "fix(convention-categories): reconcile threshold with tiered approach, add monorepo guidance"
```

---

### Task 12: Fix diagnostic-codes.md reference

**Files:**
- Modify: `skills/lint/references/diagnostic-codes.md`

- [ ] **Step 1: Add examples to METADATA code section**

In `skills/lint/references/diagnostic-codes.md`, find the METADATA section:

Find this text:

```
## METADATA (error)

**Meaning:** An instruction file has invalid or missing metadata. For agent files:
missing required frontmatter fields. For skill files: missing SKILL.md or invalid
frontmatter. For instruction files: structural issues.

**How to advise:** Show the specific metadata issue and what needs to be fixed.
This is typically a formatting/structural fix, not a content issue.
```

Replace with:

```
## METADATA (error)

**Meaning:** An instruction file has invalid or missing metadata. For agent files:
missing required frontmatter fields. For skill files: missing SKILL.md or invalid
frontmatter. For instruction files: structural issues.

**How to advise:** Show the specific metadata issue and what needs to be fixed.
This is typically a formatting/structural fix, not a content issue.

**Examples:**

- Agent file missing frontmatter entirely:
  ```
  # My Agent     <-- missing ---/name/description/model/--- block
  Do stuff
  ```
  Fix: Add frontmatter with required fields: `name`, `description`, `model`

- Agent file missing `model` field:
  ```
  ---
  name: reviewer
  description: Reviews code
  ---           <-- missing model field
  ```
  Fix: Add `model: sonnet` (or `opus`, `haiku`) to frontmatter

- Skill file missing `description` field:
  ```
  ---
  name: my-skill
  ---           <-- missing description
  ```
  Fix: Add `description: >-` followed by a clear trigger description

- Unclosed frontmatter (missing closing `---`):
  ```
  ---
  name: broken
  description: This never closes
  # Rest of file  <-- parser treats everything as frontmatter
  ```
  Fix: Add closing `---` after the last frontmatter field
```

- [ ] **Step 2: Add guidance for combined diagnostics**

In `skills/lint/references/diagnostic-codes.md`, find the separator before the CLI-only codes:

Find this text:

```
---

The following codes are NOT returned by `alignkit_lint`. They are produced by the CLI's
`--deep` mode.
```

Replace with:

```
---

## Combined Diagnostics

A single rule can trigger multiple diagnostics. Common combinations:

- **VAGUE + WEAK_EMPHASIS**: A vague rule that's also a tool constraint. Fix the vagueness
  first (make it concrete), then add emphasis. Example: "Try to run tests" -> "ALWAYS run
  `vitest run` before committing."

- **REDUNDANT + ORDERING**: Two similar rules where one is also misplaced. Merge the rules
  first, then move the merged rule to the correct position.

- **PLACEMENT + WEAK_EMPHASIS**: A rule that belongs in .claude/rules/ that also lacks
  emphasis. If moving to .claude/rules/, the emphasis is less important (scoped rules auto-
  apply). If keeping in CLAUDE.md, add emphasis.

When a rule has multiple diagnostics, address them in this priority order:
1. METADATA errors (structural issues block other fixes)
2. CONFLICT (resolve contradictions before other changes)
3. REDUNDANT (merge before rewriting)
4. VAGUE (rewrite for clarity)
5. PLACEMENT (move to correct location)
6. ORDERING (reorder within file)
7. WEAK_EMPHASIS (add emphasis markers)

---

The following codes are NOT returned by `alignkit_lint`. They are produced by the CLI's
`--deep` mode.
```

- [ ] **Step 3: Verify the file structure is valid**

Run: `wc -l skills/lint/references/diagnostic-codes.md`
Expected: Line count increased from 149 to approximately 200-210

- [ ] **Step 4: Commit**

```bash
git add skills/lint/references/diagnostic-codes.md
git commit -m "fix(diagnostic-codes): add METADATA examples and combined diagnostic guidance"
```

---

### Task 13: Fix deep-analysis-guide.md reference

**Files:**
- Modify: `skills/lint/references/deep-analysis-guide.md`

- [ ] **Step 1: Replace obvious bad examples with harder edge cases**

In `skills/lint/references/deep-analysis-guide.md`, find the LOW effectiveness examples:

Find this text:

```
**Indicators:**
- "Claude already knows this" — rules that restate common knowledge:
  - "Write clean, readable code"
  - "Handle errors properly"
  - "Use meaningful variable names"
  - "Follow REST conventions"
  - "Write unit tests for new features"
- References tools or frameworks not in the project's dependencies
- Too abstract to act on ("maintain good code quality")
- Duplicates what a linter/formatter already enforces
```

Replace with:

```
**Indicators:**
- "Claude already knows this" -- rules that restate common knowledge:
  - "Write clean, readable code"
  - "Handle errors properly"
  - "Use meaningful variable names"
  - "Follow REST conventions"
  - "Write unit tests for new features"
- References tools or frameworks not in the project's dependencies
- Too abstract to act on ("maintain good code quality")
- Duplicates what a linter/formatter already enforces

**Harder edge cases (common false-positive LOWs -- these are actually MEDIUM or HIGH):**
- "Always check for null before accessing properties" -- sounds like Claude already knows
  this, but in a codebase without strict null checks, this is genuinely useful. Check
  tsconfig `strictNullChecks`. If disabled -> HIGH. If enabled -> LOW (TypeScript enforces it).
- "Use async/await instead of .then()" -- sounds generic, but if the codebase has a mix
  and the team wants consistency, this is MEDIUM. Check whether the codebase actually has both.
- "Prefer composition over inheritance" -- sounds like textbook advice, but if the codebase
  has deep inheritance chains causing issues, this is MEDIUM. Check for `extends` depth.
- "Run database migrations before starting the server" -- sounds obvious, but many developers
  forget this step. If the project has a migration tool (Prisma, Alembic, etc.), this is HIGH.
```

- [ ] **Step 2: Add output length guidance for large rule sets**

In `skills/lint/references/deep-analysis-guide.md`, at the end of the file, add:

Find this text:

```
### Token Savings Estimation

Estimate tokens saved as: (sum of original rule tokens) - (merged rule tokens).
Rough estimate: 1 token per 4 characters.
```

Replace with:

```
### Token Savings Estimation

Estimate tokens saved as: (sum of original rule tokens) - (merged rule tokens).
Rough estimate: 1 token per 4 characters.

## Output Length Guidance

For instruction files with many rules, scale the analysis depth:

- **1-10 rules**: Full analysis of every rule. Show all MEDIUM and LOW ratings.
- **11-25 rules**: Full analysis but group similar issues. Show individual ratings for LOW
  rules only. Summarize MEDIUM rules as a group: "5 MEDIUM rules could benefit from
  project-specific details (see table)."
- **26-50 rules**: Focus on the worst offenders. Show the 5 lowest-rated rules individually.
  Group remaining issues: "12 additional MEDIUM rules identified -- see consolidation
  opportunities for the most impactful changes."
- **50+ rules**: The instruction file is likely too large. Lead with token budget analysis
  and consolidation. Show the 8 lowest-rated rules individually. Recommend aggressive
  consolidation before detailed rule-by-rule analysis.

The goal is a report the user will actually read. A 3-page analysis of 50 rules is less
useful than a 1-page summary with the top 8 issues and a consolidation plan.
```

- [ ] **Step 3: Verify the file structure is valid**

Run: `wc -l skills/lint/references/deep-analysis-guide.md`
Expected: Line count increased from 180 to approximately 215-225

- [ ] **Step 4: Commit**

```bash
git add skills/lint/references/deep-analysis-guide.md
git commit -m "fix(deep-analysis-guide): add edge case examples and output length guidance for large rule sets"
```

---

### Task 14: Fix evaluation-guide.md reference

**Files:**
- Modify: `skills/check/references/evaluation-guide.md`

- [ ] **Step 1: Clarify "Followed" vs "Inconclusive" boundary for code structure**

In `skills/check/references/evaluation-guide.md`, find the Code Structure Rules section:

Find this text:

```
**Verdict patterns:**
- Followed: File paths consistently match the required pattern
- Violated: Files created in wrong locations or with wrong naming
- Inconclusive: Most code structure rules require reading file contents, not just paths
```

Replace with:

```
**Verdict patterns:**
- Followed: File paths consistently match the required pattern in 60%+ of relevant sessions.
  Requires that the evidence clearly shows compliance, not just absence of counter-evidence.
- Violated: Files created in wrong locations or with wrong naming in 2+ sessions, or a single
  clear violation in a critical rule.
- Inconclusive: Evidence is ambiguous -- file paths alone cannot determine compliance (e.g.,
  "use absolute imports" requires reading file contents, not just seeing file paths). Also use
  Inconclusive when fewer than 3 sessions contain relevant file operations.

**Key distinction: Followed vs Inconclusive.** "Followed" requires positive evidence OF
compliance. If sessions simply don't contain relevant actions, that is Inconclusive, not
Followed. A session with no test file operations does not count as "following" a test
co-location rule.
```

- [ ] **Step 2: Define "majority of sessions" threshold**

In `skills/check/references/evaluation-guide.md`, find the "Threshold for Followed" section:

Find this text:

```
### Threshold for "Followed"

A rule is Followed when evidence suggests compliance in the majority of relevant sessions.
A single session where the rule wasn't relevant (e.g., no tests needed in a docs-only session)
should not count as a violation.
```

Replace with:

```
### Threshold for "Followed"

A rule is Followed when evidence suggests compliance in the **majority of relevant sessions,
where majority means >60%**. Specifically:

- Count only sessions where the rule was relevant (had actions that could trigger the rule).
- Exclude sessions with no relevant actions (docs-only, config-only, etc.).
- If 5 sessions touched test files and 4 followed the test co-location rule, that's 80% -> Followed.
- If 5 sessions touched test files and 3 followed the rule, that's 60% -> borderline, lean Followed.
- If 5 sessions touched test files and 2 followed the rule, that's 40% -> Violated.

A single session where the rule wasn't relevant (e.g., no tests needed in a docs-only session)
should not count toward either Followed or Violated.
```

- [ ] **Step 3: Verify the file structure is valid**

Run: `wc -l skills/check/references/evaluation-guide.md`
Expected: Line count increased from 146 to approximately 170-175

- [ ] **Step 4: Commit**

```bash
git add skills/check/references/evaluation-guide.md
git commit -m "fix(evaluation-guide): clarify followed-vs-inconclusive boundary, define majority as >60%"
```

---

### Task 15: Add CLAUDE.md to test fixture for integration tests

**Files:**
- Create: `mcp/test-fixtures/CLAUDE.md`

This task adds a CLAUDE.md file to the Phase 0 test fixture project. This file must contain rules that exercise all 7 diagnostic codes and multiple conformance check types.

- [ ] **Step 1: Create the fixture CLAUDE.md**

Create `mcp/test-fixtures/CLAUDE.md`:

```markdown
# Project Instructions

## Code Style

- Use TypeScript strict mode
- Always use named exports
- No default exports except in pages/
- Try to write clean code when possible
- Generally prefer functional approaches

## Testing

1. Run `vitest run` before committing
2. Write tests for all new functions
3. Use describe/it blocks, not standalone test()
4. In test files, always use describe/it blocks

## Imports

- Use absolute imports via path aliases (@/, @db/, @services/)
- Always use absolute imports for all source files
- No relative imports with ../

## Architecture

- Components must not import from db/ directly
- Keep services in src/services/
- Always run eslint --fix after editing TypeScript files

## Workflow

- Use camelCase for variables
- Handle errors properly
- Follow REST conventions
```

This fixture CLAUDE.md is designed to trigger:
- **VAGUE**: "Try to write clean code when possible", "Generally prefer functional approaches"
- **CONFLICT**: none (to keep it realistic)
- **REDUNDANT**: "Always use named exports" vs "No default exports except in pages/", "Use absolute imports via path aliases" vs "Always use absolute imports for all source files"
- **ORDERING**: "Run `vitest run` before committing" appears after "Use TypeScript strict mode" (which is fine), but "Always run eslint --fix after editing TypeScript files" is a tool constraint in the Architecture section, after Style rules
- **PLACEMENT**: "In test files, always use describe/it blocks" belongs in .claude/rules/, "Always run eslint --fix after editing TypeScript files" belongs as a hook
- **WEAK_EMPHASIS**: "Run `vitest run` before committing" lacks ALWAYS/MUST/NEVER emphasis
- **METADATA**: none in CLAUDE.md (but the fixture should also have an agent file for this -- already planned by Phase 0 fixture)

For conformance checks:
- "Use TypeScript strict mode" -> config check (tsconfig has strict: true -> conforms)
- "No default exports except in pages/" -> import check (grep for export default)
- "Components must not import from db/" -> architecture check
- "Handle errors properly" -> style check (unverifiable)

- [ ] **Step 2: Commit**

```bash
git add mcp/test-fixtures/CLAUDE.md
git commit -m "feat: add CLAUDE.md to test fixture for alignkit integration tests"
```

---

### Task 16: Write integration tests for alignkit-local

**Files:**
- Create: `mcp/alignkit/src/analyzers/__tests__/integration.test.ts`

These tests run the full lint and check tools against the Phase 0 test fixture project.

- [ ] **Step 1: Write the integration test**

Create `mcp/alignkit/src/analyzers/__tests__/integration.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { lintTool } from '../../mcp/tools/lint.js';
import { checkTool } from '../../mcp/tools/check.js';
import { statusTool } from '../../mcp/tools/status.js';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

// Path to the Phase 0 test fixture project
const FIXTURE_DIR = join(import.meta.dirname, '..', '..', '..', '..', 'test-fixtures');

// Skip integration tests if fixture doesn't exist yet (Phase 0 not complete)
const fixtureExists = existsSync(join(FIXTURE_DIR, 'CLAUDE.md'));

describe.skipIf(!fixtureExists)('Integration: lintTool against test fixture', () => {
  it('discovers the CLAUDE.md file', async () => {
    const result = await lintTool({}, FIXTURE_DIR);
    expect(result.files.length).toBeGreaterThanOrEqual(1);
    const claudeMd = result.files.find(f => f.path === 'CLAUDE.md');
    expect(claudeMd).toBeDefined();
  });

  it('parses rules from CLAUDE.md', async () => {
    const result = await lintTool({}, FIXTURE_DIR);
    expect(result.summary.totalRules).toBeGreaterThanOrEqual(10);
  });

  it('detects VAGUE diagnostics', async () => {
    const result = await lintTool({}, FIXTURE_DIR);
    const vague = result.diagnostics.filter(d => d.code === 'VAGUE');
    expect(vague.length).toBeGreaterThanOrEqual(1);
    // "Try to write clean code when possible" should be flagged
    expect(vague.some(d => d.ruleText.includes('Try to'))).toBe(true);
  });

  it('detects REDUNDANT diagnostics', async () => {
    const result = await lintTool({}, FIXTURE_DIR);
    const redundant = result.diagnostics.filter(d => d.code === 'REDUNDANT');
    expect(redundant.length).toBeGreaterThanOrEqual(1);
  });

  it('detects PLACEMENT diagnostics', async () => {
    const result = await lintTool({}, FIXTURE_DIR);
    const placement = result.diagnostics.filter(d => d.code === 'PLACEMENT');
    expect(placement.length).toBeGreaterThanOrEqual(1);
    // "In test files" rule should suggest .claude/rules/
    expect(placement.some(d => d.suggestion?.includes('.claude/rules/'))).toBe(true);
  });

  it('detects WEAK_EMPHASIS diagnostics', async () => {
    const result = await lintTool({}, FIXTURE_DIR);
    const weak = result.diagnostics.filter(d => d.code === 'WEAK_EMPHASIS');
    expect(weak.length).toBeGreaterThanOrEqual(1);
  });

  it('returns proper summary structure', async () => {
    const result = await lintTool({}, FIXTURE_DIR);
    expect(result.summary).toHaveProperty('totalFiles');
    expect(result.summary).toHaveProperty('totalRules');
    expect(result.summary).toHaveProperty('totalDiagnostics');
    expect(result.summary).toHaveProperty('byCode');
    expect(result.summary).toHaveProperty('bySeverity');
    expect(result.summary.totalDiagnostics).toBe(result.diagnostics.length);
  });

  it('accepts a specific file argument', async () => {
    const result = await lintTool({ file: 'CLAUDE.md' }, FIXTURE_DIR);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe('CLAUDE.md');
  });
});

describe.skipIf(!fixtureExists)('Integration: checkTool against test fixture', () => {
  it('returns verdicts for each rule', async () => {
    const result = await checkTool({}, FIXTURE_DIR);
    expect(result.rules.length).toBeGreaterThanOrEqual(10);
  });

  it('classifies config rules and checks them', async () => {
    const result = await checkTool({}, FIXTURE_DIR);
    const strictRule = result.rules.find(r => r.text.includes('strict'));
    expect(strictRule).toBeDefined();
    // Fixture has strict: true in tsconfig
    expect(strictRule!.verdict).toBe('conforms');
  });

  it('marks style rules as unverifiable', async () => {
    const result = await checkTool({}, FIXTURE_DIR);
    const styleRule = result.rules.find(r => r.text.includes('Handle errors properly'));
    expect(styleRule).toBeDefined();
    expect(styleRule!.verdict).toBe('unverifiable');
  });

  it('returns proper summary counts', async () => {
    const result = await checkTool({}, FIXTURE_DIR);
    expect(result.summary.totalRules).toBe(result.rules.length);
    expect(result.summary.conforms + result.summary.violates + result.summary.unverifiable)
      .toBe(result.summary.totalRules);
  });
});

describe.skipIf(!fixtureExists)('Integration: statusTool against test fixture', () => {
  it('returns combined lint + check summary', async () => {
    const result = await statusTool(FIXTURE_DIR);
    expect(result.instructionFiles).toBeGreaterThanOrEqual(1);
    expect(result.totalRules).toBeGreaterThanOrEqual(10);
    expect(result.lintIssues).toBeGreaterThanOrEqual(1);
    expect(result.conformance).toHaveProperty('conforms');
    expect(result.conformance).toHaveProperty('violates');
    expect(result.conformance).toHaveProperty('unverifiable');
  });

  it('produces a human-readable quickSummary', async () => {
    const result = await statusTool(FIXTURE_DIR);
    expect(result.quickSummary).toContain('instruction file');
    expect(result.quickSummary).toContain('rule');
    expect(result.quickSummary).toContain('Lint');
    expect(result.quickSummary).toContain('Conformance');
  });
});
```

- [ ] **Step 2: Run the integration test**

Run: `cd mcp/alignkit && npx vitest run src/analyzers/__tests__/integration.test.ts 2>&1 | tail -20`

Expected: If the Phase 0 test fixture exists with CLAUDE.md, all tests pass. If the fixture doesn't exist yet, tests are skipped with a message.

- [ ] **Step 3: Run all alignkit tests together**

Run: `cd mcp/alignkit && npx vitest run 2>&1 | tail -25`
Expected: All tests pass -- discovery, diagnostics, conformance, and integration (or integration skipped)

- [ ] **Step 4: Commit**

```bash
git add mcp/alignkit/src/analyzers/__tests__/integration.test.ts
git commit -m "test(alignkit): add integration tests against test fixture CLAUDE.md"
```

---

### Task 17: Build, verify, and final commit

**Files:**
- No new files -- verification only

- [ ] **Step 1: Build the alignkit server**

Run: `cd mcp/alignkit && npm run build 2>&1 | tail -10`
Expected: Clean compilation, no errors

- [ ] **Step 2: Run all alignkit tests**

Run: `cd mcp/alignkit && npx vitest run 2>&1`
Expected: All tests pass

- [ ] **Step 3: Verify the built server file exists**

Run: `ls -la mcp/alignkit/dist/mcp/server.js`
Expected: File exists

- [ ] **Step 4: Verify .mcp.json is valid JSON**

Run: `node -e "const fs = require('fs'); const j = JSON.parse(fs.readFileSync('.mcp.json', 'utf-8')); console.log('Servers:', Object.keys(j.mcpServers).join(', ')); console.log('Valid JSON')"`
Expected: `Servers: testkit, shieldkit, lenskit, timewarp, alignkit, alignkit-local` followed by `Valid JSON`

- [ ] **Step 5: Verify all skill files have valid frontmatter**

Run: `node -e "const fs = require('fs'); for (const s of ['discover', 'lint', 'check']) { const content = fs.readFileSync('skills/' + s + '/SKILL.md', 'utf-8'); const hasYaml = content.startsWith('---'); const closingIdx = content.indexOf('---', 3); console.log(s + ': frontmatter=' + hasYaml + ' closed=' + (closingIdx > 0)); }"`
Expected: All three skills report `frontmatter=true closed=true`

- [ ] **Step 6: Verify agent file has valid frontmatter**

Run: `node -e "const fs = require('fs'); const c = fs.readFileSync('agents/instruction-advisor.md', 'utf-8'); const lines = c.split('\\n'); const hasName = lines.some(l => l.startsWith('name:')); const hasModel = lines.some(l => l.startsWith('model:')); const hasBash = lines.some(l => l.includes('Bash')); console.log('name=' + hasName + ' model=' + hasModel + ' bash=' + hasBash)"`
Expected: `name=true model=true bash=true`

- [ ] **Step 7: Run existing MCP server tests (if Phase 0 complete)**

Run: `cd mcp/testkit && npx vitest run 2>&1 | tail -5`
Expected: Existing testkit tests still pass (no regressions)

- [ ] **Step 8: Verify the directory structure**

Run: `find mcp/alignkit/src -name '*.ts' | sort`
Expected:
```
mcp/alignkit/src/analyzers/__tests__/conformance.test.ts
mcp/alignkit/src/analyzers/__tests__/diagnostics.test.ts
mcp/alignkit/src/analyzers/__tests__/discovery.test.ts
mcp/alignkit/src/analyzers/__tests__/integration.test.ts
mcp/alignkit/src/analyzers/conformance.ts
mcp/alignkit/src/analyzers/diagnostics.ts
mcp/alignkit/src/analyzers/discovery.ts
mcp/alignkit/src/mcp/server.ts
mcp/alignkit/src/mcp/tools/check.ts
mcp/alignkit/src/mcp/tools/lint.ts
mcp/alignkit/src/mcp/tools/status.ts
```
