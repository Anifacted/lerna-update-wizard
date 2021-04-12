const lines = require("./utils/lines");

module.exports = (context, jobs) =>
  lines(
    ...jobs.map(job =>
      lines(
        job.targetDependency,
        ...job.targetPackages.map(pack => {
          let change = `  * ${pack}: `;
          const existingInstall =
            context.dependencyMap[job.targetDependency].packs[pack];
          if (existingInstall) {
            const versionChanges = existingInstall.map(({ version }) =>
              version === job.targetVersionResolved
                ? `${job.targetVersionResolved}`
                : `${version} → ${job.targetVersionResolved}`
            );
            change = `${change}${versionChanges.join(", ")}`;
          } else {
            change = `${change}${job.targetVersionResolved} +`;
          }

          return change;
        }),
        ""
      )
    )
  );
