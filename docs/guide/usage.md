# Usage

`createBintastic` returns helpers for setting up projects, running your CLI, and cleaning up:

```ts snippet=create-bintastic.ts
const { setupProject, teardownProject, runBin } = createBintastic({
  importMeta: import.meta,
  binPath: './bin/my-cli.js', // resolved relative to this module
  staticArgs: ['--verbose'], // args passed to every invocation
});
```

The only required option is `binPath`. `staticArgs` are prepended to every `runBin` call, and `createProject` lets you supply a custom `BintasticProject` factory.

## Resolving `binPath`

Pass `importMeta: import.meta` and a `binPath` relative to the importing module—bintastic resolves it with `fileURLToPath(new URL(binPath, importMeta.url))`. This is the recommended form. If `binPath` is a function, its returned path is resolved the same way.

Without `importMeta`, `binPath` must be an absolute path that you pre-resolve yourself:

```ts snippet=legacy-bin-path.ts
import { fileURLToPath } from 'node:url';

// Without `importMeta`, `binPath` must be an absolute path. Pre-resolve it yourself:
const { setupProject, teardownProject, runBin } = createBintastic({
  binPath: fileURLToPath(new URL('./bin/my-cli.js', import.meta.url)),
});
```

## Setup and teardown

`setupProject` creates a temp directory and returns the `BintasticProject`; `teardownProject` removes it:

```ts snippet=setup-teardown.ts
const project = await setupProject(); // creates temp directory
// ... run tests ...
teardownProject(); // removes temp directory
```

`teardownProject` also returns to the working directory you were in before `project.chdir()`, and it's safe to call when no project is active, so an `afterEach` can't mask a failure in `beforeEach`. Calling `setupProject` again without tearing down first tears the previous project down for you.

To leave a project's directory without removing it, call `project.restoreCwd()`.

## Writing fixture files

Pass a directory tree directly to `write()` to create fixture files—directory names are keys, file contents are string values. The `text` and `json` helpers are tagged-template functions that dedent text content and normalize JSON respectively:

```ts snippet=writing-fixtures.ts
import { json, text } from 'bintastic';

await project.write({
  'src/index.js': text`
    export default 42;
  `,
  'tsconfig.json': json`{ "compilerOptions": { "strict": true } }`,
});
```

::: warning `package.json` is not written this way
`package.json` is configured through the project constructor or `project.pkg`, not through the files you write. fixturify-project serializes it from the project's package metadata, so a `package.json` entry passed to `write()` is ignored.
:::

## Reading results

`runBin` resolves to an [execa](https://github.com/sindresorhus/execa) result. Read `exitCode`, `stdout`, and `stderr` to assert on what your CLI did:

```ts snippet=running-cli.ts
const result = await runBin('--flag', 'arg');

result.exitCode; // number
result.stdout; // string
result.stderr; // string
```
