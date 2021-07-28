const RaraCollectible = artifacts.require("RaraCollectible");
const RaraCollectibleBlindBoxFactory = artifacts.require("RaraCollectibleBlindBoxFactory");
const RaraToken = artifacts.require("RaraToken");
const RaraCollectibleConverter = artifacts.require("RaraCollectibleConverter");
const RaraCollectibleClassifieds = artifacts.require("RaraCollectibleClassifieds");

const values = require('./shared/values');
const nft_collections = require('./shared/nft_collections');

module.exports = function (deployer, network, accounts) {
  const { roles } = values({ network, web3 });
  const { tokens, blindBoxes, conversions } = nft_collections({ network, web3 });

  console.log(`TokenTypes`)
  for (const t of tokens) {
    console.log(` ${t.tokenType} : ${t.name}`);
  }
  console.log();

  console.log(`Blind Boxes`);
  for (const bb of blindBoxes) {
    console.log(` ${bb.saleId} : ${bb.name}`);
    for (const prize of bb.prizes) {
      console.log(`    ${prize.prizeId} : ${prize.tokenType} (${prize.supply})`);
    }
    console.log();
  }
  console.log();

  console.log(`Conversion Recipes`);
  for (const c of conversions) {
    console.log(` ${c.recipeId} : [${c.tokenTypesIn}] => ${c.tokenTypesOut}`)
  }
  console.log();

  deployer.then(async () => {
    const rara = await RaraToken.deployed();

    // deploy the collectible
    await deployer.deploy(RaraCollectible, "https://www.rara.farm/nft/");
    const collectible = await RaraCollectible.deployed();

    await deployer.deploy(RaraCollectibleBlindBoxFactory, collectible.address, rara.address);

    await deployer.deploy(RaraCollectibleConverter, collectible.address, rara.address, "0x0000000000000000000000000000000000000000");
    const converter = await RaraCollectibleConverter.deployed();
    await collectible.grantRole(roles.minter, converter.address);

    await deployer.deploy(RaraCollectibleClassifieds, collectible.address, rara.address);
  });
};
