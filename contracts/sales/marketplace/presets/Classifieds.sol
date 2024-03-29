pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";


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
contract Classifieds {
    event TradeStatusChange(
        uint256 indexed ad,
        bytes32 status,
        address indexed poster,
        uint256 indexed item,
        uint256 price
    );

    IERC20 currencyToken;
    IERC721 itemToken;

    struct Trade {
        address poster;
        uint256 item;
        uint256 price;
        bytes32 status; // Open, Executed, Cancelled
    }

    mapping(uint256 => Trade) public trades;

    uint256 tradeCounter;

    constructor (address _itemTokenAddress, address _currencyTokenAddress)
    {
        itemToken = IERC721(_itemTokenAddress);
        currencyToken = IERC20(_currencyTokenAddress);
        tradeCounter = 0;
    }

    function totalTrades()
        public
        virtual
        view
        returns(uint256)
    {
        return tradeCounter;
    }

    /**
     * @dev Returns the details for a trade.
     * @param _trade The id for the trade.
     */
    function getTrade(uint256 _trade)
        public
        virtual
        view
        returns(address, uint256, uint256, bytes32)
    {
        Trade memory trade = trades[_trade];
        return (trade.poster, trade.item, trade.price, trade.status);
    }

    /**
     * @dev Opens a new trade. Puts _item in escrow.
     * @param _item The id for the item to trade.
     * @param _price The amount of currency for which to trade the item.
     */
    function openTrade(uint256 _item, uint256 _price)
        public
        virtual
    {
        itemToken.transferFrom(msg.sender, address(this), _item);
        trades[tradeCounter] = Trade({
            poster: msg.sender,
            item: _item,
            price: _price,
            status: "Open"
        });
        tradeCounter += 1;
        emit TradeStatusChange(
            tradeCounter - 1,
            "Open",
            msg.sender,
            _item,
            _price
        );
    }

    /**
     * @dev Executes a trade. Must have approved this contract to transfer the
     * amount of currency specified to the poster. Transfers ownership of the
     * item to the filler.
     * @param _trade The id of an existing trade
     */
    function executeTrade(uint256 _trade)
        public
        virtual
    {
        Trade memory trade = trades[_trade];
        require(trade.status == "Open", "Trade is not Open.");
        currencyToken.transferFrom(msg.sender, trade.poster, trade.price);
        itemToken.transferFrom(address(this), msg.sender, trade.item);
        trades[_trade].status = "Executed";
        emit TradeStatusChange(
            _trade,
            "Executed",
            trade.poster,
            trade.item,
            trade.price
        );
    }

    /**
     * @dev Cancels a trade by the poster.
     * @param _tradeId The trade to be cancelled.
     */
    function cancelTrade(uint256 _tradeId)
        public
        virtual
    {
        Trade storage trade = trades[_tradeId];
        require(
            msg.sender == trade.poster,
            "Trade can be cancelled only by poster."
        );
        _cancelTrade(_tradeId, trade);
    }

    function _cancelTrade(uint256 _tradeId, Trade storage _trade) internal {
        require(_trade.status == "Open", "Trade is not Open.");
        itemToken.transferFrom(address(this), _trade.poster, _trade.item);
        _trade.status = "Cancelled";
        emit TradeStatusChange(
            _tradeId,
            "Cancelled",
            _trade.poster,
            _trade.item,
            _trade.price
        );
    }
}
