# @scalvert/cli-test-harness

> Provides a test harness for node CLIs that allow you to run tests against a real project.

## Install

```shell
npm add @scalvert/cli-test-harness --save-dev

# or

yarn add @scalvert/cli-test-harness --dev
```

## Usage

`@scalvert/cli-test-harness` uses two libraries to provide the test harness:

- [`fixturify-project`](https://github.com/stefanpenner/node-fixturify-project): Allows you to dynamically create test fixtures using real directories and files in a tmp directory
- [`execa`](https://github.com/sindresorhus/execa): A better replacement for `child_process.exec`

It combines the above and provides an API for running a binary with a set of arguments against a real project structure, thus mimicking testing a real environment.

```js
import { createCLITestHarness } from '@scalvert/cli-test-harness';

describe('Some tests', () => {
  let project;
  let { setupProject, teardownProject, runBin } = createCliTestHarness({
    binPath: 'node_modules/.bin/someBin',
  });

  beforeEach(() => {
    project = await setupProject();
  });

  afterEach(() => {
    await teardownProject();
  });

  // Run the bin and do something with the result
  test('a test', () => {
    const result = await runBin();

    expect(result.stdout).toBe('Did some stuff');
  });

  // Write a file with contents to the tmp directory
  test('another test', () => {
    project.write({
      'some/file.txt': 'some content',
    });

    const result = await runBin({
      args: ['--path', 'some/file.txt'],
    });

    expect(result.stdout).toBe('Read "some/file.txt"');
  });
});
```

## API

<!--DOCS_START-->

<!--DOCS_END-->
