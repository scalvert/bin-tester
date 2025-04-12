import execa from 'execa';
import { Project } from 'fixturify-project';

const ROOT = process.cwd();

export default class BinTesterProject extends Project {
  private _dirChanged = false;

  /**
   * Constructs an instance of a BinTesterProject.
   * @param {string} name - The name of the project. Used within the package.json as the name property.
   * @param {string} version - The version of the project. Used within the package.json as the version property.
   * @param {Function} cb - An optional callback for additional setup steps after the project is constructed.
   */
  constructor(name = 'fake-project', version?: string, cb?: (project: Project) => void) {
    super(name, version, cb);

    this.pkg = Object.assign({}, this.pkg, {
      license: 'MIT',
      description: 'Fake project',
      repository: 'http://fakerepo.com',
    });
  }

  /**
   * Runs `git init` inside a project.
   * @returns {*} {execa.ExecaChildProcess<string>}
   */
  gitInit(): execa.ExecaChildProcess<string> {
    return execa(`git init -q ${this.baseDir}`);
  }

  /**
   * Changes a directory from inside the project.
   */
  async chdir(): Promise<void> {
    this._dirChanged = true;

    await this.write();

    process.chdir(this.baseDir);
  }

  /**
   * Correctly disposes of the project, observing when the directory has been changed.
   * @returns {void}
   */
  dispose(): void {
    if (this._dirChanged) {
      process.chdir(ROOT);
    }

    return super.dispose();
  }
}
