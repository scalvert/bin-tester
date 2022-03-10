import execa from 'execa';
import { Project } from 'fixturify-project';

const ROOT = process.cwd();

export default class CLITestProject extends Project {
  private _dirChanged: boolean = false;

  constructor(name: string, version?: string, cb?: (project: Project) => void) {
    super(name, version, cb);

    this.pkg = Object.assign({}, this.pkg, {
      license: 'MIT',
      description: 'Fake project',
      repository: 'http://fakerepo.com',
    });
  }

  gitInit() {
    return execa(`git init -q ${this.baseDir}`);
  }

  chdir() {
    this._dirChanged = true;

    process.chdir(this.baseDir);
  }

  dispose() {
    if (this._dirChanged) {
      process.chdir(ROOT);
    }

    return super.dispose();
  }
}
