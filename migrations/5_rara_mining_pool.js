const RaraToken = artifacts.require("RaraToken");
const RaraEmitter = artifacts.require("RaraEmitter");
const RaraMiningPool = artifacts.require("RaraMiningPool");

const values = require('./shared/values');

module.exports = function (deployer, network, accounts) {
  const { miningPool } = values({ network, web3 });

  deployer.then(async () => {
    const rara = await RaraToken.deployed();
    const emitter = await RaraEmitter.deployed();
    await deployer.deploy(RaraMiningPool, rara.address, emitter.address, miningPool.unlockBlock);
    if (miningPool.burnAddress) {
      const pool = await RaraMiningPool.deployed();
      await pool.setBurnRate(5, 100, miningPool.burnAddress, true);
    }
  });
};
