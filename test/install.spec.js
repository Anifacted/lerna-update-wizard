const { default: runProgram } = require("./utils/runProgram");
const generateProject = require("./utils/generateProject");

describe("Simple install", async () => {
  let projectPath;

  beforeEach(async () => {
    projectPath = await generateProject({
      name: "project-a",
      packages: [
        { name: "sub-package-a" },
        {
          name: "sub-package-b",
          dependencies: { lodash: "0.1.0" },
        },
        { name: "sub-package-c" },
        { name: "sub-package-d", dependencies: { lodash: "0.2.0" } },
      ],
    });
  });

  it("correctly navigates, toggles and installs", async () => {
    // eslint-disable-next-line
    jest.setTimeout(100000);

    await runProgram(
      projectPath,
      ` ? Select a dependency to upgrade: (Use arrow keys or type to search)

        >>> input lodash

        ❯ lodash (2 versions)

        >>> input ENTER

        ? Select a dependency to upgrade: lodash (2 versions)
       ❯◯ sub-package-a
        ◉ sub-package-b (0.1.0)
        ◯ sub-package-c
        ◉ sub-package-d (0.2.0)

       >>> input ARROW_UP
       >>> input ARROW_UP
       >>> input SPACE

       ◯ sub-package-a
       ◉ sub-package-b (0.1.0)
      ❯◉ sub-package-c
       ◉ sub-package-d (0.2.0)

       >>> input ENTER

       ? Select version to install: (Use arrow keys)

       >>> input ARROW_UP
       >>> input ARROW_UP
       >>> input ARROW_UP

       ❯ 0.2.2
         0.2.1
         0.1.0

       >>> input ENTER

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
