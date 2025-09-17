#!/usr/bin/env node
import meow from 'meow';
import { replayLastRun, readLastRunInfo } from './replay';

const cli = meow(
  `
Usage
  $ bin-tester <command> [path]

Commands
  replay  Re-run the last recorded invocation
  info    Show details about the last recorded invocation

Options
  --inspect        Run under inspector (alias for --inspect=attach)
  --inspect-brk    Run under inspector and break on first line
  --stdio          inherit|pipe (default: inherit)
  --print          Print the command instead of executing (replay only)
`,
  {
    importMeta: import.meta,
    flags: {
      inspect: { type: 'boolean', default: false },
      'inspect-brk': { type: 'boolean', default: false },
      stdio: { type: 'string', default: 'inherit' },
      print: { type: 'boolean', default: false },
    },
  }
);

const [command, maybePath] = cli.input;
const pathArg = maybePath ?? process.cwd();

if (command === 'info') {
  const info = readLastRunInfo(pathArg);
  process.stdout.write(
    JSON.stringify(
      {
        nodePath: info.nodePath,
        binPath: info.binPath,
        args: info.args,
        cwd: info.cwd,
        envOverrides: info.envOverrides,
        timestamp: info.timestamp,
      },
      undefined,
      2
    ) + '\n'
  );
  process.exit(0);
}

if (command === 'replay') {
  const inspect = cli.flags['inspect-brk']
    ? 'break'
    : cli.flags.inspect
    ? 'attach'
    : false;
  const stdio = cli.flags.stdio === 'pipe' ? 'pipe' : 'inherit';
  const printOnly = Boolean(cli.flags.print);

  const result = replayLastRun(pathArg, { inspect, stdio, printOnly });

  if (printOnly) {
    const printed = result as {
      readonly nodePath: string;
      readonly args: string[];
      readonly cwd: string;
      readonly envOverrides: Record<string, string>;
      readonly stdio: 'inherit' | 'pipe';
    };
    process.stdout.write(JSON.stringify(printed, undefined, 2) + '\n');
    process.exit(0);
  }

  const child = result as import('execa').ExecaChildProcess<string>;
  async function run() {
    try {
      const p = await child;
      process.exit(p.exitCode ?? 0);
    } catch (error) {
      const err = error as { exitCode?: unknown } | null | undefined;
      const code = typeof err?.exitCode === 'number' ? (err.exitCode as number) : 1;
      process.exit(code);
    }
  }
  void run();
} else {
  cli.showHelp(0);
}


