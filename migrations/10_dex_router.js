const MockWETH = artifacts.require("MockWETH");
const UniswapV2Factory = artifacts.require("UniswapV2Factory");
const UniswapV2Router02 = artifacts.require("UniswapV2Router02");

const values = require('./shared/values');

module.exports = function (deployer, network, accounts) {
  const { tokens, me } = values({ network, web3 });

  deployer.then(async () => {
    let wbnb = tokens['WBNB'];
    if (!wbnb) {
        const mockWeth = await MockWETH.deployed();
        wbnb = mockWeth.address;
    }

    factory = await UniswapV2Factory.deployed();
    await deployer.deploy(UniswapV2Router02, factory.address, wbnb);
  });
};
