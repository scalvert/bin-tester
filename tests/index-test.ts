import { statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test, expect } from 'vitest';
import { createBinTester, BinTesterProject } from '../src';

class FakeProject extends BinTesterProject {}

describe('createBinTester', () => {
  test('should return object with specific properties from createBinTester', () => {
    const { runBin, setupProject, setupTmpDir, teardownProject } = createBinTester({
      binPath: './foo',
    });

    expect(runBin).toBeTypeOf('function');
    expect(setupProject).toBeTypeOf('function');
    expect(setupTmpDir).toBeTypeOf('function');
    expect(teardownProject).toBeTypeOf('function');
  });

  test('setupTmpDir should return a tmpDir that points to a tmp dir path', async () => {
    const { setupTmpDir } = createBinTester({
      binPath: './foo',
    });

    const tmp = await setupTmpDir();

    expect(statSync(tmp).isDirectory()).toEqual(true);
  });

  test('setupProject should return a default project', async () => {
    const { setupProject } = createBinTester({
      binPath: './foo',
    });

    const project = await setupProject();

    expect(project).toBeInstanceOf(BinTesterProject);
  });

  test('setupProject should return a custom project', async () => {
    const { setupProject } = createBinTester({
      binPath: './foo',
      createProject: async () => new FakeProject(),
    });

    const project = await setupProject();

    expect(project).toBeInstanceOf(FakeProject);
  });

  test('teardownProject should result in the project being disposed of', async () => {
    const { setupProject, teardownProject } = createBinTester({
      binPath: './foo',
    });

    const project = await setupProject();

    expect(project).toBeInstanceOf(BinTesterProject);

    teardownProject();

    expect(existsSync(project.baseDir)).toEqual(false);
  });

  test('runBin can run the configured bin script', async () => {
    const { setupProject, teardownProject, runBin } = createBinTester({
      binPath: fileURLToPath(new URL('fixtures/fake-bin.js', import.meta.url)),
    });

    const project = await setupProject();

    const result = await runBin();

    expect(result.stdout).toMatchInlineSnapshot('"I am a bin who takes args []"');

    teardownProject();

    expect(existsSync(project.baseDir)).toEqual(false);
  });

  test('runBin can run the configured bin script dynamically', async () => {
    const { setupProject, teardownProject, runBin } = createBinTester({
      binPath: (p) => {
        expect(p).toEqual(project);
        return fileURLToPath(new URL('fixtures/fake-bin.js', import.meta.url));
      },
    });

    const project = await setupProject();

    const result = await runBin();

    expect(result.stdout).toMatchInlineSnapshot('"I am a bin who takes args []"');

    teardownProject();

    expect(existsSync(project.baseDir)).toEqual(false);
  });

  test('runBin can run the configured bin script with static arguments', async () => {
    const { setupProject, teardownProject, runBin } = createBinTester({
      binPath: fileURLToPath(new URL('fixtures/fake-bin.js', import.meta.url)),
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

  test('runBin can run the configured bin script with arguments', async () => {
    const { setupProject, teardownProject, runBin } = createBinTester({
      binPath: fileURLToPath(new URL('fixtures/fake-bin.js', import.meta.url)),
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
    const { setupProject, teardownProject, runBin } = createBinTester({
      binPath: fileURLToPath(new URL('fixtures/fake-bin-with-env.js', import.meta.url)),
    });

    const project = await setupProject();

    const result = await runBin('--with', 'some', '--arguments', {
      env: {
        BIN_TESTER: true,
        BIN_TESTER_DEBUG: 'false',
        NODE_OPTIONS: '',
      },
    });

    expect(result.stderr).toMatchInlineSnapshot('""');
    expect(result.stdout).toMatchInlineSnapshot('"I am an env var true"');

    teardownProject();

    expect(existsSync(project.baseDir)).toEqual(false);
  });

  test('BIN_TESTER_DEBUG env toggles inspector flags passed to child', async () => {
    const { setupProject, teardownProject, runBin } = createBinTester({
      binPath: fileURLToPath(new URL('fixtures/print-exec-argv.js', import.meta.url)),
    });

    const project = await setupProject();

    try {
      process.env.BIN_TESTER_DEBUG = 'attach';

      const result = await runBin({});

      const execArgv = JSON.parse(result.stdout);

      expect(Array.isArray(execArgv)).toEqual(true);
      expect(execArgv.find((a: string) => a.startsWith('--inspect'))).toBeTypeOf('string');
    } finally {
      delete process.env.BIN_TESTER_DEBUG;
      teardownProject();
    }

    expect(existsSync(project.baseDir)).toEqual(false);
  });

  test('runBinDebug enables inspector flags without global env change', async () => {
    const { setupProject, teardownProject, runBinDebug } = createBinTester({
      binPath: fileURLToPath(new URL('fixtures/print-exec-argv.js', import.meta.url)),
    });

    const project = await setupProject();

    const before = process.env.BIN_TESTER_DEBUG;
    expect(before).toBeUndefined();

    const result = await runBinDebug({});
    const execArgv = JSON.parse(result.stdout);
    expect(execArgv.find((a: string) => a.startsWith('--inspect'))).toBeTypeOf('string');
    expect(process.env.BIN_TESTER_DEBUG).toBeUndefined();

    teardownProject();
    expect(existsSync(project.baseDir)).toEqual(false);
  });

  test('BIN_TESTER_DEBUG preserves tmp dir on teardown', async () => {
    const { setupProject, teardownProject, runBin } = createBinTester({
      binPath: fileURLToPath(new URL('fixtures/fake-bin.js', import.meta.url)),
    });

    const project = await setupProject();

    try {
      process.env.BIN_TESTER_DEBUG = 'attach';
      await runBin();

      teardownProject();

      // With DEBUG set, the directory should still exist
      expect(existsSync(project.baseDir)).toEqual(true);
    } finally {
      delete process.env.BIN_TESTER_DEBUG;
      teardownProject();
    }

    expect(existsSync(project.baseDir)).toEqual(false);
  });

});
