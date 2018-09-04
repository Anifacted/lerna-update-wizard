const expect = require("unexpected");
const stripAnsi = require("strip-ansi");
const { generatePattern, mirrorPattern } = require("./processIndicator");

describe("processIndicator", () => {
  it("generatePattern", () => {
    const output = [
      "─                            ",
      " ─                           ",
      "   ──                        ",
      "      ───                    ",
      "         ─────               ",
    ];

    expect(generatePattern, "when called with", [29, 5], "to equal", output);
  });

  it("mirrorPattern", () => {
    const pattern = [
      "─                            ",
      " ─                           ",
      "   ──                        ",
      "      ───                    ",
      "         ─────               ",
    ];

    const output = [
      "─                            ",
      " ─                           ",
      "   ──                        ",
      "      ───                    ",
      "         ─────               ",
      "               ─────         ",
      "                    ───      ",
      "                        ──   ",
      "                           ─ ",
      "                            ─",
    ];

    expect(mirrorPattern(pattern).map(stripAnsi), "to equal", output);
  });

  it("pingPongPattern", () => {
    const pattern = [
      "─                            ",
      " ─                           ",
      "   ──                        ",
      "      ───                    ",
      "         ─────               ",
    ];

    const output = [
      "─                            ",
      " ─                           ",
      "   ──                        ",
      "      ───                    ",
      "         ─────               ",
      "               ─────         ",
      "                    ───      ",
      "                        ──   ",
      "                           ─ ",
      "                            ─",
    ];

    expect(mirrorPattern(pattern).map(stripAnsi), "to equal", output);
  });
});
