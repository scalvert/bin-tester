import execa from 'execa';
import CLITestProject from './project';
interface CLITestHarnessOptions {
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

interface CreateCLITestHarnessResult<TProject extends CLITestProject> {
  runBin: (runOptions?: RunOptions) => execa.ExecaChildProcess<string>;
  setupProject: () => Promise<TProject>;
  setupTmpDir: () => Promise<string>;
  teardownProject: () => void;
}

const DEFAULT_CLI_TEST_HARNESS_OPTIONS = {
  staticArgs: [],
  projectConstructor: CLITestProject,
};

const DEFAULT_RUN_OPTIONS = {
  args: [],
  execaOptions: {},
};

/**
 * Creates the test harness API functions to use within tests.
 *
 * @param options - An object of test harness options
 * @returns - A project instance.
 */
export function createCLITestHarness<TProject extends CLITestProject>(
  options: CLITestHarnessOptions
): CreateCLITestHarnessResult<TProject> {
  let project: TProject;

  const mergedOptions: Required<CLITestHarnessOptions> = {
    ...DEFAULT_CLI_TEST_HARNESS_OPTIONS,
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
