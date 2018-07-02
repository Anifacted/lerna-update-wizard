// const inquirer = require("inquirer");

let bottomMessageUpdateId = null;
let bottomMessage = "";

// const ui = new inquirer.ui.BottomBar();
module.exports.logBottom = (ui, message = "") => {
  const chars = "/-\\|";
  let index = 0;

  if (message !== bottomMessage) {
    clearInterval(bottomMessageUpdateId);

    if (message !== "") {
      bottomMessageUpdateId = setInterval(() => {
        if (chars.charAt(index) === "") index = 0;

        console.log(ui);

        ui.updateBottomBar(`${chars.charAt(index++)} ${message}`);
        // ui.close();
      }, 100);
    } else {
      ui.updateBottomBar("");
      // ui.close();
    }
  }

  bottomMessage = message;
};

// module.exports.log = new inquirer.ui.BottomBar().log;
