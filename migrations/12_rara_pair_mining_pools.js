const UniswapV2Factory = artifacts.require("UniswapV2Factory");

const RaraToken = artifacts.require("RaraToken");
const RaraMiningPool = artifacts.require("RaraMiningPool");
const WithdrawFeeStakeManager = artifacts.require("WithdrawFeeStakeManager");
const MockWETH = artifacts.require("MockWETH");

const values = require('./shared/values');

module.exports = function (deployer, network, accounts) {
  const v = values({ network, web3 });

  deployer.then(async () => {
    const rara = await RaraToken.deployed();
    const factory = await UniswapV2Factory.deployed();
    const miningPool = await RaraMiningPool.deployed();
    const stakeManager = await WithdrawFeeStakeManager.deployed();

    let wbnb = v.tokens['WBNB'];
    if (!wbnb) {
        const mockWeth = await MockWETH.deployed();
        wbnb = mockWeth.address;
    }

    if (v.tokens.VIDYX) { // shorthand: this is not testing
      // the new mining pools are Rara-VidyX and Rara-BNB.
      const tokenPairs = [
        { name:'RARA-VIDYX', tokens:[rara.address, v.tokens.VIDYX] },
        { name:'RARA-BNB  ', tokens:[rara.address, wbnb] }
      ];

      for (const tokenPair of tokenPairs) {
        const { tokens, name } = tokenPair;

        // create the pair if necessary and get the pair address
        let lpToken = await factory.getPair(tokens[0], tokens[1]);
        if (lpToken == v.tokens.zero) {  // create the pair
          await factory.createPair(tokens[0], tokens[1]);
          lpToken = await factory.getPair(tokens[0], tokens[1]);
        }

        let pools = Number((await miningPool.poolLength()));
        let pid = -1;
        for (let i = 0; i < pools; i++) {
          if (await miningPool.lpToken(i) == lpToken) {
            pid = i;
          }
        }

        if (pid >= 0) {
          console.log(`${name} already exists: pid ${pid} LP token ${lpToken}`);
        } else {
          await miningPool.add(0, lpToken, stakeManager.address);
          console.log(`${name} created: pid ${pools} LP token ${lpToken}`);
        }
      }
    }
  });
};
