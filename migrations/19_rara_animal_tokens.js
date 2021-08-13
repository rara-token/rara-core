const RaraAnimal = artifacts.require("RaraAnimal");

const nft_animals = require('./shared/nft_animals');

const startAt = 0;

module.exports = function (deployer, network, accounts) {
  const { tokens } = nft_animals({ network, web3 });

  deployer.then(async () => {
    const animal = await RaraAnimal.deployed();

    let prevCount = Number((await animal.totalTypes()).toString());
    for (let i = startAt; i < tokens.length; i++) {
      const token = tokens[i];
      const tokenType = token.tokenType;
      if (tokenType < prevCount) {
        console.log(`Skipping token type ${tokenType}: ${token.name}. Exists as ${await animal.typeName(tokenType)}`);
      } else if (tokenType > prevCount) {
        console.log(`ERROR: contract has ${prevCount} tokens; couldn't add new token ${JSON.stringify(token)}`);
        throw new Error(`Couldn't do it`);
      } else {
        console.log(`Creating token type ${tokenType}: ${token.name}`);
        await animal.addTokenType(token.name, token.symbol, token.value);

        prevCount = Number((await animal.totalTypes()).toString());
      }
    }
  });
};
