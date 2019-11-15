const merge = require("lodash/merge");
const sortBy = require("lodash/sortBy");
const fromPairs = require("lodash/fromPairs");

const sortByKeys = object =>
  fromPairs(sortBy(Object.keys(object)).map(key => [key, object[key]]));

module.exports = (basePackageJson, modificationsBlob) => {
  const merged = merge(basePackageJson, modificationsBlob);

  merged.dependencies = merged.dependencies && sortByKeys(merged.dependencies);

  merged.devDependencies =
    merged.devDependencies && sortByKeys(merged.devDependencies);

  merged.peerDependencies =
    merged.peerDependencies && sortByKeys(merged.peerDependencies);

  return JSON.stringify(merged, null, 2);
};
