# Debugging

When a CLI test fails, you often want to step through the binary as it runs and inspect the fixture files it operated on. `bintastic` supports both.

## `BINTASTIC_DEBUG` modes

Set `BINTASTIC_DEBUG` to enable the Node inspector and preserve fixtures for inspection instead of tearing them down:

```bash
BINTASTIC_DEBUG=attach npm test  # attach debugger
BINTASTIC_DEBUG=break npm test   # break on first line
```

`attach` runs the binary with `--inspect` so you can connect a debugger while it executes; `break` uses `--inspect-brk` to pause on the first line. In either mode the temp directory is left on disk and its path is logged so you can examine the fixtures after the run.

The value is read the same way everywhere:

- Unset, empty, `0`, and `false` (any case) turn debugging off.
- `break` (any case) breaks on the first line; any other value attaches.
- A `BINTASTIC_DEBUG` passed in a single run's `env` option takes precedence over the process environment, so you can turn debugging on or off for one run:

```ts
await runBin('--flag', { env: { BINTASTIC_DEBUG: 'break' } });
```

`bintastic` reads `BINTASTIC_DEBUG` itself; it does not add the variable to your CLI's environment.

## `runBinDebug`

To debug a single invocation without setting an environment variable for the whole run, call `runBinDebug` in place of `runBin`:

```ts snippet=run-bin-debug.ts
await runBinDebug('--flag'); // runs with --inspect
```

`runBinDebug` always enables debugging, even when `BINTASTIC_DEBUG` is `false`. It still honours `BINTASTIC_DEBUG=break` from either the run's `env` or the process environment.

## Node options passed to your CLI

By default the CLI starts with the same Node flags as the test process (`process.execArgv`), minus any `--inspect*` flags, so loaders and `--experimental-*` flags carry over. Passing `nodeOptions` replaces that list, and `nodeOptions: []` starts the CLI with no inherited flags. In debug mode the inspector flag is appended to whichever list applies, so your `nodeOptions` are kept.

::: warning Test runner flags are inherited too
Under Vitest, `process.execArgv` includes flags such as `--conditions development` and a `--require` of Vitest's warning suppressor. `--conditions` can change which `exports` entry your CLI's dependencies resolve to. If that matters for your CLI, pass `nodeOptions` explicitly.
:::

## VS Code launch configuration

For VS Code, add the following to `.vscode/launch.json` so child processes spawned by the test runner are attached automatically:

```jsonc
{
  "name": "Debug Tests",
  "type": "node",
  "request": "launch",
  "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/vitest",
  "runtimeArgs": ["run"],
  "autoAttachChildProcesses": true,
  "console": "integratedTerminal",
}
```
