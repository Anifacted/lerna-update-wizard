# Lerna update wizard

Command line interface for simplifying the process of bulk updating dependencies across multiple Lerna packages.

## Install

```bash
$ yarn add lerna-update-wizard
```

Or via NPM:

```bash
$ npm install --save-dev lerna-update-wizard
```

If installed globally, it can be used independently of a project:

```bash
$ yarn global add lerna-update-wizard
```

## Usage

Simply run the command in the root of a Lerna based project:

```bash
$ lernaupdate
```

Or from the outside by specifying the path to the project:

```bash
$ lernaupdate ~/projects/my-lerna-project
```

### Step 1

When running the command you will be prompted to search for and select the dependency you wish to install:

![Select dependency](https://raw.githubusercontent.com/Anifacted/lerna-update-wizard/master/public/update.png?raw=true "Select dependency")

### Step 2

After selecting a dependency you will be asked to specify which package(s) to install the dependency in. Packages with already installed versions of the dependency will be preselected with the installed version number shown:

![Select packages](https://raw.githubusercontent.com/Anifacted/lerna-update-wizard/master/public/step2.png?raw=true "Select packages")

### Step 3

Next you will need to specify which version you wish to install from the list of available versions for that dependency:

![Select version](https://raw.githubusercontent.com/Anifacted/lerna-update-wizard/master/public/step3.png?raw=true "Select version")

### Step 4

Finally, you can optionally choose to create a git branch and/or commit containing the changes made in the update:

![Git branc/commit](https://raw.githubusercontent.com/Anifacted/lerna-update-wizard/master/public/step4.png?raw=true "Git branch/commit")
