import { describe, it, expect } from 'vitest';
import {
  extractPythonFunctions,
  extractPythonImports,
  detectPythonTestFramework,
  isPythonTestFile,
  findPythonInjectionPatterns,
} from './python-patterns.js';

describe('extractPythonFunctions', () => {
  it('extracts def functions', () => {
    const content = `
def hello():
    pass

def greet(name: str) -> str:
    return f"Hello {name}"
`;
    const fns = extractPythonFunctions(content);
    expect(fns).toEqual([
      { name: 'hello', line: 2, isAsync: false, isMethod: false },
      { name: 'greet', line: 5, isAsync: false, isMethod: false },
    ]);
  });

  it('extracts async def functions', () => {
    const content = `
async def fetch_data():
    pass
`;
    const fns = extractPythonFunctions(content);
    expect(fns).toEqual([
      { name: 'fetch_data', line: 2, isAsync: true, isMethod: false },
    ]);
  });

  it('extracts class methods with self', () => {
    const content = `
class UserService:
    def get_user(self, user_id: str):
        pass

    async def create_user(self, data: dict):
        pass
`;
    const fns = extractPythonFunctions(content);
    expect(fns).toEqual([
      { name: 'get_user', line: 3, isAsync: false, isMethod: true },
      { name: 'create_user', line: 6, isAsync: true, isMethod: true },
    ]);
  });

  it('skips commented-out functions', () => {
    const content = `
# def old_function():
#     pass
def real_function():
    pass
`;
    const fns = extractPythonFunctions(content);
    expect(fns).toEqual([
      { name: 'real_function', line: 4, isAsync: false, isMethod: false },
    ]);
  });
});

describe('extractPythonImports', () => {
  it('extracts from...import statements', () => {
    const content = `
from flask import Flask, request
from .models import UserModel
from ..utils import validate_email
`;
    const imports = extractPythonImports(content);
    expect(imports).toEqual([
      { module: 'flask', names: ['Flask', 'request'], line: 2 },
      { module: '.models', names: ['UserModel'], line: 3 },
      { module: '..utils', names: ['validate_email'], line: 4 },
    ]);
  });

  it('extracts bare import statements', () => {
    const content = `
import os
import subprocess
import json
`;
    const imports = extractPythonImports(content);
    expect(imports).toEqual([
      { module: 'os', names: [], line: 2 },
      { module: 'subprocess', names: [], line: 3 },
      { module: 'json', names: [], line: 4 },
    ]);
  });

  it('skips commented imports', () => {
    const content = `
# import os
import json
`;
    const imports = extractPythonImports(content);
    expect(imports).toEqual([
      { module: 'json', names: [], line: 3 },
    ]);
  });
});

describe('isPythonTestFile', () => {
  it('detects test_ prefix files', () => {
    expect(isPythonTestFile('test_utils.py')).toBe(true);
    expect(isPythonTestFile('tests/test_auth.py')).toBe(true);
  });

  it('detects _test suffix files', () => {
    expect(isPythonTestFile('utils_test.py')).toBe(true);
  });

  it('detects conftest.py', () => {
    expect(isPythonTestFile('conftest.py')).toBe(true);
    expect(isPythonTestFile('tests/conftest.py')).toBe(true);
  });

  it('rejects non-test files', () => {
    expect(isPythonTestFile('utils.py')).toBe(false);
    expect(isPythonTestFile('test_data.json')).toBe(false);
  });
});

describe('detectPythonTestFramework', () => {
  it('detects pytest from import', () => {
    expect(detectPythonTestFramework('import pytest\n')).toBe('pytest');
  });

  it('detects pytest from conftest fixture', () => {
    expect(detectPythonTestFramework('@pytest.fixture\ndef db():\n    pass')).toBe('pytest');
  });

  it('detects unittest from class', () => {
    expect(detectPythonTestFramework('class TestUser(unittest.TestCase):\n    pass')).toBe('unittest');
  });

  it('detects unittest from import', () => {
    expect(detectPythonTestFramework('import unittest\n')).toBe('unittest');
  });

  it('returns null for ambiguous content', () => {
    expect(detectPythonTestFramework('def test_something():\n    assert True')).toBeNull();
  });
});

describe('findPythonInjectionPatterns', () => {
  it('detects f-string SQL injection', () => {
    const content = `
query = f"SELECT * FROM users WHERE name = '{user_input}'"
`;
    const findings = findPythonInjectionPatterns(content);
    expect(findings.length).toBe(1);
    expect(findings[0].type).toBe('sql-injection');
    expect(findings[0].line).toBe(2);
  });

  it('detects os.system calls', () => {
    const content = `
import os
os.system(user_input)
`;
    const findings = findPythonInjectionPatterns(content);
    expect(findings.length).toBe(1);
    expect(findings[0].type).toBe('command-injection');
  });

  it('detects subprocess.call with shell=True', () => {
    const content = `
subprocess.call(cmd, shell=True)
`;
    const findings = findPythonInjectionPatterns(content);
    expect(findings.length).toBe(1);
    expect(findings[0].type).toBe('command-injection');
  });

  it('detects eval calls', () => {
    const content = `
result = eval(user_expression)
`;
    const findings = findPythonInjectionPatterns(content);
    expect(findings.length).toBe(1);
    expect(findings[0].type).toBe('code-injection');
  });

  it('detects pickle.loads', () => {
    const content = `
data = pickle.loads(untrusted_bytes)
`;
    const findings = findPythonInjectionPatterns(content);
    expect(findings.length).toBe(1);
    expect(findings[0].type).toBe('deserialization');
  });

  it('does not flag safe patterns', () => {
    const content = `
db.execute("SELECT * FROM users WHERE id = %s", [user_id])
subprocess.run(["ls", "-la"], check=True)
`;
    const findings = findPythonInjectionPatterns(content);
    expect(findings).toEqual([]);
  });
});
