const RaraToken = artifacts.require("RaraToken");
const RaraEmitter = artifacts.require("RaraEmitter");
const RaraMiningPool = artifacts.require("RaraMiningPool");
const BufferTokenEmitter = artifacts.require("BufferTokenEmitter");

const values = require('./shared/values');

module.exports = function (deployer, network, accounts) {
  const v = values({ network, web3 });

  deployer.then(async () => {
    const emitter = await RaraEmitter.deployed();
    const miningPool = await RaraMiningPool.deployed();
    const mysteryBoxBuffer = await BufferTokenEmitter.deployed();

    // the mining pool and mystery box system both receive RARA from the
    // emitter. At this moment the mystery box is not implemented, so its
    // RARA will collect in a buffer that the mystery box system will empty
    // and distribute when launched.
    await emitter.addTarget(miningPool.address, v.emitter.raraToMiningPool);
    await emitter.addTarget(mysteryBoxBuffer.address, v.emitter.raraToMysteryBox);
  });
};
