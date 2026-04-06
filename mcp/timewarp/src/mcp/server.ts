import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { analyzeHistory } from '../analyzers/history.js';
import { analyzeTrends } from '../analyzers/trends.js';

const server = new McpServer({
  name: 'timewarp',
  version: '0.2.0',
});

const cwd = process.cwd();

function validateFilePath(file: string | undefined): string | undefined {
  if (!file) return undefined;
  // Reject path traversal attempts
  const normalized = file.replace(/\\/g, '/');
  if (normalized.includes('..') || normalized.startsWith('/')) {
    throw new Error(
      `Invalid file path: "${file}". Path must be relative and cannot contain ".." or start with "/".`,
    );
  }
  return file;
}

server.tool(
  'timewarp_history',
  'Git history analysis for a file or the whole project. Returns commit frequency, authors, commit classification (feature/fix/refactor/chore/docs), most-changed files, and optional size-over-time tracking.',
  {
    file: z.string().optional().describe(
      'Path to a specific file to analyze. If omitted, analyzes the whole project.'
    ),
    since: z.string().optional().describe(
      'Time period string for git log --since (e.g. "6 months ago", "2025-01-01"). Defaults to "6 months ago".'
    ),
  },
  async (args) => {
    try {
      const file = validateFilePath(args.file);
      const result = await analyzeHistory({ file, since: args.since }, cwd);
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
  'timewarp_trends',
  'Trend computation for growth rates and acceleration. Samples files at multiple time points to compute line/function growth, detect acceleration patterns (accelerating/linear/decelerating/flat), and project future size. Returns per-file trend data: growth.{linesPerMonth, percentPerMonth, pattern}, churn.{firstHalf, secondHalf, pattern}, projection.{linesIn3Months, linesIn6Months, crossesThreshold}, samples[].{date, lines, functions}.',
  {
    file: z.string().optional().describe(
      'Path to a specific file to analyze. If omitted, analyzes the top 20 most-changed files.'
    ),
    months: z.number().optional().describe(
      'Analysis period in months. Defaults to 6.'
    ),
  },
  async (args) => {
    try {
      const file = validateFilePath(args.file);
      const result = await analyzeTrends({ file, months: args.months }, cwd);
      const output = Array.isArray(result) && result.length === 0
        ? { trends: [], message: 'Insufficient git history to compute trends. Need at least 2 data points per file within the analysis period.' }
        : result;
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
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
  console.error('timewarp-mcp server failed to start:', error);
  process.exit(1);
});
