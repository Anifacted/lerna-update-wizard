const path = require("path");
const fs = require("fs");
const inquirer = require("inquirer");
const { execSync, spawn } = require("child_process");
const chalk = require("chalk");
const minimist = require("minimist");
const uniq = require("lodash/uniq");
const flatten = require("lodash/flatten");

const argv = require("minimist")(process.argv.slice(1));
const ui = new inquirer.ui.BottomBar();

let bottomMessageUpdateId = null;
let bottomMessage = "";

const showBottomMessage = (message = "") => {
  const chars = "/-\\|";
  let index = 0;

  if (message === "" || message !== bottomMessage) {
    clearInterval(bottomMessageUpdateId);
  }

  if (message === "") {
    ui.updateBottomBar("");
  } else {
    bottomMessageUpdateId = setInterval(() => {
      if (chars.charAt(index) === "") index = 0;

      ui.updateBottomBar(`${chars.charAt(index++)} ${message}`);
    }, 100);
  }

  bottomMessage = message;
};

const runCommand = async (options = {}) => {
  showBottomMessage(options.startMessage);
  const proc = spawn(options.cmd, { shell: true });

  if (options.logOutput !== false) proc.stdout.pipe(ui.log);

  let data = "";
  return new Promise((resolve, reject) => {
    proc.stdout.on("data", d => (data = data + d.toString()));
    proc.stdout.on("end", () => {
      showBottomMessage("");
      options.endMessage && ui.log.write(options.endMessage);
      ui.log.write("");
      resolve(data);
    });
    proc.stdout.on("error", reject);
  });
};

inquirer.registerPrompt(
  "autocomplete",
  require("inquirer-autocomplete-prompt")
);

const run = async () => {
  "use strict";
  const dir = argv._.pop();
  const { resolve, basename } = path;
  const projectName = basename(dir);
  const packagesDir = resolve(dir || ".", "packages");
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

  const targetDependencyAnswers = await inquirer.prompt([
    {
      type: "autocomplete",
      name: "targetDependency",
      message: "Select a dependency to upgrade:",
      pageSize: 15,
      source: (undefined, input) =>
        Promise.resolve(
          allDependencies.filter(name => new RegExp(input).test(name))
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

  const json = await runCommand({
    cmd: `yarn info ${targetDependency} versions --json`,
    startMessage: `Fetching package information for "${targetDependency}"`,
    logOutput: false
  });

  const { data: availableVersions } = JSON.parse(json);

  const targetVersionAnswers = await inquirer.prompt([
    {
      type: "list",
      name: "targetVersion",
      message: "Select version to install:",
      pageSize: 10,
      choices: availableVersions
        .map(version => ({
          name: version,
          value: version
        }))
        .reverse()
    }
  ]);

  const { targetVersion } = targetVersionAnswers;
  const { targetPackages } = targetPackagesAnswers;

  for (let pack of targetPackages) {
    const installCmd = `yarn add ${targetDependency}@${targetVersion}`;
    await runCommand({
      cmd: `cd ${resolve(packagesDir, pack)} && ${installCmd}`,
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
