import execa from 'execa';
import BinTesterProject from './project';
interface BinTesterOptions<TProject> {
  /**
   * The absolute path to the bin to invoke
   */
  binPath: string;
  /**
   * An array of static arguments that will be used every time when running the bin
   */
  staticArgs?: string[];
  /**
   * An optional function to use to create the project. Use this if you want to provide a custom implementation of a BinTesterProject.
   */
  createProject?: () => TProject;
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
  (): execa.ExecaChildProcess<string>;
  (...args: RunBinArgs): execa.ExecaChildProcess<string>;
}

interface CreateBinTesterResult<TProject extends BinTesterProject> {
  runBin: RunBin;
  setupProject: () => Promise<TProject>;
  setupTmpDir: () => Promise<string>;
  teardownProject: () => void;
}

type RunBinArgs = [...binArgs: string[], execaOptions: execa.Options<string>];

const DEFAULT_BIN_TESTER_OPTIONS = {
  staticArgs: [],
  projectConstructor: BinTesterProject,
};

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
 * @param options - An object of bin tester options
 * @returns - A project instance.
 */
export function createBinTester<TProject extends BinTesterProject>(
  options: BinTesterOptions<TProject>
): CreateBinTesterResult<TProject> {
  let project: TProject;

  const mergedOptions = {
    ...DEFAULT_BIN_TESTER_OPTIONS,
    ...options,
  } as Required<BinTesterOptions<TProject>>;

  function runBin(...args: RunBinArgs): execa.ExecaChildProcess<string> {
    const mergedRunOptions = parseArgs(args);

    return execa(
      process.execPath,
      [mergedOptions.binPath, ...mergedOptions.staticArgs, ...mergedRunOptions.args],
      {
        reject: false,
        cwd: project.baseDir,
        ...mergedRunOptions.execaOptions,
      }
    );
  }

  async function setupProject() {
    project =
      'createProject' in mergedOptions
        ? await mergedOptions.createProject()
        : (new BinTesterProject() as TProject);

    await project.write();

    return project;
  }

  async function setupTmpDir() {
    if (typeof project === 'undefined') {
      await setupProject();
    }

    return project.baseDir;
  }

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
