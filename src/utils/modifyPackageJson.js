const merge = require("lodash/merge");
const sortBy = require("lodash/sortBy");
const fromPairs = require("lodash/fromPairs");
const fs = require("fs-extra");

const sortByKeys = object =>
  fromPairs(sortBy(Object.keys(object)).map(key => [key, object[key]]));

module.exports = (basePackageJsonPath, modificationsBlob) => {
  const basePackageJson = fs.readFileSync(basePackageJsonPath, "utf8");

  const fileEndMatch = basePackageJson.match(/}((\s|\n)+$)/);

  const whitespaceMatch = basePackageJson.match(/{\n^(\s+)"/m);
  const whitespaceChar = (whitespaceMatch && whitespaceMatch[1]) || "  ";

  const merged = merge(JSON.parse(basePackageJson), modificationsBlob);

  merged.dependencies = merged.dependencies && sortByKeys(merged.dependencies);

  merged.devDependencies =
    merged.devDependencies && sortByKeys(merged.devDependencies);

  merged.peerDependencies =
    merged.peerDependencies && sortByKeys(merged.peerDependencies);

  let mergedResult = JSON.stringify(merged, null, whitespaceChar);

  if (fileEndMatch) {
    mergedResult = mergedResult.replace(/}$/, fileEndMatch[0]);
  }

  return mergedResult;
};
