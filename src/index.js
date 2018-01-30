const path = require("path");
const fs = require("fs");
const inquirer = require("inquirer");
const chalk = require("chalk");
const uniq = require("lodash/uniq");

const fileExists = require("./utils/fileExists");
const ui = require("./utils/ui");

inquirer.registerPrompt(
  "autocomplete",
  require("inquirer-autocomplete-prompt")
);

module.exports = async ({ input, flags }) => {
  const { resolve } = path;
  const projectDir = input.shift() || ".";

  const projectPackagePath = resolve(projectDir, "package.json");
  const packagesDir = resolve(projectDir, "packages");

  if (!await fileExists(projectPackagePath)) {
    ui.log.write(
      chalk.red.bold("No 'package.json' found in specified directory")
    );
    process.exit();
  }

  if (!await fileExists(packagesDir)) {
    ui.log.write(
      chalk.red.bold("No 'packages/' directory found. Is this a lerna project?")
    );
    process.exit();
  }

  const { name: projectName } = require(projectPackagePath);
  const packages = fs.readdirSync(packagesDir);

  const dependencies = packages.reduce((prev, pack) => {
    const { dependencies, devDependencies } = require(resolve(
      packagesDir,
      pack,
      "package.json"
    ));

    return {
      ...prev,
      [pack]: { ...dependencies, ...devDependencies }
    };
  }, {});

  let dependencyMap = packages.reduce((prev, pack) => {
    const packDeps = dependencies[pack];
    return {
      ...prev,
      ...Object.keys(packDeps).reduce((prev, dep) => {
        const version = packDeps[dep];
        const prevDep = prev[dep] || { packs: {}, versions: [] };
        const versions = uniq([...prevDep.versions, version]);

        let color = "grey";
        const count = versions.length;

        if (count > 1) color = "yellow";
        if (count > 3) color = "red";

        return {
          ...prev,
          [dep]: {
            ...prevDep,
            name: dep,
            packs: { ...prevDep.packs, [pack]: version },
            versions,
            color
          }
        };
      }, prev)
    };
  }, {});

  // filter out non-conflicted dependencies when deduping
  if (flags.dedupe) {
    dependencyMap = Object.values(dependencyMap)
      .filter(({ versions }) => versions.length > 1)
      .reduce(
        (prev, { name }) => ({ ...prev, [name]: dependencyMap[name] }),
        {}
      );
  }

  return require(`./wizards/upgrade.js`)({
    dependencyMap,
    projectName,
    projectDir,
    packagesDir,
    packages,
    resolve,
    flags
  });
};
