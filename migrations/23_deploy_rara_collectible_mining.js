const RaraToken = artifacts.require("RaraToken");
const FlowSupplementEmitter = artifacts.require("FlowSupplementEmitter");
const RaraCollectibleMining = artifacts.require("RaraCollectibleMining");
const RaraAnimal = artifacts.require("RaraAnimal");

const values = require('./shared/values');

module.exports = function (deployer, network, accounts) {
  const { tokens } = values({ network, web3 });

  deployer.then(async () => {
    const rara = await RaraToken.deployed();

    const emitter = await FlowSupplementEmitter.deployed();
    const animal = await RaraAnimal.deployed();
    await deployer.deploy(RaraCollectibleMining, rara.address, emitter.address, 0);
    const pool = await RaraCollectibleMining.deployed();

    await pool.setPeriod(24 * 60 * 60, 0); // daily roll-over
    await pool.addPool(animal.address, '10', true, 3);
    await pool.addPool(animal.address, '30', true, 4);
    await pool.addPool(animal.address, '100', true, 5);

    await pool.setPoolActivation(0, '10', animal.address, '3', true, 0);
    await pool.setPoolActivation(1, '30', animal.address, '3', true, 1);
    await pool.setPoolActivation(2, '100', animal.address, '4', true, 2);

    await pool.initialize();
  });
};
