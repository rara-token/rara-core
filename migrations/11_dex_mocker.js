const MockUniswapV2Library = artifacts.require("MockUniswapV2Library");

const values = require('./shared/values');

module.exports = function (deployer, network, accounts) {
  const { tokens, me } = values({ network, web3 });

  deployer.then(async () => {
    await deployer.deploy(MockUniswapV2Library);
  });
};
