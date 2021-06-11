const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const s = (val) => {
  if (Array.isArray(val)) {
      arr = [];
      for (const v of val) {
        arr.push(s(v));
      }
      return arr;
  } else if (typeof val === 'object' && val !== null && 'valueOf' in val) {
      return val.valueOf().toString();
  } else if (typeof val === 'object' && val !== null && 'toString' in val) {
      return val.toString();
  }
  return `${val}`;
}

module.exports = exports = ({ network, web3 }) => {
  function bn(val) {
      if (typeof val === 'object' && val !== null && 'valueOf' in val) {
          return bn(val.valueOf().toString());
      }
      if (typeof val === 'string' && val.includes(',')) {
          vals = val.split(',');
          arr = [];
          for (const v of vals) {
            arr.push(bn(v));
          }
          return arr;
      }
      return web3.utils.toBN(val);
  }

  function expandToDecimals(n, d) {
    return bn(n).mul(bn(10).pow(bn(d)));
  }

  function expandTo8Decimals(n) {
    return expandToDecimals(n, 8);
  }

  const values = {};

  // standardize network name
  if (network === 'bsc_test-fork') network = 'bsc_test';
  if (network === 'bsc-fork') network = 'bsc';

  // token addresses
  // TODO expand with tokens used in migration, including LP token pools
  const tokens = values['tokens'] = values['token'] = {
    bsc: {
      WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',   // wrapped BNB; equiv to WETH
      VIDYX: '0x7a16175098fbb7e5eb304dfd29fe232efe54f8fc',
      BUSD: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
      zero: ZERO_ADDRESS
    },
    bsc_test: {
      WBNB: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd',
      VIDYX: '0x87957D6A2FbBDB092388B9df15817234B844663b',
      BUSD: '0x8301f2213c0eed49a7e28ae4c3e91722919b8b47',
      zero: ZERO_ADDRESS
    },
    test: {
      zero: ZERO_ADDRESS
    }
  }[network];

  // assume 3 seconds / block
  const ONE_DAY = bn(28800);  // 3 sec / block
  const ONE_WEEK = ONE_DAY.mul(bn(7));
  const blocks = values['blocks'] = values['block'] = {
    mainnet: {
      start: bn('8207763')    // TODO: configure
    },
    rinkeby: {
      start: bn('9642666')    // TODO: configure
    },
    test: {
      start: bn('0')
    }
  }[network]
  blocks['unlock'] = blocks.start.add(ONE_WEEK.mul(bn(2))); // 14 days later

  // emitter inputs
  const emitter = values['emitter'] = {
    raraPerBlock: expandTo8Decimals(48),
    startBlock: blocks.start
  }

  // mining pool inputs
  const miningPool = values['miningPool'] = {
    unlockBlock: blocks.unlock,
    burnAddress: null
  }

  if (web3) {
    const roles = values['roles'] = values['role'] = {
      manager: web3.utils.soliditySha3('MANAGER_ROLE'),
      minter: web3.utils.soliditySha3('MINTER_ROLE'),
      pauser: web3.utils.soliditySha3('PAUSER_ROLE')
    }
  }

  const me = values['me'] = {
    bsc: '0x3dAA15A52c40DfE580160820acAB0748Cd9a88B3',
    bsc_test: '0x3dAA15A52c40DfE580160820acAB0748Cd9a88B3'
  }[network];


  return values;
}
