const RaraCollectibleBlindBoxFactory = artifacts.require("RaraCollectibleBlindBoxFactory");
const RaraCollectible = artifacts.require("RaraCollectible");

const values = require('./shared/values');
const nft_collections = require('./shared/nft_collections');

const startAt = 0;

module.exports = function (deployer, network, accounts) {
  const { roles } = values({ network, web3 });
  const { blindBoxes } = nft_collections({ network, web3 });

  deployer.then(async () => {
    const factory = await RaraCollectibleBlindBoxFactory.deployed();
    const collectible = await RaraCollectible.deployed();

    let prevCount = Number((await factory.saleCount()).toString());
    for (const bb of blindBoxes) {
      const saleId = bb.saleId;
      if (saleId < startAt) {
        console.log(`Skipping saleId ${saleId}: ${bb.name}. Not yet at startAt.`);
      } else if (saleId < prevCount) {
        console.log(`Skipping saleId ${saleId}: ${bb.name}. Exists as ${await factory.saleName(saleId)}`);
      } else if (saleId > prevCount) {
        console.log(`ERROR: contract has ${prevCount} sales; couldn't add new sale ${JSON.stringify(bb)}`);
        throw new Error(`Couldn't do it`);
      } else {
        const prizeTokenTypes = bb.prizes.map(p => p.tokenType);
        const prizeSupplies = bb.prizes.map(p => p.supply);
        console.log(`Creating sale ${saleId}: ${bb.name}`);
        console.log(`  with types ${prizeTokenTypes} supplies ${prizeSupplies} price ${bb.drawPrice} block range ${bb.startBlock}-${bb.endBlock}`);
        await factory.createSaleWithPrizes(
          bb.name, true, bb.startBlock, bb.endBlock,
          bb.drawPrice, "0x0000000000000000000000000000000000000000",
          prizeTokenTypes, prizeSupplies
        );
        const sale = await factory.sales(saleId);
        await collectible.grantRole(roles.minter, sale);
        console.log(`  given address ${sale}`);

        prevCount = Number((await factory.saleCount()).toString());
      }
    }
  });
};
