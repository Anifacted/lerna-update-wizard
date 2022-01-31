const { default: runProgram } = require("./utils/runProgram");
const generateProject = require("./utils/generateProject");

let projectPath;

describe("Lazy install dependency", () => {
  describe("dep is not installed in any of the packages", () => {
    beforeEach(async () => {
      projectPath = await generateProject({
        name: "project-a",
        packages: [
          { name: "sub-package-a" },
          {
            name: "sub-package-b",
            dependencies: { lodash: "0.1.0" },
          },
        ],
      });
    });
    it("lazily installs the dependency", async () => {
      await runProgram(
        `${projectPath} --lazy --dependency "treediff@latest"`,
        `
        Fetching package information for "treediff"

        >>> wait

        ? Select packages to affect: (Press <space> to select, <a> to toggle all, <i> to
         invert selection, and <enter> to proceed)
        ❯◯ sub-package-a
         ◯ sub-package-b

        >>> input SPACE
        >>> input ENTER

        Resolving dependency version for "treediff@latest"

        >>> wait

        ? Confirm or edit installations

        >>> input ENTER

        ? Select installation type for new dependency
          sub-package-a
          + treediff ^0.2.5

        >>> input ENTER

        project-a: npm install

        >>> wait

        ? Do you want to create a new git branch for the change? (Y/n)

        >>> input n
        >>> input ENTER

        ? Do you want to create a new git commit for the change? (Y/n)

        >>> input n
        >>> input ENTER
        `
      );
    });
  });
});
