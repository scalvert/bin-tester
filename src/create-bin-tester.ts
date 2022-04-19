import execa from 'execa';
import BinTesterProject from './project';
interface BinTesterOptions<TProject> {
  /**
   * The absolute path to the bin to invoke
   */
  binPath: string | (<TProject extends BinTesterProject>(project: TProject) => string);
  /**
   * An array of static arguments that will be used every time when running the bin
   */
  staticArgs?: string[];
  /**
   * An optional function to use to create the project. Use this if you want to provide a custom implementation of a BinTesterProject.
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
  execaOptions: execa.Options<string>;
}

interface RunBin {
  /**
   * A runBin implementation that takes no parameters.
   *
   * @returns {*}  {execa.ExecaChildProcess<string>}
   * @memberof RunBin
   */
  (): execa.ExecaChildProcess<string>;
  /**
   * A runBin implementation that takes varargs.
   *
   * @param {...RunBinArgs} args
   * @returns {*}  {execa.ExecaChildProcess<string>}
   * @memberof RunBin
   */
  (...args: RunBinArgs): execa.ExecaChildProcess<string>;
}

interface CreateBinTesterResult<TProject extends BinTesterProject> {
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
   * Tears the project down, ensuring the tmp directory is removed. Shoud be paired with setupProject.
   */
  teardownProject: () => void;
}

type RunBinArgs = [...binArgs: string[], execaOptions: execa.Options<string>];

const DEFAULT_BIN_TESTER_OPTIONS = {
  staticArgs: [],
};

/**
 * Parses the arguments provided to runBin
 *
 * @private
 * @param {RunBinArgs} args - The arguments passed to runBin.
 * @returns {RunOptions} Returns an object with args and execaOptions.
 */
function parseArgs(args: RunBinArgs): RunOptions {
  if (args.length > 0 && typeof args[args.length - 1] === 'object') {
    const execaOptions = args.pop();
    return {
      args,
      execaOptions,
    } as RunOptions;
  } else {
    return {
      args,
      execaOptions: {},
    } as RunOptions;
  }
}

/**
 * Creates the bin tester API functions to use within tests.
 *
 * @param {BinTesterOptions<TProject>} options - An object of bin tester options
 * @returns {CreateBinTesterResult<TProject>} - A project instance.
 */
export function createBinTester<TProject extends BinTesterProject>(
  options: BinTesterOptions<TProject>
): CreateBinTesterResult<TProject> {
  let project: TProject;

  const mergedOptions = {
    ...DEFAULT_BIN_TESTER_OPTIONS,
    ...options,
  } as Required<BinTesterOptions<TProject>>;

  /**
   * @param {...RunBinArgs} args - Arguments or execa options.
   * @returns {execa.ExecaChildProcess<string>} An instance of execa's child process.
   */
  function runBin(...args: RunBinArgs): execa.ExecaChildProcess<string> {
    const mergedRunOptions = parseArgs(args);
    const binPath =
      typeof mergedOptions.binPath === 'function'
        ? mergedOptions.binPath(project)
        : mergedOptions.binPath;

    return execa(
      process.execPath,
      [binPath, ...mergedOptions.staticArgs, ...mergedRunOptions.args],
      {
        reject: false,
        cwd: project.baseDir,
        ...mergedRunOptions.execaOptions,
      }
    );
  }

  /**
   * Sets up the specified project for use within tests.
   */
  async function setupProject() {
    project =
      'createProject' in mergedOptions
        ? await mergedOptions.createProject()
        : (new BinTesterProject() as TProject);

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
   * Tears the project down, ensuring the tmp directory is removed. Shoud be paired with setupProject.
   */
  function teardownProject() {
    project.dispose();
  }

  return {
    runBin,
    setupProject,
    teardownProject,
    setupTmpDir,
  };
}
