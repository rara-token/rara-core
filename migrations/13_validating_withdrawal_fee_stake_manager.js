const RaraMiningPool = artifacts.require("RaraMiningPool");
const WithdrawFeeTokenBuffer =  artifacts.require("WithdrawFeeTokenBuffer");
const WithdrawFeeStakeManager = artifacts.require("WithdrawFeeStakeManager");
const WithdrawFeeValidatingStakeManager = artifacts.require("WithdrawFeeValidatingStakeManager");
const RaraToken = artifacts.require("RaraToken");
const MockWETH = artifacts.require("MockWETH");

const UniswapV2Factory = artifacts.require("UniswapV2Factory");

const values = require('./shared/values');

module.exports = function (deployer, network, accounts) {
  const { roles } = values({ network, web3 });

  deployer.then(async () => {
    const pool = await RaraMiningPool.deployed();
    const lender = await  WithdrawFeeStakeManager.deployed();

    // the withdraw fee manager charges 5% fees w/in 72 hours, sending them to the buffer.
    const buffer = await WithdrawFeeTokenBuffer.deployed();
    const seconds = 72 * 60 * 60;
    await deployer.deploy(WithdrawFeeValidatingStakeManager, pool.address, lender.address, 5, 100, seconds, buffer.address);
    const manager = await WithdrawFeeValidatingStakeManager.deployed();
    await lender.grantRole(roles.lender, manager.address);
  });
};
