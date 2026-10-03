import { isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Options } from 'execa';

/**
 * How the Bin is started under the Node inspector in Debug mode.
 * @internal
 */
export type DebugMode = 'attach' | 'break';

/**
 * The varargs accepted by runBin and runBinDebug: string args with an optional
 * trailing execa options object.
 * @internal
 */
export type RunBinArgs = (string | Options)[];

type Env = Readonly<Record<string, unknown>>;

/**
 * Inputs to the Debug mode rule.
 * @internal
 */
export interface DebugModeSources {
  /**
   * True when the caller asked for Debug mode explicitly (runBinDebug).
   */
  forced?: boolean;
  /**
   * The per-Run env passed via execa options. Takes precedence over `env`.
   */
  callEnv?: Env;
  /**
   * The harness process env.
   */
  env: Env;
}

/**
 * Everything needed to plan a Run.
 * @internal
 */
export interface RunPlanInput<TProject extends { baseDir: string }> {
  config: {
    binPath: string | ((project: TProject) => string);
    importMeta?: ImportMeta;
    staticArgs?: string[];
  };
  project: TProject;
  args: RunBinArgs;
  forceDebug?: boolean;
  env: Env;
  execArgv: readonly string[];
}

/**
 * A fully resolved description of a Run, computed before anything is spawned.
 * @internal
 */
export interface RunPlan {
  file: string;
  args: string[];
  options: Options;
  debugMode: DebugMode | undefined;
}

const DEBUG_ENV = 'BINTASTIC_DEBUG';

/**
 * Parses one BINTASTIC_DEBUG value. Unset, empty, `0`, and `false` mean off.
 * @param {unknown} value - The raw env value.
 * @returns {DebugMode | undefined} The Debug mode, or undefined when off.
 */
function parseDebugValue(value: unknown): DebugMode | undefined {
  if (value === undefined || value === null || value === false || value === 0) {
    return undefined;
  }

  const normalized = String(value).toLowerCase();
  if (normalized === '' || normalized === '0' || normalized === 'false') {
    return undefined;
  }

  return normalized === 'break' ? 'break' : 'attach';
}

/**
 * The single Debug mode rule. Precedence: forced, then per-call env, then process env.
 * Forced Debug mode still honours `break` from whichever env source applies.
 * @param {DebugModeSources} sources - Where Debug mode can be requested from.
 * @returns {DebugMode | undefined} The Debug mode, or undefined when off.
 * @internal
 */
export function resolveDebugMode({
  forced,
  callEnv,
  env,
}: DebugModeSources): DebugMode | undefined {
  const callValue = callEnv?.[DEBUG_ENV];
  const mode = parseDebugValue(callValue === undefined ? env[DEBUG_ENV] : callValue);

  if (forced) {
    return mode === 'break' ? 'break' : 'attach';
  }

  return mode;
}

/**
 * Splits runBin varargs into string args and the trailing execa options object.
 * @param {RunBinArgs} args - The raw varargs.
 * @returns {{ args: string[], options: Options }} The separated args and options.
 */
function splitArgs(args: RunBinArgs): { args: string[]; options: Options } {
  const last = args[args.length - 1];
  const hasOptions = typeof last === 'object' && last !== null;
  const stringArgs = (hasOptions ? args.slice(0, -1) : args).filter(
    (arg): arg is string => typeof arg === 'string'
  );

  return { args: stringArgs, options: hasOptions ? last : {} };
}

/**
 * Resolves the configured binPath to an absolute path.
 * @param {RunPlanInput<TProject>['config']} config - The bintastic config.
 * @param {TProject} project - The active Project, passed to a binPath function.
 * @returns {string} The absolute path to the Bin.
 */
function resolveBinPath<TProject extends { baseDir: string }>(
  config: RunPlanInput<TProject>['config'],
  project: TProject
): string {
  const rawBinPath =
    typeof config.binPath === 'function' ? config.binPath(project) : config.binPath;

  if (config.importMeta) {
    return fileURLToPath(new URL(rawBinPath, config.importMeta.url));
  }

  if (!isAbsolute(rawBinPath)) {
    throw new Error('[bintastic] binPath must be an absolute path when importMeta is not provided');
  }

  return rawBinPath;
}

/**
 * Computes the Node flags for a Run: the caller's nodeOptions, or else the parent's
 * flags, without inspector flags, plus the Debug mode inspector flag.
 * @param {ReadonlyArray<string> | undefined} callerNodeOptions - nodeOptions passed by the caller.
 * @param {ReadonlyArray<string>} execArgv - The parent process's Node flags.
 * @param {DebugMode | undefined} debugMode - The resolved Debug mode.
 * @returns {string[]} The Node flags to start the Bin with.
 */
function resolveNodeOptions(
  callerNodeOptions: readonly string[] | undefined,
  execArgv: readonly string[],
  debugMode: DebugMode | undefined
): string[] {
  const base = (callerNodeOptions ?? execArgv).filter((option) => !option.startsWith('--inspect'));

  if (!debugMode) {
    return base;
  }

  return [...base, debugMode === 'break' ? '--inspect-brk=0' : '--inspect=0'];
}

/**
 * Plans a Run: decides the file, args, execa options, and Debug mode without spawning anything.
 * @param {RunPlanInput<TProject>} input - Config, Project, call args, and the parent process state.
 * @returns {RunPlan} The resolved Run plan.
 * @internal
 */
export function planRun<TProject extends { baseDir: string }>(
  input: RunPlanInput<TProject>
): RunPlan {
  const { args, options } = splitArgs(input.args);
  const debugMode = resolveDebugMode({
    forced: input.forceDebug,
    callEnv: options.env,
    env: input.env,
  });

  return {
    file: resolveBinPath(input.config, input.project),
    args: [...(input.config.staticArgs ?? []), ...args],
    options: {
      reject: false,
      ...options,
      cwd: options.cwd ?? input.project.baseDir,
      nodeOptions: resolveNodeOptions(options.nodeOptions, input.execArgv, debugMode),
    },
    debugMode,
  };
}
