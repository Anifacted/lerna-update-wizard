const { default: runProgram } = require("./utils/runProgram");
const generateProject = require("./utils/generateProject");
const { resolve } = require("path");
const expect = require("unexpected");

describe("Multiple installation jobs", async () => {
  it("correctly adds in one job and updates in another", async () => {
    // eslint-disable-next-line
    jest.setTimeout(100000);
    const projectPath = await generateProject({
      name: "multijob-project",
      packages: [
        { name: "my-app" },
        {
          name: "my-tools",
          dependencies: { treediff: "0.1.0" },
        },
        { name: "my-helpers", dependencies: { lodash: "0.1.0" } },
      ],
    });

    await runProgram(
      projectPath,
      `
        ? Select a dependency to upgrade: (Use arrow keys or type to search)

        >>> input lodash

        ❯ lodash (1 version)

        >>> input ENTER

        ❯◯ my-app
         ◉ my-helpers (0.1.0)
         ◯ my-tools

        >>> input SPACE

        ? Select packages to affect:
        ❯◉ my-app
         ◉ my-helpers (0.1.0)
         ◯ my-tools

        >>> input ENTER

        ? Select packages to affect: my-app, my-helpers (0.1.0)

        ? Select version to install:

        >>> input ARROW_UP
        >>> input ARROW_UP

        ❯ 0.2.1

        >>> input ENTER

        ? Confirm or edit installations
         (Use arrow keys)
          x lodash 0.2.1 (2 packages)
          ──────────────
          + Add another
        ❯ ✓ Confirm

        >>> input ARROW_UP

        ❯ + Add another

        >>> input ENTER

        ? Select a dependency to upgrade: (Use arrow keys or type to search)
        ❯ treediff (1 version)

        >>> input ENTER

        ❯◯ my-app
         ◯ my-helpers
         ◉ my-tools (0.1.0)

        >>> input SPACE

        ❯◉ my-app
         ◯ my-helpers
         ◉ my-tools (0.1.0)

        >>> input ARROW_DOWN
        >>> input ARROW_DOWN

        >>> input SPACE

         ◉ my-app
         ◯ my-helpers
        ❯◯ my-tools (0.1.0)

        >>> input ENTER

        ? Select version to install:

        >>> input ARROW_UP
        >>> input ARROW_UP

        ❯ 0.0.2

        >>> input ENTER

       ? Confirm or edit installations
        (Use arrow keys)
          x lodash 0.2.1 (2 packages)
          x treediff 0.0.2 (1 package)
          x Clear all
          ──────────────
          + Add another
        ❯ ✓ Confirm

        >>> input ARROW_UP

        ❯ + Add another

        >>> input ENTER

        No results...

        >>> input promise-react-component

        ❯ promise-react-component [+ADD]

        >>> input ENTER

        ❯◯ my-app
         ◯ my-helpers
         ◯ my-tools

        >>> input SPACE

        ❯◉ my-app
         ◯ my-helpers
         ◯ my-tools

        >>> input ENTER

        >>> input ARROW_UP
        >>> input ARROW_UP

        ❯ 0.0.2

        >>> input ENTER

        ? Confirm or edit installations
         (Use arrow keys)
          x lodash 0.2.1 (2 packages)
          x treediff 0.0.2 (1 package)
          x promise-react-component 0.0.2 (1 package)
          x Clear all
          ──────────────
          + Add another
        ❯ ✓ Confirm

        >>> input ENTER

        ? Select installation type for new dependency
          my-app
          + lodash 0.2.1

        >>> input ARROW_DOWN

        ❯ devDependencies

        >>> input ENTER

        ? Select installation type for new dependency
          my-app
          + treediff 0.0.2

        >>> input ENTER

        ? Select installation type for new dependency
          my-app
          + promise-react-component 0.0.2

        >>> input ENTER

        ? Do you want to create a new git branch for the change? (Y/n)

        >>> input CTRL+C
       `
    );

    expect(
      require(resolve(projectPath, "packages", "my-app", "package.json")),
      "to satisfy",
      {
        dependencies: { "promise-react-component": "0.0.2", treediff: "0.0.2" },
        devDependencies: { lodash: "^0.2.1" },
        peerDependencies: expect.it("to be empty"),
      }
    );

    expect(
      require(resolve(projectPath, "packages", "my-helpers", "package.json")),
      "to satisfy",
      {
        dependencies: { lodash: "^0.2.1" },
        devDependencies: expect.it("to be empty"),
        peerDependencies: expect.it("to be empty"),
      }
    );

    expect(
      require(resolve(projectPath, "packages", "my-tools", "package.json")),
      "to satisfy",
      {
        dependencies: { treediff: "0.1.0" },
        devDependencies: expect.it("to be empty"),
        peerDependencies: expect.it("to be empty"),
      }
    );
  });
});
