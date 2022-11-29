const UniswapV2Factory = artifacts.require("UniswapV2Factory");

const RaraMiningPool = artifacts.require("RaraMiningPool");
const WithdrawFeeStakeManager = artifacts.require("WithdrawFeeStakeManager");
const MockWETH = artifacts.require("MockWETH");

const values = require('./shared/values');

module.exports = function (deployer, network, accounts) {
  const v = values({ network, web3 });

  deployer.then(async () => {
    const factory = await UniswapV2Factory.deployed();
    const miningPool = await RaraMiningPool.deployed();
    const stakeManager = await WithdrawFeeStakeManager.deployed();

    let wbnb = v.tokens['WBNB'];
    if (!wbnb) {
        const mockWeth = await MockWETH.deployed();
        wbnb = mockWeth.address;
    }

    // the first mining pool is an LP token combining VidyX and BNB (i.e. "WETH").
    // create such an LP pair (if it doesn't already exist) and add it at an
    // arbitrary nonzero score (it will be altered when a second pool is added).
    if (v.tokens.VIDYX) {
      // get pair address (creating if necesssary)
      let lpToken = await factory.getPair(wbnb, v.tokens.VIDYX);
      if (lpToken == v.tokens.zero) {  // create the pair
        await factory.createPair(wbnb, v.tokens.VIDYX);
        lpToken = await factory.getPair(wbnb, v.tokens.VIDYX);
      }

      // shorthand to estimate if no pools exist
      if ((await miningPool.totalAllocPoint()).toString() == '0') {
        await miningPool.add(1, lpToken, stakeManager.address);
      }
    }
  });
};
