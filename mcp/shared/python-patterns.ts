/**
 * python-patterns.ts — Shared Python analysis patterns.
 *
 * Provides Python-specific detection for functions, imports, test frameworks,
 * and security vulnerability patterns. Used by testkit, shieldkit, lenskit,
 * and timewarp for Python language support.
 */

export interface PythonFunction {
  name: string;
  line: number;
  isAsync: boolean;
  isMethod: boolean;
}

export interface PythonImport {
  module: string;
  names: string[];
  line: number;
}

export interface InjectionFinding {
  type: 'sql-injection' | 'command-injection' | 'code-injection' | 'deserialization';
  line: number;
  text: string;
  pattern: string;
}

/**
 * Extract function definitions from Python source code.
 */
export function extractPythonFunctions(content: string): PythonFunction[] {
  const functions: PythonFunction[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    // Skip comments
    if (trimmed.startsWith('#')) continue;

    // Match: async def name(...) or def name(...)
    const match = trimmed.match(/^(async\s+)?def\s+(\w+)\s*\(/);
    if (match) {
      const isAsync = !!match[1];
      const name = match[2];
      // Check if it's a method (has self or cls as first param)
      const isMethod = /\(\s*(self|cls)\b/.test(trimmed);
      functions.push({ name, line: i + 1, isAsync, isMethod });
    }
  }

  return functions;
}

/**
 * Extract import statements from Python source code.
 */
export function extractPythonImports(content: string): PythonImport[] {
  const imports: PythonImport[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    // Skip comments
    if (trimmed.startsWith('#')) continue;

    // from module import name1, name2
    const fromMatch = trimmed.match(/^from\s+(\S+)\s+import\s+(.+)/);
    if (fromMatch) {
      const module = fromMatch[1];
      const names = fromMatch[2]
        .split(',')
        .map((n) => n.trim())
        .filter((n) => n && !n.startsWith('#'));
      imports.push({ module, names, line: i + 1 });
      continue;
    }

    // import module
    const importMatch = trimmed.match(/^import\s+(\S+)\s*$/);
    if (importMatch) {
      imports.push({ module: importMatch[1], names: [], line: i + 1 });
      continue;
    }
  }

  return imports;
}

/**
 * Check if a file path is a Python test file.
 */
export function isPythonTestFile(filePath: string): boolean {
  const name = filePath.split('/').pop() ?? '';
  if (!name.endsWith('.py')) return false;
  if (name === 'conftest.py') return true;
  if (name.startsWith('test_')) return true;
  if (name.endsWith('_test.py')) return true;
  return false;
}

/**
 * Detect Python test framework from file content.
 * Returns 'pytest', 'unittest', or null.
 */
export function detectPythonTestFramework(content: string): 'pytest' | 'unittest' | null {
  if (/\bimport\s+pytest\b/.test(content) || /@pytest\./.test(content)) {
    return 'pytest';
  }
  if (/\bimport\s+unittest\b/.test(content) || /unittest\.TestCase/.test(content)) {
    return 'unittest';
  }
  return null;
}

const INJECTION_PATTERNS: Array<{
  regex: RegExp;
  type: InjectionFinding['type'];
  pattern: string;
}> = [
  // f-string SQL injection: f"SELECT ... {variable}"
  {
    regex: /f["'].*(?:SELECT|INSERT|UPDATE|DELETE|WHERE|FROM).*\{.*\}.*["']/i,
    type: 'sql-injection',
    pattern: 'f-string with SQL keyword and interpolation',
  },
  // String format SQL: "SELECT ...".format(variable)
  {
    regex: /["'].*(?:SELECT|INSERT|UPDATE|DELETE|WHERE|FROM).*["']\.format\(/i,
    type: 'sql-injection',
    pattern: '.format() with SQL keyword',
  },
  // String concatenation SQL: "SELECT ... " + variable
  {
    regex: /["'].*(?:SELECT|INSERT|UPDATE|DELETE|WHERE|FROM).*["']\s*\+/i,
    type: 'sql-injection',
    pattern: 'string concatenation with SQL keyword',
  },
  // os.system()
  {
    regex: /\bos\.system\s*\(/,
    type: 'command-injection',
    pattern: 'os' + '.system()',
  },
  // subprocess with shell=True
  {
    regex: /\bsubprocess\.(?:call|run|Popen|check_output|check_call)\s*\(.*shell\s*=\s*True/,
    type: 'command-injection',
    pattern: 'subprocess with shell=True',
  },
  // eval()
  {
    regex: /\beval\s*\(/,
    type: 'code-injection',
    pattern: 'eval' + '()',
  },
  // exec() — Python's exec statement
  {
    regex: /\bexec\s*\(/,
    type: 'code-injection',
    pattern: 'exec()',
  },
  // pickle.loads
  {
    regex: /\bpickle\.loads?\s*\(/,
    type: 'deserialization',
    pattern: ['pickle', 'loads()'].join('.'),
  },
];

/**
 * Find Python injection vulnerability patterns in source code.
 */
export function findPythonInjectionPatterns(content: string): InjectionFinding[] {
  const findings: InjectionFinding[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    // Skip comments
    if (trimmed.startsWith('#')) continue;

    for (const { regex, type, pattern } of INJECTION_PATTERNS) {
      if (regex.test(trimmed)) {
        findings.push({
          type,
          line: i + 1,
          text: trimmed.trim(),
          pattern,
        });
        break; // One finding per line
      }
    }
  }

  return findings;
}
