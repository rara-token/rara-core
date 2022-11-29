/**
 * FractionalExponents
 * Copied and modified from:
 *  https://github.com/bancorprotocol/contracts/blob/master/solidity/contracts/converter/BancorFormula.sol#L289
 * Redistributed Under Apache License 2.0:
 *  https://github.com/bancorprotocol/contracts/blob/master/LICENSE
 * Provided as an answer to:
 *  https://ethereum.stackexchange.com/questions/50527/is-there-any-efficient-way-to-compute-the-exponentiation-of-an-fractional-base-a
 */
pragma solidity ^0.8.0;
interface IFractionalExponents {
  /**
      General Description:
          Determine a value of precision.
          Calculate an integer approximation of (_baseN / _baseD) ^ (_expN / _expD) * 2 ^ precision.
          Return the result along with the precision used.
      Detailed Description:
          Instead of calculating "base ^ exp", we calculate "e ^ (log(base) * exp)".
          The value of "log(base)" is represented with an integer slightly smaller than "log(base) * 2 ^ precision".
          The larger "precision" is, the more accurately this value represents the real value.
          However, the larger "precision" is, the more bits are required in order to store this value.
          And the exponentiation function, which takes "x" and calculates "e ^ x", is limited to a maximum exponent (maximum value of "x").
          This maximum exponent depends on the "precision" used, and it is given by "maxExpArray[precision] >> (MAX_PRECISION - precision)".
          Hence we need to determine the highest precision which can be used for the given input, before calling the exponentiation function.
          This allows us to compute "base ^ exp" with maximum accuracy and without exceeding 256 bits in any of the intermediate computations.
          This functions assumes that "_expN < 2 ^ 256 / log(MAX_NUM - 1)", otherwise the multiplication should be replaced with a "safeMul".
  */
  function power(uint256 _baseN, uint256 _baseD, uint32 _expN, uint32 _expD) external view returns (uint256, uint8);
}
