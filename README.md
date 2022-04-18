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
  test('a test', async () => {
    const result = await runBin();

    expect(result.stdout).toBe('Did some stuff');
  });

  test('another test', async () => {
    // Write a file with contents to the tmp directory
    await project.writeDirJSON({
      'some/file.txt': 'some content',
    });

    // pass some args to the bin that will be used for only this invocation
    const result = await runBin('--path', 'some/file.txt');

    expect(result.stdout).toBe('Read "some/file.txt"');
  });
});
```

## API

<!--DOCS_START-->
## Classes

<dl>
<dt><a href="#BinTesterProject">BinTesterProject</a></dt>
<dd></dd>
</dl>

## Functions

<dl>
<dt><a href="#createBinTester">createBinTester(options)</a> ⇒ <code>CreateBinTesterResult.&lt;TProject&gt;</code></dt>
<dd><p>Creates the bin tester API functions to use within tests.</p></dd>
</dl>

<a name="BinTesterProject"></a>

## BinTesterProject
**Kind**: global class  

* [BinTesterProject](#BinTesterProject)
    * [new BinTesterProject(name, version, cb)](#new_BinTesterProject_new)
    * [.gitInit()](#BinTesterProject+gitInit) ⇒ <code>\*</code>
    * [.chdir()](#BinTesterProject+chdir)
    * [.dispose()](#BinTesterProject+dispose) ⇒ <code>void</code>

<a name="new_BinTesterProject_new"></a>

### new BinTesterProject(name, version, cb)
<p>Constructs an instance of a BinTesterProject.</p>


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| name | <code>string</code> | <code>&quot;fake-project&quot;</code> | <p>The name of the project. Used within the package.json as the name property.</p> |
| version | <code>string</code> |  | <p>The version of the project. Used within the package.json as the version property.</p> |
| cb | <code>function</code> |  | <p>An optional callback for additional setup steps after the project is constructed.</p> |

<a name="BinTesterProject+gitInit"></a>

### binTesterProject.gitInit() ⇒ <code>\*</code>
<p>Runs <code>git init</code> inside a project.</p>

**Kind**: instance method of [<code>BinTesterProject</code>](#BinTesterProject)  
**Returns**: <code>\*</code> - <p>{execa.ExecaChildProcess<string>}</p>  
<a name="BinTesterProject+chdir"></a>

### binTesterProject.chdir()
<p>Changes a directory from inside the project.</p>

**Kind**: instance method of [<code>BinTesterProject</code>](#BinTesterProject)  
<a name="BinTesterProject+dispose"></a>

### binTesterProject.dispose() ⇒ <code>void</code>
<p>Correctly disposes of the project, observing when the directory has been changed.</p>

**Kind**: instance method of [<code>BinTesterProject</code>](#BinTesterProject)  
<a name="createBinTester"></a>

## createBinTester(options) ⇒ <code>CreateBinTesterResult.&lt;TProject&gt;</code>
<p>Creates the bin tester API functions to use within tests.</p>

**Kind**: global function  
**Returns**: <code>CreateBinTesterResult.&lt;TProject&gt;</code> - <ul>
<li>A project instance.</li>
</ul>  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>BinTesterOptions.&lt;TProject&gt;</code> | <p>An object of bin tester options</p> |


* [createBinTester(options)](#createBinTester) ⇒ <code>CreateBinTesterResult.&lt;TProject&gt;</code>
    * [~runBin(...args)](#createBinTester..runBin) ⇒ <code>execa.ExecaChildProcess.&lt;string&gt;</code>
    * [~setupProject()](#createBinTester..setupProject)
    * [~setupTmpDir()](#createBinTester..setupTmpDir)
    * [~teardownProject()](#createBinTester..teardownProject)

<a name="createBinTester..runBin"></a>

### createBinTester~runBin(...args) ⇒ <code>execa.ExecaChildProcess.&lt;string&gt;</code>
**Kind**: inner method of [<code>createBinTester</code>](#createBinTester)  
**Returns**: <code>execa.ExecaChildProcess.&lt;string&gt;</code> - <p>An instance of execa's child process.</p>  

| Param | Type | Description |
| --- | --- | --- |
| ...args | <code>RunBinArgs</code> | <p>Arguments or execa options.</p> |

<a name="createBinTester..setupProject"></a>

### createBinTester~setupProject()
<p>Sets up the specified project for use within tests.</p>

**Kind**: inner method of [<code>createBinTester</code>](#createBinTester)  
<a name="createBinTester..setupTmpDir"></a>

### createBinTester~setupTmpDir()
<p>Sets up a tmp directory for use within tests.</p>

**Kind**: inner method of [<code>createBinTester</code>](#createBinTester)  
<a name="createBinTester..teardownProject"></a>

### createBinTester~teardownProject()
<p>Tears the project down, ensuring the tmp directory is removed. Shoud be paired with setupProject.</p>

**Kind**: inner method of [<code>createBinTester</code>](#createBinTester)  

<!--DOCS_END-->
