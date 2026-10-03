import { describe, test, expect } from 'vitest';
import { planRun, resolveDebugMode } from '../src/run-plan';

const project = { baseDir: '/tmp/fake-project' };
const importMeta = { url: 'file:///repo/tests/cli-test.ts' } as ImportMeta;
const parentExecArgv = ['--conditions', 'development', '--inspect=9229', '--trace-warnings'];

/**
 * Plans a Run with an absolute binPath, a fake Project, and empty parent process state.
 * @param {Partial<Parameters<typeof planRun>[0]>} overrides - Inputs to change for this case.
 * @returns {ReturnType<typeof planRun>} The Run plan.
 */
function plan(overrides: Partial<Parameters<typeof planRun>[0]> = {}) {
  return planRun({
    config: { binPath: '/abs/bin.js' },
    project,
    args: [],
    env: {},
    execArgv: [],
    ...overrides,
  });
}

describe('resolveDebugMode', () => {
  test.each([
    ['unset', undefined],
    ['empty', ''],
    ['zero', '0'],
    ['false', 'false'],
    ['FALSE', 'FALSE'],
  ])('treats %s BINTASTIC_DEBUG as off', (_label, value) => {
    expect(resolveDebugMode({ env: { BINTASTIC_DEBUG: value } })).toBeUndefined();
  });

  test.each([
    ['attach', 'attach'],
    ['1', 'attach'],
    ['true', 'attach'],
    ['break', 'break'],
    ['BREAK', 'break'],
  ])('treats BINTASTIC_DEBUG=%s as %s', (value, expected) => {
    expect(resolveDebugMode({ env: { BINTASTIC_DEBUG: value } })).toEqual(expected);
  });

  test('per-call env takes precedence over process env', () => {
    expect(
      resolveDebugMode({
        callEnv: { BINTASTIC_DEBUG: 'false' },
        env: { BINTASTIC_DEBUG: 'attach' },
      })
    ).toBeUndefined();
    expect(resolveDebugMode({ callEnv: { BINTASTIC_DEBUG: 'break' }, env: {} })).toEqual('break');
  });

  test('an undefined per-call value falls back to process env', () => {
    expect(
      resolveDebugMode({
        callEnv: { BINTASTIC_DEBUG: undefined },
        env: { BINTASTIC_DEBUG: 'break' },
      })
    ).toEqual('break');
  });

  test('forced debug overrides a disabled env and defaults to attach', () => {
    expect(resolveDebugMode({ forced: true, env: { BINTASTIC_DEBUG: 'false' } })).toEqual('attach');
    expect(resolveDebugMode({ forced: true, env: {} })).toEqual('attach');
  });

  test('forced debug honours break from either env source', () => {
    expect(resolveDebugMode({ forced: true, env: { BINTASTIC_DEBUG: 'break' } })).toEqual('break');
    expect(
      resolveDebugMode({ forced: true, callEnv: { BINTASTIC_DEBUG: 'break' }, env: {} })
    ).toEqual('break');
  });
});

describe('planRun', () => {
  describe('args', () => {
    test('prepends static args to call args', () => {
      const result = plan({
        config: { binPath: '/abs/bin.js', staticArgs: ['--static', 'true'] },
        args: ['--with', 'some'],
      });

      expect(result.file).toEqual('/abs/bin.js');
      expect(result.args).toEqual(['--static', 'true', '--with', 'some']);
    });

    test('splits a trailing execa options object off the call args', () => {
      const result = plan({ args: ['a', 'b', { timeout: 10 }] });

      expect(result.args).toEqual(['a', 'b']);
      expect(result.options.timeout).toEqual(10);
    });
  });

  describe('execa options', () => {
    test('defaults cwd to the Project and disables rejection', () => {
      const result = plan();

      expect(result.options.cwd).toEqual(project.baseDir);
      expect(result.options.reject).toEqual(false);
    });

    test('lets the caller override cwd and reject', () => {
      const result = plan({ args: [{ cwd: '/elsewhere', reject: true }] });

      expect(result.options.cwd).toEqual('/elsewhere');
      expect(result.options.reject).toEqual(true);
    });

    test('passes the caller env through without injecting BINTASTIC_DEBUG', () => {
      expect(plan({ forceDebug: true }).options.env).toBeUndefined();
      expect(plan({ forceDebug: true, args: [{ env: { FOO: 'bar' } }] }).options.env).toEqual({
        FOO: 'bar',
      });
    });
  });

  describe('node options', () => {
    test('inherits parent flags except the inspector', () => {
      expect(plan({ execArgv: parentExecArgv }).options.nodeOptions).toEqual([
        '--conditions',
        'development',
        '--trace-warnings',
      ]);
    });

    test('caller nodeOptions replace inherited flags', () => {
      const result = plan({ execArgv: parentExecArgv, args: [{ nodeOptions: ['--no-warnings'] }] });

      expect(result.options.nodeOptions).toEqual(['--no-warnings']);
    });

    test('strips inspector flags from caller nodeOptions', () => {
      const result = plan({ args: [{ nodeOptions: ['--inspect-brk', '--no-warnings'] }] });

      expect(result.options.nodeOptions).toEqual(['--no-warnings']);
    });

    test('appends --inspect=0 in attach Debug mode', () => {
      const result = plan({ execArgv: parentExecArgv, env: { BINTASTIC_DEBUG: 'attach' } });

      expect(result.debugMode).toEqual('attach');
      expect(result.options.nodeOptions).toEqual([
        '--conditions',
        'development',
        '--trace-warnings',
        '--inspect=0',
      ]);
    });

    test('appends --inspect-brk=0 in break Debug mode', () => {
      const result = plan({ env: { BINTASTIC_DEBUG: 'break' } });

      expect(result.debugMode).toEqual('break');
      expect(result.options.nodeOptions).toEqual(['--inspect-brk=0']);
    });

    test('keeps caller nodeOptions in Debug mode', () => {
      const result = plan({ forceDebug: true, args: [{ nodeOptions: ['--no-warnings'] }] });

      expect(result.options.nodeOptions).toEqual(['--no-warnings', '--inspect=0']);
    });

    test('adds no inspector flag when Debug mode is off', () => {
      const result = plan({ env: { BINTASTIC_DEBUG: '' } });

      expect(result.debugMode).toBeUndefined();
      expect(result.options.nodeOptions).toEqual([]);
    });
  });

  describe('binPath', () => {
    test('rejects a relative binPath without importMeta', () => {
      expect(() => plan({ config: { binPath: './bin.js' } })).toThrow(
        '[bintastic] binPath must be an absolute path when importMeta is not provided'
      );
    });

    test('resolves a relative binPath against importMeta.url', () => {
      expect(plan({ config: { binPath: '../bin/cli.js', importMeta } }).file).toEqual(
        '/repo/bin/cli.js'
      );
    });

    test('calls a binPath function with the Project and resolves its result', () => {
      const result = plan({
        config: {
          importMeta,
          binPath: (p) => {
            expect(p).toBe(project);
            return 'fixtures/cli.js';
          },
        },
      });

      expect(result.file).toEqual('/repo/tests/fixtures/cli.js');
    });
  });
});
