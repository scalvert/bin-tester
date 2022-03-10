import { statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test, expect } from 'vitest';
import { createCLITestHarness, CLITestProject } from '../src';

class FakeProject extends CLITestProject {}

describe('createCLITestHarness', () => {
  test('should return object with specific properties from createCLITestHarness', () => {
    const { runBin, setupProject, setupTmpDir, teardownProject } =
      createCLITestHarness({
        binPath: './foo',
      });

    expect(runBin).toBeTypeOf('function');
    expect(setupProject).toBeTypeOf('function');
    expect(setupTmpDir).toBeTypeOf('function');
    expect(teardownProject).toBeTypeOf('function');
  });

  test('setupTmpDir should return a tmpDir that points to a tmp dir path', async () => {
    const { setupTmpDir } = createCLITestHarness({
      binPath: './foo',
    });

    const tmp = await setupTmpDir();

    expect(statSync(tmp).isDirectory()).toEqual(true);
  });

  test('setupProject should return a default project', async () => {
    const { setupProject } = createCLITestHarness({
      binPath: './foo',
    });

    const project = await setupProject();

    expect(project).toBeInstanceOf(CLITestProject);
  });

  test('setupProject should return a custom project', async () => {
    const { setupProject } = createCLITestHarness({
      binPath: './foo',
      projectConstructor: FakeProject,
    });

    const project = await setupProject();

    expect(project).toBeInstanceOf(FakeProject);
  });

  test('teardownProject should result in the project being disposed of', async () => {
    const { setupProject, teardownProject } = createCLITestHarness({
      binPath: './foo',
    });

    const project = await setupProject();

    expect(project).toBeInstanceOf(CLITestProject);

    teardownProject();

    expect(existsSync(project.baseDir)).toEqual(false);
  });

  test('runBin can run the configured bin script', async () => {
    const { setupProject, teardownProject, runBin } = createCLITestHarness({
      binPath: fileURLToPath(new URL('fixtures/fake-bin.js', import.meta.url)),
    });

    await setupProject();

    const result = await runBin();

    expect(result.stdout).toMatchInlineSnapshot(
      '"I am a bin who takes args  []"'
    );

    teardownProject();
  });

  test('runBin can run the configured bin script with arguments', async () => {
    const { setupProject, teardownProject, runBin } = createCLITestHarness({
      binPath: fileURLToPath(new URL('fixtures/fake-bin.js', import.meta.url)),
    });

    await setupProject();

    const result = await runBin({
      args: ['--with', 'some', '--arguments'],
    });

    expect(result.stdout).toMatchInlineSnapshot(
      "\"I am a bin who takes args  [ '--with', 'some', '--arguments' ]\""
    );

    teardownProject();
  });
});