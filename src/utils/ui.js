const inquirer = require("inquirer");
const ui = new inquirer.ui.BottomBar();
const stripAnsi = require("strip-ansi");

const { player } = require("./processIndicator");

let bottomMessageUpdateId = null;
let bottomMessage = "";

module.exports.logBottom = (message = "") => {
  const { tick } = player({
    frames: 6,
    size: stripAnsi(message).length,
  });

  if (message !== bottomMessage) {
    clearInterval(bottomMessageUpdateId);

    if (message !== "") {
      bottomMessageUpdateId = setInterval(() => {
        ui.updateBottomBar(`${message}\n${tick()}\n`);
      }, 50);
    } else {
      ui.updateBottomBar("");
    }
  }

  bottomMessage = message;
};

module.exports.log = ui.log;
