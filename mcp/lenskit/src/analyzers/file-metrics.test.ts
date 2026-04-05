import { describe, it, expect } from 'vitest';
import {
  countFunctions,
  computeMaxNestingDepth,
} from './file-metrics.js';

describe('countFunctions', () => {
  it('counts exported function declarations', () => {
    const lines = [
      'export function createUser(name: string) {',
      '  return { name };',
      '}',
      '',
      'export async function deleteUser(id: string) {',
      '  await db.delete(id);',
      '}',
    ];
    expect(countFunctions(lines, 'ts')).toBe(2);
  });

  it('counts non-exported arrow function declarations', () => {
    const lines = [
      'const validate = (input: string): boolean => {',
      '  return input.length > 0;',
      '};',
      '',
      'const transform = async (data: any) => {',
      '  return process(data);',
      '};',
    ];
    expect(countFunctions(lines, 'ts')).toBe(2);
  });

  it('counts Go receiver methods', () => {
    const lines = [
      'func (s *UserService) GetUser(id string) (*User, error) {',
      '  return s.repo.FindById(id)',
      '}',
      '',
      'func (s *UserService) CreateUser(name string) error {',
      '  return s.repo.Create(name)',
      '}',
      '',
      'func main() {',
      '  fmt.Println("hello")',
      '}',
    ];
    expect(countFunctions(lines, 'go')).toBe(3);
  });

  it('counts Python def and async def functions', () => {
    const lines = [
      'def create_user(name: str) -> dict:',
      '    return {"name": name}',
      '',
      'async def fetch_data():',
      '    pass',
      '',
      'class UserService:',
      '    def get_user(self, user_id: str):',
      '        pass',
    ];
    expect(countFunctions(lines, 'py')).toBe(3);
  });

  it('counts Python class methods', () => {
    const lines = [
      'class UserModel:',
      '    def __init__(self, name):',
      '        self.name = name',
      '',
      '    @classmethod',
      '    def create(cls, name):',
      '        return cls(name)',
      '',
      '    @staticmethod',
      '    def validate(name):',
      '        return len(name) > 0',
    ];
    expect(countFunctions(lines, 'py')).toBe(3);
  });

  it('counts Java methods without access modifiers', () => {
    const lines = [
      'class UserService {',
      '  User getUser(String id) {',
      '    return repo.findById(id);',
      '  }',
      '',
      '  void deleteUser(String id) {',
      '    repo.delete(id);',
      '  }',
      '}',
    ];
    expect(countFunctions(lines, 'java')).toBe(2);
  });
});

describe('computeMaxNestingDepth', () => {
  describe('brace-based nesting (JS/TS/Java/Go/Rust)', () => {
    it('computes depth 0 for flat function', () => {
      const lines = [
        'function hello() {',
        '  console.log("hi");',
        '}',
      ];
      expect(computeMaxNestingDepth(lines, 'ts')).toBe(0);
    });

    it('computes depth 1 for single if-block', () => {
      const lines = [
        'function check(x) {',
        '  if (x > 0) {',
        '    return true;',
        '  }',
        '}',
      ];
      expect(computeMaxNestingDepth(lines, 'ts')).toBe(1);
    });

    it('computes depth 2 for nested if/for', () => {
      const lines = [
        'function process(items) {',
        '  for (const item of items) {',
        '    if (item.valid) {',
        '      handle(item);',
        '    }',
        '  }',
        '}',
      ];
      expect(computeMaxNestingDepth(lines, 'ts')).toBe(2);
    });

    it('computes depth 3 for deeply nested code', () => {
      const lines = [
        'function deep() {',
        '  if (a) {',
        '    for (const x of items) {',
        '      if (x.ok) {',
        '        process(x);',
        '      }',
        '    }',
        '  }',
        '}',
      ];
      expect(computeMaxNestingDepth(lines, 'ts')).toBe(3);
    });

    it('ignores braces inside string literals', () => {
      const lines = [
        'function fmt() {',
        '  const s = "{ not a block }";',
        '  return s;',
        '}',
      ];
      expect(computeMaxNestingDepth(lines, 'ts')).toBe(0);
    });

    it('handles Go function with receiver', () => {
      const lines = [
        'func (s *Server) handleRequest(w http.ResponseWriter, r *http.Request) {',
        '  if r.Method == "GET" {',
        '    for _, item := range items {',
        '      if item.Valid {',
        '        w.Write(item.Data)',
        '      }',
        '    }',
        '  }',
        '}',
      ];
      expect(computeMaxNestingDepth(lines, 'go')).toBe(3);
    });

    it('handles Rust match arms', () => {
      const lines = [
        'fn process(input: &str) -> Result<(), Error> {',
        '  match input {',
        '    "a" => {',
        '      println!("found a");',
        '    }',
        '    _ => {',
        '      return Err(Error::Unknown);',
        '    }',
        '  }',
        '}',
      ];
      // match is depth 1, arm block is depth 2
      expect(computeMaxNestingDepth(lines, 'rs')).toBe(2);
    });
  });

  describe('indent-based nesting (Python)', () => {
    it('computes depth 1 for single if in Python', () => {
      const lines = [
        'def check(x):',
        '    if x > 0:',
        '        return True',
        '    return False',
      ];
      expect(computeMaxNestingDepth(lines, 'py')).toBe(1);
    });

    it('computes depth 2 for nested Python blocks', () => {
      const lines = [
        'def process(items):',
        '    for item in items:',
        '        if item.valid:',
        '            handle(item)',
        '    return True',
      ];
      expect(computeMaxNestingDepth(lines, 'py')).toBe(2);
    });
  });
});
