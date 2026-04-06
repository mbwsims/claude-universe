import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { analyzeTool } from './tools/analyze.js';
import { graphTool } from './tools/graph.js';
import { statusTool } from './tools/status.js';

const server = new McpServer({
  name: 'lenskit',
  version: '0.2.0',
});

const cwd = process.cwd();

function validateFilePath(file: string | undefined): string | undefined {
  if (!file) return undefined;
  const normalized = file.replace(/\\/g, '/');
  if (normalized.includes('..') || normalized.startsWith('/')) {
    throw new Error(
      `Invalid file path: "${file}". Path must be relative and cannot contain ".." or start with "/".`,
    );
  }
  return file;
}

server.tool(
  'lenskit_analyze',
  'Analyze source files for complexity metrics, coupling, churn, test coverage, and risk scores. Returns file-level metrics and risk classification (Critical/High/Medium/Low).',
  {
    file: z.string().optional().describe(
      'Path to a specific source file to analyze. If omitted, discovers and analyzes all source files in the project.'
    ),
  },
  async (args) => {
    try {
      const file = validateFilePath(args.file);
      const result = await analyzeTool({ file }, cwd);
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
  'lenskit_graph',
  'Build a dependency graph for the project. Detects circular dependencies, identifies hub files (most imported) and leaf files (never imported), classifies modules by layer, and detects layer violations.',
  {},
  async () => {
    try {
      const result = await graphTool(cwd);
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
  'lenskit_status',
  'Lightweight project health probe: file count, test file count, and estimated test coverage ratio. Fast (sub-second). Use lenskit_analyze for risk scores and lenskit_graph for dependency analysis.',
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
  console.error('lenskit-mcp server failed to start:', error);
  process.exit(1);
});
