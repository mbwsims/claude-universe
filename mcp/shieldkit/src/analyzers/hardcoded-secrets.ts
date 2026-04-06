/**
 * Hardcoded secrets analyzer.
 *
 * Detects secret values committed in source code such as passwords,
 * API keys, tokens, and known key prefixes.
 * Includes entropy-based detection for unknown-prefix secrets.
 */

export interface HardcodedSecretLocation {
  line: number;
  text: string;
  pattern: string;
}

export interface HardcodedSecretsResult {
  count: number;
  locations: HardcodedSecretLocation[];
}

interface SecretPattern {
  regex: RegExp;
  name: string;
}

const SECRET_PATTERNS: SecretPattern[] = [
  { regex: /password\s*=\s*["']/i, name: 'password-assignment' },
  { regex: /apiKey\s*=\s*["']/i, name: 'api-key-assignment' },
  { regex: /secret\s*=\s*["']/i, name: 'secret-assignment' },
  { regex: /token\s*=\s*["']/i, name: 'token-assignment' },
  { regex: /Bearer\s+[A-Za-z0-9]/, name: 'bearer-token' },
  { regex: /sk-[A-Za-z0-9]{10,}/, name: 'openai-secret-key' },
  { regex: /AKIA[A-Z0-9]/, name: 'aws-access-key' },
];

const EXCLUDE_FILE_PATTERNS = [
  /\.(test|spec)\.(ts|js|tsx|jsx|mjs|cjs)$/,
  /\/__tests__\//,
  /\.env\.example$/,
];

const EXCLUDE_LINE_PATTERNS = [
  /TODO/i,
  /placeholder/i,
  /example/i,
  /changeme/i,
  /REPLACE/i,
  /your[-_]?(\w+[-_]?)*here/i,
  /xxxx/i,
  /process\.env\./,
  /import\s/,
  /require\s*\(/,
];

const MIN_SECRET_VALUE_LENGTH = 8;

/**
 * Calculate Shannon entropy of a string.
 * Higher entropy = more random-looking = more likely to be a secret.
 */
function shannonEntropy(str: string): number {
  if (str.length === 0) return 0;

  const freq = new Map<string, number>();
  for (const char of str) {
    freq.set(char, (freq.get(char) ?? 0) + 1);
  }

  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / str.length;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  return entropy;
}

const ENTROPY_THRESHOLD = 4.5;
const MIN_ENTROPY_VALUE_LENGTH = 12;

/**
 * Variable name patterns that suggest the value might be a secret.
 * Used for entropy-based detection of secrets without known prefixes.
 */
const SECRET_CONTEXT_VAR_PATTERNS = [
  /\b(api[_-]?key|api[_-]?token|auth[_-]?token|access[_-]?key|private[_-]?key)\b/i,
  /\b(secret[_-]?key|signing[_-]?key|encryption[_-]?key|master[_-]?key)\b/i,
  /\b(credentials?|passphrase|auth[_-]?secret)\b/i,
  /\b(api|secret|token|key|password|credential|auth)\s*=/i,
];

/**
 * Extract the string value after a keyword assignment like `password = "value"`.
 * Returns the value between quotes, or null if not extractable.
 */
function extractAssignedValue(line: string): string | null {
  const match = line.match(/=\s*["'`]([^"'`]*)["'`]/);
  return match ? match[1] : null;
}

export function isExcludedFile(filePath: string): boolean {
  return EXCLUDE_FILE_PATTERNS.some(p => p.test(filePath));
}

export function analyzeHardcodedSecrets(content: string, filePath?: string): HardcodedSecretsResult {
  // Skip excluded file types
  if (filePath && isExcludedFile(filePath)) {
    return { count: 0, locations: [] };
  }

  const lines = content.split('\n');
  const locations: HardcodedSecretLocation[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip comment lines
    if (/^\s*\/\//.test(line) || /^\s*\/?\*/.test(line) || /^\s*#/.test(line)) {
      continue;
    }

    // Skip lines with exclusion markers
    if (EXCLUDE_LINE_PATTERNS.some(p => p.test(line))) {
      continue;
    }

    let found = false;

    // Pass 1: Known patterns
    for (const { regex, name } of SECRET_PATTERNS) {
      if (regex.test(line)) {
        // For keyword-based patterns (not prefix-based like sk-, AKIA),
        // check the value meets minimum length
        const isKeywordPattern = name.endsWith('-assignment');
        if (isKeywordPattern) {
          const value = extractAssignedValue(line);
          if (!value || value.length < MIN_SECRET_VALUE_LENGTH) {
            continue;
          }
        }

        locations.push({
          line: lineNum,
          text: line.trim(),
          pattern: name,
        });
        found = true;
        break;
      }
    }

    // Pass 2: Entropy-based detection for unknown-prefix secrets
    if (!found) {
      const isSecretContext = SECRET_CONTEXT_VAR_PATTERNS.some(p => p.test(line));
      if (isSecretContext) {
        const value = extractAssignedValue(line);
        if (value && value.length >= MIN_ENTROPY_VALUE_LENGTH) {
          const entropy = shannonEntropy(value);
          if (entropy > ENTROPY_THRESHOLD) {
            locations.push({
              line: lineNum,
              text: line.trim(),
              pattern: 'high-entropy-string',
            });
          }
        }
      }
    }
  }

  return {
    count: locations.length,
    locations,
  };
}
