const { default: runProgram } = require("./utils/runProgram");
const generateProject = require("./utils/generateProject");
const expect = require("unexpected");
const { resolve } = require("path");

const projectConfig = {
  name: "project-a",
  packages: [
    {
      name: "sub-package-a",
      dependencies: { lodash: "0.1.0" },
      moduleDirName: "myPackages",
    },
  ],
};

let projectPath;

describe("lerna.json `packages` configuration", () => {
  describe("when given no lerna.json", () => {
    beforeEach(async () => {
      projectPath = await generateProject(projectConfig);
    });

    it("cannot find any packages for the project", async () => {
      await runProgram(
        projectPath,
        "Error: No packages found. Please specify via:"
      );
    });
  });

  describe("but given a package.json `workspaces` configuration", () => {
    beforeEach(async () => {
      projectPath = await generateProject({
        ...projectConfig,
        workspaces: ["fooPackages/*"],
        packages: [
          {
            name: "sub-package-myPackages",
            dependencies: { lodash: "0.1.0" },
            moduleDirName: "fooPackages",
          },
        ],
      });
    });

    it("uses the package.json `workspaces` configuration", async () => {
      await runProgram(
        projectPath,
        `
        ❯ lodash (1 version)

        >>> input ENTER

        ❯◉ sub-package-myPackages (0.1.0)

        >>> input ENTER

        ? Select version to install:

        >>> input ENTER

        ? Confirm or edit installations

        >>> input ENTER

        ? It looks like you are using Yarn Workspaces!
         A single install at the end is recommended to save time.
         Note: You can enable this automatically using the --lazy flag
        (Use arrow keys)
       ❯ Run single-install (lazy)
         Run individual installs (exhaustive)

         >>> input ENTER

         >>> input CTRL+C`
      );
    });
  });

  describe("but given a package.json `packages` configuration", () => {
    beforeEach(async () => {
      projectPath = await generateProject({
        ...projectConfig,
        workspaces: { packages: ["fooPackages/*"] },
        packages: [
          {
            name: "sub-package-myPackages",
            dependencies: { lodash: "0.1.0" },
            moduleDirName: "fooPackages",
          },
        ],
      });
    });

    it("uses the package.json `packages` configuration", async () => {
      await runProgram(
        projectPath,
        `
        ❯ lodash (1 version)

        >>> input ENTER

        ❯◉ sub-package-myPackages (0.1.0)

        >>> input ENTER

        ? Select version to install:

        >>> input ENTER

        ? Confirm or edit installations

        >>> input ENTER

        ? It looks like you are using Yarn Workspaces!
         A single install at the end is recommended to save time.
         Note: You can enable this automatically using the --lazy flag
        (Use arrow keys)
       ❯ Run single-install (lazy)
         Run individual installs (exhaustive)

         >>> input ENTER

         >>> input CTRL+C`
      );
    });
  });

  describe("when given a single non-standard packages location", () => {
    beforeEach(async () => {
      projectPath = await generateProject({
        ...projectConfig,
        lernaJson: {
          packages: ["myPackages/*"],
        },
      });
    });

    it("reads and installs correctly from/to that directory", async () => {
      await runProgram(
        projectPath,
        `
        ? Select a dependency to upgrade: (Use arrow keys or type to search)
        ❯ lodash (1 version)

        >>> input ENTER

        ? Select packages to affect: (Press <space> to select, <a> to toggle all, <i> to
        invert selection)
        ❯◉ sub-package-a (0.1.0)

        >>> input ENTER

        ? Select version to install:

        >>> input ARROW_UP
        >>> input ENTER

        ? Confirm or edit installations

        >>> input ENTER

        ? Do you want to create a new git branch for the change? (Y/n)

        >>> input CTRL+C
        `
      );

      expect(
        require(resolve(projectPath, "myPackages/sub-package-a/package.json")),
        "to satisfy",
        { dependencies: { lodash: "^0.2.0" } }
      );
    });
  });

  describe("when given 3 different `packages` locations", () => {
    beforeEach(async () => {
      projectPath = await generateProject({
        name: "project-multi-packages-dir",
        packages: [
          {
            name: "sub-package-myPackages",
            dependencies: { lodash: "0.1.0" },
            moduleDirName: "myPackages",
          },
          {
            name: "sub-package-foobarbaz",
            dependencies: { lodash: "0.2.0" },
            moduleDirName: "foo/bar/baz",
          },
          {
            name: "sub-package-default",
            dependencies: { treediff: "0.1.0" },
          },
        ],
        lernaJson: {
          packages: ["packages/*", "myPackages/*", "foo/bar/baz/*"],
        },
      });
    });

    it("reads and installs correctly from/to that directory", async () => {
      await runProgram(
        projectPath,
        `
        ? Select a dependency to upgrade: (Use arrow keys or type to search)
          ❯ lodash (2 versions)
          treediff (1 version)

        >>> input ENTER

        ? Select packages to affect: (Press <space> to select, <a> to toggle all, <i> to
         invert selection)
        ❯◯ sub-package-default
         ◉ sub-package-foobarbaz (0.2.0)
         ◉ sub-package-myPackages (0.1.0)

         >>> input SPACE
         >>> input ENTER

         ? Select version to install:

         >>> input ARROW_UP
         >>> input ENTER

         ? Confirm or edit installations

         >>> input ENTER

         ❯ dependencies
           devDependencies

         >>> input ENTER

         ? Do you want to create a new git branch for the change? (Y/n)

         >>> input CTRL+C
        `
      );
    });
  });
});
