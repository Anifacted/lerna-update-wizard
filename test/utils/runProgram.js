const chalk = require("chalk");
const { streamWrite } = require("@rauschma/stringio");
const fs = require("fs-extra");
const stripANSI = require("strip-ansi");
const sequenceFromString = require("./sequenceFromString");

const { spawn } = require("child_process");

// From https://www.novell.com/documentation/extend5/Docs/help/Composer/books/TelnetAppendixB.html
const keys = {
  ARROW_UP: "\u001b[A",
  ARROW_DOWN: "\u001b[B",
  ARROW_RIGHT: "\u001b[C",
  ARROW_LEFT: "\u001b[D",
  ENTER: "\n",
  "CTRL+C": "\u0003",
  SPACE: " ",
};

const run = (proc, { input, lookFor, maxWait = 5 }, onStdOut) =>
  new Promise(async (resolve, reject) => {
    if (!proc) return resolve();

    proc.stdout.removeAllListeners();

    proc.stdout.on("data", data => {
      onStdOut(data.toString());
    });

    if (lookFor) {
      let timeoutId = setTimeout(
        () =>
          reject(new Error(`Did not find "${lookFor}" within ${maxWait} sec.`)),
        maxWait * 1000
      );

      proc.stdout.on("data", data => {
        const isFound = Array.isArray(lookFor)
          ? lookFor.every(line => data.toString().includes(line))
          : data.toString().includes(lookFor);

        if (isFound) {
          clearTimeout(timeoutId);

          const output = Array.isArray(lookFor)
            ? data
                .toString()
                .split("\n")
                .filter(l => lookFor.some(lf => l.includes(lf)))
                .join("\n")
            : `"${lookFor}"`;

          console.info(chalk.green(`Found:\n${output}`));

          setTimeout(() => resolve(proc), 500);
        }
      });
    }

    if (input) {
      const sendInput = data =>
        new Promise(resolve => {
          console.info(chalk.blue(`Input: ${data}`));
          setTimeout(() => {
            const inputCode = keys[data] || data;
            streamWrite(proc.stdin, inputCode);

            if (!lookFor) resolve(proc);
          }, 200);
        });

      const sendInputs = async inputs => {
        for (const input of inputs) {
          await sendInput(input);
        }
      };

      (await Array.isArray(input)) ? sendInputs(input) : sendInput(input);
      resolve(proc);
    }

    proc.stdout.on("end", () => setTimeout(resolve, 1000));
  });

module.exports = (projectPath, inputSequence, { log = false } = {}) => {
  const [initial, ...sequences] =
    typeof inputSequence === "string"
      ? sequenceFromString(inputSequence)
      : inputSequence;

  const cmd = `./bin/lernaupdate ${projectPath}`;
  const proc = spawn(cmd, { shell: true });

  console.info(chalk.white.bold(`Running program: ${cmd}`));
  const logFilePath = `./tmp/test-log.txt`;

  fs.ensureFileSync(logFilePath);

  console.info("Track log output:");
  console.info(chalk.bold.white(`tail -f ${logFilePath} | sed 's/\\n/\\n/g'`));

  const onStdOut = content => {
    log && console.log(chalk.red(content));
    fs.appendFileSync(logFilePath, content);
  };

  return sequences
    .reduce(
      (prev, config, index) => prev.then(proc => run(proc, config, onStdOut)),
      run(proc, initial, onStdOut)
    )
    .then(() => stripANSI(fs.readFileSync(logFilePath).toString()));
};
