const path = require("path");
const chalk = require("chalk");
const { streamWrite, streamEnd } = require("@rauschma/stringio");
const runCommand = require("../src/utils/runCommand");
const expect = require("unexpected");
const ui = require("../src/utils/ui");

const keys = {
  ARROW_UP: "\u001b[A",
  ARROW_DOWN: "\u001b[B",
  ARROW_RIGHT: "\u001b[C",
  ARROW_LEFT: "\u001b[D",
  ENTER: "\n",
};

const { spawn } = require("child_process");

const run = (proc, { input, lookFor, debug, last }) =>
  new Promise(resolve => {
    if (!proc) return resolve();

    proc.stdout.removeAllListeners();

    if (debug) {
      proc.stdout.on("data", data => {
        console.info(data.toString());
      });
    }

    if (lookFor) {
      proc.stdout.on("data", data => {
        if (data.toString().includes(lookFor)) {
          console.info(chalk.green(`Found: "${lookFor}"`));
          if (!last) resolve(proc);
        }
      });
    }
    if (input) {
      setTimeout(() => {
        const inputCode = keys[input] || input;
        console.info(chalk.blue(`Input: ${input}`));
        streamWrite(proc.stdin, inputCode);
        // if (debug) {
        //   streamEnd(proc.stdin);
        // }

        if (!lookFor) resolve(proc);
      }, 500);
    }

    proc.stdout.on("end", () => {
      console.log("done", input, lookFor);
      setTimeout(resolve, 2000);
    });
  });

const sequence = (proc, [initial, ...sequences]) => {
  console.info(chalk.white("Running sequence..."));
  return sequences.reduce(
    (prev, config, index) => prev.then(proc => run(proc, config)),
    run(proc, initial)
  );
};

const r = p => path.resolve(__dirname, p);

describe("lerna-update-wizard", () => {
  // beforeEach(async () => {
  // return await runCommand(`cp -r test/fixtures/ ${tmpPath}`);
  // });

  jest.setTimeout(100000);

  it("should find dependency when searching", () => {
    return sequence(spawn(r("../bin/lernaupdate"), [r("../tmp/projectA")]), [
      {
        lookFor:
          "? Select a dependency to upgrade: (Use arrow keys or type to search)",
      },
      {
        input: "lodash",
        lookFor: "❯ lodash (1 version)",
      },
      { input: "ENTER", lookFor: "❯◉ projectA-1 (^4.17.10)" },
      { input: "ENTER", lookFor: "❯ 4.17.10 #latest" },
      {
        input: "ENTER",
        lookFor:
          "? Do you want to create a new git branch for the change? (Y/n)",
        onComplete: output => console.log(output),
      },
      { input: "n" },
      {
        input: "ENTER",
        lookFor:
          "? Do you want to create a new git commit for the change? (Y/n)",
      },
      { input: "n" },
      {
        input: "ENTER",
        lookFor: "? Do you want to create a new git commit for the change? No",
        debug: true,
        last: true,
      },
    ]).then(() => {
      expect(false, "to be false");
    });
  });
});
