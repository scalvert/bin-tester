# bintastic

A test harness for Node.js CLI tools: it builds a throwaway fixture directory, runs a CLI inside it as a subprocess, and hands back the output for assertions.

## Language

**Bin**:
The Node.js CLI script under test.
_Avoid_: binary, executable, command

**Project**:
The temporary fixture directory, and its files, that a Bin runs against.
_Avoid_: tmp dir, fixture dir, workspace

**Run**:
One invocation of the Bin as a subprocess against a Project.
_Avoid_: execution, spawn, call

**Debug mode**:
A Run where the Bin starts under the Node inspector, either attaching or breaking on the first line, and whose Project is preserved rather than removed at teardown. Set by `runBinDebug` or `BINTASTIC_DEBUG`; unset, empty, `0`, and `false` mean off.
_Avoid_: inspect mode, debugging
