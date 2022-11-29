const RaraToken = artifacts.require("RaraToken");
const RaraEmitter = artifacts.require("RaraEmitter");
const FlowSupplementEmitter = artifacts.require("FlowSupplementEmitter");

const values = require('./shared/values');

module.exports = function (deployer, network, accounts) {
  const { tokens } = values({ network, web3 });

  deployer.then(async () => {
    const rara = await RaraToken.deployed();
    const emitter = await RaraEmitter.deployed();
    await deployer.deploy(FlowSupplementEmitter, rara.address, emitter.address, tokens.zero);
  });
};
