import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { analyzeTool } from './tools/analyze.js';
import { mapTool } from './tools/map.js';
import { statusTool } from './tools/status.js';
const server = new McpServer({
    name: 'testkit',
    version: '0.1.0',
});
const cwd = process.cwd();
server.tool('testkit_analyze', 'Analyze test files for quality issues: shallow assertions, error coverage gaps, mock health, and test name quality. Returns structured metrics and letter grades per dimension.', {
    file: z.string().optional().describe('Path to a specific test file to analyze. If omitted, discovers and analyzes all test files in the project.'),
}, async (args) => {
    try {
        const result = await analyzeTool({ file: args.file }, cwd);
        return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
            isError: true,
        };
    }
});
server.tool('testkit_map', 'Map test files to their corresponding source files. Identifies untested source files and classifies them by criticality (high: auth/payment/security, medium: business logic, low: utilities).', {}, async () => {
    try {
        const result = await mapTool(cwd);
        return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
            isError: true,
        };
    }
});
server.tool('testkit_status', 'Quick project test health summary: overall grade, coverage ratio, untested high-priority files, and top issues.', {}, async () => {
    try {
        const result = await statusTool(cwd);
        return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
            isError: true,
        };
    }
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((error) => {
    console.error('testkit-mcp server failed to start:', error);
    process.exit(1);
});
//# sourceMappingURL=server.js.map