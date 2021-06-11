const MockWETH = artifacts.require("MockWETH");
const UniswapV2Factory = artifacts.require("UniswapV2Factory");
const UniswapV2Router02 = artifacts.require("UniswapV2Router02");

const values = require('./shared/values');

module.exports = function (deployer, network, accounts) {
  const { tokens, me } = values({ network, web3 });

  deployer.then(async () => {
    let wbnb = tokens['WBNB'];
    if (!wbnb) {
        // deploy
        await deployer.deploy(MockWETH);
        const mockWeth = await MockWETH.deployed();
        wbnb = mockWeth.address;
    }

    await deployer.deploy(UniswapV2Factory, me || accounts[0]);  // allow deploying account to set feeTo
    factory = await UniswapV2Factory.deployed();
    await factory.setCreationDisallowed(true);    // temporary; authority pair creation only
    if (tokens.BUSD) { // Disable creation of BUSD/WBNB pair; special consideration later
      await factory.setPairDisallowed(tokens.BUSD, wbnb);
    }
    await deployer.deploy(UniswapV2Router02, factory.address, wbnb);
  });
};
