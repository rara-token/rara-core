pragma solidity ^0.8.0;

import "./Classifieds.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";

/**
 * @title Classifieds
 * @notice Implements the classifieds board market. The market will be governed
 * by an ERC20 token as currency, and an ERC721 token that represents the
 * ownership of the items being traded. Only ads for selling items are
 * implemented. The item tokenization is responsibility of the ERC721 contract
 * which should encode any item details.
 *
 * From https://github.com/HQ20/contracts/blob/master/contracts/classifieds/Classifieds.sol
 */
contract ManagedClassifieds is Context, AccessControlEnumerable, Classifieds {

    // Role that can manage and change emission targets
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    constructor (address _itemTokenAddress, address _currencyTokenAddress)
    Classifieds(_itemTokenAddress,  _currencyTokenAddress)
    {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());   // admin; can add/remove managers
    }

    /**
     * @dev Cancels a trade by the poster.
     * @param _tradeId The trade to be cancelled.
     */
    function cancelTrade(uint256 _tradeId)
        public
        virtual
        override
    {
        Trade storage trade = trades[_tradeId];
        address sender = _msgSender();
        require(
            sender == trade.poster || hasRole(MANAGER_ROLE, sender),
            "Trade can be cancelled only by poster or manager."
        );
        _cancelTrade(_tradeId, trade);
    }
}
