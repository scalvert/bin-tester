const { setupProject, teardownProject, runBin } = createTestDriver({
  binPath: './bin/my-cli.js',
  staticArgs: ['--verbose'], // args passed to every invocation
});
