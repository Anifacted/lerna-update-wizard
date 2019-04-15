const lines = require("./lines");

module.exports = (condition, ...textLines) => {
  if (!condition) {
    throw new Error(lines(...textLines));
  }
};
