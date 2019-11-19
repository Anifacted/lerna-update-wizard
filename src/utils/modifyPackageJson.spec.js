const expect = require("unexpected");
const modifyPackageJson = require("./modifyPackageJson");
const { resolve } = require("path");
const fs = require("fs-extra");

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

    const outputPath = resolve("tmp", "modifyPackageJson-test", "package.json");

    fs.outputFileSync(
      outputPath,
      `{
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
}
\t

`
    );

    expect(
      modifyPackageJson,
      "when called with",
      [outputPath, mods],
      "to equal",
      `{
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
    "d3": "3",
    "semver-compare": "^1.0.0"
  },
  "devDependencies": {
    "lodash": "3"
  },
  "scripts": {
    "test": "jest --verbose --runInBand"
  },
  "jest": {
    "testURL": "http://localhost"
  },
  "peerDependencies": {
    "underscore": "~2"
  }
}
\t

`
    );
  });
});
