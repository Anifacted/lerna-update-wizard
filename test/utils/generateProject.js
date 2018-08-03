const fs = require("fs-extra");
const path = require("path");
const execSync = require("child_process").execSync;
const chalk = require("chalk");

const generateProject = async options => {
  const { name, packages, dependencies, prefixPath } = options;

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

  if (typeof dependencies === "object") {
    execSync(`cd ${p} && npm install`);
  }

  if (packages) {
    await Promise.all(
      packages.map(pOptions => {
        generateProject({
          ...pOptions,
          prefixPath: path.resolve(p, "packages"),
        });
      })
    );
  }
};

module.exports = async options => {
  await fs.remove(path.resolve("tmp"));
  const prefixPath = path.resolve("tmp");

  await generateProject({ ...options, prefixPath });

  return path.resolve(prefixPath, options.name);
};
