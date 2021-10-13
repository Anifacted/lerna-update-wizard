const { resolve } = require("path");
const expect = require("unexpected");
const { default: runProgram } = require("./utils/runProgram");
const generateProject = require("./utils/generateProject");

describe("Peer dependency", () => {
  it("updates and installs peer dependencies", async () => {
    // eslint-disable-next-line
    jest.setTimeout(100000);

    const projectPath = await generateProject({
      name: "project-a",
      packages: [
        { name: "sub-package-a" },
        {
          name: "sub-package-b",
          dependencies: { lodash: "0.1.0" },
          peerDependencies: { treediff: "0.1.0" },
        },
        { name: "sub-package-c", dependencies: { lodash: "0.2.0" } },
      ],
    });

    await runProgram(
      projectPath,
      `
        ? Select a dependency to upgrade: (Use arrow keys or type to search)
        ❯ lodash (2 versions)
          treediff (1 version)

          >>> input ARROW_DOWN

          >>> input ENTER

          ❯◯ sub-package-a
           ◉ sub-package-b (0.1.0)
           ◯ sub-package-c

          >>> input SPACE
          >>> input ENTER

          ❯ 0.2.5 #latest

          >>> input ENTER

          ? Confirm or edit installations

          >>> input ENTER

          ❯ dependencies
            devDependencies
            peerDependencies

          >>> input ARROW_DOWN
          >>> input ARROW_DOWN
          >>> input ENTER

          sub-package-a:
            treediff@0.2.5
            package.json updated ✓

          >>> input CTRL+C
        `
    );

    expect(
      require(resolve(
        projectPath,
        "packages",
        "sub-package-a",
        "package.json"
      )),
      "to satisfy",
      {
        dependencies: expect.it("to be empty"),
        peerDependencies: { treediff: "0.2.5" },
        devDependencies: expect.it("to be empty"),
      }
    );

    expect(
      require(resolve(
        projectPath,
        "packages",
        "sub-package-b",
        "package.json"
      )),
      "to satisfy",
      {
        dependencies: { lodash: "0.1.0" },
        peerDependencies: { treediff: "0.2.5" },
        devDependencies: expect.it("to be empty"),
      }
    );
  });
});
