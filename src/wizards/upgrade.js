const inquirer = require("inquirer");
const chalk = require("chalk");

const fileExists = require("../utils/fileExists");
const ui = require("../utils/ui");
const runCommand = require("../utils/runCommand");
const semverCompare = require("semver-compare");

const plural = (a, b, count) => `${count} ${count > 1 ? b : a}`;

module.exports = async ({
  dependencyMap,
  projectName,
  projectDir,
  packagesDir,
  packages,
  resolve,
  flags
}) => {
  const allDependencies = Object.keys(dependencyMap);

  ui.log.write(`Starting update wizard for ${chalk.white.bold(projectName)}`);
  ui.log.write("");

  const { targetDependency } = await inquirer.prompt([
    {
      type: "autocomplete",
      name: "targetDependency",
      message: "Select a dependency to upgrade:",
      pageSize: 15,
      source: (_ignore_, input) => {
        const itemize = value => ({
          value,
          name: `${chalk.white(value)} ${chalk[dependencyMap[value].color](
            `(${plural(
              "version",
              "versions",
              dependencyMap[value].versions.length
            )})`
          )}`
        });

        const sorter = flags.dedupe
          ? (a, b) =>
              dependencyMap[b].versions.length -
              dependencyMap[a].versions.length
          : undefined;

        return Promise.resolve(
          input
            ? allDependencies
                .filter(name => new RegExp(input).test(name))
                .sort(sorter)
                .map(itemize)
            : allDependencies.sort(sorter).map(itemize)
        );
      }
    }
  ]);

  const { targetPackages } = await inquirer.prompt([
    {
      type: "checkbox",
      name: "targetPackages",
      message: "Select packages to affect:",
      pageSize: 15,
      choices: packages.map(pack => {
        const installedVersion = dependencyMap[targetDependency].packs[pack];
        return {
          name: `${pack} ${installedVersion ? `(${installedVersion})` : ""}`,
          value: pack,
          checked: !!installedVersion
        };
      })
    }
  ]);

  const npmVersions = await runCommand(
    `npm info ${targetDependency} versions --json`,
    {
      startMessage: `Fetching package information for "${targetDependency}"`,
      logOutput: false
    }
  );

  const npmVersionsParsed = JSON.parse(npmVersions)
    .map(version => ({ name: version }))
    .reverse();

  const highestInstalled = dependencyMap[targetDependency].versions
    .sort(semverCompare)
    .pop();

  const { name: highestPublished } = npmVersionsParsed.shift();

  const availableVersions = [
    {
      name: `${chalk.white("Highest published version")} ${chalk.grey(
        `(${highestPublished})`
      )}`,
      value: highestPublished
    },
    {
      name: `${chalk.white("Highest installed version")} ${chalk.grey(
        `(${highestInstalled})`
      )}`,
      value: highestInstalled
    },
    ...npmVersionsParsed
  ];

  const { targetVersion } = await inquirer.prompt([
    {
      type: "list",
      name: "targetVersion",
      message: "Select version to install:",
      pageSize: 10,
      choices: availableVersions
    }
  ]);

  for (let pack of targetPackages) {
    if (dependencyMap[targetDependency].packs[pack] === targetVersion) {
      ui.log.write("");
      ui.log.write(`Already installed (${targetVersion})`);
      ui.log.write(chalk.green(`${pack} ✓`));
      ui.log.write("");
      continue;
    }

    const packDir = resolve(packagesDir, pack);

    const installCmd = (await fileExists(resolve(packDir, "yarn.lock")))
      ? `yarn add ${targetDependency}@${targetVersion}`
      : `npm install --save ${targetDependency}@${targetVersion}`;

    await runCommand(`cd ${packDir} && ${installCmd}`, {
      startMessage: `${chalk.white.bold(pack)}: ${installCmd}`,
      endMessage: chalk.green(`${pack} ✓`)
    });
  }

  const userName = (
    (await runCommand("git config --get github.user", { logOutput: false })) ||
    (await runCommand("whoami")) ||
    "upgrade"
  )
    .split("\n")
    .shift();

  const {
    shouldCreateGitBranch,
    shouldCreateGitCommit,
    gitBranchName,
    gitCommitMessage
  } = await inquirer.prompt([
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
      default: `${userName}/${targetDependency}-${targetVersion}`
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

  if (shouldCreateGitBranch) {
    const createCmd = `git checkout -b ${gitBranchName}`;
    await runCommand(`cd ${projectDir} && ${createCmd}`, {
      startMessage: `${chalk.white.bold(projectName)}: ${createCmd}`,
      endMessage: chalk.green(`Branch created ✓`)
    });
  }

  if (shouldCreateGitCommit) {
    const createCmd = `git add . && git commit -m '${gitCommitMessage}'`;
    await runCommand(`cd ${projectDir} && ${createCmd}`, {
      startMessage: `${chalk.white.bold(projectName)}: ${createCmd}`,
      endMessage: chalk.green(`Commit created ✓`)
    });
  }
};
