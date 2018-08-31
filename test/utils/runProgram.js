const chalk = require("chalk");
const { streamWrite } = require("@rauschma/stringio");
const fs = require("fs-extra");
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

let latestBuffer = "";

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const run = (proc, { type, value, maxWait = 5 }, onStdOut) =>
  new Promise(async (resolve, reject) => {
    if (!proc) return resolve();

    proc.stdout.removeAllListeners();

    proc.stdout.on("data", bufferData => {
      const data = bufferData.toString();
      latestBuffer += data;
      onStdOut && onStdOut(data);
    });

    switch (type) {
      case "wait":
        return resolve(proc);
      case "find":
        let timeoutId = setTimeout(() => {
          reject(new Error(`Did not find "${value}" within ${maxWait} sec.`));
        }, maxWait * 1000);

        const resolveIfFound = bufferOrString => {
          const data = bufferOrString.toString();
          const isFound = Array.isArray(value)
            ? value.every(line => data.includes(line))
            : data.includes(value);

          if (isFound) {
            clearTimeout(timeoutId);

            const output = Array.isArray(value)
              ? latestBuffer
                  .toString()
                  .split("\n")
                  .filter(l => value.some(lf => l.includes(lf)))
                  .join("\n")
              : `"${value}"`;

            console.info(chalk.green(`Found:\n${output}\n`));

            delay(500).then(() => resolve(proc));
          }
          return isFound;
        };

        const foundInBuffer = resolveIfFound(latestBuffer);

        if (!foundInBuffer) {
          proc.stdout.on("data", resolveIfFound);
        }

        break;
      case "input":
        const sendInput = async data => {
          console.info(chalk.blue(`Input: ${data}`));
          streamWrite(proc.stdin, keys[data] || data);
          await delay(200); // Prevent clogging
        };

        const sendInputs = async inputs => {
          for (const input of inputs) {
            latestBuffer = "";

            await sendInput(input);
          }
        };

        await (Array.isArray(value) ? sendInputs(value) : sendInput(value));
        resolve(proc);
        break;
    }

    proc.stdout.on("end", async () => {
      await delay(1000);
      resolve();
    });
  });

module.exports.run = run;

module.exports.default = (
  projectPath,
  inputSequence,
  { log = !!process.env.CI } = {}
) => {
  const program =
    typeof inputSequence === "string"
      ? sequenceFromString(inputSequence)
      : inputSequence;

  const [initial, ...sequences] = program;

  log && console.info("Running program", JSON.stringify(program, null, 2));

  const cmd = `./bin/lernaupdate ${projectPath}`;
  const proc = spawn(cmd, { shell: true });

  console.info(chalk.white.bold(`Running program: ${cmd}`));
  const logFilePath = `./tmp/test-log.txt`;

  fs.ensureFileSync(logFilePath);

  console.info("Track log output:");
  console.info(chalk.bold.white(`tail -f ${logFilePath} | sed 's/\\n/\\n/g'`));

  const onStdOut = content => {
    log && console.info(chalk.red(content));
    fs.appendFileSync(logFilePath, content);
  };

  return sequences.reduce(
    (prev, config, index) => prev.then(proc => run(proc, config, onStdOut)),
    run(proc, initial, onStdOut)
  );
};
