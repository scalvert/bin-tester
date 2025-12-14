import execa from 'execa';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import BinTesterProject from './project';
import type { SerializableStdio } from './replay';
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
   * @returns {*}  {execa.ExecaChildProcess<string>}
   * @memberof RunBin
   */
  (): execa.ExecaChildProcess<string>;
  /**
   * A runBin implementation that takes string varargs.
   * @param {...RunBinArgs} args
   * @returns {*}  {execa.ExecaChildProcess<string>}
   * @memberof RunBin
   */
  (...args: [...binArgs: string[]]): execa.ExecaChildProcess<string>;
  /**
   * A runBin implementation that takes an execa.Options<string> object.
   * @param {...RunBinArgs} args
   * @returns {*}  {execa.ExecaChildProcess<string>}
   * @memberof RunBin
   */
  (...args: [execaOptions: execa.Options<string>]): execa.ExecaChildProcess<string>;
  /**
   * A runBin implementation that takes string or an execa.Options<string> object varargs.
   * @param {...RunBinArgs} args
   * @returns {*}  {execa.ExecaChildProcess<string>}
   * @memberof RunBin
   */
  (
    ...args: [...binArgs: string[], execaOptions: execa.Options<string>]
  ): execa.ExecaChildProcess<string>;
}

type RunBinArgs = (string | execa.Options<string>)[];

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
   * Tears the project down, ensuring the tmp directory is removed. Should be paired with setupProject.
   */
  teardownProject: (options?: { force?: boolean }) => void;
  /**
   * Runs the configured bin with Node inspector enabled in attach mode (--inspect).
   * Use BIN_TESTER_DEBUG=1 or BIN_TESTER_DEBUG=break to break on first line instead.
   */
  runBinDebug: RunBin;
}

const DEFAULT_BIN_TESTER_OPTIONS = {
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

    // Check both process.env and options.env for debug flag (options.env takes precedence)
    const optionsEnv = mergedRunOptions.execaOptions.env as Record<string, string | undefined> | undefined;
    const debugEnv = optionsEnv?.BIN_TESTER_DEBUG ?? process.env.BIN_TESTER_DEBUG;
    const nodeInspectorArgs: string[] = [];
    if (debugEnv && String(debugEnv).toLowerCase() !== '0' && String(debugEnv).toLowerCase() !== 'false') {
      const mode = String(debugEnv).toLowerCase();
      if (mode === 'attach') {
        nodeInspectorArgs.push('--inspect=0');
      } else {
        nodeInspectorArgs.push('--inspect-brk=0');
      }
    }

    const resolvedCwd = (mergedRunOptions.execaOptions as execa.Options<string>).cwd ?? project.baseDir;
    // Normalize stdio to a serializable value for the artifact
    // Non-serializable values (Stream, number, arrays) fall back to 'pipe'
    const rawStdio = mergedRunOptions.execaOptions.stdio;
    const serializableStdioValues: SerializableStdio[] = ['pipe', 'ignore', 'inherit', 'ipc'];
    const stdioMode: SerializableStdio =
      typeof rawStdio === 'string' && serializableStdioValues.includes(rawStdio as SerializableStdio)
        ? (rawStdio as SerializableStdio)
        : 'pipe';

    const child = execa(
      process.execPath,
      [...nodeInspectorArgs, binPath, ...mergedOptions.staticArgs, ...mergedRunOptions.args],
      {
        reject: false,
        cwd: resolvedCwd,
        ...mergedRunOptions.execaOptions,
      }
    );

    try {
      const artifactDir = join(project.baseDir, '.bin-tester');
      mkdirSync(artifactDir, { recursive: true });
      const artifactPath = join(artifactDir, 'last-run.json');
      const envOverrides = Object.fromEntries(
        Object.entries(mergedRunOptions.execaOptions.env ?? {}).map(([k, v]) => [k, v === undefined ? '' : String(v)])
      );
      const artifact = {
        nodePath: process.execPath,
        binPath,
        args: [...mergedOptions.staticArgs, ...mergedRunOptions.args],
        cwd: resolvedCwd,
        envOverrides,
        stdioMode,
        timestamp: new Date().toISOString(),
      } as const;
      writeFileSync(artifactPath, JSON.stringify(artifact, undefined, 2));
      // Only log replay hint when BIN_TESTER_DEBUG is set to reduce noise in normal test runs
      if (debugEnv) {
        console.log(`Replay with: bin-tester replay '${artifactPath}'`);
      }
    } catch (error) {
      // Log warning but don't fail the run - artifact persistence is optional
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[bin-tester] Warning: Failed to persist run artifact: ${message}`);
    }

    return child;
  }

  /**
   * Runs the configured bin with Node inspector enabled in attach mode (--inspect).
   * @param {...RunBinArgs} args Arguments identical to runBin
   */
  function runBinDebug(...args: RunBinArgs): execa.ExecaChildProcess<string> {
    const parsedArgs = parseArgs(args);
    // Pass debug mode through execa env options to avoid race conditions with process.env
    const debugEnv = process.env.BIN_TESTER_DEBUG || 'attach';
    parsedArgs.execaOptions = {
      ...parsedArgs.execaOptions,
      env: {
        ...parsedArgs.execaOptions.env,
        BIN_TESTER_DEBUG: debugEnv,
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
   * Tears the project down, ensuring the tmp directory is removed. Should be paired with setupProject.
   * @param {object} [options] Optional teardown options.
   * @param {boolean} [options.force] When true, forces teardown even if BIN_TESTER_KEEP_FIXTURE is set.
   */
  function teardownProject(options?: { force?: boolean }) {
    const keep = process.env.BIN_TESTER_KEEP_FIXTURE;
    const shouldKeep = keep && String(keep) !== '0' && String(keep).toLowerCase() !== 'false';
    if (shouldKeep && !(options && options.force)) {
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
