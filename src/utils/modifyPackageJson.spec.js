const expect = require("unexpected");
const modifyPackageJson = require("./modifyPackageJson");

const baseJson = JSON.parse(`{
  "name": "lerna-update-wizard",
  "bin": {
    "lernaupdate": "./bin/lernaupdate"
  },
  "version": "0.12.0",
  "main": "index.js",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/Anifacted/lerna-update-wizard"
  },
  "dependencies": {
    "chalk": "^2.3.0",
    "semver-compare": "^1.0.0"
  },
  "devDependencies": {
  },
  "scripts": {
    "test": "jest --verbose --runInBand"
  },
  "jest": {
    "testURL": "http://localhost"
  }
}`);

describe("modifyPackageJson", () => {
  it("should work", () => {
    const mods = {
      dependencies: {
        d3: "3",
      },
      devDependencies: {
        lodash: "3",
      },
      peerDependencies: {
        underscore: "~2",
      },
    };

    expect(
      modifyPackageJson,
      "when called with",
      [baseJson, mods],
      "to equal",
      `{
  "name": "lerna-update-wizard",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/Anifacted/lerna-update-wizard"
  },
  "version": "0.12.0",
  "main": "index.js",
  "bin": {
    "lernaupdate": "./bin/lernaupdate"
  },
  "scripts": {
    "test": "jest --verbose --runInBand"
  },
  "dependencies": {
    "chalk": "^2.3.0",
    "d3": "3",
    "semver-compare": "^1.0.0"
  },
  "peerDependencies": {
    "underscore": "~2"
  },
  "devDependencies": {
    "lodash": "3"
  },
  "jest": {
    "testURL": "http://localhost"
  }
}\n`
    );
  });
});
