const { setupProject, teardownProject, runBin } = createBinTester({
  binPath: './bin/my-cli.js',
  staticArgs: ['--verbose'], // args passed to every invocation
});
