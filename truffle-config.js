const HDWalletProvider = require("@truffle/hdwallet-provider");
const infura = require('./secrets/infura.json');
const bsc = require('./secrets/bsc.json');

/*
 * NB: since truffle-hdwallet-provider 0.0.5 you must wrap HDWallet providers in a
 * function when declaring them. Failure to do so will cause commands to hang. ex:
 * ```
 * mainnet: {
 *     provider: function() {
 *       return new HDWalletProvider(mnemonic, 'https://mainnet.infura.io/<infura-key>')
 *     },
 *     network_id: '1',
 *     gas: 4500000,
 *     gasPrice: 10000000000,
 *   },
 */

 module.exports = {
   // See <http://truffleframework.com/docs/advanced/configuration>
   // to customize your Truffle configuration!
   networks: {
     infura: {
      provider: function() {
        return new HDWalletProvider(infura.mnemonic, `https://mainnet.infura.io/v3/${infura.projectID}`)
      },
      network_id: 1,
      gas: 6000000,
      gasPrice: 45000000000
    },
     live: {
       network_id: 1,
       host: "127.0.0.1",
       port: 8545,
       gas: 4600000
     },
     ropsten: {
       network_id: 3,
       host: "127.0.0.1",
       port: 8545,
       gas: 4600000
     },
     rinkeby: {
       network_id: 4,
       host: "127.0.0.1",
       port: 8545,
       gas: 4600000
     },
     ganache: {
       host: "127.0.0.1",
       port: 7545,
       network_id: "*", // Match any network id
       gas: 4600000
     },
     backend_ganache: {  // a pointless network that exists for configuration testing
       host: "127.0.0.1",
       port: 7545,
       network_id: "*", // Match any network id
       gas: 4600000
     },
     backend_live: {
       network_id: 1,
       host: "127.0.0.1",
       port: 8545,
       gas: 4600000
     },
     backend_rinkeby: {
       network_id: 4,
       host: "127.0.0.1",
       port: 8545,
       gas: 4600000
     },
     ganache: {
       host: "127.0.0.1",
       port: 7545,
       network_id: "*", // Match any network id
       gas: 6700000
     },
     test: {
       host: "127.0.0.1",
       port: 7545,
       network_id: "*", // Match any network id
       gas: 6700000
     },
     bsc_test: {
       provider: () => new HDWalletProvider(bsc.mnemonic, `https://data-seed-prebsc-1-s1.binance.org:8545/`),
       network_id: 97,
       confirmations: 10,
       timeoutBlocks: 200,
       gas: 6700000
     },
     bsc: {
       provider: () => new HDWalletProvider({
         mnemonic: bsc.mnemonic,
         providerOrUrl: `https://bsc-dataseed2.binance.org/`,
         gas: 3000000,
         chainId: 56
       }),
       network_id: 56,
       confirmations: 2,
       timeoutBlocks: 200,
       gas: 6700000
     },
     moralis_bsc: {
       provider: () => new HDWalletProvider({
         mnemonic: bsc.mnemonic,
         providerOrUrl: `https://speedy-nodes-nyc.moralis.io/d8fbc1893f70ee9ec442ade6/bsc/mainnet`,
         chainId: 56
       }),
       network_id: 56,
       chain_id: 56,
       chainId: 56,
       confirmations: 2,
       timeoutBlocks: 200,
       gas: 6700000
     },
   },
   compilers: {
     solc: {
       version: "0.8.0",
       settings: {
         optimizer: {
           enabled: true,
           runs: 200
         }
       }
     }
   },
   plugins: [
     'truffle-contract-size'
  ]
 };
