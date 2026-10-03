import { statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test, expect } from 'vitest';
import { createBintastic, BintasticProject, json, text } from '../src';

class FakeProject extends BintasticProject {}

describe('createBintastic', () => {
  test('should return object with specific properties from createBintastic', () => {
    const { runBin, setupProject, setupTmpDir, teardownProject } = createBintastic({
      binPath: './foo',
    });

    expect(runBin).toBeTypeOf('function');
    expect(setupProject).toBeTypeOf('function');
    expect(setupTmpDir).toBeTypeOf('function');
    expect(teardownProject).toBeTypeOf('function');
  });

  test('setupTmpDir should return a tmpDir that points to a tmp dir path', async () => {
    const { setupTmpDir } = createBintastic({
      binPath: './foo',
    });

    const tmp = await setupTmpDir();

    expect(statSync(tmp).isDirectory()).toEqual(true);
  });

  test('setupProject should return a default project', async () => {
    const { setupProject } = createBintastic({
      binPath: './foo',
    });

    const project = await setupProject();

    expect(project).toBeInstanceOf(BintasticProject);
  });

  test('setupProject should return a custom project', async () => {
    const { setupProject } = createBintastic({
      binPath: './foo',
      createProject: async () => new FakeProject(),
    });

    const project = await setupProject();

    expect(project).toBeInstanceOf(FakeProject);
  });

  test('setupProject should accept a synchronous custom project factory', async () => {
    const { setupProject } = createBintastic({
      binPath: './foo',
      createProject: () => new FakeProject(),
    });

    const project = await setupProject();

    expect(project).toBeInstanceOf(FakeProject);
  });

  test('teardownProject should result in the project being disposed of', async () => {
    const { setupProject, teardownProject } = createBintastic({
      binPath: './foo',
    });

    const project = await setupProject();

    expect(project).toBeInstanceOf(BintasticProject);

    teardownProject();

    expect(existsSync(project.baseDir)).toEqual(false);
  });

  test('runBin rejects a relative binPath without importMeta', async () => {
    const { setupProject, teardownProject, runBin } = createBintastic({
      binPath: './fixtures/fake-bin.js',
    });

    await setupProject();

    expect(() => runBin()).toThrow(
      '[bintastic] binPath must be an absolute path when importMeta is not provided'
    );

    teardownProject();
  });

  test('runBin resolves a relative binPath against importMeta.url', async () => {
    const { setupProject, teardownProject, runBin } = createBintastic({
      importMeta: import.meta,
      binPath: 'fixtures/fake-bin.js',
    });

    const project = await setupProject();

    const result = await runBin();

    expect(result.stdout).toMatchInlineSnapshot('"I am a bin who takes args []"');

    teardownProject();

    expect(existsSync(project.baseDir)).toEqual(false);
  });

  test('runBin resolves a function binPath against importMeta.url', async () => {
    const { setupProject, teardownProject, runBin } = createBintastic({
      importMeta: import.meta,
      binPath: (p) => {
        expect(p).toEqual(project);
        return 'fixtures/fake-bin.js';
      },
    });

    const project = await setupProject();

    const result = await runBin();

    expect(result.stdout).toMatchInlineSnapshot('"I am a bin who takes args []"');

    teardownProject();

    expect(existsSync(project.baseDir)).toEqual(false);
  });

  test('runBin accepts a pre-resolved absolute binPath (legacy)', async () => {
    const { setupProject, teardownProject, runBin } = createBintastic({
      binPath: fileURLToPath(new URL('fixtures/fake-bin.js', import.meta.url)),
    });

    const project = await setupProject();

    const result = await runBin();

    expect(result.stdout).toMatchInlineSnapshot('"I am a bin who takes args []"');

    teardownProject();

    expect(existsSync(project.baseDir)).toEqual(false);
  });

  test('runBin can run the configured bin script with static arguments', async () => {
    const { setupProject, teardownProject, runBin } = createBintastic({
      importMeta: import.meta,
      binPath: 'fixtures/fake-bin.js',
      staticArgs: ['--static', 'true'],
    });

    const project = await setupProject();

    const result = await runBin('--with', 'some', '--arguments');

    expect(result.stdout).toMatchInlineSnapshot(
      "\"I am a bin who takes args [ '--static', 'true', '--with', 'some', '--arguments' ]\""
    );

    teardownProject();

    expect(existsSync(project.baseDir)).toEqual(false);
  });

  test('runBin executes from the fixture project and reads nested fixture files', async () => {
    const { setupProject, teardownProject, runBin } = createBintastic({
      importMeta: import.meta,
      binPath: 'fixtures/read-fixture.mjs',
    });

    const project = await setupProject();
    project.files = {
      nested: {
        'input.txt': 'fixture content',
      },
    };
    await project.write();

    const result = await runBin();
    expect(JSON.parse(result.stdout)).toEqual({
      cwd: project.baseDir,
      content: 'fixture content',
    });

    teardownProject();
  });

  test('runBin can run the configured bin script with arguments', async () => {
    const { setupProject, teardownProject, runBin } = createBintastic({
      importMeta: import.meta,
      binPath: 'fixtures/fake-bin.js',
    });

    const project = await setupProject();

    const result = await runBin('--with', 'some', '--arguments');

    expect(result.stdout).toMatchInlineSnapshot(
      "\"I am a bin who takes args [ '--with', 'some', '--arguments' ]\""
    );

    teardownProject();

    expect(existsSync(project.baseDir)).toEqual(false);
  });

  test('runBin can run the configured bin script with arguments and execa options', async () => {
    const { setupProject, teardownProject, runBin } = createBintastic({
      importMeta: import.meta,
      binPath: 'fixtures/fake-bin-with-env.js',
    });

    const project = await setupProject();

    const result = await runBin('--with', 'some', '--arguments', {
      env: {
        BINTASTIC: true,
        BINTASTIC_DEBUG: 'false',
        NODE_OPTIONS: '',
      },
    });

    expect(result.stderr).toMatchInlineSnapshot('""');
    expect(result.stdout).toMatchInlineSnapshot('"I am an env var true"');

    teardownProject();

    expect(existsSync(project.baseDir)).toEqual(false);
  });

  test('runBinDebug enables inspector flags without global env change', async () => {
    const { setupProject, teardownProject, runBinDebug } = createBintastic({
      binPath: fileURLToPath(new URL('fixtures/print-exec-argv.js', import.meta.url)),
    });

    const project = await setupProject();

    const before = process.env.BINTASTIC_DEBUG;
    expect(before).toBeUndefined();

    const result = await runBinDebug({});
    const execArgv = JSON.parse(result.stdout);
    expect(execArgv.find((a: string) => a.startsWith('--inspect'))).toBeTypeOf('string');
    expect(process.env.BINTASTIC_DEBUG).toBeUndefined();

    // runBinDebug activated debug mode, so teardown keeps the fixture and releases the project
    teardownProject();
    expect(existsSync(project.baseDir)).toEqual(true);
    expect(() => runBinDebug()).toThrow(
      '[bintastic] setupProject() must be called before runBinDebug()'
    );

    project.dispose();
  });

  test('runBinDebug preserves tmp dir on teardown without process.env mutation (CHK-005)', async () => {
    const { setupProject, teardownProject, runBinDebug } = createBintastic({
      binPath: fileURLToPath(new URL('fixtures/print-exec-argv.js', import.meta.url)),
    });

    const project = await setupProject();

    expect(process.env.BINTASTIC_DEBUG).toBeUndefined();

    await runBinDebug({});

    // process.env must remain unset — runBinDebug should not mutate it
    expect(process.env.BINTASTIC_DEBUG).toBeUndefined();

    teardownProject();

    // Because runBinDebug activated debug mode via execa env, teardownProject must preserve fixtures
    expect(existsSync(project.baseDir)).toEqual(true);

    // Second teardown (with no debug active) should clean up
    project.dispose();
    expect(existsSync(project.baseDir)).toEqual(false);
  });

  test('setupProject called twice disposes the first project directory', async () => {
    const { setupProject, teardownProject } = createBintastic({
      binPath: './foo',
    });

    const firstProject = await setupProject();
    const firstBaseDir = firstProject.baseDir;

    await setupProject();

    expect(existsSync(firstBaseDir)).toEqual(false);

    teardownProject();
  });

  test('teardownProject invalidates the disposed project', async () => {
    const { setupProject, teardownProject, runBin } = createBintastic({
      binPath: './foo',
    });

    await setupProject();
    teardownProject();

    expect(() => runBin()).toThrow('[bintastic] setupProject() must be called before runBin()');
  });

  test('debug preservation does not leak to a replacement project', async () => {
    const { setupProject, teardownProject, runBinDebug } = createBintastic({
      binPath: fileURLToPath(new URL('fixtures/print-exec-argv.js', import.meta.url)),
    });

    const preservedProject = await setupProject();
    await runBinDebug({});
    teardownProject();
    expect(existsSync(preservedProject.baseDir)).toEqual(true);

    const replacementProject = await setupProject();
    // The next setupProject must not remove the preserved fixture
    expect(existsSync(preservedProject.baseDir)).toEqual(true);
    teardownProject();

    expect(existsSync(replacementProject.baseDir)).toEqual(false);
    preservedProject.dispose();
  });

  test('teardownProject is safe to call without an active project', () => {
    const { teardownProject } = createBintastic({ binPath: './foo' });

    expect(() => teardownProject()).not.toThrow();
  });
});

