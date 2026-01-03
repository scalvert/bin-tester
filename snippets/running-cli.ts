const result = await runBin('--flag', 'arg');

result.exitCode;  // number
result.stdout;    // string
result.stderr;    // string
