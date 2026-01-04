const { setupProject, teardownProject, runBin } = createBintastic({
  binPath: './bin/my-cli.js',
  staticArgs: ['--verbose'], // args passed to every invocation
});
