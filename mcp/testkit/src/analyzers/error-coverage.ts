/**
 * Analyzes error test coverage by comparing throwable operations in source
 * to error assertions in tests.
 */

export interface ErrorCoverageResult {
  throwable: number;
  tested: number;
  ratio: number;
  throwableLocations: Array<{ line: number; text: string }>;
  errorTestLocations: Array<{ line: number; text: string }>;
}

// Patterns that indicate a function can throw/reject
const THROWABLE_PATTERNS = [
  /\bthrow\s+new\b/,
  /\bthrow\s+\w/,
  /Promise\.reject\(/,
  /\.reject\(/,        // escaped dot -- only matches .reject(, not onReject(
  // Python: raise SomeError(...) or bare raise (re-raise)
  /\braise\s+\w/,
  /\braise\s*$/,
];

// Patterns that indicate an error is being tested
const ERROR_TEST_PATTERNS = [
  /\.toThrow\(/,
  /\.toThrowError\(/,
  /\.rejects\./,
  /expect\.unreachable/,
  /\.toThrow\(\)/,
  // Python: pytest.raises(ExceptionType) or self.assertRaises(ExceptionType)
  /pytest\.raises\(/,
  /self\.assertRaises\(/,
  /assertRaises\(/,
];

/** Strip single-line (//) and multi-line block comments from source text. */
function stripComments(content: string): string {
  // Remove block comments (non-greedy, handles multi-line)
  let stripped = content.replace(/\/\*[\s\S]*?\*\//g, (match) => {
    const newlines = match.split('\n').length - 1;
    return '\n'.repeat(newlines);
  });
  // Remove single-line comments
  stripped = stripped.replace(/\/\/.*$/gm, '');
  return stripped;
}

export function analyzeErrorCoverage(
  sourceContent: string,
  testContent: string
): ErrorCoverageResult {
  const sourceLines = stripComments(sourceContent).split('\n');
  const testLines = stripComments(testContent).split('\n');

  const throwableLocations: ErrorCoverageResult['throwableLocations'] = [];
  const errorTestLocations: ErrorCoverageResult['errorTestLocations'] = [];

  // Count throwable operations in source
  for (let i = 0; i < sourceLines.length; i++) {
    const line = sourceLines[i];
    for (const pattern of THROWABLE_PATTERNS) {
      if (pattern.test(line)) {
        throwableLocations.push({ line: i + 1, text: line.trim() });
        break;
      }
    }
  }

  // Count error assertions in tests
  for (let i = 0; i < testLines.length; i++) {
    const line = testLines[i];
    for (const pattern of ERROR_TEST_PATTERNS) {
      if (pattern.test(line)) {
        errorTestLocations.push({ line: i + 1, text: line.trim() });
        break;
      }
    }
  }

  const throwable = throwableLocations.length;
  const tested = errorTestLocations.length;

  return {
    throwable,
    tested,
    ratio: throwable === 0 ? 1 : tested / throwable,
    throwableLocations,
    errorTestLocations,
  };
}
