const RaraToken = artifacts.require("RaraToken");
const RaraEmitter = artifacts.require("RaraEmitter");

const values = require('./shared/values');

module.exports = function (deployer, network, accounts) {
  const { emitter, roles } = values({ network, web3 });

  deployer.then(async () => {
    const rara = await RaraToken.deployed();
    await deployer.deploy(RaraEmitter, rara.address, emitter.raraPerBlock, emitter.startBlock);
    const raraEmitter = await RaraEmitter.deployed();

    // the emitter can mint rara
    await rara.grantRole(roles.minter, raraEmitter.address);
  });
};
