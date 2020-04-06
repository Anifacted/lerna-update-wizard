const ui = require("./utils/ui");
const plural = require("./utils/plural");
const parseDependency = require("./utils/parseDependency");
const semverCompare = require("semver-compare");
const chalk = require("chalk");
const invariant = require("./utils/invariant");
const inquirer = require("inquirer");
const runCommand = require("./utils/runCommand");
const lines = require("./utils/lines");

let jobs = [];

const createJobWizard = async ({
  flags,
  projectName,
  dependencyMap,
  allDependencies,
  packages,
}) => {
  ui.log.write(`Starting update wizard for ${chalk.white.bold(projectName)}`);
  ui.log.write("");

  // Filter out depenencies that have already been queued for installation
  // in a different job
  const queuedDependencies = jobs.map(job => job.targetDependency);
  const installableDependencies = allDependencies.filter(
    depName => !queuedDependencies.includes(depName)
  );

  let targetDependency =
    flags.dependency && parseDependency(flags.dependency).name;

  if (!targetDependency) {
    const { targetDependency: promptedTarget } = await inquirer.prompt([
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

          let results = installableDependencies.filter(
            input ? name => new RegExp(input).test(name) : () => true
          );

          if (flags.dedupe) {
            results = results.sort(
              (a, b) =>
                dependencyMap[b].versions.length -
                dependencyMap[a].versions.length
            );
          } else if (input && input.length > 2) {
            results = results.sort((a, b) => a.length - b.length);
          } else {
            results = results.sort();
          }

          results = results.map(itemize);

          if (input && !installableDependencies.includes(input)) {
            results = [
              ...results,
              {
                name: `${input} ${chalk.green.bold("[+ADD]")}`,
                value: input,
              },
            ];
          }

          return Promise.resolve(results);
        },
      },
    ]);

    targetDependency = promptedTarget;
  }

  // Look up NPM dependency and its versions

  const npmPackageInfoRaw = await runCommand(
    `npm info ${targetDependency} versions dist-tags --json`,
    {
      startMessage: `Fetching package information for "${targetDependency}"`,
      logOutput: false,
    }
  );

  const npmPackageInfo = JSON.parse(npmPackageInfoRaw);

  if (npmPackageInfo.error) {
    throw new Error(`Could not look up "${targetDependency}" in NPM registry`);
  }

  // Target packages selection
  const isNewDependency = !installableDependencies.includes(targetDependency);

  if (flags.nonInteractive && isNewDependency) {
    invariant(
      flags.newInstallsMode,
      `"${targetDependency}" is a first-time install for one or more packages.`,
      "In non-interactive mode you must specify the --new-installs-mode flag (prod|dev|peer) in this situation."
    );
  }

  let targetPackages;

  if (flags.nonInteractive && !flags.packages) {
    const installedPackages = packages
      .filter(
        ({ config: { name } }) =>
          !!(
            dependencyMap[targetDependency] &&
            dependencyMap[targetDependency].packs[name]
          )
      )
      .map(({ config: { name } }) => name);

    invariant(
      installedPackages.length > 0,
      `No packages contain the dependency "${targetDependency}".`,
      "In non-interactive mode you must specify the --packages flag in this situation,",
      "so the script can know which packages install it in."
    );

    targetPackages = installedPackages;
  } else if (flags.packages) {
    targetPackages = packages.map(({ config: { name } }) => name);
  }

  if (!targetPackages) {
    const { targetPackages: promptedTarget } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "targetPackages",
        message: "Select packages to affect:",
        pageSize: 15,
        choices: packages.map(({ config: { name: packageName } }) => {
          if (isNewDependency) {
            return {
              name: packageName,
              value: packageName,
              checked: false,
            };
          }

          let name = packageName;
          const versions = dependencyMap[targetDependency].packs[packageName];
          if (versions) {
            const versionStrs = versions.map(
              ({ version, source }) =>
                `${chalk.yellow(version)}${
                  source === "devDependencies" ? " dev" : ""
                }`
            );
            name = `${name} (${versionStrs.join(", ")})`;
          }

          return {
            name,
            value: packageName,
            checked: !!versions,
          };
        }),
      },
    ]);

    targetPackages = promptedTarget;
  }

  // Target version selection
  let targetVersion =
    flags.dependency && parseDependency(flags.dependency).version;

  if (!targetVersion) {
    const npmVersions = npmPackageInfo.versions.reverse();
    const npmDistTags = npmPackageInfo["dist-tags"];

    const highestInstalled =
      !isNewDependency &&
      dependencyMap[targetDependency].versions.sort(semverCompare).pop();

    const availableVersions = [
      ...Object.entries(npmDistTags).map(([tag, version]) => ({
        name: `${version} ${chalk.bold(`#${tag}`)}`,
        value: version,
      })),
      !isNewDependency && {
        name: `${highestInstalled} ${chalk.bold("Highest installed")}`,
        value: highestInstalled,
      },
      ...npmVersions.filter(
        version =>
          version !== highestInstalled &&
          !Object.values(npmDistTags).includes(version)
      ),
    ].filter(Boolean);

    const { targetVersion: promptedTarget } = await inquirer.prompt([
      {
        type: "semverList",
        name: "targetVersion",
        message: "Select version to install:",
        pageSize: 10,
        choices: availableVersions,
      },
    ]);

    targetVersion = promptedTarget;
  }
  let targetVersionResolved = targetVersion;

  let targetVersionLookup = (
    await runCommand(`npm info ${targetDependency}@${targetVersion} version`, {
      startMessage: `Resolving dependency version for "${targetDependency}@${targetVersion}"`,
      logOutput: false,
    })
  ).trim();

  invariant(
    targetVersionLookup,
    `The version "${targetVersion}" was not found for "${targetDependency}"`
  );

  // If targeting a specific tag (such as @latest),
  const versionFromDistTag = npmPackageInfo["dist-tags"][targetVersion];
  if (versionFromDistTag) {
    targetVersionResolved = `^${versionFromDistTag}`;
  }

  return {
    targetPackages,
    targetDependency,
    targetVersion,
    targetVersionResolved,
    isNewDependency,
  };
};

