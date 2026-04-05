/**
 * Discovers instruction files and parses individual rules from markdown content.
 *
 * Instruction files include:
 * - CLAUDE.md (project root)
 * - .claude/rules/ (markdown files)
 * - .claude/agents/ (markdown files)
 * - .claude/skills/ (SKILL.md files)
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
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
