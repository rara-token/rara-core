// SPDX-License-Identifier: MIT
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IBlindSalePrizeBag.sol";
import "../interfaces/IBlindCollectibleSale.sol";
import "../../../token/interfaces/IERC721TypeExchangeable.sol";
import "../../../token/interfaces/IERC721Collectible.sol";

// A blind box prize pool where each prize represents the minting of a particular
// tokenType.
pragma solidity ^0.8.0;
contract BlindCollectiblePrizeBag is Context, AccessControlEnumerable, IBlindSalePrizeBag, IBlindCollectibleSale {
    using SafeERC20 for IERC20;

    // Role that create new sales
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant SALTER_ROLE = keccak256("SALTER_ROLE");

    // @notice prize info
    struct PrizeInfo {
        uint256 tokenType;
        uint256 supply;
        uint256 totalSupply;
    }

    // @notice draw info
    struct DrawInfo {
        address user;
        uint256 prizeId;
        uint256 tokenId;
    }

    // prizes
    PrizeInfo[] public prizeInfo;
    uint256 public override availableSupply;
    uint256 public override totalSupply;

    // tokens and price
    address public override prizeToken;
    address public override purchaseToken;
    uint256 public override drawPrice;

    // sale recipient
    address public recipient;

    // active blocks
    uint32 public startTime;
    uint32 public endTime;

    // draws
    DrawInfo[] public drawInfo;
    mapping(uint256 => uint256[]) public override prizeDrawId;
    mapping(address => uint256[]) public override drawIdBy;
    bytes32 internal _seed;
    bytes32 internal _salt;

    event PrizeCreation(uint256 indexed prizeId, uint256 indexed tokenType, uint256 supply);
    event PrizeSupplyIncrease(uint256 indexed prizeId, uint256 indexed tokenType, uint256 amount, uint256 supply);
    event PrizeSupplyDecrease(uint256 indexed prizeId, uint256 indexed tokenType, uint256 amount, uint256 supply);

    constructor(address _prizeToken, address _purchaseToken, uint256 _drawPrice, address _recipient) {
        prizeToken = _prizeToken;
        purchaseToken = _purchaseToken;
        drawPrice = _drawPrice;
        recipient = _recipient;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());   // admin; can add/remove managers
        _setupRole(MANAGER_ROLE, _msgSender());         // manager; can add/configure prizes
        _setupRole(SALTER_ROLE, _msgSender());          // salter; can rewrite the RNG salt
    }

    // @dev Purchase the indicated number of draws, paying a maximum total price
    // of `_maximumCost`.
    // @param _to The address to award the prize(s).
    // @param _draws The number of draws to purchase.
    // @param _maximumCost The maximum price to pay for the draws (in total),
    // in case prices fluctuate.
    function purchaseDraws(address _to, uint256 _draws, uint256 _maximumCost) external override {
        require(
            startTime <= block.timestamp && (endTime == 0 || block.timestamp < endTime),
            "BlindCollectiblePrizeBag: not active"
        );
        require(_draws <= availableSupply, "BlindCollectiblePrizeBag: not enough supply");

        // determine payment
        address buyer = _msgSender();
        uint256 amount = _draws * drawPrice;
        require(amount <= _maximumCost, "BlindCollectiblePrizeBag: too expensive");

        // charge payment
        address paymentTo = recipient != address(0) ? recipient : address(this);
        IERC20(purchaseToken).safeTransferFrom(buyer, paymentTo, amount);

        for (uint256 i = 0; i < _draws; i++) {
            _purchase(buyer, _to, drawPrice);
        }
    }

    function setDrawPrice(uint256 _price) external {
      require(hasRole(MANAGER_ROLE, _msgSender()), "BlindCollectiblePrizeBag: must have MANAGER role to setDrawPrice");
      drawPrice = _price;
    }

    function claimAllProceeds(address _to) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BlindCollectiblePrizeBag: must have MANAGER role to claimAllProceeds");
        uint256 amount = IERC20(purchaseToken).balanceOf(address(this));
        IERC20(purchaseToken).transfer(_to, amount);
        // TODO emit
    }

    function claimProceeds(address _to, uint256 _amount) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BlindCollectiblePrizeBag: must have MANAGER role to claimProceeds");
        IERC20(purchaseToken).transfer(_to, _amount);
        // TODO emit
    }

    function setSalt(bytes32 salt) external {
        require(hasRole(SALTER_ROLE, _msgSender()), "BlindCollectiblePrizeBag: must have SALTER role to setSalt");
        _salt = salt;
    }

    // @dev Returns the number of draws by `_user` (thus far).
    function drawCountBy(address _user) external view override returns (uint256) {
        return drawIdBy[_user].length;
    }

    // @dev Returns the number of draws conducted thus far. drawIds will index
    // from zero to this number.
    function totalDraws() external view override returns (uint256) {
        return drawInfo.length;
    }

    // @dev Returns the number of distinct prizes offered (each prize may have
    // multiple instances and be drawn multiple times, but they should be identical).
    // Use to iterate {totalPrizeSupply}, etc.
    function prizeCount() external view override returns (uint256) {
        return prizeInfo.length;
    }

    // @dev The available supply of prize `_pid`. Use {prizeCount} as limit of
    // enumeration.
    function availablePrizeSupply(uint256 _pid) external view override returns (uint256) {
        require(_pid < prizeInfo.length, "BlindCollectiblePrizeBag: nonexistent pid");
        return prizeInfo[_pid].supply;
    }

    // @dev The total supply of prize `_pid`, including already drawn. Use
    // {prizeCount} as limit of enumeration.
    function totalPrizeSupply(uint256 _pid) external view override returns (uint256) {
        require(_pid < prizeInfo.length, "BlindCollectiblePrizeBag: nonexistent pid");
        return prizeInfo[_pid].totalSupply;
    }

    // @dev The number of times this prize has been drawn (so far).
    function prizeDrawCount(uint256 _pid) external view override returns (uint256) {
        require(_pid < prizeInfo.length, "BlindCollectiblePrizeBag: nonexistent pid");
        return prizeDrawId[_pid].length;
    }

    function prizeTokenType(uint256 _pid) external view returns (uint256) {
      require(_pid < prizeInfo.length, "BlindCollectiblePrizeBag: nonexistent pid");
      return prizeInfo[_pid].tokenType;
    }

    function drawPrizeId(uint256 _did) external view override returns (uint256) {
        require(_did < drawInfo.length, "BlindCollectiblePrizeBag: nonexistent did");
        return drawInfo[_did].prizeId;
    }

    function drawTokenId(uint256 _did) external view override returns (uint256) {
      require(_did < drawInfo.length, "BlindCollectiblePrizeBag: nonexistent did");
      return drawInfo[_did].tokenId;
    }

    function drawTokenType(uint256 _did) external view override returns (uint256) {
      require(_did < drawInfo.length, "BlindCollectiblePrizeBag: nonexistent did");
      uint256 prizeId = drawInfo[_did].prizeId;
      return prizeInfo[prizeId].tokenType;
    }

    function setRecipient(address _recipient) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BlindCollectiblePrizeBag: must have MANAGER role to setRecipient");
        recipient = _recipient;
    }

    function setTimes(uint32 _startTime, uint32 _endTime) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BlindCollectiblePrizeBag: must have MANAGER role to setTimes");
        startTime = _startTime;
        endTime = _endTime;
    }

    // TODO controls for changing price, start/stop times, prizes and supplies.
    function createPrize(uint256 _tokenType, uint256 _supply) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BlindCollectiblePrizeBag: must have MANAGER role to addPrize");
        require(_tokenType < IERC721Collectible(prizeToken).totalTypes(), "BlindCollectiblePrizeBag: nonexistent tokenType");
        prizeInfo.push(PrizeInfo({
            tokenType: _tokenType,
            supply: _supply,
            totalSupply: _supply
        }));
        availableSupply = availableSupply + _supply;
        totalSupply = totalSupply + _supply;

        emit PrizeCreation(prizeInfo.length - 1, _tokenType, _supply);
    }

    function addSupply(uint256 _pid, uint256 _amount) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BlindCollectiblePrizeBag: must have MANAGER role to addSupply");
        require(_pid < prizeInfo.length, "BlindCollectiblePrizeBag: nonexistent pid");
        PrizeInfo storage prize = prizeInfo[_pid];
        prize.supply = prize.supply + _amount;
        prize.totalSupply = prize.totalSupply + _amount;
        availableSupply = availableSupply + _amount;
        totalSupply = totalSupply + _amount;

        emit PrizeSupplyIncrease(_pid, prize.tokenType, _amount, prize.supply);
    }

    function removeSupply(uint256 _pid, uint256 _amount, bool _zeroSafe) external {
        require(hasRole(MANAGER_ROLE, _msgSender()), "BlindCollectiblePrizeBag: must have MANAGER role to removeSupply");
        require(_pid < prizeInfo.length, "BlindCollectiblePrizeBag: nonexistent pid");
        PrizeInfo storage prize = prizeInfo[_pid];
        if (_zeroSafe && (prize.supply < _amount || availableSupply < _amount)) {
            _amount = prize.supply < availableSupply ? prize.supply : availableSupply;
        }
        prize.supply = prize.supply - _amount;
        prize.totalSupply = prize.totalSupply - _amount;
        availableSupply = availableSupply - _amount;
        totalSupply = totalSupply - _amount;

        emit PrizeSupplyDecrease(_pid, prize.tokenType, _amount, prize.supply);
    }

    // @dev Fulfill a purchase which has already been charged. This may or may not
    // involve performing a pseudorandom draw.
    function _purchase(address _buyer, address _to, uint256 _pricePaid) internal virtual {
        // potentially exploitable by miner but unknown to other purchasers
        // reordering purchases by multiple buyers will alter distributed items
        _seed = keccak256(abi.encodePacked(_salt, _seed, _buyer, blockhash(block.number - 1), block.coinbase));
        uint256 anchor = uint256(_seed) % availableSupply;

        // select
        uint256 prizeId = 0;
        for (; prizeId < prizeInfo.length; prizeId++) {
            uint256 supply = prizeInfo[prizeId].supply;
            if (anchor < supply) {
                break;
            }
            anchor = anchor - supply;
        }

        // remove prize from box
        PrizeInfo storage prize = prizeInfo[prizeId];
        prize.supply = prize.supply - 1;
        availableSupply = availableSupply - 1;

        // perform the draw (mint the token)
        uint256 tokenId = IERC721TypeExchangeable(prizeToken).mint(_to, prize.tokenType);
        uint256 drawId = drawInfo.length;
        drawInfo.push(DrawInfo({
            user: _to,
            prizeId: prizeId,
            tokenId: tokenId
        }));

        // mappings
        prizeDrawId[prizeId].push(drawId);
        drawIdBy[_to].push(drawId);

        emit DrawPurchase(_buyer, _to, drawId, _pricePaid);
        emit Draw(_to, drawId, prizeId);
    }
}