const composeJobsWizard = async context => {
  const create = async () => {
    try {
      jobs = [...jobs, await createJobWizard(context)];
      await composeJobsWizard(context);
    } catch (e) {
      if (context.flags.nonInteractive) {
        throw e;
      } else {
        console.info(chalk`{red ${e}}`);
        await composeJobsWizard(context);
      }
    }
  };

  if (!jobs.length) {
    await create();
  } else if (!context.flags.nonInteractive) {
    const selectedJobs = jobs.map((job, index) => ({
      name: chalk`{red x} ${job.targetDependency} {bold ${
        job.targetVersionResolved
      }} {grey (${plural("package", "packages", job.targetPackages.length)})}`,
      value: index,
    }));

    const { jobManager } = await inquirer.prompt([
      {
        name: "jobManager",
        type: "list",
        message: lines("Confirm or edit installations", ""),
        default: "confirm",
        choices: [
          ...selectedJobs,
          selectedJobs.length > 1 && {
            name: chalk`{red x} {bold Clear all}`,
            value: "reset",
          },
          new inquirer.Separator(),
          {
            name: chalk`{green +} Add another`,
            value: "create",
          },
          {
            name: chalk`{green.bold ✓} {bold Confirm}`,
            value: "confirm",
          },
        ].filter(Boolean),
      },
    ]);

    if (jobManager === "create") {
      await create();
    } else if (jobManager === "reset") {
      jobs = [];
      await composeJobsWizard(context);
    } else if (jobManager !== "confirm") {
      jobs.splice(jobManager, 1);
      await composeJobsWizard(context);
    }
  }

  return jobs;
};

module.exports = composeJobsWizard;
