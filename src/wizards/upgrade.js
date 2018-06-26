const inquirer = require("inquirer");
const chalk = require("chalk");

const fileExists = require("../utils/fileExists");
const ui = require("../utils/ui");
const runCommand = require("../utils/runCommand");
const semverCompare = require("semver-compare");

const plural = (a, b, count) => `${count} ${count > 1 ? b : a}`;
const sanitizeGitBranchName = name => name.replace(/@/g, "");

module.exports = async ({
  dependencyMap,
  projectName,
  projectDir,
  packagesDir,
  packages,
  resolve,
  flags,
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
          )}`,
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
      },
    },
  ]);

  const { targetPackages } = await inquirer.prompt([
    {
      type: "checkbox",
      name: "targetPackages",
      message: "Select packages to affect:",
      pageSize: 15,
      choices: packages.map(depName => {
        const { version, source } =
          dependencyMap[targetDependency].packs[depName] || {};

        const versionBit = version ? ` (${version})` : "";
        const sourceBit =
          source === "devDependencies" ? chalk.white(" (dev)") : "";

        return {
          name: `${depName}${versionBit}${sourceBit}`,
          value: depName,
          checked: !!version,
        };
      }),
    },
  ]);

  const npmPackageInfoRaw = await runCommand(
    `npm info ${targetDependency} versions dist-tags --json`,
    {
      startMessage: `Fetching package information for "${targetDependency}"`,
      logOutput: false,
    }
  );

  const npmPackageInfo = JSON.parse(npmPackageInfoRaw);
  const npmVersions = npmPackageInfo.versions.reverse();
  const npmDistTags = npmPackageInfo["dist-tags"];

  const highestInstalled = dependencyMap[targetDependency].versions
    .sort(semverCompare)
    .pop();

  const availableVersions = [
    ...Object.entries(npmDistTags).map(([tag, version]) => ({
      name: `${version} ${chalk.bold(`#${tag}`)}`,
      value: version,
    })),
    {
      name: `${highestInstalled} ${chalk.bold("Highest installed")}`,
      value: highestInstalled,
    },
    ...npmVersions
      .filter(
        version =>
          version !== highestInstalled &&
          !Object.values(npmDistTags).includes(version)
      )
      .map(version => ({ name: version })),
  ];

  const { targetVersion } = await inquirer.prompt([
    {
      type: "list",
      name: "targetVersion",
      message: "Select version to install:",
      pageSize: 10,
      choices: availableVersions,
    },
  ]);

  for (let depName of targetPackages) {
    const { version, source } =
      dependencyMap[targetDependency].packs[depName] || {};

    if (version === targetVersion) {
      ui.log.write("");
      ui.log.write(`Already installed (${targetVersion})`);
      ui.log.write(chalk.green(`${depName} ✓`));
      ui.log.write("");
      continue;
    }

    const packDir = resolve(packagesDir, depName);

    const dependencyManager = (await fileExists(
      resolve(projectDir, "yarn.lock")
    ))
      ? "yarn"
      : "npm";

    const sourceParam = {
      yarn: {
        dependencies: "",
        devDependencies: "--dev",
      },
      npm: {
        dependencies: "--save",
        devDependencies: "--save-dev",
      },
    }[dependencyManager][source || "dependencies"];

    const installCmd =
      dependencyManager === "yarn"
        ? `yarn add ${sourceParam} ${targetDependency}@${targetVersion}`
        : `npm install ${sourceParam} ${targetDependency}@${targetVersion}`;

    await runCommand(`cd ${packDir} && ${installCmd}`, {
      startMessage: `${chalk.white.bold(depName)}: ${installCmd}`,
      endMessage: chalk.green(`${depName} ✓`),
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
    gitCommitMessage,
  } = await inquirer.prompt([
    {
      type: "confirm",
      name: "shouldCreateGitBranch",
      message: "Do you want to create a new git branch for the change?",
    },
    {
      type: "input",
      name: "gitBranchName",
      message: "Enter a name for your branch:",
      when: ({ shouldCreateGitBranch }) => shouldCreateGitBranch,
      default: sanitizeGitBranchName(
        `${userName}/${targetDependency}-${targetVersion}`
      ),
    },
    {
      type: "confirm",
      name: "shouldCreateGitCommit",
      message: "Do you want to create a new git commit for the change?",
    },
    {
      type: "input",
      name: "gitCommitMessage",
      message: "Enter a git commit message:",
      when: ({ shouldCreateGitCommit }) => shouldCreateGitCommit,
      default: `Upgrade dependency: ${targetDependency}@${targetVersion}`,
    },
  ]);

  if (shouldCreateGitBranch) {
    const createCmd = `git checkout -b ${gitBranchName}`;
    await runCommand(`cd ${projectDir} && ${createCmd}`, {
      startMessage: `${chalk.white.bold(projectName)}: ${createCmd}`,
      endMessage: chalk.green(`Branch created ✓`),
    });
  }

  if (shouldCreateGitCommit) {
    const subMessage = targetPackages
      .reduce((prev, depName) => {
        const { version: fromVersion } = dependencyMap[targetDependency].packs[
          depName
        ];

        if (fromVersion === targetVersion) return prev;

        return fromVersion
          ? [...prev, `* ${depName}: ${fromVersion} →  ${targetVersion}`]
          : [...prev, `* ${depName}: ${targetVersion}`];
      }, [])
      .join("\n");

    const createCmd = `git add . && git commit -m '${gitCommitMessage}' -m '${subMessage}'`;
    await runCommand(`cd ${projectDir} && ${createCmd}`, {
      startMessage: `${chalk.white.bold(projectName)}: git add . && git commit`,
      endMessage: chalk.green(`Commit created ✓`),
      logOutput: false,
    });
  }
};
