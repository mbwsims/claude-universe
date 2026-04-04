import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { scanTool } from './tools/scan.js';
import { surfaceTool } from './tools/surface.js';
import { statusTool } from './tools/status.js';
const server = new McpServer({
    name: 'shieldkit',
    version: '0.2.0',
});
const cwd = process.cwd();
server.tool('shieldkit_scan', 'Deterministic pattern detection across source files: SQL injection, hardcoded secrets, dangerous functions, CORS misconfiguration, and missing auth. Returns structured findings per file with severity classifications.', {
    file: z.string().optional().describe('Path to a specific source file to scan. If omitted, discovers and scans all source files in the project.'),
}, async (args) => {
    try {
        const result = await scanTool({ file: args.file }, cwd);
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
server.tool('shieldkit_surface', 'Attack surface mapping for the whole project. Discovers API endpoints, checks auth protection, finds .env files and gitignore coverage, and counts database access files.', {}, async () => {
    try {
        const result = await surfaceTool(cwd);
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
server.tool('shieldkit_status', 'Quick security health summary combining scan and surface analysis: overall risk level, finding counts by severity, endpoint protection, and top issues.', {}, async () => {
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
    console.error('shieldkit-mcp server failed to start:', error);
    process.exit(1);
});
//# sourceMappingURL=server.js.map