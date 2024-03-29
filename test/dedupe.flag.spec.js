const { default: runProgram } = require("./utils/runProgram");
const generateProject = require("./utils/generateProject");
const expect = require("unexpected");
const { resolve } = require("path");

let projectPath;

describe("--dedupe flag", () => {
  beforeAll(async () => {
    projectPath = await generateProject({
      name: "project-dedupe-flag",
      packages: [
        {
          name: "sub-package-a",
          dependencies: { lodash: "0.1.0" },
        },
        {
          name: "sub-package-b",
          dependencies: { lodash: "0.2.0", treediff: "0.1.0" },
        },
      ],
    });
  });

  it("filters out dependencies with less than different 2 versions installed", async () => {
    await runProgram(
      `${projectPath} --dedupe`,
      `
        ? Select a dependency to upgrade: (Use arrow keys or type to search)
        ❯ lodash (2 versions)

        >>> input tree

        ? Select a dependency to upgrade: tree
        ❯ tree [+ADD]

        >>> input CTRL+C
        `
    );
  });

  it("deduplicates dependency version by installing the highest installed version", async () => {
    await runProgram(
      `${projectPath} --dedupe`,
      `
        ? Select a dependency to upgrade: (Use arrow keys or type to search)
        ❯ lodash (2 versions)

        >>> input lodash

        ? Select a dependency to upgrade: lodash
        ❯ lodash (2 versions)

        >>> input ENTER

        ❯◉ sub-package-a (0.1.0)
         ◉ sub-package-b (0.2.0)

        >>> input ENTER

        ? Select version to install:

        >>> input ARROW_DOWN
        >>> input ENTER

        ❯ ✓ Confirm

        >>> input ENTER

        sub-package-b:
          lodash@0.2.0
          Already installed ✗

        >>> input CTRL+C
        `
    );

    expect(
      require(resolve(projectPath, "packages/sub-package-a/package.json")),
      "to satisfy",
      { dependencies: { lodash: "^0.2.0" } }
    );
  });
});
