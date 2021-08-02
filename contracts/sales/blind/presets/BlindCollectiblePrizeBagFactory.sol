// SPDX-License-Identifier: MIT
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "./BlindCollectiblePrizeBag.sol";

// A blind box prize pool factory allowing manager(s) to create and update
// blind box sales. Be EXTREMELY careful of the manager list of this factory;
// anyone listed as a manager will be able to make changes to ALL blind boxes
// created by this factory, even if they were not a manager at the time the
// box was created.
pragma solidity ^0.8.0;
contract BlindCollectiblePrizeBagFactory is Context, AccessControlEnumerable {
    using SafeERC20 for IERC20;

    // Role that can alter any setting on any blind box _ever_ created by this factory.
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    // Role that can create new blind boxes; as long as they remain a creator
    // they can alter the settings on any blind box _they created_.
    bytes32 public constant CREATOR_ROLE = keccak256("CREATOR_ROLE");
    // Role that can set salt on sales; no effect on this contract but used on created sales.
    bytes32 public constant SALTER_ROLE = keccak256("SALTER_ROLE");

    struct SaleInfo {
        address creator;
        string name;
        bool managed;
    }

    // prize and purchase tokens
    address public prizeToken;
    address public purchaseToken;

    // sales and creators
    SaleInfo[] public saleInfo;
    address[] public sales;

    bytes32 internal _seed;

    event SaleCreation(uint256 indexed saleId, address indexed creator, address indexed sale, string name, bool managed, uint32 startTime, uint32 endTime);

    constructor(address _prizeToken, address _purchaseToken) {
        prizeToken = _prizeToken;
        purchaseToken = _purchaseToken;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());   // admin; can add/remove managers
        _setupRole(MANAGER_ROLE, _msgSender());         // manager; can add/configure prizes
        _setupRole(CREATOR_ROLE, _msgSender());          // salter; can rewrite the RNG salt

        _seed = keccak256(abi.encodePacked(_msgSender(), blockhash(block.number - 1), block.coinbase));
    }

    function saleCount() external view returns (uint256) {
        return sales.length;
    }

    function saleName(uint256 _saleId) external view returns (string memory name) {
        require(_saleId < sales.length, "BlindCollectiblePrizeBagFactory: invalid saleId");
        name = saleInfo[_saleId].name;
    }

    function saleCreator(uint256 _saleId) external view returns (address) {
        require(_saleId < sales.length, "BlindCollectiblePrizeBagFactory: invalid saleId");
        return saleInfo[_saleId].creator;
    }

    function saleManaged(uint256 _saleId) external view returns (bool) {
        require(_saleId < sales.length, "BlindCollectiblePrizeBagFactory: invalid saleId");
        return saleInfo[_saleId].managed;
    }

    // sale creation

    function createSale(
        string calldata _name,
        bool _managed,
        uint32 _startTime,
        uint32 _endTime,
        uint256 _drawPrice,
        address _recipient
    ) external returns (address sale) {
        address creator = _msgSender();
        require(hasRole(MANAGER_ROLE, creator) || hasRole(CREATOR_ROLE, creator), "BlindCollectiblePrizeBagFactory: must have MANAGER or CREATOR role to create sale");
        sale = _createSale(creator, _name, _managed, _startTime, _endTime, _drawPrice, _recipient);
    }

    function createSaleWithPrizes(
        string calldata _name,
        bool _managed,
        uint32 _startTime,
        uint32 _endTime,
        uint256 _drawPrice,
        address _recipient,
        uint256[] calldata _tokenTypes,
        uint256[] calldata _prizeSupplies
    ) external returns (address sale) {
        address creator = _msgSender();
        require(hasRole(MANAGER_ROLE, creator) || hasRole(CREATOR_ROLE, creator), "BlindCollectiblePrizeBagFactory: must have MANAGER or CREATOR role to create sale");
        require(_tokenTypes.length == _prizeSupplies.length, "BlindCollectiblePrizeBagFactory: prize type and supply arrays must match length");
        sale = _createSale(creator, _name, _managed, _startTime, _endTime, _drawPrice, _recipient);
        for (uint256 i = 0; i < _tokenTypes.length; i++) {
            BlindCollectiblePrizeBag(sale).createPrize(_tokenTypes[i], _prizeSupplies[i]);
        }
    }

    // management

    function setSaleManaged(uint256 _saleId, bool _managed) external {
        require(_saleId < sales.length, "BlindCollectiblePrizeBagFactory: invalid saleId");
        require(hasRole(MANAGER_ROLE, _msgSender()), "BlindCollectiblePrizeBagFactory: must have MANAGER role to setManaged");
        saleInfo[_saleId].managed = _managed;
    }

    // recipient / funding options

    function setSaleRecipient(uint256 _saleId, address _recipient) external onlyManagedBySender(_saleId) {
        BlindCollectiblePrizeBag(sales[_saleId]).setRecipient(_recipient);
    }

    function claimAllSaleProceeds(uint256 _saleId, address _to) external onlyManagedBySender(_saleId) {
        BlindCollectiblePrizeBag(sales[_saleId]).claimAllProceeds(_to);
    }

    function claimSaleProceeds(uint256 _saleId, address _to, uint256 _amount) external onlyManagedBySender(_saleId) {
        BlindCollectiblePrizeBag(sales[_saleId]).claimProceeds(_to, _amount);
    }

    // sale configuration

    function setDrawPrice(uint256 _saleId, uint256 _drawPrice) external onlyManagedBySender(_saleId) {
        BlindCollectiblePrizeBag(sales[_saleId]).setDrawPrice(_drawPrice);
    }

    function setSaleTimes(uint256 _saleId, uint32 _startTime, uint32 _endTime) external onlyManagedBySender(_saleId) {
        BlindCollectiblePrizeBag(sales[_saleId]).setTimes(_startTime, _endTime);
    }

    function createSalePrize(uint256 _saleId, uint256 _tokenType, uint256 _supply) external onlyManagedBySender(_saleId) {
        BlindCollectiblePrizeBag(sales[_saleId]).createPrize(_tokenType, _supply);
    }

    function addSaleSupply(uint256 _saleId, uint256 _pid, uint256 _amount) external onlyManagedBySender(_saleId) {
        BlindCollectiblePrizeBag(sales[_saleId]).addSupply(_pid, _amount);
    }

    function removeSaleSupply(uint256 _saleId, uint256 _pid, uint256 _amount, bool _zeroSafe) external onlyManagedBySender(_saleId) {
        BlindCollectiblePrizeBag(sales[_saleId]).removeSupply(_pid, _amount, _zeroSafe);
    }

    // internal functions

    modifier onlyManagedBySender(uint256 _saleId) {
        require(_saleId < sales.length, "BlindCollectiblePrizeBagFactory: invalid saleId");
        SaleInfo storage _saleInfo = saleInfo[_saleId];
        require(_canManage(_saleInfo, _msgSender()), "BlindCollectiblePrizeBagFactory: not authorized");
        _;
    }

    function _canManage(SaleInfo storage _saleInfo, address _user) internal view returns (bool) {
        return _saleInfo.managed && (
            hasRole(MANAGER_ROLE, _user)
            || (hasRole(CREATOR_ROLE, _user) && _user == _saleInfo.creator)
        );
    }

    function _createSale(
        address _creator,
        string calldata _name,
        bool _managed,
        uint32 _startTime,
        uint32 _endTime,
        uint256 _drawPrice,
        address _recipient
    ) internal returns (address) {
        BlindCollectiblePrizeBag sale = new BlindCollectiblePrizeBag(prizeToken, purchaseToken, _drawPrice, _recipient);
        _seed = keccak256(abi.encodePacked(_seed, blockhash(block.number - 1), block.coinbase));
        sale.setSalt(_seed);
        sale.setTimes(_startTime, _endTime);

        // we are the admin, manager, and salter of the token sale. Make the creator
        // that as well, so they can make direct alterations as needed.
        sale.grantRole(DEFAULT_ADMIN_ROLE, _creator);
        sale.grantRole(MANAGER_ROLE, _creator);
        sale.grantRole(SALTER_ROLE, _creator);

        // add to records
        uint256 saleId = sales.length;
        sales.push(address(sale));
        saleInfo.push(SaleInfo({
            creator: _creator,
            name: _name,
            managed: _managed
        }));

        // event
        emit SaleCreation(saleId, _creator, address(sale), _name, _managed, _startTime, _endTime);
        return address(sale);
    }
}
