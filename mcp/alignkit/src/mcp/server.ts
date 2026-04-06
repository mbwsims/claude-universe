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
