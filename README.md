# @scalvert/bin-tester

![CI Build](https://github.com/scalvert/bin-tester/workflows/CI%20Build/badge.svg)
[![npm version](https://badge.fury.io/js/%40scalvert%2Fbin-tester.svg)](https://badge.fury.io/js/%40scalvert%2Fbin-tester)
[![License](https://img.shields.io/npm/l/@scalvert/bin-tester.svg)](https://github.com/scalvert/bin-tester/blob/master/package.json)
![Dependabot](https://badgen.net/badge/icon/dependabot?icon=dependabot&label)
![Volta Managed](https://img.shields.io/static/v1?label=volta&message=managed&color=yellow&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QAeQC6AMEpK7AhAAAACXBIWXMAAAsSAAALEgHS3X78AAAAB3RJTUUH5AMGFS07qAYEaAAAABl0RVh0Q29tbWVudABDcmVhdGVkIHdpdGggR0lNUFeBDhcAAAFmSURBVDjLY2CgB/g/j0H5/2wGW2xyTAQ1r2DQYOBgm8nwh+EY6TYvZtD7f9rn5e81fAGka17GYPL/esObP+dyj5Cs+edqZsv/V8o//H+z7P+XHarW+NSyoAv8WsFszyKTtoVBM5Tn7/Xys+zf7v76vYrJlPEvAwPjH0YGxp//3jGl/L8LU8+IrPnPUkY3ZomoDQwOpZwMv14zMHy8yMDwh4mB4Q8jA8OTgwz/L299wMDyx4Mp9f9NDAP+bWVwY3jGsJpB3JaDQVCEgYHlLwPDfwYWRqVQJgZmHoZ/+3PPfWP+68Mb/Pw5sqUoLni9ipuRnekrAwMjA8Ofb6K8/PKBF5nU7RX+Hize8Y2DOZTP7+kXogPy1zrH+f/vT/j/Z5nUvGcr5VhJioUf88UC/59L+/97gUgDyVH4YzqXxL8dOs/+zuFLJivd/53HseLPPHZPsjT/nsHi93cqozHZue7rLDYhUvUAADjCgneouzo/AAAAAElFTkSuQmCC&link=https://volta.sh)
[![Code Style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](#badge)

> Provides a test harness for node CLIs that allow you to run tests against a real project.

## Install

```shell
npm add @scalvert/bin-tester --save-dev

# or

yarn add @scalvert/bin-tester --dev
```

## Usage

`@scalvert/bin-tester` uses two libraries to provide the test harness:

- [`fixturify-project`](https://github.com/stefanpenner/node-fixturify-project): Allows you to dynamically create test fixtures using real directories and files in a tmp directory
- [`execa`](https://github.com/sindresorhus/execa): A better replacement for `child_process.exec`

It combines the above and provides an API for running a binary with a set of arguments against a real project structure, thus mimicking testing a real environment.

```js
import { createBinTester } from '@scalvert/bin-tester';

describe('Some tests', () => {
  let project;
  let { setupProject, teardownProject, runBin } = createBinTester({
    binPath: 'node_modules/.bin/someBin',
    staticArgs: ['--some-arg'], // pass some args to the bin that will be used for each invocation
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

  test('another test', () => {
    // Write a file with contents to the tmp directory
    await project.writeJSON({
      'some/file.txt': 'some content',
    });

    // pass some args to the bin that will be used for only this invocation
    const result = await runBin('--path', 'some/file.txt');

    expect(result.stdout).toBe('Read "some/file.txt"');
  });
});
```

## API

```ts
class BinTesterProject extends Project {
    private _dirChanged;
    constructor(name: string, version?: string, cb?: (project: Project) => void);
    gitInit(): execa.ExecaChildProcess<string>;
    chdir(): void;
    dispose(): void;
}

interface BinTesterOptions {
    binPath: string;
    projectConstructor?: any;
}

interface RunOptions {
    args?: string[];
    execaOptions?: execa.Options<string>;
}

interface createBinTesterResult<TProject extends BinTesterProject> {
    runBin: (runOptions?: RunOptions) => execa.ExecaChildProcess<string>;
    setupProject: () => Promise<TProject>;
    setupTmpDir: () => Promise<string>;
    teardownProject: () => void;
}

function createBinTester<TProject extends BinTesterProject>(options: BinTesterOptions): createBinTesterResult<TProject>;
```
