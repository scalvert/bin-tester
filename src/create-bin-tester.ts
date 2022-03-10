import execa from 'execa';
import BinTesterProject from './project';
interface BinTesterOptions {
  /**
   * The absolute path to the bin to invoke
   */
  binPath: string;
  /**
   * An array of static arguments that will be used every time when running the bin
   */
  staticArgs?: string[];
  /**
   * An optional class to use to create the project
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  projectConstructor?: any;
}

interface RunOptions {
  /**
   * Arguments to provide to the bin script.
   */
  args: string[];
  /**
   * Options to provide to execa. @see https://github.com/sindresorhus/execa#options
   */
  execaOptions?: execa.Options<string>;
}

interface CreateBinTesterResult<TProject extends BinTesterProject> {
  runBin: (runOptions?: RunOptions) => execa.ExecaChildProcess<string>;
  setupProject: () => Promise<TProject>;
  setupTmpDir: () => Promise<string>;
  teardownProject: () => void;
}

const DEFAULT_BIN_TESTER_OPTIONS = {
  staticArgs: [],
  projectConstructor: BinTesterProject,
};

const DEFAULT_RUN_OPTIONS = {
  args: [],
  execaOptions: {},
};

/**
 * Creates the bin tester API functions to use within tests.
 *
 * @param options - An object of bin tester options
 * @returns - A project instance.
 */
export function createBinTester<TProject extends BinTesterProject>(
  options: BinTesterOptions
): CreateBinTesterResult<TProject> {
  let project: TProject;

  const mergedOptions: Required<BinTesterOptions> = {
    ...DEFAULT_BIN_TESTER_OPTIONS,
    ...options,
  };

  function runBin(runOptions: Partial<RunOptions> = DEFAULT_RUN_OPTIONS) {
    return execa(
      process.execPath,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      [mergedOptions.binPath, ...mergedOptions.staticArgs, ...runOptions.args!],
      {
        reject: false,
        cwd: project.baseDir,
        ...runOptions.execaOptions,
      }
    );
  }

  async function setupProject() {
    project = new mergedOptions.projectConstructor();

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
