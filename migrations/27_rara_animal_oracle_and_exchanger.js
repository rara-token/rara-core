const RaraAnimal = artifacts.require("RaraAnimal");
const RaraAnimalOracle = artifacts.require("RaraAnimalOracle");
const RaraAnimalProxyExchanger = artifacts.require("RaraAnimalProxyExchanger");

const values = require('./shared/values');

module.exports = function (deployer, network, accounts) {
  const { roles } = values({ network, web3 });

  deployer.then(async () => {
    const animal = await RaraAnimal.deployed();
    await deployer.deploy(RaraAnimalOracle, animal.address);

    const oracle = await RaraAnimalOracle.deployed();

    await deployer.deploy(RaraAnimalProxyExchanger, animal.address, oracle.address);
    const exchanger = await RaraAnimalProxyExchanger.deployed();

    await animal.grantRole(roles.minter, exchanger.address);
  });
};
