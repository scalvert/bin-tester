import { readFileSync } from 'node:fs';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import execa from 'execa';

/**
 * Serializable subset of execa's stdio options for JSON persistence.
 * Excludes Stream and number which cannot be serialized.
 */
export type SerializableStdio = 'pipe' | 'ignore' | 'inherit' | 'ipc';

/**
 * Describes the persisted replay artifact written by bin-tester after a run.
 */
export interface LastRunArtifact {
  nodePath: string;
  binPath: string;
  args: string[];
  cwd: string;
  envOverrides: Record<string, string>;
  stdioMode: SerializableStdio;
  timestamp: string;
}

/**
 * Options to control how a replay is executed.
 */
export interface ReplayOptions {
  inspect?: 'attach' | 'break' | false;
  stdio?: execa.Options<string>['stdio'];
  printOnly?: boolean;
}

/**
 * Resolves the artifact path from a directory or an explicit file path.
 * @param {string} inputPath The path to a fixture directory or an artifact file.
 * @throws {Error} If the path does not exist or is not accessible.
 */
function resolveArtifactPath(inputPath: string): string {
  let stats;
  try {
    stats = statSync(inputPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot access path "${inputPath}": ${message}`);
  }
  if (stats.isDirectory()) {
    return join(inputPath, '.bin-tester', 'last-run.json');
  }
  return inputPath;
}

/**
 * Reads and parses the last-run artifact from disk.
 * @param {string} inputPath The path to a fixture directory or an artifact file.
 * @throws {Error} If the artifact file cannot be read or contains invalid JSON.
 */
export function readLastRunInfo(inputPath: string): LastRunArtifact {
  const artifactPath = resolveArtifactPath(inputPath);

  let raw: string;
  try {
    raw = readFileSync(artifactPath, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot read artifact file "${artifactPath}": ${message}`);
  }

  let parsed: LastRunArtifact;
  try {
    parsed = JSON.parse(raw) as LastRunArtifact;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in artifact file "${artifactPath}": ${message}`);
  }

  return parsed;
}

/**
 * Replays the last recorded invocation. When printOnly is true, returns a struct
 * describing the command instead of executing it.
 * @param {string} inputPath The path to a fixture directory or an artifact file.
 * @param {ReplayOptions} options Options controlling replay behavior.
 */
export function replayLastRun(inputPath: string, options: ReplayOptions = {}) {
  const info = readLastRunInfo(inputPath);
  const inspectorArgs: Array<string> = [];
  if (options.inspect === 'attach') {
    inspectorArgs.push('--inspect=0');
  } else if (options.inspect === 'break') {
    inspectorArgs.push('--inspect-brk=0');
  }

  const stdio = options.stdio ?? 'inherit';

  const commandArgs = [...inspectorArgs, info.binPath, ...info.args];

  if (options.printOnly) {
    return {
      nodePath: info.nodePath,
      args: commandArgs,
      cwd: info.cwd,
      envOverrides: info.envOverrides,
      stdio,
    } as const;
  }

  return execa(info.nodePath, commandArgs, {
    cwd: info.cwd,
    env: { ...process.env, ...info.envOverrides },
    reject: false,
    stdio,
  });
}


