import { statSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { describe, test, expect } from 'vitest';
import { createCLITestHarness, CLITestProject } from '../src';

class FakeProject extends CLITestProject {}

describe('createCLITestHarness', () => {
  test('should return object with specific properties from createCLITestHarness', () => {
    let { runBin, setupProject, setupTmpDir, teardownProject } =
      createCLITestHarness({
        binPath: './foo',
      });

    expect(runBin).toBeTypeOf('function');
    expect(setupProject).toBeTypeOf('function');
    expect(setupTmpDir).toBeTypeOf('function');
    expect(teardownProject).toBeTypeOf('function');
  });

  test('setupTmpDir should return a tmpDir that points to a tmp dir path', async () => {
    let { setupTmpDir } = createCLITestHarness({
      binPath: './foo',
    });

    let tmp = await setupTmpDir();

    expect(statSync(tmp).isDirectory()).toEqual(true);
  });

  test('setupProject should return a default project', async () => {
    let { setupProject } = createCLITestHarness({
      binPath: './foo',
    });

    let project = await setupProject();

    expect(project).toBeInstanceOf(CLITestProject);
  });

  test('setupProject should return a custom project', async () => {
    let { setupProject } = createCLITestHarness({
      binPath: './foo',
      projectConstructor: FakeProject,
    });

    let project = await setupProject();

    expect(project).toBeInstanceOf(FakeProject);
  });

  test('teardownProject should result in the project being disposed of', async () => {
    let { setupProject, teardownProject } = createCLITestHarness({
      binPath: './foo',
    });

    let project = await setupProject();

    expect(project).toBeInstanceOf(CLITestProject);

    teardownProject();

    expect(existsSync(project.baseDir)).toEqual(false);
  });

  test('runBin can run the configured bin script', async () => {
    let { setupProject, teardownProject, runBin } = createCLITestHarness({
      binPath: fileURLToPath(
        new URL('./fixtures/fake-bin.js', import.meta.url)
      ),
    });

    await setupProject();

    let result = await runBin();

    expect(result.stdout).toMatchInlineSnapshot('"I am a bin who takes args  []"');

    teardownProject();
  });

  test('runBin can run the configured bin script with arguments', async () => {
    let { setupProject, teardownProject, runBin } = createCLITestHarness({
      binPath: fileURLToPath(
        new URL('./fixtures/fake-bin.js', import.meta.url)
      ),
    });

    await setupProject();

    let result = await runBin({
      args: ['--with', 'some', '--arguments'],
    });

    expect(result.stdout).toMatchInlineSnapshot(
      "\"I am a bin who takes args  [ '--with', 'some', '--arguments' ]\""
    );

    teardownProject();
  });
});
