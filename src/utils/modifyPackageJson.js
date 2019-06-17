const { format } = require("prettier-package-json");
const merge = require("lodash/merge");

module.exports = (basePackageJson, modificationsBlob) => {
  const merged = merge(basePackageJson, modificationsBlob);
  return format(merged);
};
