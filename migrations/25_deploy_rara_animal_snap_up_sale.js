const FractionalExponents = artifacts.require("FractionalExponents");
const RaraAnimalSnapUpSale = artifacts.require("RaraAnimalSnapUpSale");
const RaraAnimal = artifacts.require("RaraAnimal");
const RaraToken = artifacts.require("RaraToken");

const values = require('./shared/values');

const ZERO = '0x0000000000000000000000000000000000000000';

module.exports = function (deployer, network, accounts) {
  const { roles } = values({ network, web3 });

  deployer.then(async () => {
    const rara = await RaraToken.deployed();
    const animal = await RaraAnimal.deployed();

    await deployer.deploy(FractionalExponents);
    const fexp = await FractionalExponents.deployed();

    await deployer.deploy(RaraAnimalSnapUpSale, rara.address, fexp.address, ZERO);
    const sale = await RaraAnimalSnapUpSale.deployed();

    await animal.grantRole(roles.minter, sale.address);
  });
};