describe('BintasticProject', () => {
  test('restores the cwd that was active before chdir', async () => {
    const originalCwd = process.cwd();
    const callerProject = new BintasticProject();
    const targetProject = new BintasticProject();

    try {
      process.chdir(callerProject.baseDir);
      await targetProject.chdir();
      await targetProject.chdir();
      targetProject.dispose();

      expect(process.cwd()).toEqual(callerProject.baseDir);
    } finally {
      callerProject.dispose();
      process.chdir(originalCwd);
    }
  });

  test('restoreCwd returns to the previous cwd and keeps the directory', async () => {
    const originalCwd = process.cwd();
    const project = new BintasticProject();

    try {
      await project.chdir();
      project.restoreCwd();

      expect(process.cwd()).toEqual(originalCwd);
      expect(existsSync(project.baseDir)).toEqual(true);

      project.restoreCwd();
      expect(process.cwd()).toEqual(originalCwd);
    } finally {
      process.chdir(originalCwd);
      project.dispose();
    }
  });
});

describe('json', () => {
  test('stringifies JSON template content', () => {
    expect(json`{ "foo": "bar" }`).toEqual('{"foo":"bar"}');
  });

  test('serializes interpolated values as JSON', () => {
    expect(
      json`{ "name": ${'test'}, "nested": ${{ enabled: true }}, "items": ${['a', 'b']} }`
    ).toEqual('{"name":"test","nested":{"enabled":true},"items":["a","b"]}');
  });

  test('throws when template content is not valid JSON', () => {
    expect(() => json`{ foo: "bar" }`).toThrow(SyntaxError);
  });

  test('throws when an interpolated value is not JSON-serializable', () => {
    expect(() => json`{ "value": ${undefined} }`).toThrow(
      '[bintastic] json template values must be JSON-serializable'
    );
  });

  test('throws when an interpolated number is not finite', () => {
    expect(() => json`{ "value": ${Number.NaN} }`).toThrow(
      '[bintastic] json template values must be JSON-serializable'
    );
    expect(() => json`{ "value": ${Infinity} }`).toThrow(
      '[bintastic] json template values must be JSON-serializable'
    );
  });

  test('throws when a non-finite number is nested inside an interpolated value', () => {
    expect(() => json`{ "value": ${{ count: Number.NaN }} }`).toThrow(
      '[bintastic] json template values must be JSON-serializable'
    );
  });

  test('throws when unsupported values are nested inside an interpolated value', () => {
    const omitted = Reflect.get({}, 'missing');
    const unsupportedValues = [
      { nested: omitted },
      { nested: () => {} },
      { nested: Symbol('unsupported') },
      [omitted],
      [() => {}],
      [Symbol('unsupported')],
    ];

    for (const value of unsupportedValues) {
      expect(() => json`{ "value": ${value} }`).toThrow(
        '[bintastic] json template values must be JSON-serializable'
      );
    }
  });

  test('throws a branded error when an interpolated value is a BigInt', () => {
    expect(() => json`{ "value": ${10n} }`).toThrow(
      '[bintastic] json template values must be JSON-serializable'
    );
  });
});

