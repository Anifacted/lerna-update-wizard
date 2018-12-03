module.exports = signature => {
  const [name, version] = signature.split("@");

  return { name, version };
};
