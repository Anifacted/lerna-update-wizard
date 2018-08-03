const expect = require("unexpected");
const sequenceFromString = require("./sequenceFromString");

describe("sequenceFromString", () => {
  it("consolidates inputs", () => {
    const seq = `
      foobar

      > ENTER
      > n

      baz
    `;
    expect(sequenceFromString, "when called with", [seq], "to equal", [
      { lookFor: "foobar" },
      { input: ["ENTER", "n"] },
      { lookFor: "baz" },
    ]);
  });

  it("consolidates lookFors", () => {
    const seq = `
      foobar
      quix

      > ENTER

      baz
    `;
    expect(sequenceFromString, "when called with", [seq], "to equal", [
      { lookFor: ["foobar", "quix"] },
      { input: "ENTER" },
      { lookFor: "baz" },
    ]);
  });
});
