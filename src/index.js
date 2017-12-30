const path = require("path");
const fs = require("fs");
const inquirer = require("inquirer");
const chalk = require("chalk");

const uniq = require("lodash/uniq");
const flatten = require("lodash/flatten");

const fileExists = require("./utils/fileExists");
const ui = require("./utils/ui");
const runCommand = require("./utils/runCommand");

inquirer.registerPrompt(
  "autocomplete",
  require("inquirer-autocomplete-prompt")
);

const run = async args => {
  "use strict";

  const argv = require("minimist")(args);
  const { resolve } = path;
  const dir = argv._[0] || ".";

  const projectPackagePath = resolve(dir, "package.json");
  const packagesDir = resolve(dir, "packages");

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

  const dependencies = packages.reduce(
    (prev, pack) => ({
      ...prev,
      [pack]: require(resolve(packagesDir, pack, "package.json")).dependencies
    }),
    {}
  );

  const allDependencies = uniq(
    flatten(Object.values(dependencies).map(Object.keys))
  );

  ui.log.write(`Starting update wizard for ${chalk.white.bold(projectName)}`);
  ui.log.write("");

  const targetDependencyAnswers = await inquirer.prompt([
    {
      type: "autocomplete",
      name: "targetDependency",
      message: "Select a dependency to upgrade:",
      pageSize: 15,
      source: (_ignore_, input) =>
        Promise.resolve(
          input
            ? allDependencies.filter(name => new RegExp(input).test(name))
            : allDependencies
        )
    }
  ]);

  const { targetDependency } = targetDependencyAnswers;

  const targetPackagesAnswers = await inquirer.prompt([
    {
      type: "checkbox",
      name: "targetPackages",
      message: "Select packages to affect:",
      pageSize: 15,
      choices: packages.map(pack => {
        const installedVersion = dependencies[pack][targetDependency];
        return {
          name: `${pack} ${installedVersion ? `(${installedVersion})` : ""}`,
          value: pack,
          checked: !!installedVersion
        };
      })
    }
  ]);

  const availableVersions = await runCommand({
    cmd: `npm info ${targetDependency} versions --json`,
    startMessage: `Fetching package information for "${targetDependency}"`,
    logOutput: false
  });

  const targetVersionAnswers = await inquirer.prompt([
    {
      type: "list",
      name: "targetVersion",
      message: "Select version to install:",
      pageSize: 10,
      choices: JSON.parse(availableVersions)
        .map(version => ({ name: version }))
        .reverse()
    }
  ]);

  const { targetVersion } = targetVersionAnswers;
  const { targetPackages } = targetPackagesAnswers;

  for (let pack of targetPackages) {
    const packDir = resolve(packagesDir, pack);

    const installCmd = (await fileExists(resolve(packDir, "yarn.lock")))
      ? `yarn add ${targetDependency}@${targetVersion}`
      : `npm install --save ${targetDependency}@${targetVersion}`;

    await runCommand({
      cmd: `cd ${packDir} && ${installCmd}`,
      startMessage: `${chalk.white.bold(pack)}: ${installCmd}`,
      endMessage: chalk.green(`${pack} ✓`)
    });
  }

  const gitAnswers = await inquirer.prompt([
    {
      type: "confirm",
      name: "shouldCreateGitBranch",
      message: "Do you want to create a new git branch for the change?"
    },
    {
      type: "input",
      name: "gitBranchName",
      message: "Enter a name for your branch:",
      when: ({ shouldCreateGitBranch }) => shouldCreateGitBranch,
      default: `upgrade-${targetDependency}-${targetVersion}`
    },
    {
      type: "confirm",
      name: "shouldCreateGitCommit",
      message: "Do you want to create a new git commit for the change?"
    },
    {
      type: "input",
      name: "gitCommitMessage",
      message: "Enter a git commit message:",
      when: ({ shouldCreateGitCommit }) => shouldCreateGitCommit,
      default: `Upgrade dependency: ${targetDependency}@${targetVersion}`
    }
  ]);

  const {
    shouldCreateGitBranch,
    shouldCreateGitCommit,
    gitBranchName,
    gitCommitMessage
  } = gitAnswers;

  if (shouldCreateGitBranch) {
    const createCmd = `git checkout -b ${gitBranchName}`;
    await runCommand({
      cmd: `cd ${dir} && ${createCmd}`,
      startMessage: `${chalk.white.bold(projectName)}: ${createCmd}`,
      endMessage: chalk.green(`Branch created ✓`)
    });
  }

  if (shouldCreateGitCommit) {
    const createCmd = `git add . && git commit -m '${gitCommitMessage}'`;
    await runCommand({
      cmd: `cd ${dir} && ${createCmd}`,
      startMessage: `${chalk.white.bold(projectName)}: ${createCmd}`,
      endMessage: chalk.green(`Commit created ✓`)
    });
  }
};

module.exports = { run };
