const { spawn } = require("child_process");

const ui = require("./ui");

module.exports = async (options = {}) => {
  ui.logBottom(options.startMessage);
  const proc = spawn(options.cmd, { shell: true });

  if (options.logOutput !== false) proc.stdout.pipe(ui.log);

  let data = "";
  return new Promise((resolve, reject) => {
    proc.stdout.on("data", d => (data = data + d.toString()));
    proc.stdout.on("end", () => {
      ui.logBottom("");
      options.endMessage && ui.log.write(options.endMessage);
      ui.log.write("");
      resolve(data);
    });
    proc.stdout.on("error", reject);
  });
};
