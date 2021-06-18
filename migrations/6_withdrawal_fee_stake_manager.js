const RaraMiningPool = artifacts.require("RaraMiningPool");
const WithdrawFeeTokenBuffer =  artifacts.require("WithdrawFeeTokenBuffer");
const WithdrawFeeStakeManager = artifacts.require("WithdrawFeeStakeManager");
const RaraToken = artifacts.require("RaraToken");

const UniswapV2Factory = artifacts.require("UniswapV2Factory");
const UniswapV2Router02 = artifacts.require("UniswapV2Router02");

const values = require('./shared/values');

module.exports = function (deployer, network, accounts) {
  const { tokens } = values({ network, web3 });

  deployer.then(async () => {
    const pool = await RaraMiningPool.deployed();
    const rara = await RaraToken.deployed();
    const factory = await UniswapV2Factory.deployed();
    const router =  await UniswapV2Router02.deployed();

    // fees are sent to a token buffer for later processing into Rara
    const weth = await router.WETH();
    await deployer.deploy(WithdrawFeeTokenBuffer, factory.address, tokens.zero, rara.address, weth);

    // the withdraw fee manager charges 5% fees w/in 72 hours, sending them to the buffer.
    const buffer = await WithdrawFeeTokenBuffer.deployed();
    const seconds = 72 * 60 * 60;
    await deployer.deploy(WithdrawFeeStakeManager, pool.address, 5, 100, seconds, buffer.address);
  });
};
