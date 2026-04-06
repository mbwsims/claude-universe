/**
 * Missing auth analyzer.
 *
 * Detects route handler functions that lack auth function calls.
 * Checks for common auth patterns at handler level, not just file level.
 * Supports JS/TS and Python auth patterns.
 */

export interface MissingAuthLocation {
  file: string;
  hasAuth: boolean;
}

export interface HandlerAuthResult {
  name: string;
  hasAuth: boolean;
  startLine: number;
}

export interface HandlerAuthLocation {
  file: string;
  handler: string;
  hasAuth: boolean;
  line?: number;
}

export interface MissingAuthResult {
  total: number;
  unprotected: number;
  locations: MissingAuthLocation[];
  handlers: HandlerAuthLocation[];
}

const AUTH_PATTERNS = [
  /\bgetSession\b/,
  /\bgetServerSession\b/,
  /\bgetUser\b/,
  /\bverifyToken\b/,
  /\bauthenticate\b/,
  /\brequireAuth\b/,
  /\bwithAuth\b/,
  /\bisAuthenticated\b/,
  /\bcheckAuth\b/,
  /\bauth\s*\(\s*\)/,
  /\bpassport\.authenticate\b/,
  /\bjwt\.verify\b/,
  // Python patterns
  /@login_required\b/,
  /@permission_required\b/,
  /@requires_auth\b/,
  /@jwt_required\b/,
  // Middleware-level auth (app.use / router.use with auth)
  /\b(?:app|router)\.use\s*\(\s*(?:auth|requireAuth|authenticate|withAuth|isAuthenticated|checkAuth|authMiddleware|verifyAuth|ensureAuth|authHandler)\b/,
  /\b(?:app|router)\.use\s*\(\s*\w*[Aa]uth\w*\s*[\),]/,
  /\bpassport\.initialize\b/,
  // Django middleware auth
  /AuthenticationMiddleware/,
  /LoginRequiredMiddleware/,
];

const ROUTE_FILE_PATTERNS = [
  /route\.(ts|js|tsx|jsx)$/,
  /handler\.(ts|js|tsx|jsx)$/,
  /controller\.(ts|js|tsx|jsx)$/,
  /[/\\]routes[/\\]/,
  /[/\\]api[/\\]/,
  /[/\\]controllers[/\\]/,
  // Python route files
  /views\.py$/,
  /routes\.py$/,
  /api\.py$/,
  /urls\.py$/,
];

export function isRouteFile(filePath: string): boolean {
  return ROUTE_FILE_PATTERNS.some(p => p.test(filePath));
}

export function analyzeAuth(content: string): boolean {
  // Check if any auth function calls appear in the content
  return AUTH_PATTERNS.some(p => p.test(content));
}

/**
 * Analyze individual handlers within a file for auth patterns.
 * Returns per-handler auth status.
 */
export function analyzeHandlerAuth(content: string): HandlerAuthResult[] {
  const results: HandlerAuthResult[] = [];

  // Detect JS/TS exported handler functions
  const jsHandlers = extractJsHandlers(content);
  for (const handler of jsHandlers) {
    const hasAuth = AUTH_PATTERNS.some(p => p.test(handler.body));
    results.push({
      name: handler.name,
      hasAuth,
      startLine: handler.startLine,
    });
  }

  // Detect Python route handlers
  const pyHandlers = extractPythonHandlers(content);
  for (const handler of pyHandlers) {
    const hasAuth = AUTH_PATTERNS.some(p => p.test(handler.decorators));
    results.push({
      name: handler.name,
      hasAuth,
      startLine: handler.startLine,
    });
  }

  return results;
}

interface ExtractedHandler {
  name: string;
  body: string;
  startLine: number;
}

interface ExtractedPyHandler {
  name: string;
  decorators: string;
  startLine: number;
}

/**
 * Extract exported JS/TS handler functions from file content.
 * Matches: export async function NAME, export function NAME,
 * app.get/post/put/delete/patch patterns.
 */
function extractJsHandlers(content: string): ExtractedHandler[] {
  const handlers: ExtractedHandler[] = [];
  const lines = content.split('\n');

  // Pattern 1: export (async) function NAME
  const exportFnRegex = /^export\s+(async\s+)?function\s+(\w+)/;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(exportFnRegex);
    if (match) {
      const name = match[2];
      const body = extractFunctionBody(lines, i);
      handlers.push({ name, body, startLine: i + 1 });
    }
  }

  // Pattern 2: app.METHOD('/path', handler) -- Express-style
  const appMethodRegex = /app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(appMethodRegex);
    if (match) {
      const method = match[1].toUpperCase();
      const path = match[2];
      const body = extractFunctionBody(lines, i);
      const name = `${method} ${path}`;
      handlers.push({ name, body, startLine: i + 1 });
    }
  }

  return handlers;
}

/**
 * Extract Python route handlers by finding @app.route decorators
 * and the def that follows them.
 */
function extractPythonHandlers(content: string): ExtractedPyHandler[] {
  const handlers: ExtractedPyHandler[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    // Look for Python function definitions
    const defMatch = lines[i].match(/^def\s+(\w+)\s*\(/);
    if (!defMatch) continue;

    const name = defMatch[1];

    // Collect all decorators above this def
    let decorators = '';
    let j = i - 1;
    while (j >= 0 && (lines[j].trim().startsWith('@') || lines[j].trim() === '')) {
      if (lines[j].trim().startsWith('@')) {
        decorators = lines[j] + '\n' + decorators;
      }
      j--;
    }

    // Only include if it has a route decorator
    if (/@app\.(route|get|post|put|delete|patch)\b/.test(decorators) ||
        /@router\.(route|get|post|put|delete|patch)\b/.test(decorators)) {
      handlers.push({ name, decorators, startLine: i + 1 });
    }
  }

  return handlers;
}

/**
 * Extract the body of a function starting from the given line index.
 * Uses brace counting for JS/TS.
 */
function extractFunctionBody(lines: string[], startIndex: number): string {
  let braceCount = 0;
  let started = false;
  const bodyLines: string[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    bodyLines.push(line);

    for (const char of line) {
      if (char === '{') {
        braceCount++;
        started = true;
      } else if (char === '}') {
        braceCount--;
      }
    }

    if (started && braceCount <= 0) {
      break;
    }
  }

  return bodyLines.join('\n');
}

export function buildMissingAuthResult(
  files: Array<{ path: string; hasAuth: boolean }>,
  handlers: HandlerAuthLocation[] = [],
): MissingAuthResult {
  const unprotected = files.filter(f => !f.hasAuth).length;

  return {
    total: files.length,
    unprotected,
    locations: files.map(f => ({ file: f.path, hasAuth: f.hasAuth })),
    handlers,
  };
}
