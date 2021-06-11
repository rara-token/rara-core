const RaraToken = artifacts.require("RaraToken");

module.exports = function (deployer) {
  deployer.deploy(RaraToken);
};
