const RaraAnimalGachaRackHelper = artifacts.require("RaraAnimalGachaRackHelper");
const RaraAnimalGachaRack = artifacts.require("RaraAnimalGachaRack");
const RaraAnimalSnapUpSale = artifacts.require("RaraAnimalSnapUpSale");

const nft_animals = require('./shared/nft_animals');

module.exports = function (deployer, network, accounts) {
  const { games, sales } = nft_animals({ network, web3 });

  deployer.then(async () => {
    const helper = await RaraAnimalGachaRackHelper.deployed();
    const rack = await RaraAnimalGachaRack.deployed();
    const sale = await RaraAnimalSnapUpSale.deployed();

    for (let i = 0; i < games.length; i++) {
      console.log(`Activating GachaRack game ${i}`);
      await helper.activateGame(i, i == 0);
    }

    for (let i = 0; i < games.length; i++) {
      console.log(`Setting resupply for GachaRack game ${i}`)
      await rack.setGameSupplyPeriod(
        i,
        games[i].prizeSupply,
        games[i].prizePeriodDuration,
        games[i].prizePeriodAnchorTime,
        false
      )
    }

    for (let i = 0; i < sales.length; i++) {
      console.log(`Setting sale times for item ${i}`);
      await sale.setItemResupply(i, sales[i].supply, sales[i].openClose, false)
    }
  });
};
