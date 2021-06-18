const UniswapV2Factory = artifacts.require("UniswapV2Factory");
const UniswapV2Router02 = artifacts.require("UniswapV2Router02");

const RaraMiningPool = artifacts.require("RaraMiningPool");
const WithdrawFeeStakeManager = artifacts.require("WithdrawFeeStakeManager");

const values = require('./shared/values');

module.exports = function (deployer, network, accounts) {
  const v = values({ network, web3 });

  deployer.then(async () => {
    const factory = await UniswapV2Factory.deployed();
    const router = await UniswapV2Router02.deployed();
    const miningPool = await RaraMiningPool.deployed();
    const stakeManager = await WithdrawFeeStakeManager.deployed();

    // the first mining pool is an LP token combining VidyX and BNB (i.e. "WETH").
    // create such an LP pair (if it doesn't already exist) and add it at an
    // arbitrary nonzero score (it will be altered when a second pool is added).
    if (v.tokens.VIDYX) {
      // get pair address (creating if necesssary)
      const wbnb = router.WETH();
      let lpToken = await factory.getPair(wbnb, v.tokens.VIDYX);
      if (lpToken == tokens.zero) {  // create the pair
        await factory.createPair(wbnb, v.tokens.VIDYX);
        lpToken = await factory.getPair(token0, token1);
      }

      if ((await pool.lpToken(0)) == v.tokens.zero) {
        await pool.add(1, lpToken, stakeManager);
      }
    }
  });
};
