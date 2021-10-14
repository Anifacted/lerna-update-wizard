const { default: runProgram } = require("./utils/runProgram");
const generateProject = require("./utils/generateProject");
const { resolve } = require("path");
const expect = require("unexpected");

let projectPath;

describe("Noninteractive mode", () => {
  describe("when given no flags", () => {
    beforeEach(async () => {
      projectPath = await generateProject({
        name: "project-noninteractive-1",
        packages: [{ name: "sub-package" }],
      });
    });

    it("should complain about missing dependency flag", async () => {
      await runProgram(
        projectPath,
        `An error occurred:
        Error: \`--dependency\` option must be specified in non-interactive mode`,
        { flags: "--non-interactive" }
      );
    });
  });

  describe("when adding new dependency", () => {
    beforeEach(async () => {
      projectPath = await generateProject({
        name: "project-noninteractive-adding",
        packages: [{ name: "sub-package", dependencies: {} }],
      });
    });

    describe("and omitting --new-installs-mode", () => {
      it("should complain about missing flag", async () => {
        await runProgram(
          projectPath,
          `
          An error occurred:
          Error: "lodash" is a first-time install for one or more packages.
          In non-interactive mode you must specify the --new-installs-mode flag (prod|dev|peer) in this situation.`,
          { flags: "--non-interactive --dependency lodash@0.2.1" }
        );
      });
    });

    describe("and setting --new-installs-mode", () => {
      describe("and omitting --packages", () => {
        it("should complain about missing flag", async () => {
          await runProgram(
            projectPath,
            `
            An error occurred:
            Error: No packages contain the dependency "lodash".
            In non-interactive mode you must specify the --packages flag in this situation,
            so the script can know which packages install it in.`,
            {
              flags:
                "--non-interactive --dependency lodash@0.2.1 --new-installs-mode dev",
            }
          );
        });
      });

      describe("and setting --packages", () => {
        it("installs the dependency", async () => {
          await runProgram(projectPath, `Installed 1 packages in`, {
            flags:
              "--non-interactive --dependency lodash@0.2.1 --new-installs-mode dev --packages packages/sub-package",
          });

          expect(
            require(resolve(
              projectPath,
              "packages/sub-package/node_modules/lodash/package.json"
            )),
            "to satisfy",
            { version: "0.2.1" }
          );
        });
      });
    });
  });

  describe("when updating existing dependency", () => {
    beforeEach(async () => {
      projectPath = await generateProject({
        name: "project-noninteractive-updating",
        packages: [
          {
            name: "sub-package",
            dependencies: {
              lodash: "0.2.0",
            },
          },
        ],
      });
    });

    it("should install package", async () => {
      await runProgram(projectPath, `Installed 1 packages in`, {
        flags: "--non-interactive --dependency lodash@0.2.1",
      });

      expect(
        require(resolve(
          projectPath,
          "packages/sub-package/node_modules/lodash/package.json"
        )),
        "to satisfy",
        { version: "0.2.1" }
      );
    });
  });

  describe("when updating existing scoped dependency", () => {
    beforeEach(async () => {
      projectPath = await generateProject({
        name: "project-noninteractive-updating-scoped-dependency",
        packages: [
          {
            name: "sub-package",
            dependencies: {
              "@ngrx/entity": "6.1.0",
            },
          },
        ],
      });
    });

    it("should install package", async () => {
      await runProgram(projectPath, `Installed 1 packages in`, {
        flags: "--non-interactive --dependency @ngrx/entity@7.0.0",
      });

      expect(
        require(resolve(
          projectPath,
          "packages/sub-package/node_modules/@ngrx/entity/package.json"
        )),
        "to satisfy",
        { version: "7.0.0" }
      );
    });
  });
});
