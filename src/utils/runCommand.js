const { spawn } = require("child_process");
const perf = require("execution-time")();
const { logBottom } = require("../utils/ui");

module.exports = ui => async (cmd, options = {}) => {
  logBottom(ui, options.startMessage);
  const proc = spawn(cmd, { shell: true });

  if (options.logOutput !== false) proc.stdout.pipe(ui.log);
  if (options.logTime) perf.start();

  let data = "";
  return new Promise((resolve, reject) => {
    proc.stdout.on("data", d => {
      data = data + d.toString();
    });
    proc.stdout.on("end", () => {
      logBottom("");

      if (options.endMessage || options.logTime) {
        const timeLog = options.logTime ? `(${perf.stop().words})` : "";

        const endMessage = options.endMessage || "";

        console.info([endMessage, timeLog].join(" "));
      }

      console.info("");
      resolve(data);
    });
    proc.stdout.on("error", reject);
  });
};
