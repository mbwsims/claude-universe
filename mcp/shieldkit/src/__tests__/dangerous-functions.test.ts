import { describe, it, expect } from 'vitest';
import { analyzeDangerousFunctions } from '../analyzers/dangerous-functions.js';

describe('dangerous-functions', () => {
  describe('existing JS/TS patterns', () => {
    it('should detect eval()', () => {
      const result = analyzeDangerousFunctions('const r = eval(userInput);');
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('eval');
      expect(result.locations[0].severity).toBe('critical');
    });

    it('should detect Function constructor', () => {
      const result = analyzeDangerousFunctions('const fn = Function("return " + code);');
      expect(result.count).toBe(1);
      expect(result.locations[0].severity).toBe('critical');
    });

    it('should detect innerHTML assignment', () => {
      const result = analyzeDangerousFunctions('el.innerHTML = userContent;');
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('innerHTML-assignment');
      expect(result.locations[0].severity).toBe('high');
    });

    it('should detect dangerouslySetInnerHTML', () => {
      const result = analyzeDangerousFunctions('<div dangerouslySetInnerHTML={{ __html: content }} />');
      expect(result.count).toBe(1);
      expect(result.locations[0].severity).toBe('medium');
    });

    it('should detect shell exec but not execFile', () => {
      // NOTE: This test detects child_process.exec -- the dangerous pattern.
      // This analyzer reads source text to flag risky patterns; it does NOT execute them.
      const exec_result = analyzeDangerousFunctions('require("child_process").exec(cmd);');
      expect(exec_result.count).toBe(1);

      const execFile_result = analyzeDangerousFunctions('require("child_process").execFile("/bin/ls", ["-la"]);');
      expect(execFile_result.count).toBe(0);
    });
  });

  describe('new JS/TS patterns', () => {
    it('should detect setTimeout with string argument', () => {
      const result = analyzeDangerousFunctions('setTimeout("alert(1)", 1000);');
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('setTimeout-string');
    });

    it('should NOT detect setTimeout with function argument', () => {
      const result = analyzeDangerousFunctions('setTimeout(() => { doThing(); }, 1000);');
      expect(result.count).toBe(0);
    });

    it('should detect setInterval with string argument', () => {
      const result = analyzeDangerousFunctions('setInterval("poll()", 5000);');
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('setInterval-string');
    });

    it('should detect document.write()', () => {
      const result = analyzeDangerousFunctions('document.write(userContent);');
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('document-write');
      expect(result.locations[0].severity).toBe('high');
    });

    it('should detect execSync()', () => {
      const result = analyzeDangerousFunctions('const out = execSync(cmd);');
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('execSync');
    });

    it('should detect vm.runInNewContext()', () => {
      const result = analyzeDangerousFunctions('vm.runInNewContext(code, sandbox);');
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('vm-runInNewContext');
    });
  });

  describe('Python patterns', () => {
    it('should detect os.system()', () => {
      const result = analyzeDangerousFunctions('os.system(user_cmd)');
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('python-os-system');
    });

    it('should detect subprocess with shell=True', () => {
      const result = analyzeDangerousFunctions('subprocess.call(cmd, shell=True)');
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('python-subprocess-shell');
    });

    it('should detect Python eval()', () => {
      const result = analyzeDangerousFunctions('result = eval(user_expr)');
      expect(result.count).toBe(1);
      expect(result.locations[0].severity).toBe('critical');
    });

    it('should detect Python exec()', () => {
      const result = analyzeDangerousFunctions('exec(user_code)');
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('python-exec');
    });

    it('should detect pickle.loads()', () => {
      const result = analyzeDangerousFunctions('obj = pickle.loads(data)');
      expect(result.count).toBe(1);
      expect(result.locations[0].pattern).toBe('python-pickle-loads');
    });
  });

  describe('per-finding severity', () => {
    it('should assign critical to eval and Function', () => {
      const result = analyzeDangerousFunctions('eval(x);\nnew Function(y);');
      expect(result.locations[0].severity).toBe('critical');
      expect(result.locations[1].severity).toBe('critical');
    });

    it('should assign high to innerHTML and document.write', () => {
      const result = analyzeDangerousFunctions('el.innerHTML = x;\ndocument.write(y);');
      expect(result.locations[0].severity).toBe('high');
      expect(result.locations[1].severity).toBe('high');
    });

    it('should assign medium to dangerouslySetInnerHTML', () => {
      const result = analyzeDangerousFunctions('dangerouslySetInnerHTML={{ __html: x }}');
      expect(result.locations[0].severity).toBe('medium');
    });
  });

  describe('false-positive regression suite', () => {
    const knownSafePatterns = [
      // setTimeout/setInterval with function (not string)
      `setTimeout(() => { doThing(); }, 1000);`,
      `setInterval(checkStatus, 5000);`,
      `setTimeout(function() { refresh(); }, 100);`,
      // execFile (safe alternative)
      `require("child_process").execFile("/bin/ls", ["-la"]);`,
      // eval in variable name or comment
      `const evalResult = computeScore();`,
      `// Don't use eval() here`,
      // Function as variable name
      `const myFunction = () => {};`,
      // innerHTML read (not assignment)
      `const html = el.innerHTML;`,
      `console.log(el.innerHTML);`,
      // Python safe subprocess
      `subprocess.run(["ls", "-la"])`,
      `subprocess.call(["git", "status"])`,
    ];

    for (const pattern of knownSafePatterns) {
      it(`should NOT flag: ${pattern.slice(0, 60)}...`, () => {
        const result = analyzeDangerousFunctions(pattern);
        expect(result.count, `False positive on: ${pattern}`).toBe(0);
      });
    }
  });
});
