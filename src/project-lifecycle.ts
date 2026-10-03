import type BintasticProject from './project';
import { resolveDebugMode } from './run-plan';

/**
 * Inputs to the Project lifecycle.
 * @internal
 */
export interface ProjectLifecycleOptions<TProject extends BintasticProject> {
  /**
   * Builds a fresh, unwritten Project.
   */
  createProject: () => TProject | PromiseLike<TProject>;
  /**
   * The env Debug mode is read from at teardown. Read live, so pass `process.env` itself.
   */
  env: Readonly<Record<string, unknown>>;
}

/**
 * Owns the single active Project: idle until setup, active until teardown.
 * @internal
 */
export interface ProjectLifecycle<TProject extends BintasticProject> {
  /**
   * The active Project, or undefined when idle.
   */
  readonly active: TProject | undefined;
  /**
   * Tears down any active Project, then creates, writes, and activates a new one.
   */
  setup(): Promise<TProject>;
  /**
   * Marks the active Project to be kept on disk at teardown.
   */
  preserve(): void;
  /**
   * Releases the active Project: restores cwd, then removes the directory unless the
   * Project is preserved or Debug mode is on. A no-op when idle.
   */
  teardown(): void;
}

/**
 * Creates the Project lifecycle used by createBintastic.
 * @param {ProjectLifecycleOptions<TProject>} options - How to build Projects and where to read Debug mode.
 * @returns {ProjectLifecycle<TProject>} The lifecycle, initially idle.
 * @internal
 */
export function createProjectLifecycle<TProject extends BintasticProject>({
  createProject,
  env,
}: ProjectLifecycleOptions<TProject>): ProjectLifecycle<TProject> {
  let active: TProject | undefined;
  let preserved = false;

  /**
   * Releases the active Project and returns to idle.
   */
  function teardown(): void {
    const project = active;
    const keep = preserved || resolveDebugMode({ env }) !== undefined;
    active = undefined;
    preserved = false;

    if (!project) {
      return;
    }

    if (keep) {
      project.restoreCwd();
      console.log(`[bintastic] Fixture preserved: ${project.baseDir}`);
      return;
    }

    project.dispose();
  }

  return {
    get active() {
      return active;
    },

    async setup() {
      teardown();

      const project = await createProject();

      try {
        await project.write();
      } catch (error) {
        project.dispose();
        throw error;
      }

      active = project;
      return project;
    },

    preserve() {
      if (active) {
        preserved = true;
      }
    },

    teardown,
  };
}
