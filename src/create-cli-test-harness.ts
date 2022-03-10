import { fileURLToPath } from 'url';
import execa, { ExecaChildProcess } from 'execa';
import CLITestProject from './project';
interface CLITestHarnessOptions {
  binPath: string;
  projectConstructor?: any;
}
interface RunOptions {
  args?: string[];
  options?: Record<string, unknown>;
}

interface CreateCLITestHarnessResult<TProject extends CLITestProject> {
  runBin: (runOptions?: RunOptions) => ExecaChildProcess<string>;
  setupProject: () => Promise<TProject>;
  setupTmpDir: () => Promise<string>;
  teardownProject: () => void;
}

export function createCLITestHarness<TProject extends CLITestProject>(
  options: CLITestHarnessOptions
): CreateCLITestHarnessResult<TProject> {
  let project: TProject;

  options = {
    ...{
      projectConstructor: CLITestProject,
      binPath: '',
    },
    ...options,
  };

  function runBin(
    runOptions: RunOptions = {
      args: [],
      options: {},
    }
  ) {
    return execa(process.execPath, [options.binPath, ...runOptions.args!], {
      reject: false,
      cwd: project.baseDir,
      ...runOptions.options,
    });
  }

  async function setupProject() {
    project = new options.projectConstructor!();

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
