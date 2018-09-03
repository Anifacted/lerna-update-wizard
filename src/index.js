const path = require("path");
const inquirer = require("inquirer");
const chalk = require("chalk");
const uniq = require("lodash/uniq");
const globby = require("globby");

const fileExists = require("./utils/fileExists");
const ui = require("./utils/ui");

inquirer.registerPrompt(
  "autocomplete",
  require("inquirer-autocomplete-prompt")
);

module.exports = async ({ input, flags }) => {
  const { resolve } = path;
  const projectDir = input.shift() || ".";

  const projectPackageJsonPath = resolve(projectDir, "package.json");

  if (!await fileExists(projectPackageJsonPath)) {
    ui.log.write(
      chalk.red.bold("No 'package.json' found in specified directory")
    );
    process.exit();
  }

  const { name: projectName } = require(projectPackageJsonPath);

  // Read `lerna.json` config file
  let lernaConfig = {};
  try {
    lernaConfig = require(resolve(projectDir, "lerna.json"));
  } catch (e) {}

  ui.log.write(
    `\n${chalk.bold("Lerna Update Wizard")}\n${chalk.grey(
      "v" + require("../package.json").version
    )}\n\n`
  );

  ui.logBottom("Collecting packages...");

  const packagesRead = await globby(
    (lernaConfig.packages || ["packages/*"]).map(glob =>
      resolve(projectDir, glob, "package.json")
    ),
    { expandDirectories: true }
  );

  const packages = packagesRead.map(path => ({
    path: path.substr(0, path.length - "package.json".length),
    config: require(path),
  }));

  if (packages.length === 0) {
    ui.log.write(chalk.red.bold("No packages found. Is this a Lerna project?"));
    process.exit();
  }

  ui.logBottom("");

  const setSourceForDeps = (deps = [], source = "dependencies") =>
    Object.keys(deps).reduce(
      (prev, name) => ({
        ...prev,
        [name]: {
          version: deps[name],
          source,
        },
      }),
      {}
    );

  const dependencies = packages.reduce(
    (prev, { config: { dependencies, devDependencies, name } }) => ({
      ...prev,
      [name]: {
        ...setSourceForDeps(dependencies),
        ...setSourceForDeps(devDependencies, "devDependencies"),
      },
    }),
    {}
  );

  let dependencyMap = packages.reduce(
    (prev, { config: { name: packageName } }) => {
      const packDeps = dependencies[packageName];
      return {
        ...prev,
        ...Object.keys(packDeps).reduce((prev, dep) => {
          const { version, source } = packDeps[dep];
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
              packs: {
                ...prevDep.packs,
                [packageName]: { version, source },
              },
              versions,
              color,
            },
          };
        }, prev),
      };
    },
    {}
  );

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
    packages,
    resolve,
    flags,
  });
};
