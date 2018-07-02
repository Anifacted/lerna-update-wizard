#!/usr/bin/env node

const inquirer = require("inquirer");

module.exports = async () => {
  console.log("loading");
  await inquirer.prompt([
    {
      type: "input",
      name: "gitBranchName",
      message: "Enter a name for your branch:",
      default: "marc",
    },
  ]);
  console.log("all done");
};
