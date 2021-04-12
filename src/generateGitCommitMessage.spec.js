const expect = require("unexpected");
const lines = require("./utils/lines");
const generateGitCommitMessage = require("./generateGitCommitMessage");

describe("generateGitCommitMessage", () => {
  it("should generate correct message", () => {
    const mockContext = {
      dependencyMap: {
        lodash: {
          packs: {
            "package-a": [{ version: "1.2.0", source: "dependencies" }],
            "package-b": [{ version: "1.3.0", source: "devDependencies" }],
            "package-c": [{ version: "1.4.0", source: "devDependencies" }],
          },
          versions: ["1.2.0", "1.3.0", "1.4.0"],
          name: "lodash",
          color: "grey",
        },
        underscore: {
          packs: {
            "package-a": [{ version: "3.0.0", source: "dependencies" }],
          },
          versions: ["3.0.0"],
          name: "lodash",
          color: "grey",
        },
      },
    };

    const mockJobs = [
      {
        targetPackages: ["package-b", "package-c"],
        targetDependency: "lodash",
        targetVersion: "2.0.0",
        targetVersionResolved: "2.0.0",
        isNewDependency: false,
      },
      {
        targetPackages: ["package-a", "package-b"],
        targetDependency: "underscore",
        targetVersion: "3.0.0",
        targetVersionResolved: "3.0.0",
        isNewDependency: false,
      },
    ];

    expect(
      generateGitCommitMessage,
      "when called with",
      [mockContext, mockJobs],
      "to equal",
      lines(
        "lodash",
        "  * package-b: 1.3.0 → 2.0.0",
        "  * package-c: 1.4.0 → 2.0.0",
        "",
        "underscore",
        "  * package-a: 3.0.0",
        "  * package-b: 3.0.0 +",
        ""
      )
    );
  });
});
