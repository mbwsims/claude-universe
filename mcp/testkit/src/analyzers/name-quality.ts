/**
 * Analyzes test name quality -- whether names read as specifications or are vague.
 */

export interface NameQualityResult {
  total: number;
  vague: number;
  vagueNames: Array<{ line: number; name: string; reason: string }>;
}

const GENERIC_TERMS = new Set([
  'works', 'correct', 'correctly', 'properly', 'right',
  'good', 'fine', 'ok', 'okay', 'test', 'tests',
  'check', 'checks', 'verify', 'verifies',
  // Note: 'handles' removed -- it is commonly used in legitimate descriptive names
  // like 'handles concurrent requests gracefully'
]);

// Match test('...') or it('...') or test(`...`) or it(`...`)
const TEST_NAME_REGEX = /(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]/g;

// Match Python test functions: def test_something_descriptive(self?):
const PYTHON_TEST_NAME_REGEX = /def\s+(test_\w+)\s*\(/g;

/**
 * Heuristic: a word is "domain-specific" if it contains camelCase, PascalCase,
 * or is a known technical term pattern (e.g., contains uppercase mid-word,
 * contains digits mid-word like 'base64', or is longer than 8 chars).
 */
function isDomainSpecificWord(word: string): boolean {
  // camelCase or PascalCase: has an uppercase letter after a lowercase letter
  if (/[a-z][A-Z]/.test(word)) return true;
  // PascalCase: starts uppercase and has another uppercase or lowercase transition
  if (/^[A-Z][a-z]+[A-Z]/.test(word)) return true;
  // Contains digits mid-word (e.g., 'base64', 'utf8')
  if (/[a-zA-Z]\d/.test(word) || /\d[a-zA-Z]/.test(word)) return true;
  return false;
}

function isVagueName(name: string): { vague: boolean; reason: string } {
  const words = name.split(/\s+/).filter(w => w.length > 0);

  // Numbered test names (check first -- always vague regardless of length)
  if (/^test\s*\d+$/i.test(name.trim())) {
    return { vague: true, reason: 'numbered test name' };
  }

  // Too short -- but allow short names if they contain domain-specific words
  if (words.length < 3) {
    // Short names with a domain-specific word are still meaningful
    const hasDomainWord = words.some(w => isDomainSpecificWord(w));
    if (!hasDomainWord) {
      return { vague: true, reason: 'fewer than 3 words' };
    }
  }

  if (words.length === 3) {
    // 3-word names are acceptable if at least one word is domain-specific
    const hasDomainWord = words.some(w => isDomainSpecificWord(w));
    const nonGenericWords = words.filter(w => !GENERIC_TERMS.has(w.toLowerCase()));
    if (!hasDomainWord && nonGenericWords.length <= 1) {
      return { vague: true, reason: 'fewer than 3 non-generic words' };
    }
    // 3 words with at least 2 non-generic words or a domain-specific word: OK
  }

  // All words are generic
  const nonGenericWords = words.filter(w => !GENERIC_TERMS.has(w.toLowerCase()));
  if (nonGenericWords.length <= 1) {
    return { vague: true, reason: 'mostly generic terms' };
  }

  // Starts with "should" + only generic words
  if (words[0].toLowerCase() === 'should' && words.length <= 3) {
    const rest = words.slice(1);
    if (rest.every(w => GENERIC_TERMS.has(w.toLowerCase()))) {
      return { vague: true, reason: 'vague "should" pattern' };
    }
  }

  return { vague: false, reason: '' };
}

export function analyzeNameQuality(content: string): NameQualityResult {
  const lines = content.split('\n');
  const vagueNames: NameQualityResult['vagueNames'] = [];
  let total = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // JS/TS: test('name') or it('name')
    TEST_NAME_REGEX.lastIndex = 0;
    let match;
    while ((match = TEST_NAME_REGEX.exec(line)) !== null) {
      total++;
      const name = match[1];
      const nameResult = isVagueName(name);
      if (nameResult.vague) {
        vagueNames.push({ line: i + 1, name, reason: nameResult.reason });
      }
    }

    // Python: def test_name_with_underscores(
    PYTHON_TEST_NAME_REGEX.lastIndex = 0;
    while ((match = PYTHON_TEST_NAME_REGEX.exec(line)) !== null) {
      total++;
      // Convert test_name_with_underscores to "name with underscores" for quality check
      const rawName = match[1];
      const name = rawName.replace(/^test_/, '').replace(/_/g, ' ');
      const nameResult = isVagueName(name);
      if (nameResult.vague) {
        vagueNames.push({ line: i + 1, name: rawName, reason: nameResult.reason });
      }
    }
  }

  return {
    total,
    vague: vagueNames.length,
    vagueNames,
  };
}
