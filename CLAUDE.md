# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

bintastic is a test harness for Node.js CLI tools. It creates temporary directories with fixture files, spawns CLI binaries as subprocesses, and captures their output for assertion.

## Commands

```bash
npm test              # Run lint + tests
npm run test:vitest   # Run tests only
npm run lint          # ESLint + Prettier check + markdown-code check
npm run build         # Build CJS and ESM with tsup
npm run docs          # Generate TypeDoc API documentation
npm run format        # Format all files with Prettier
```

Run a single test:

```bash
npx vitest run -t "test name pattern"
```

## Architecture

The library exports two main pieces:

1. **`createBintastic(options)`** - Factory function that returns test helpers:
   - `setupProject()` - Creates a temp directory with a `BintasticProject`
   - `teardownProject()` - Cleans up the temp directory
   - `runBin(...args)` - Executes the configured CLI binary via `execaNode`
   - `runBinDebug(...args)` - Same as `runBin` but with Node inspector enabled

2. **`BintasticProject`** - Extends `fixturify-project`'s `Project` class. Provides:
   - `files` property for defining fixture files
   - `write()` to persist files to the temp directory
   - `gitInit()` to initialize a git repo
   - `chdir()` / `dispose()` for directory management

## Key Dependencies

- **execa v9** - Subprocess execution. Uses `execaNode` for running Node scripts with `nodeOptions` for inspector flags.
- **fixturify-project** - Temp directory and fixture file management.

## Debugging Tests

Set `BINTASTIC_DEBUG=attach` or `BINTASTIC_DEBUG=break` to enable Node inspector and preserve fixture directories after test runs.
