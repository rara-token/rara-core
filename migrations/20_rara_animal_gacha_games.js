const RaraAnimalGachaRack = artifacts.require("RaraAnimalGachaRack");
const RaraAnimal = artifacts.require("RaraAnimal");

const values = require('./shared/values');
const nft_animals = require('./shared/nft_animals');

const startAt = 0;

module.exports = function (deployer, network, accounts) {
  const { roles } = values({ network, web3 });
  const { games } = nft_animals({ network, web3 });

  deployer.then(async () => {
    const gachaRack = await RaraAnimalGachaRack.deployed();
    const animal = await RaraAnimal.deployed();

    let prevCount = Number((await gachaRack.gameCount()).toString());
    for (let i = startAt; i < games.length; i++) {
      const g = games[i];
      const gameId = g.gameId;
      if (gameId < startAt) {
        console.log(`Skipping gameId ${gameId}: ${g.name}. Not yet at startAt.`);
      } else if (gameId < prevCount) {
        console.log(`Skipping gameId ${gameId}: ${g.name}. Exists.`);
      } else if (gameId > prevCount) {
        console.log(`ERROR: contract has ${prevCount} games; couldn't add new sale ${JSON.stringify(g)}`);
        throw new Error(`Couldn't do it`);
      } else {
        const prizeTokenTypes = g.prizes.map(p => p.tokenType);
        const prizeWeights = g.prizes.map(p => p.weight);
        console.log(`Creating game ${gameId}: ${g.name}`);
        console.log(`  with types ${prizeTokenTypes} weights ${prizeWeights}`);
        console.log(`  charging ${g.drawPrice} with reveal blocks ${g.revealBlocks}}`);
        await gachaRack.createActivatedGame(i == 0,
          g.drawPrice, g.revealBlocks,
          g.prizeSupply, g.prizePeriodDuration, g.prizePeriodAnchorTime,
          g.saleOpenTime, g.saleCloseTime,
          prizeTokenTypes, prizeWeights
        );
        console.log(`  created game`);

        prevCount = Number((await gachaRack.gameCount()).toString());
      }
    }
  });
};
