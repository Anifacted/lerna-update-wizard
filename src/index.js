const path = require("path");
const inquirer = require("inquirer");
const chalk = require("chalk");
const uniq = require("lodash/uniq");
const orderBy = require("lodash/orderBy");
const globby = require("globby");
const perf = require("execution-time")();

const runCommand = require("./utils/runCommand");
const fileExists = require("./utils/fileExists");
const ui = require("./utils/ui");
const invariant = require("./utils/invariant");
const sanitizeGitBranchName = require("./utils/sanitizeGitBranchName");
const generateGitCommitMessage = require("./generateGitCommitMessage");
const lines = require("./utils/lines");
const composeCommand = require("./utils/composeCommand");

const composeJobs = require("./composeJobs");
const runJob = require("./runJob");

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
    Object.keys(deps).map(name => ({
      [name]: { version: deps[name], source },
    }));

  const dependencies = packages.reduce(
    (
      prev,
      { config: { dependencies, devDependencies, peerDependencies, name } }
    ) => {
      return {
        ...prev,
        [name]: [
          ...setSourceForDeps(dependencies),
          ...setSourceForDeps(devDependencies, "devDependencies"),
          ...setSourceForDeps(peerDependencies, "peerDependencies"),
        ].reduce((sourcedDeps, sourcedDep) => {
          for (const depName of Object.keys(sourcedDep)) {
            if (!sourcedDeps[depName]) {
              sourcedDeps[depName] = [];
            }

            sourcedDeps[depName].push(sourcedDep[depName]);
          }

          return sourcedDeps;
        }, {}),
      };
    },
    {}
  );

  let dependencyMap = packages.reduce(
    (prev, { config: { name: packageName } }) => {
      const packDeps = dependencies[packageName];
      return {
        ...prev,
        ...Object.keys(packDeps).reduce((prev, dep) => {
          const prevDep = prev[dep] || { packs: {}, versions: [] };
          const versions = uniq([
            ...prevDep.versions,
            ...packDeps[dep].map(({ version }) => version),
          ]);

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
                [packageName]: packDeps[dep],
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

  // INFO GATHER COMPLETE

  const context = {
    flags,
    projectName,
    dependencyMap,
    allDependencies,
    packages,
  };

  const jobs = await composeJobs(context);

  // PROMPT: Yarn workspaces lazy installation
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

    context.flags.lazy = useLazy;
  }

  // INSTALL PROCESS START:

  perf.start();

  context.dependencyManager = (await fileExists(
    resolve(projectDir, "yarn.lock")
  ))
    ? "yarn"
    : "npm";

  let totalInstalls = 0;

  // Install process
  for (let job of jobs) {
    totalInstalls += await runJob(job, context);
  }

  // INSTALL END

  // Final install lazy install after package.json files have been modified
  if (flags.lazy) {
    ui.log.write("");

    const installCmd = composeCommand(
      context.dependencyManager === "yarn" ? "yarn" : "npm install",
      flags.installArgs
    );

    await runCommand(`cd ${projectDir} && ${installCmd}`, {
      startMessage: `${chalk.white.bold(context.projectName)}: ${installCmd}`,
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
          jobs.length === 1
            ? `${userName}/${jobs[0].targetDependency}-${jobs[0].targetVersionResolved}`
            : `${userName}/upgrade-dependencies`
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
        default:
          jobs.length === 1
            ? `Update dependency: ${jobs[0].targetDependency}@${jobs[0].targetVersionResolved}`
            : `Update ${jobs.length} dependencies`,
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
      const subMessage = generateGitCommitMessage(context, jobs);

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
