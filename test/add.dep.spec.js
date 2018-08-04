const { default: runProgram } = require("./utils/runProgram");
const generateProject = require("./utils/generateProject");

describe("Adding new dependency", async () => {
  let projectPath;

  beforeEach(async () => {
    projectPath = await generateProject({
      name: "project-a",
      packages: [
        { name: "sub-package-a" },
        {
          name: "sub-package-b",
          dependencies: { treediff: "0.1.0" },
        },
        { name: "sub-package-c" },
        { name: "sub-package-d", dependencies: { lodash: "0.2.0" } },
      ],
    });
  });

  it("correctly installs a new version", async () => {
    // eslint-disable-next-line
    jest.setTimeout(100000);

    await runProgram(
      projectPath,
      `
      Starting update wizard for project-a

      ? Select a dependency to upgrade: (Use arrow keys or type to search)

        >>> input tree

        ? Select a dependency to upgrade: tree
        ❯ treediff (1 version)
          tree + ADD NEW

        >>> input ARROW_DOWN

        ❯ tree + ADD NEW

        >>> input ENTER

        ❯◯ sub-package-a
         ◯ sub-package-b
         ◯ sub-package-c
         ◯ sub-package-d

        >>> input ARROW_DOWN
        >>> input ARROW_DOWN
        >>> input SPACE

         ◯ sub-package-a
         ◯ sub-package-b
        ❯◉ sub-package-c
         ◯ sub-package-d

        >>> input ENTER

        >>> input ARROW_UP
        >>> input ARROW_UP

        ❯ 0.1.1
          0.1.0

        >>> input ENTER

        ? Select dependency installation type for "sub-package-c" (Use arrow keys)
        ❯ dependencies
          devDependencies

        >>> input CTRL+C
       `
    );
  });
});
