# Runs inherit every parent Node flag except the inspector

When the caller passes no `nodeOptions`, a Run gives the Bin all of the parent process's `process.execArgv` except `--inspect*` flags. Callers who pass `nodeOptions` replace that list entirely, and `nodeOptions: []` opts out. We kept this (introduced in #335) because it matches execa's own `nodeOptions` default and is how `--experimental-*`, `--import`, and loader flags reach the Bin without extra configuration. Inspector flags are stripped because two processes can't share a debug port, and Debug mode adds its own.

## Considered Options

- **Inherit nothing by default.** Makes the Bin's flags predictable, but silently breaks CLIs that depend on loaders or experimental flags the test runner was started with.
- **Also strip test-runner flags.** Under Vitest, `process.execArgv` includes `--require …/vitest/suppress-warnings.cjs` and `--conditions node --conditions development`, which can change how the Bin resolves package exports. Rejected: keeping a list of runner-specific flags would never be complete, and `--conditions` is sometimes exactly what a caller wants to pass through. Document the caveat instead.
