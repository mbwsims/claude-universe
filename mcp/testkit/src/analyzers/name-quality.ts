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
  'handles', 'check', 'checks', 'verify', 'verifies',
]);

// Match test('...') or it('...') or test(`...`) or it(`...`)
const TEST_NAME_REGEX = /(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]/g;

function isVagueName(name: string): { vague: boolean; reason: string } {
  const words = name.split(/\s+/).filter(w => w.length > 0);

  // Too short
  if (words.length < 4) {
    return { vague: true, reason: 'fewer than 4 words' };
  }

  // Numbered test names
  if (/^test\s*\d+$/i.test(name.trim())) {
    return { vague: true, reason: 'numbered test name' };
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
    TEST_NAME_REGEX.lastIndex = 0;
    let match;

    while ((match = TEST_NAME_REGEX.exec(line)) !== null) {
      total++;
      const name = match[1];
      const result = isVagueName(name);
      if (result.vague) {
        vagueNames.push({ line: i + 1, name, reason: result.reason });
      }
    }
  }

  return {
    total,
    vague: vagueNames.length,
    vagueNames,
  };
}
