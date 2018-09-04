const chalk = require("chalk");

const clamp = (value, min, max) => {
  if (typeof value !== "number") {
    throw new Error(`Cannot clamp non-number '${value}'`);
  }
  return value > max ? max : value < min ? min : value;
};

const curve = (start, end, factor, exp = 2) => {
  if (factor === 0) return start;

  const size = end - start;
  const current = size * factor;
  return current * Math.pow(factor, exp);
};

const generatePattern = (size, frames) => {
  let output = [];

  for (let frame = 0; frame < frames; frame++) {
    const progressFactor = (frame + 1) / frames;
    const startAt = curve(0, size, progressFactor, 1) / 2;
    const barSize = Math.ceil(curve(1, 6, progressFactor, 2));
    const bar = "─".repeat(barSize);
    const frameOutput = " ".repeat(clamp(startAt - barSize, 0, size)) + bar;

    output = [...output, (frameOutput + " ".repeat(size)).substr(0, size)];
  }

  return output;
};

const mirrorPattern = pattern => {
  const applyColor = frame => {
    const barSize = frame.trim().length;
    if (barSize > 3) return chalk.red.dim(frame);
    return chalk.red(frame);
  };

  return [
    ...pattern.map(applyColor),
    ...pattern
      .slice()
      .reverse()
      .map((frame, idx) =>
        applyColor(
          frame
            .split("")
            .reverse()
            .join(""),
          pattern.length - idx - 1
        )
      ),
  ];
};

const player = ({ size, frames }) => {
  const patternFrames = mirrorPattern(generatePattern(size, frames));
  let index = 0;
  let ticker = 1;

  const tick = () => {
    const output = patternFrames[index];

    index += ticker;

    if (index >= patternFrames.length - 1) {
      ticker = -1;
    } else if (index <= 0) {
      ticker = 1;
    }
    return output;
  };
  return { tick };
};

module.exports = {
  generatePattern,
  mirrorPattern,
  player,
};
