const lines = require("./utils/lines");

module.exports = (context, jobs) =>
  lines(
    ...jobs.map(job =>
      lines(
        job.targetDependency,
        ...job.targetPackages.map(pack => {
          const existingInstall =
            context.dependencyMap[job.targetDependency].packs[pack];

          const existingVersion = existingInstall && existingInstall.version;
          const plus = !existingVersion ? " +" : "";

          return !existingVersion ||
            existingVersion === job.targetVersionResolved
            ? `  * ${pack}: ${job.targetVersionResolved}${plus}`
            : `  * ${pack}: ${existingVersion} →  ${job.targetVersionResolved}`;
        }),
        ""
      )
    )
  );
