const fs = require("fs-extra");
const path = require("path");
const util = require("util");
const exec = util.promisify(require("child_process").exec);
const chalk = require("chalk");

const generateProject = async options => {
  const { name, packages, dependencies, prefixPath, lernaJson } = options;

  const p = path.resolve(prefixPath, name);

  console.info(chalk.bold("Creating project", p));

  await fs.outputFile(
    path.resolve(p, "package.json"),
    JSON.stringify(
      JSON.parse(`{
      "name": "${name}",
      "version": "1.0.0",
      "dependencies": ${dependencies ? JSON.stringify(dependencies) : "{}"},
      "description": "",
      "main": "index.js",
      "scripts": {
        "test": "echo 'Error: no test specified' && exit 1"
      },
      "author": "",
      "license": "ISC"
    }`),
      null,
      2
    )
  );

  if (lernaJson) {
    await fs.outputFile(
      path.resolve(p, "lerna.json"),
      JSON.stringify(lernaJson, null, 2)
    );
  }

  if (typeof dependencies === "object") {
    await exec(`cd ${p} && npm install`);
  }

  if (packages) {
    for (let pOptions of packages) {
      await generateProject({
        ...pOptions,
        prefixPath: path.resolve(p, pOptions.moduleDirName || "packages"),
      });
    }
  }
};

module.exports = async options => {
  await fs.remove(path.resolve("tmp"));
  const prefixPath = path.resolve("tmp");

  await generateProject({ ...options, prefixPath });

  return path.resolve(prefixPath, options.name);
};
