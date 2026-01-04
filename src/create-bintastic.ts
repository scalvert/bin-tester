import { execaNode, type Options, type ResultPromise } from 'execa';
import BintasticProject from './project';
/**
 * Options for configuring bintastic.
 */
export interface BintasticOptions<TProject> {
  /**
   * The absolute path to the bin to invoke
   */
  binPath: string | (<TProject extends BintasticProject>(project: TProject) => string);
  /**
   * An array of static arguments that will be used every time when running the bin
   */
  staticArgs?: string[];
  /**
   * An optional function to use to create the project. Use this if you want to provide a custom implementation of a BintasticProject.
   */
  createProject?: () => Promise<TProject>;
}

interface RunOptions {
  /**
   * Arguments to provide to the bin script.
   */
  args: string[];
  /**
   * Options to provide to execa. @see https://github.com/sindresorhus/execa#options
   */
  execaOptions: Options;
}

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

type RunBinArgs = (string | Options)[];

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
   * Tears the project down, ensuring the tmp directory is removed.
   * When BINTASTIC_DEBUG is set, fixtures are preserved for inspection.
   */
  teardownProject: () => void;
  /**
   * Runs the configured bin with Node inspector enabled in attach mode (--inspect).
   * Set BINTASTIC_DEBUG=break to break on first line instead.
   */
  runBinDebug: RunBin;
}

const DEFAULT_BINTASTIC_OPTIONS = {
  staticArgs: [],
};

/**
 * Parses the arguments provided to runBin
 * @private
 * @param {RunBinArgs} args - The arguments passed to runBin.
 * @returns {RunOptions} Returns an object with args and execaOptions.
 */
function parseArgs(args: RunBinArgs): RunOptions {
  if (args.length > 0 && typeof args[args.length - 1] === 'object') {
    const argsCopy = [...args];
    const execaOptions = argsCopy.pop();
    return {
      args: argsCopy,
      execaOptions,
    } as RunOptions;
  } else {
    return {
      args: [...args],
      execaOptions: {},
    } as RunOptions;
  }
}

/**
 * Creates the bintastic API functions to use within tests.
 * @param {BintasticOptions<TProject>} options - An object of bintastic options
 * @returns {CreateBintasticResult<TProject>} - A project instance.
 */
export function createBintastic<TProject extends BintasticProject>(
  options: BintasticOptions<TProject>
): CreateBintasticResult<TProject> {
  let project: TProject;

  const mergedOptions = {
    ...DEFAULT_BINTASTIC_OPTIONS,
    ...options,
  } as Required<BintasticOptions<TProject>>;

  /**
   * @param {...RunBinArgs} args - Arguments or execa options.
   * @returns {ResultPromise} An instance of execa's result promise.
   */
  function runBin(...args: RunBinArgs): ResultPromise {
    const mergedRunOptions = parseArgs(args);
    const binPath =
      typeof mergedOptions.binPath === 'function'
        ? mergedOptions.binPath(project)
        : mergedOptions.binPath;

    const optionsEnv = mergedRunOptions.execaOptions.env;
    const debugEnv = optionsEnv?.BINTASTIC_DEBUG ?? process.env.BINTASTIC_DEBUG;

    const nodeOptions: string[] = [];
    if (debugEnv && debugEnv !== '0' && debugEnv.toLowerCase() !== 'false') {
      if (debugEnv.toLowerCase() === 'break') {
        nodeOptions.push('--inspect-brk=0');
      } else {
        nodeOptions.push('--inspect=0');
      }
      console.log(`[bintastic] Debugging enabled. Fixture: ${project.baseDir}`);
    }

    const resolvedCwd = mergedRunOptions.execaOptions.cwd ?? project.baseDir;

    return execaNode(binPath, [...mergedOptions.staticArgs, ...mergedRunOptions.args], {
      reject: false,
      cwd: resolvedCwd,
      nodeOptions,
      ...mergedRunOptions.execaOptions,
    });
  }

  /**
   * Runs the configured bin with Node inspector enabled in attach mode (--inspect).
   * @param {...RunBinArgs} args Arguments identical to runBin
   */
  function runBinDebug(...args: RunBinArgs): ResultPromise {
    const parsedArgs = parseArgs(args);
    // Pass debug mode through execa env options to avoid race conditions with process.env
    const debugEnv = process.env.BINTASTIC_DEBUG || 'attach';
    parsedArgs.execaOptions = {
      ...parsedArgs.execaOptions,
      env: {
        ...parsedArgs.execaOptions.env,
        BINTASTIC_DEBUG: debugEnv,
      },
    };
    // Reconstruct args array with merged options
    const reconstructedArgs: RunBinArgs = [...parsedArgs.args, parsedArgs.execaOptions];
    return runBin(...reconstructedArgs);
  }

  /**
   * Sets up the specified project for use within tests.
   */
  async function setupProject() {
    project =
      'createProject' in mergedOptions
        ? await mergedOptions.createProject()
        : (new BintasticProject() as TProject);

    await project.write();

    return project;
  }

  /**
   * Sets up a tmp directory for use within tests.
   */
  async function setupTmpDir() {
    if (typeof project === 'undefined') {
      await setupProject();
    }

    return project.baseDir;
  }

  /**
   * Tears the project down, ensuring the tmp directory is removed. Should be paired with setupProject.
   * When BINTASTIC_DEBUG is set, fixtures are preserved for inspection.
   */
  function teardownProject() {
    const debugEnv = process.env.BINTASTIC_DEBUG;
    if (debugEnv && debugEnv !== '0' && debugEnv.toLowerCase() !== 'false') {
      console.log(`[bintastic] Fixture preserved: ${project.baseDir}`);
      return;
    }

    project.dispose();
  }

  return {
    runBin,
    runBinDebug,
    setupProject,
    teardownProject,
    setupTmpDir,
  };
}
