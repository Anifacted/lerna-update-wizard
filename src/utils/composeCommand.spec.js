const expect = require("unexpected");
const composeCommand = require("./composeCommand");

describe("composeCommand", () => {
  it("composes single command", () => {
    expect(composeCommand, "when called with", ["yarn"], "to equal", "yarn");
  });

  it("composes multiple commands", () => {
    expect(
      composeCommand,
      "when called with",
      ["yarn", "add"],
      "to equal",
      "yarn add"
    );
  });

  it("ignores empty inputs", () => {
    expect(
      composeCommand,
      "when called with",
      ["yarn", undefined, "add", null, false],
      "to equal",
      "yarn add"
    );
  });
});
