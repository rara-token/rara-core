const RaraAnimal = artifacts.require("RaraAnimal");
const RaraAnimalOracle = artifacts.require("RaraAnimalOracle");
const RaraAnimalProxyExchanger = artifacts.require("RaraAnimalProxyExchanger");
const RaraAnimalBinanceWalletChecker = artifacts.require("RaraAnimalBinanceWalletChecker");
const BinanceERC721StandIn = artifacts.require("BinanceERC721StandIn");

module.exports = function (deployer, network, accounts) {
  deployer.then(async () => {
    const oracle = await RaraAnimalOracle.deployed();
    const exchanger = await RaraAnimalProxyExchanger.deployed();

    let tokenAddress = '0x9C7198740D97d18D9e2C9C0c23341952256fee78';

    if (network == 'bsc_test-fork' || network == 'bsc_test') {
      // deploy a joke token
      // await deployer.deploy(BinanceERC721StandIn);
      const token = await BinanceERC721StandIn.deployed();
      tokenAddress = token.address;
    }

    await deployer.deploy(RaraAnimalBinanceWalletChecker, tokenAddress, oracle.address, exchanger.address);
  });
};
