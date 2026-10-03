import { execaNode, type Options, type ResultPromise } from 'execa';
import BintasticProject from './project';
import { createProjectLifecycle } from './project-lifecycle';
import { planRun, type RunBinArgs } from './run-plan';

/**
 * Options shared by every way of configuring bintastic.
 */
interface BintasticOptionsBase<TProject> {
  /**
   * The path to the bin to invoke.
   *
   * When {@link ImportMetaBintasticOptions.importMeta | importMeta} is provided, this is treated as
   * a path relative to the importing module and resolved via
   * `fileURLToPath(new URL(binPath, importMeta.url))`. Otherwise it must be an
   * absolute path (typically pre-resolved by the caller).
   *
   * May also be a function that receives the project and returns the path. The
   * returned value is resolved using the same rule.
   */
  binPath: string | ((project: TProject) => string);
  /**
   * An array of static arguments that will be used every time when running the bin
   */
  staticArgs?: string[];
  /**
   * An optional function to use to create the project. Use this if you want to provide a custom implementation of a BintasticProject.
   */
  createProject?: () => TProject | PromiseLike<TProject>;
}

/**
 * Options where `binPath` is an already-resolved absolute path.
 */
export interface ResolvedBintasticOptions<TProject> extends BintasticOptionsBase<TProject> {
  /**
   * Must be absent. Provide {@link ImportMetaBintasticOptions} to resolve a relative `binPath`.
   */
  importMeta?: undefined;
}

/**
 * Options where `binPath` is relative to the importing module, resolved against `importMeta.url`.
 */
export interface ImportMetaBintasticOptions<TProject> extends BintasticOptionsBase<TProject> {
  /**
   * The `import.meta` of the module configuring bintastic. Used to resolve a
   * relative `binPath` to an absolute path.
   */
  importMeta: ImportMeta;
}

/**
 * Options for configuring bintastic.
 *
 * Either provide an absolute `binPath` ({@link ResolvedBintasticOptions}) or pass
 * `importMeta` alongside a relative `binPath` ({@link ImportMetaBintasticOptions}).
 */
export type BintasticOptions<TProject> =
  ResolvedBintasticOptions<TProject> | ImportMetaBintasticOptions<TProject>;

/**
 * Function signature for running the configured CLI binary.
 */
export interface RunBin {
  /**
   * A runBin implementation that takes no parameters.
   * @returns {*}  {ResultPromise}
   */
  (): ResultPromise;
  /**
   * A runBin implementation that takes string varargs.
   * @param {...RunBinArgs} args
   * @returns {*}  {ResultPromise}
   */
  (...args: [...binArgs: string[]]): ResultPromise;
  /**
   * A runBin implementation that takes an Options object.
   * @param {...RunBinArgs} args
   * @returns {*}  {ResultPromise}
   */
  (...args: [execaOptions: Options]): ResultPromise;
  /**
   * A runBin implementation that takes string or an Options object varargs.
   * @param {...RunBinArgs} args
   * @returns {*}  {ResultPromise}
   */
  (...args: [...binArgs: string[], execaOptions: Options]): ResultPromise;
}

/**
 * The result returned by createBintastic.
 */
export interface CreateBintasticResult<TProject extends BintasticProject> {
  /**
   * Runs the configured bin function via execa.
   */
  runBin: RunBin;
  /**
   * Sets up the specified project for use within tests.
   */
  setupProject: () => Promise<TProject>;
  /**
   * Sets up a tmp directory for use within tests.
   */
  setupTmpDir: () => Promise<string>;
  /**
   * Tears the project down: restores the cwd from `project.chdir()` and removes the tmp directory.
   * In debug mode (`runBinDebug` or `BINTASTIC_DEBUG`) the directory is kept on disk and its path
   * logged. Safe to call when no project is active.
   */
  teardownProject: () => void;
  /**
   * Runs the configured bin with Node inspector enabled in attach mode (--inspect).
   * Set BINTASTIC_DEBUG=break to break on first line instead.
   */
  runBinDebug: RunBin;
}

/**
 * Creates the bintastic API functions to use within tests.
 * @param {BintasticOptions<TProject>} options - An object of bintastic options
 * @returns {CreateBintasticResult<TProject>} - A project instance.
 */
export function createBintastic<TProject extends BintasticProject>(
  options: BintasticOptions<TProject>
): CreateBintasticResult<TProject> {
  const lifecycle = createProjectLifecycle<TProject>({
    createProject:
      typeof options.createProject === 'function'
        ? options.createProject
        : () => new BintasticProject() as TProject,
    env: process.env,
  });

  /**
   * Returns the active Project, or throws if setupProject() hasn't been called.
   * @param {string} caller - The public function name used in the error message.
   * @returns {TProject} The active Project.
   */
  function requireProject(caller: string): TProject {
    const project = lifecycle.active;
    if (!project) throw new Error(`[bintastic] setupProject() must be called before ${caller}()`);
    return project;
  }

  /**
   * Plans and starts a Run against the active Project. Debug mode marks the Project
   * as preserved so teardownProject leaves it on disk.
   * @param {TProject} activeProject - The Project to run against.
   * @param {RunBinArgs} args - Arguments or execa options.
   * @param {boolean} forceDebug - True for runBinDebug.
   * @returns {ResultPromise} An instance of execa's result promise.
   */
  function run(activeProject: TProject, args: RunBinArgs, forceDebug: boolean): ResultPromise {
    const plan = planRun({
      config: options,
      project: activeProject,
      args,
      forceDebug,
      env: process.env,
      execArgv: process.execArgv,
    });

    if (plan.debugMode) {
      lifecycle.preserve();
      console.log(`[bintastic] Debugging enabled. Fixture: ${activeProject.baseDir}`);
    }

    return execaNode(plan.file, plan.args, plan.options);
  }

  /**
   * @param {...RunBinArgs} args - Arguments or execa options.
   * @returns {ResultPromise} An instance of execa's result promise.
   */
  function runBin(...args: RunBinArgs): ResultPromise {
    return run(requireProject('runBin'), args, false);
  }

  /**
   * Runs the configured bin with Node inspector enabled in attach mode (--inspect).
   * @param {...RunBinArgs} args Arguments identical to runBin
   */
  function runBinDebug(...args: RunBinArgs): ResultPromise {
    return run(requireProject('runBinDebug'), args, true);
  }

  /**
   * Sets up a tmp directory for use within tests.
   */
  async function setupTmpDir() {
    const activeProject = lifecycle.active ?? (await lifecycle.setup());

    return activeProject.baseDir;
  }

  return {
    runBin,
    runBinDebug,
    setupProject: () => lifecycle.setup(),
    teardownProject: () => lifecycle.teardown(),
    setupTmpDir,
  };
}
