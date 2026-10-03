import { existsSync } from 'node:fs';
import { realpathSync } from 'node:fs';
import { describe, test, expect, afterEach } from 'vitest';
import { BintasticProject } from '../src';
import { createProjectLifecycle } from '../src/project-lifecycle';

const leftovers: BintasticProject[] = [];
const originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);
  for (const project of leftovers) project.dispose();
  leftovers.length = 0;
});

/**
 * Creates a lifecycle over real BintasticProjects with a test-local env.
 * @param {Record<string, string | undefined>} env - The env Debug mode is read from at teardown.
 * @returns {ReturnType<typeof createProjectLifecycle<BintasticProject>>} The lifecycle.
 */
function lifecycleWith(env: Record<string, string | undefined> = {}) {
  return createProjectLifecycle({
    createProject: () => {
      const project = new BintasticProject();
      leftovers.push(project);
      return project;
    },
    env,
  });
}

describe('Project lifecycle', () => {
  test('setup writes a Project and makes it active', async () => {
    const lifecycle = lifecycleWith();

    const project = await lifecycle.setup();

    expect(existsSync(project.baseDir)).toEqual(true);
    expect(lifecycle.active).toBe(project);
  });

  test('teardown removes the Project and goes idle', async () => {
    const lifecycle = lifecycleWith();
    const project = await lifecycle.setup();

    lifecycle.teardown();

    expect(existsSync(project.baseDir)).toEqual(false);
    expect(lifecycle.active).toBeUndefined();
  });

  test('teardown when idle is a no-op', async () => {
    const lifecycle = lifecycleWith();

    expect(() => lifecycle.teardown()).not.toThrow();

    await lifecycle.setup();
    lifecycle.teardown();

    expect(() => lifecycle.teardown()).not.toThrow();
  });

  test('a preserved Project is kept on disk, released, and its cwd restored', async () => {
    const lifecycle = lifecycleWith();
    const project = await lifecycle.setup();
    await project.chdir();

    lifecycle.preserve();
    lifecycle.teardown();

    expect(existsSync(project.baseDir)).toEqual(true);
    expect(lifecycle.active).toBeUndefined();
    expect(realpathSync(process.cwd())).toEqual(realpathSync(originalCwd));
  });

  test('BINTASTIC_DEBUG at teardown preserves the Project without a Debug mode Run', async () => {
    const env: Record<string, string | undefined> = {};
    const lifecycle = lifecycleWith(env);
    const project = await lifecycle.setup();

    env.BINTASTIC_DEBUG = 'attach';
    lifecycle.teardown();

    expect(existsSync(project.baseDir)).toEqual(true);
    expect(lifecycle.active).toBeUndefined();
  });

  test('a disabled BINTASTIC_DEBUG does not preserve the Project', async () => {
    const lifecycle = lifecycleWith({ BINTASTIC_DEBUG: '' });
    const project = await lifecycle.setup();

    lifecycle.teardown();

    expect(existsSync(project.baseDir)).toEqual(false);
  });

  test('a preserved Project survives the next setup', async () => {
    const lifecycle = lifecycleWith();
    const preserved = await lifecycle.setup();
    lifecycle.preserve();
    lifecycle.teardown();

    const next = await lifecycle.setup();

    expect(existsSync(preserved.baseDir)).toEqual(true);
    expect(lifecycle.active).toBe(next);
  });

  test('preservation does not carry over to the next Project', async () => {
    const lifecycle = lifecycleWith();
    await lifecycle.setup();
    lifecycle.preserve();
    lifecycle.teardown();

    const next = await lifecycle.setup();
    lifecycle.teardown();

    expect(existsSync(next.baseDir)).toEqual(false);
  });

  test('setup over an active Project tears the old one down', async () => {
    const lifecycle = lifecycleWith();
    const first = await lifecycle.setup();

    await lifecycle.setup();

    expect(existsSync(first.baseDir)).toEqual(false);
  });

  test('setup over an active Project in Debug mode preserves the old one', async () => {
    const lifecycle = lifecycleWith({ BINTASTIC_DEBUG: 'attach' });
    const first = await lifecycle.setup();

    await lifecycle.setup();

    expect(existsSync(first.baseDir)).toEqual(true);
  });

  test('a Project that fails to write is removed and the lifecycle stays idle', async () => {
    class BrokenProject extends BintasticProject {
      async write(): Promise<void> {
        throw new Error('disk full');
      }
    }
    let brokenDir = '';
    const lifecycle = createProjectLifecycle({
      createProject: () => {
        const project = new BrokenProject();
        // baseDir is created lazily; touch it so the tmp dir exists, as after a partial write.
        brokenDir = project.baseDir;
        return project;
      },
      env: {},
    });

    await expect(lifecycle.setup()).rejects.toThrow('disk full');

    expect(existsSync(brokenDir)).toEqual(false);
    expect(lifecycle.active).toBeUndefined();
  });
});
