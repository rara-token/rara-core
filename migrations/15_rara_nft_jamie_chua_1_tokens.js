const RaraCollectible = artifacts.require("RaraCollectible");

const nft_collections = require('./shared/nft_collections');

const startAt = 0;

module.exports = function (deployer, network, accounts) {
  const { tokens, blindBoxes } = nft_collections({ network, web3 });

  deployer.then(async () => {
    const collectible = await RaraCollectible.deployed();

    let prevCount = Number((await collectible.totalTypes()).toString());
    for (let i = startAt; i < tokens.length; i++) {
      const token = tokens[i];
      const tokenType = token.tokenType;
      if (tokenType < prevCount) {
        console.log(`Skipping token type ${tokenType}: ${token.name}. Exists as ${await collectible.typeName(tokenType)}`);
      } else if (tokenType > prevCount) {
        console.log(`ERROR: contract has ${prevCount} tokens; couldn't add new token ${JSON.stringify(token)}`);
        throw new Error(`Couldn't do it`);
      } else {
        console.log(`Creating token type ${tokenType}: ${token.name}`);
        await collectible.addTokenType(token.name, token.symbol, token.value);

        prevCount = Number((await collectible.totalTypes()).toString());
      }
    }
  });
};
