const path = require("path");
const inquirer = require("inquirer");
const chalk = require("chalk");
const uniq = require("lodash/uniq");
const orderBy = require("lodash/orderBy");
const globby = require("globby");
const semverCompare = require("semver-compare");
const perf = require("execution-time")();
const fs = require("fs-extra");

const runCommand = require("./utils/runCommand");
const fileExists = require("./utils/fileExists");
const ui = require("./utils/ui");
const plural = require("./utils/plural");
const invariant = require("./utils/invariant");
const parseDependency = require("./utils/parseDependency");
const sanitizeGitBranchName = require("./utils/sanitizeGitBranchName");
const modifyPackageJson = require("./utils/modifyPackageJson");
const lines = require("./utils/lines");

inquirer.registerPrompt(
  "autocomplete",
  require("inquirer-autocomplete-prompt")
);

inquirer.registerPrompt("semverList", require("./prompts/semverList"));

module.exports = async ({ input, flags }) => {
  const { resolve } = path;
  const projectDir = input.shift() || ".";

  // Validate flags
  flags.nonInteractive &&
    invariant(
      flags.dependency,
      "`--dependency` option must be specified in non-interactive mode"
    );

  const projectPackageJsonPath = resolve(projectDir, "package.json");

  invariant(
    await fileExists(projectPackageJsonPath),
    "No 'package.json' found in specified directory"
  );

  ui.logBottom("Resolving package locations...");

  let packagesConfig = ["packages/*"];

  const { name: projectName, workspaces } = require(projectPackageJsonPath);

  // Attempt to get `packages` config from project package.json
  if (workspaces && Array.isArray(workspaces.packages)) {
    packagesConfig = workspaces.packages;
    ui.logBottom(
      "Found `packages` config in `package.json['workspaces']['packages']`"
    );
  }

  if (workspaces && !flags.lazy && !flags.nonInteractive) {
    ui.logBottom("");

    const { useLazy } = await inquirer.prompt([
      {
        name: "useLazy",
        type: "list",
        message: lines(
          "It looks like you are using Yarn Workspaces!",
          chalk.reset(
            "  A single install at the end is recommended to save time."
          ),
          chalk.reset(
            "  Note: You can enable this automatically using the --lazy flag"
          ),
          ""
        ),
        choices: [
          { name: "Run single-install (lazy)", value: true },
          { name: "Run individual installs (exhaustive)", value: false },
        ],
      },
    ]);

    flags.lazy = useLazy;
  }

  // Attempt to get `packages` config from lerna.json
  try {
    const lernaConfig = require(resolve(projectDir, "lerna.json"));

    if (Array.isArray(lernaConfig.packages)) {
      packagesConfig = lernaConfig.packages;
      ui.logBottom("Found `packages` config in `lerna.json['packages']`");
    }
  } catch (e) {}

  ui.log.write(
    `\n${chalk.bold("Lerna Update Wizard")}\n${chalk.grey(
      "v" + require("../package.json").version
    )}\n\n`
  );

  ui.logBottom("Collecting packages...");

  const defaultPackagesGlobs = flags.packages
    ? flags.packages.split(",")
    : packagesConfig;

  const packagesRead = await globby(
    defaultPackagesGlobs.map(glob => resolve(projectDir, glob, "package.json")),
    { expandDirectories: true }
  );

  const packages = orderBy(
    packagesRead.map(path => ({
      path: path.substr(0, path.length - "package.json".length),
      config: require(path),
    })),
    "config.name"
  );

  invariant(
    packages.length > 0,
    "No packages found. Please specify via:",
    "",
    "  package.json:  ['workspaces']['packages']",
    "  lerna.json:    ['packages']",
    "  --packages     (CLI flag. See --help)"
  );

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
    (
      prev,
      { config: { dependencies, devDependencies, peerDependencies, name } }
    ) => ({
      ...prev,
      [name]: {
        ...setSourceForDeps(dependencies),
        ...setSourceForDeps(devDependencies, "devDependencies"),
        ...setSourceForDeps(peerDependencies, "peerDependencies"),
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

  const allDependencies = Object.keys(dependencyMap);

  ui.log.write(`Starting update wizard for ${chalk.white.bold(projectName)}`);
  ui.log.write("");

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

          const sorter = flags.dedupe
            ? (a, b) =>
                dependencyMap[b].versions.length -
                dependencyMap[a].versions.length
            : undefined;

          let results = input
            ? allDependencies
                .filter(name => new RegExp(input).test(name))
                .sort(sorter)
                .map(itemize)
            : allDependencies.sort(sorter).map(itemize);

          if (input && !allDependencies.includes(input)) {
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
  const isNewDependency = !allDependencies.includes(targetDependency);

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

          const { version, source } =
            dependencyMap[targetDependency].packs[packageName] || {};

          const versionBit = version ? ` (${version})` : "";
          const sourceBit =
            source === "devDependencies" ? chalk.white(" (dev)") : "";

          return {
            name: `${packageName}${versionBit}${sourceBit}`,
            value: packageName,
            checked: !!version,
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

  let targetVersionLookup = (await runCommand(
    `npm info ${targetDependency}@${targetVersion} version`,
    {
      startMessage: `Resolving dependency version for "${targetDependency}@${targetVersion}"`,
      logOutput: false,
    }
  )).trim();

  invariant(
    targetVersionLookup,
    `The version "${targetVersion}" was not found for "${targetDependency}"`
  );

  // If targeting a specific tag (such as @latest),
  const versionFromDistTag = npmPackageInfo["dist-tags"][targetVersion];
  if (versionFromDistTag) {
    targetVersionResolved = `^${versionFromDistTag}`;
  }

  ui.log.write(chalk.green(`Using version ${targetVersionResolved} ✓\n`));

  perf.start();
  let totalInstalls = 0;

  const dependencyManager = (await fileExists(resolve(projectDir, "yarn.lock")))
    ? "yarn"
    : "npm";

  // Install process
  for (let depName of targetPackages) {
    const existingDependency = dependencyMap[targetDependency];

    let source = "dependencies";

    if (existingDependency && existingDependency.packs[depName]) {
      const { version, source: theSource } =
        existingDependency.packs[depName] || {};

      source = theSource;

      if (version === targetVersion) {
        ui.log.write("");
        ui.log.write(`Already installed (${targetVersion})`);
        ui.log.write(chalk.green(`${depName} ✓`));
        ui.log.write("");
        continue;
      }
    } else if (!flags.newInstallsMode) {
      const { targetSource } = await inquirer.prompt([
        {
          type: "list",
          name: "targetSource",
          message: `Select dependency installation type for "${depName}"`,
          pageSize: 3,
          choices: [
            { name: "dependencies" },
            { name: "devDependencies" },
            { name: "peerDependencies" },
          ].filter(Boolean),
        },
      ]);

      source = targetSource;
    } else {
      source = {
        prod: "dependencies",
        dev: "devDependencies",
        peer: "peerDependencies",
      }[flags.newInstallsMode];
    }

    const {
      path: packageDir,
      config: { name: packageName },
    } = packages.find(({ config: { name } }) => name === depName);

    const sourceParam = {
      yarn: {
        devDependencies: "--dev",
        peerDependencies: "--peer",
      },
      npm: {
        dependencies: "--save",
        devDependencies: "--save-dev",
      },
    }[dependencyManager][source || "dependencies"];

    if (
      // If we're running in lazy mode
      flags.lazy ||
      // Or if we're dealing with a peer dependency via npm
      (source === "peerDependencies" && dependencyManager === "npm")
    ) {
      const packageJsonPath = resolve(packageDir, "package.json");
      const targetPackageJson = require(packageJsonPath);

      fs.writeFileSync(
        packageJsonPath,
        modifyPackageJson(targetPackageJson, {
          [source]: { [targetDependency]: targetVersionResolved },
        })
      );

      ui.log.write(
        chalk`{white.bold ${packageName}}: {green package.json updated ✓}\n`
      );
    } else {
      const installCmd = (dependencyManager === "yarn"
        ? ["yarn", "add", sourceParam, `${targetDependency}@${targetVersion}`]
        : [
            "npm",
            "install",
            sourceParam,
            `${targetDependency}@${targetVersion}`,
          ]
      ).join(" ");

      await runCommand(`cd ${packageDir} && ${installCmd}`, {
        startMessage: `${chalk.white.bold(depName)}: ${installCmd}`,
        endMessage: chalk.green(`${depName} ✓`),
        logTime: true,
      });
    }
    totalInstalls++;
  }

  // Final install lazy install after package.json files have been modified
  if (flags.lazy) {
    ui.log.write("");

    const installCmd = dependencyManager === "yarn" ? "yarn" : "npm install";

    await runCommand(`cd ${projectDir} && ${installCmd}`, {
      startMessage: `${chalk.white.bold(projectName)}: ${installCmd}`,
      endMessage: chalk.green(`Packages installed ✓`),
      logTime: true,
    });
  }

  if (totalInstalls === 0) process.exit();

  ui.log.write(
    chalk.bold(`Installed ${totalInstalls} packages in ${perf.stop().words}`)
  );

  if (!flags.nonInteractive) {
    const userName = (
      (await runCommand("git config --get github.user", {
        logOutput: false,
      })) ||
      (await runCommand("whoami", { logOutput: false })) ||
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
          const fromVersion =
            !isNewDependency &&
            dependencyMap[targetDependency].packs[depName].version;

          if (fromVersion === targetVersion) return prev;

          return fromVersion
            ? [...prev, `* ${depName}: ${fromVersion} →  ${targetVersion}`]
            : [...prev, `* ${depName}: ${targetVersion}`];
        }, [])
        .join("\n");

      const createCmd = `git add . && git commit -m '${gitCommitMessage}' -m '${subMessage}'`;
      await runCommand(`cd ${projectDir} && ${createCmd}`, {
        startMessage: `${chalk.white.bold(
          projectName
        )}: git add . && git commit`,
        endMessage: chalk.green(`Commit created ✓`),
        logOutput: false,
      });
    }
  } else {
    process.exit();
  }
};
