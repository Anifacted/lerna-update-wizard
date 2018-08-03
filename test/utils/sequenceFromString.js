const ensureArray = val => (Array.isArray(val) ? val : [val]);

const trimInput = l => l.split("> ").pop();

module.exports = commandsStr =>
  commandsStr
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.trim() !== "")
    .reduce((prev, l, idx) => {
      const isInput = l.startsWith("> ");

      if (prev.length === 0) {
        return [isInput ? { input: trimInput(l) } : { lookFor: l }];
      }

      if (!isInput && prev[prev.length - 1].lookFor) {
        return [
          ...prev.slice(0, prev.length - 1),
          { lookFor: [...ensureArray(prev[prev.length - 1].lookFor), l] },
        ];
      }

      if (isInput && prev[prev.length - 1].input) {
        return [
          ...prev.slice(0, prev.length - 1),
          {
            input: [...ensureArray(prev[prev.length - 1].input), trimInput(l)],
          },
        ];
      }

      // Default: new entry
      return isInput
        ? [...prev, { input: trimInput(l) }]
        : [...prev, { lookFor: l }];
    }, []);
