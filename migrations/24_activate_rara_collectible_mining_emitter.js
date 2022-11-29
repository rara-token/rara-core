const RaraEmitter = artifacts.require("RaraEmitter");
const BufferTokenEmitter = artifacts.require("BufferTokenEmitter");
const FlowSupplementEmitter = artifacts.require("FlowSupplementEmitter");
const RaraMiningPool = artifacts.require("RaraMiningPool");
const RaraCollectibleMining = artifacts.require("RaraCollectibleMining");

const values = require('./shared/values');

module.exports = function (deployer, network, accounts) {
  const v = values({ network, web3 });

  deployer.then(async () => {
    const sourceEmitter = await RaraEmitter.deployed();
    const mysteryBoxBuffer = await BufferTokenEmitter.deployed();
    const collectiblePoolEmitter = await FlowSupplementEmitter.deployed();
    const miningPool = await RaraMiningPool.deployed();
    const collectiblePool = await RaraCollectibleMining.deployed();

    await sourceEmitter.emitRara(1);
    await mysteryBoxBuffer.setRecipient(collectiblePoolEmitter.address);
    await mysteryBoxBuffer.flush();

    await collectiblePoolEmitter.setRecipient(collectiblePool.address);

    // revise burn policy; ensure 5% burn is handled by external logic,
    // not done by mining contracts
    const burnTarget = "0x655eE1Ea6FAF57276d0d0263eEaB96939348F2A8";    // TOOD

    await sourceEmitter.updateTarget(0, miningPool.address, v.emitter.raraToLPMiningPostBurn);
    await sourceEmitter.updateTarget(1, collectiblePoolEmitter.address, v.emitter.raraToAnimalMiningPostBurn);
    await sourceEmitter.addTarget(burnTarget, v.emitter.raraToBurn);
  });
};