describe('text', () => {
  test('dedents text template content', () => {
    expect(text`
      export function main() {
        console.log('hello');
      }
    `).toEqual("export function main() {\n  console.log('hello');\n}");
  });

  test('preserves intentional blank lines inside content', () => {
    expect(text`
      # Title

      Body text.
    `).toEqual('# Title\n\nBody text.');
  });

  test('serializes interpolated values as text', () => {
    const name = 'fixture';

    expect(text`
      export const name = '${name}';
    `).toEqual("export const name = 'fixture';");
  });

  test('dedents the template without re-indenting multi-line interpolated values', () => {
    const value = 'first\nsecond';

    expect(text`
      const x = "${value}";
      const y = 1;
    `).toEqual('const x = "first\nsecond";\nconst y = 1;');
  });

  test('normalizes carriage returns in the template', () => {
    const template = ['\n  a\r\n  b\r  c\n'] as unknown as TemplateStringsArray;

    expect(text(template)).toEqual('a\nb\nc');
  });

  test('leaves content untouched when indentation mixes tabs and spaces', () => {
    const template = ['\n\tconst a = 1;\n  const b = 2;\n'] as unknown as TemplateStringsArray;

    expect(text(template)).toEqual('\tconst a = 1;\n  const b = 2;');
  });

  test('dedents the remaining lines when content starts on the opening line', () => {
    expect(text`first
      second
      third`).toEqual('first\nsecond\nthird');
  });

  test('ignores flush lines when computing common indentation', () => {
    const template = ['\n  a\nb\n  c\n'] as unknown as TemplateStringsArray;

    expect(text(template)).toEqual('a\nb\nc');
  });

  test('normalizes whitespace-only lines to empty', () => {
    const template = ['\n    a\n        \n    b\n'] as unknown as TemplateStringsArray;

    expect(text(template)).toEqual('a\n\nb');
  });

  test('coerces interpolated values the same way a native template literal does', () => {
    expect(text`count=${42}`).toEqual('count=42');
  });
});
