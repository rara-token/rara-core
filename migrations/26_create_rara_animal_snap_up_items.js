const RaraAnimalSnapUpSale = artifacts.require("RaraAnimalSnapUpSale");
const RaraAnimal = artifacts.require("RaraAnimal");

const values = require('./shared/values');
const nft_animals = require('./shared/nft_animals');

const startAt = 0;

module.exports = function (deployer, network, accounts) {
  const { roles } = values({ network, web3 });
  const { sales } = nft_animals({ network, web3 });

  deployer.then(async () => {
    const sale = await RaraAnimalSnapUpSale.deployed();
    const animal = await RaraAnimal.deployed();

    let prevCount = Number((await sale.itemCount()).toString());
    for (let i = startAt; i < sales.length; i++) {
      const s = sales[i];
      const saleId = s.saleId;
      if (saleId < startAt) {
        console.log(`Skipping saleId ${saleId}: ${s.name}. Not yet at startAt.`);
      } else if (saleId < prevCount) {
        console.log(`Skipping saleId ${saleId}: ${s.name}. Exists.`);
      } else if (saleId > prevCount) {
        console.log(`ERROR: contract has ${prevCount} games; couldn't add new sale ${JSON.stringify(s)}`);
        throw new Error(`Couldn't do it`);
      } else {
        console.log(`Creating sale ${saleId}: ${s.name}`);
        console.log(`  with price ${s.price} x 10^${s.scale} increasing by y = (${s.scalar[0]}x/${s.scalar[1]})^(${s.exp[0]}/${s.exp[1]})`);
        console.log(`  selling ${s.supply[0]} ${s.supply[1] == 0 ? "once" : "every day"}`);
        console.log(`  opens at ${new Date(s.openClose[0] * 1000)}`);

        // create item
        await sale.createItemWithResupplyPricing(
          animal.address, s.tokenType,
          s.supply, [0, 1],   // not open yet
          s.price, s.scale, s.scalar, s.exp
        );

        // read item count
        prevCount = Number((await sale.itemCount()).toString());
      }
    }
  });
};
