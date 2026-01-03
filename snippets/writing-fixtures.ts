project.files = {
  'src/index.js': 'export default 42;',
  'package.json': JSON.stringify({ name: 'test' }),
};
await project.write();
