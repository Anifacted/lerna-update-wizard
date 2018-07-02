const path = require("path");
const chalk = require("chalk");
const { streamWrite, streamEnd } = require("@rauschma/stringio");
// const runCommand = require("../src/utils/runCommand");
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
    proc.stdout.removeAllListeners();

    if (debug) {
      proc.stdout.on("data", data => {
        // ui.log.write(data.toString());
      });
    }

    if (lookFor) {
      proc.stdout.on("data", data => {
        if (data.toString().includes(lookFor)) {
          // ui.log.write(chalk.green(`Found: "${lookFor}"`));
          if (!last) resolve(proc);
        }
      });
    }
    if (input) {
      setTimeout(() => {
        const inputCode = keys[input] || input;
        // ui.log.write(chalk.blue(`Input: ${input}`));
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
  // ui.log.write(chalk.white("Running sequence..."));
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
    expect(true, "to be true");
    return sequence(spawn(r("./simpletestindex.js")), [
      {
        lookFor: "loading",
      },
      {
        lookFor: "? Enter a name for your branch: (marc)",
      },
      {
        input: "Coolio",
      },
      { input: "ENTER", debug: true, lookFor: "all done" },
    ]).then(() => {
      expect(false, "to be false");
    });
  });
});
