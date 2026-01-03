import execa from 'execa';
import * as inspector from 'node:inspector';
import BinTesterProject from './project';

/**
 * Detects if the parent process is being debugged using Node's built-in inspector module.
 * This enables automatic debugging of child processes when the test runner is started with --inspect.
 * @returns {boolean} True if the parent process has an active inspector session.
 */
function isParentBeingDebugged(): boolean {
  // Primary detection: use the built-in inspector module
  // inspector.url() returns the WebSocket URL if active, undefined otherwise
  const inspectorUrl = inspector.url();
  if (inspectorUrl) {
    return true;
  }

  // Fallback: check process.execArgv for inspect flags
  // This catches cases where inspector was passed but not yet fully initialized
  const hasInspectFlag = process.execArgv.some(
    (arg) => arg.startsWith('--inspect') || arg.startsWith('--debug')
  );
  if (hasInspectFlag) {
    return true;
  }

  // Fallback: check NODE_OPTIONS environment variable
  const nodeOptions = process.env.NODE_OPTIONS ?? '';
  if (/--inspect/.test(nodeOptions)) {
    return true;
  }

  return false;
}
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

    // Determine if debugging should be enabled:
    // 1. Explicit env var takes precedence (BIN_TESTER_DEBUG)
    // 2. Auto-detect if parent is being debugged (unless explicitly disabled)
    const optionsEnv = mergedRunOptions.execaOptions.env as Record<string, string | undefined> | undefined;
    const debugEnv = optionsEnv?.BIN_TESTER_DEBUG ?? process.env.BIN_TESTER_DEBUG;
    const explicitlyDisabled =
      debugEnv === '0' || String(debugEnv).toLowerCase() === 'false';
    const autoDetected = !explicitlyDisabled && !debugEnv && isParentBeingDebugged();

    const nodeInspectorArgs: string[] = [];
    if (!explicitlyDisabled && (debugEnv || autoDetected)) {
      const mode = String(debugEnv ?? 'attach').toLowerCase();
      // Explicit 'break' mode takes precedence over auto-detection
      if (mode === 'break') {
        // Use --inspect-brk=0 to break on first line
        nodeInspectorArgs.push('--inspect-brk=0');
      } else {
        // Use --inspect=0 for attach mode (default for explicit 'attach' or auto-detected)
        nodeInspectorArgs.push('--inspect=0');
      }
    }

    const resolvedCwd = (mergedRunOptions.execaOptions as execa.Options<string>).cwd ?? project.baseDir;
    const debuggingEnabled = !explicitlyDisabled && (debugEnv || autoDetected);

    // Log fixture path when debugging is enabled
    if (debuggingEnabled) {
      const source = autoDetected ? ' (auto-detected)' : '';
      console.log(`[bin-tester] Debugging enabled${source}. Fixture: ${project.baseDir}`);
    }

    return execa(
      process.execPath,
      [...nodeInspectorArgs, binPath, ...mergedOptions.staticArgs, ...mergedRunOptions.args],
      {
        reject: false,
        cwd: resolvedCwd,
        ...mergedRunOptions.execaOptions,
      }
    );
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
   * When debugging is active (auto-detected or via BIN_TESTER_DEBUG), the fixture is preserved automatically.
   * @param {object} [options] Optional teardown options.
   * @param {boolean} [options.force] When true, forces teardown even if debugging or BIN_TESTER_KEEP_FIXTURE is set.
   */
  function teardownProject(options?: { force?: boolean }) {
    if (options?.force) {
      project.dispose();
      return;
    }

    // Check if fixture should be preserved
    const keepEnv = process.env.BIN_TESTER_KEEP_FIXTURE;
    const explicitKeep = keepEnv && String(keepEnv) !== '0' && String(keepEnv).toLowerCase() !== 'false';

    // Auto-keep when debugging is active
    const debugEnv = process.env.BIN_TESTER_DEBUG;
    const debugExplicitlyDisabled = debugEnv === '0' || String(debugEnv).toLowerCase() === 'false';
    const debuggingActive = !debugExplicitlyDisabled && (debugEnv || isParentBeingDebugged());

    if (explicitKeep || debuggingActive) {
      console.log(`[bin-tester] Fixture preserved: ${project.baseDir}`);
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
