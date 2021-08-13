const RaraAnimalConverter = artifacts.require("RaraAnimalConverter");

const nft_animals = require('./shared/nft_animals');

module.exports = function (deployer, network, accounts) {
  const { conversions } = nft_animals({ network, web3 });

  deployer.then(async () => {
    const converter = await RaraAnimalConverter.deployed();

    for (const c of conversions) {
      const prevCount = Number((await converter.recipeCount()).toString());
      const recipeId = c.recipeId;
      if (recipeId < prevCount) {
        console.log(`Skipping recipeId ${recipeId}: ${c.name}. Exists as ${await converter.recipeInfo(recipeId)}`);
      } else if (recipeId > prevCount) {
        console.log(`ERROR: contract has ${prevCount} recipes; couldn't add new sale ${JSON.stringify(c)}`);
        throw new Error(`Couldn't do it`);
      } else {
        console.log(`Creating recipe ${recipeId}`);
        console.log(`  with types in ${c.tokenTypesIn} out ${c.tokenTypesOut}`);
        await converter.createRecipe(c.tokenTypesIn, c.tokenTypesOut, 0, true);
      }
    }
  });
};
