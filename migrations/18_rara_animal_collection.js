const RaraAnimal = artifacts.require("RaraAnimal");
const RaraAnimalGachaRack = artifacts.require("RaraAnimalGachaRack");
const RaraAnimalGachaRackHelper = artifacts.require("RaraAnimalGachaRackHelper");
const RaraToken = artifacts.require("RaraToken");
const RaraAnimalConverter = artifacts.require("RaraAnimalConverter");
const RaraAnimalClassifieds = artifacts.require("RaraAnimalClassifieds");
const EIP210 = artifacts.require("EIP210");

const values = require('./shared/values');
const nft_animals = require('./shared/nft_animals');

const ZERO = '0x0000000000000000000000000000000000000000';

module.exports = function (deployer, network, accounts) {
  const { roles } = values({ network, web3 });
  const { tokens, games, conversions } = nft_animals({ network, web3 });

  /*
  console.log(`TokenTypes`)
  for (const t of tokens) {
    console.log(` ${t.tokenType} : ${t.name}`);
  }
  console.log();

  console.log(`Games`);
  for (const g of games) {
    console.log(` ${g.gameId} : ${g.name}`);
    for (const prize of g.prizes) {
      console.log(`    ${prize.prizeId} : ${prize.tokenType} (${prize.weight})`);
    }
    console.log();
  }
  console.log();

  console.log(`Conversion Recipes`);
  for (const c of conversions) {
    console.log(` ${c.recipeId} : [${c.tokenTypesIn}] => ${c.tokenTypesOut}`)
  }
  console.log();
  */

  deployer.then(async () => {
    const rara = await RaraToken.deployed();

    // deploy the collectible
    await deployer.deploy(RaraAnimal, "https://www.rara.farm/animal/");
    const animal = await RaraAnimal.deployed();

    await deployer.deploy(EIP210);
    const eip210 = await EIP210.deployed();

    // deploy the gacha game
    await deployer.deploy(RaraAnimalGachaRack, animal.address, rara.address, eip210.address, ZERO);
    const gachaRack = await RaraAnimalGachaRack.deployed();
    await animal.grantRole(roles.minter, gachaRack.address);

    await gachaRack.setAutoAwarding(true);
    await gachaRack.setAllowAwarding(true);

    await deployer.deploy(RaraAnimalGachaRackHelper, gachaRack.address);
    const helper = await RaraAnimalGachaRackHelper.deployed();
    await gachaRack.grantRole(roles.manager, helper.address);

    await deployer.deploy(RaraAnimalConverter, animal.address, rara.address, ZERO);
    const converter = await RaraAnimalConverter.deployed();
    await animal.grantRole(roles.minter, converter.address);

    // deploy the classifieds
    await deployer.deploy(RaraAnimalClassifieds, animal.address, rara.address);
  });
};
