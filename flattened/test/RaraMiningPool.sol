// File: @openzeppelin/contracts/utils/Context.sol

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/*
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        this; // silence state mutability warning without generating bytecode - see https://github.com/ethereum/solidity/issues/2691
        return msg.data;
    }
}

// File: @openzeppelin/contracts/utils/Strings.sol



pragma solidity ^0.8.0;

/**
 * @dev String operations.
 */
library Strings {
    bytes16 private constant alphabet = "0123456789abcdef";

    /**
     * @dev Converts a `uint256` to its ASCII `string` decimal representation.
     */
    function toString(uint256 value) internal pure returns (string memory) {
        // Inspired by OraclizeAPI's implementation - MIT licence
        // https://github.com/oraclize/ethereum-api/blob/b42146b063c7d6ee1358846c198246239e9360e8/oraclizeAPI_0.4.25.sol

        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    /**
     * @dev Converts a `uint256` to its ASCII `string` hexadecimal representation.
     */
    function toHexString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0x00";
        }
        uint256 temp = value;
        uint256 length = 0;
        while (temp != 0) {
            length++;
            temp >>= 8;
        }
        return toHexString(value, length);
    }

    /**
     * @dev Converts a `uint256` to its ASCII `string` hexadecimal representation with fixed length.
     */
    function toHexString(uint256 value, uint256 length) internal pure returns (string memory) {
        bytes memory buffer = new bytes(2 * length + 2);
        buffer[0] = "0";
        buffer[1] = "x";
        for (uint256 i = 2 * length + 1; i > 1; --i) {
            buffer[i] = alphabet[value & 0xf];
            value >>= 4;
        }
        require(value == 0, "Strings: hex length insufficient");
        return string(buffer);
    }

}

// File: @openzeppelin/contracts/utils/introspection/IERC165.sol



pragma solidity ^0.8.0;

/**
 * @dev Interface of the ERC165 standard, as defined in the
 * https://eips.ethereum.org/EIPS/eip-165[EIP].
 *
 * Implementers can declare support of contract interfaces, which can then be
 * queried by others ({ERC165Checker}).
 *
 * For an implementation, see {ERC165}.
 */
interface IERC165 {
    /**
     * @dev Returns true if this contract implements the interface defined by
     * `interfaceId`. See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[EIP section]
     * to learn more about how these ids are created.
     *
     * This function call must use less than 30 000 gas.
     */
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

// File: @openzeppelin/contracts/utils/introspection/ERC165.sol



pragma solidity ^0.8.0;


/**
 * @dev Implementation of the {IERC165} interface.
 *
 * Contracts that want to implement ERC165 should inherit from this contract and override {supportsInterface} to check
 * for the additional interface id that will be supported. For example:
 *
 * ```solidity
 * function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
 *     return interfaceId == type(MyInterface).interfaceId || super.supportsInterface(interfaceId);
 * }
 * ```
 *
 * Alternatively, {ERC165Storage} provides an easier to use but more expensive implementation.
 */
abstract contract ERC165 is IERC165 {
    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IERC165).interfaceId;
    }
}

// File: @openzeppelin/contracts/access/AccessControl.sol



pragma solidity ^0.8.0;




/**
 * @dev External interface of AccessControl declared to support ERC165 detection.
 */
interface IAccessControl {
    function hasRole(bytes32 role, address account) external view returns (bool);
    function getRoleAdmin(bytes32 role) external view returns (bytes32);
    function grantRole(bytes32 role, address account) external;
    function revokeRole(bytes32 role, address account) external;
    function renounceRole(bytes32 role, address account) external;
}

/**
 * @dev Contract module that allows children to implement role-based access
 * control mechanisms. This is a lightweight version that doesn't allow enumerating role
 * members except through off-chain means by accessing the contract event logs. Some
 * applications may benefit from on-chain enumerability, for those cases see
 * {AccessControlEnumerable}.
 *
 * Roles are referred to by their `bytes32` identifier. These should be exposed
 * in the external API and be unique. The best way to achieve this is by
 * using `public constant` hash digests:
 *
 * ```
 * bytes32 public constant MY_ROLE = keccak256("MY_ROLE");
 * ```
 *
 * Roles can be used to represent a set of permissions. To restrict access to a
 * function call, use {hasRole}:
 *
 * ```
 * function foo() public {
 *     require(hasRole(MY_ROLE, msg.sender));
 *     ...
 * }
 * ```
 *
 * Roles can be granted and revoked dynamically via the {grantRole} and
 * {revokeRole} functions. Each role has an associated admin role, and only
 * accounts that have a role's admin role can call {grantRole} and {revokeRole}.
 *
 * By default, the admin role for all roles is `DEFAULT_ADMIN_ROLE`, which means
 * that only accounts with this role will be able to grant or revoke other
 * roles. More complex role relationships can be created by using
 * {_setRoleAdmin}.
 *
 * WARNING: The `DEFAULT_ADMIN_ROLE` is also its own admin: it has permission to
 * grant and revoke this role. Extra precautions should be taken to secure
 * accounts that have been granted it.
 */
abstract contract AccessControl is Context, IAccessControl, ERC165 {
    struct RoleData {
        mapping (address => bool) members;
        bytes32 adminRole;
    }

    mapping (bytes32 => RoleData) private _roles;

    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    /**
     * @dev Emitted when `newAdminRole` is set as ``role``'s admin role, replacing `previousAdminRole`
     *
     * `DEFAULT_ADMIN_ROLE` is the starting admin for all roles, despite
     * {RoleAdminChanged} not being emitted signaling this.
     *
     * _Available since v3.1._
     */
    event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole);

    /**
     * @dev Emitted when `account` is granted `role`.
     *
     * `sender` is the account that originated the contract call, an admin role
     * bearer except when using {_setupRole}.
     */
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);

    /**
     * @dev Emitted when `account` is revoked `role`.
     *
     * `sender` is the account that originated the contract call:
     *   - if using `revokeRole`, it is the admin role bearer
     *   - if using `renounceRole`, it is the role bearer (i.e. `account`)
     */
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);

    /**
     * @dev Modifier that checks that an account has a specific role. Reverts
     * with a standardized message including the required role.
     *
     * The format of the revert reason is given by the following regular expression:
     *
     *  /^AccessControl: account (0x[0-9a-f]{20}) is missing role (0x[0-9a-f]{32})$/
     *
     * _Available since v4.1._
     */
    modifier onlyRole(bytes32 role) {
        _checkRole(role, _msgSender());
        _;
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IAccessControl).interfaceId
            || super.supportsInterface(interfaceId);
    }

    /**
     * @dev Returns `true` if `account` has been granted `role`.
     */
    function hasRole(bytes32 role, address account) public view override returns (bool) {
        return _roles[role].members[account];
    }

    /**
     * @dev Revert with a standard message if `account` is missing `role`.
     *
     * The format of the revert reason is given by the following regular expression:
     *
     *  /^AccessControl: account (0x[0-9a-f]{20}) is missing role (0x[0-9a-f]{32})$/
     */
    function _checkRole(bytes32 role, address account) internal view {
        if(!hasRole(role, account)) {
            revert(string(abi.encodePacked(
                "AccessControl: account ",
                Strings.toHexString(uint160(account), 20),
                " is missing role ",
                Strings.toHexString(uint256(role), 32)
            )));
        }
    }

    /**
     * @dev Returns the admin role that controls `role`. See {grantRole} and
     * {revokeRole}.
     *
     * To change a role's admin, use {_setRoleAdmin}.
     */
    function getRoleAdmin(bytes32 role) public view override returns (bytes32) {
        return _roles[role].adminRole;
    }

    /**
     * @dev Grants `role` to `account`.
     *
     * If `account` had not been already granted `role`, emits a {RoleGranted}
     * event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     */
    function grantRole(bytes32 role, address account) public virtual override onlyRole(getRoleAdmin(role)) {
        _grantRole(role, account);
    }

    /**
     * @dev Revokes `role` from `account`.
     *
     * If `account` had been granted `role`, emits a {RoleRevoked} event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     */
    function revokeRole(bytes32 role, address account) public virtual override onlyRole(getRoleAdmin(role)) {
        _revokeRole(role, account);
    }

    /**
     * @dev Revokes `role` from the calling account.
     *
     * Roles are often managed via {grantRole} and {revokeRole}: this function's
     * purpose is to provide a mechanism for accounts to lose their privileges
     * if they are compromised (such as when a trusted device is misplaced).
     *
     * If the calling account had been granted `role`, emits a {RoleRevoked}
     * event.
     *
     * Requirements:
     *
     * - the caller must be `account`.
     */
    function renounceRole(bytes32 role, address account) public virtual override {
        require(account == _msgSender(), "AccessControl: can only renounce roles for self");

        _revokeRole(role, account);
    }

    /**
     * @dev Grants `role` to `account`.
     *
     * If `account` had not been already granted `role`, emits a {RoleGranted}
     * event. Note that unlike {grantRole}, this function doesn't perform any
     * checks on the calling account.
     *
     * [WARNING]
     * ====
     * This function should only be called from the constructor when setting
     * up the initial roles for the system.
     *
     * Using this function in any other way is effectively circumventing the admin
     * system imposed by {AccessControl}.
     * ====
     */
    function _setupRole(bytes32 role, address account) internal virtual {
        _grantRole(role, account);
    }

    /**
     * @dev Sets `adminRole` as ``role``'s admin role.
     *
     * Emits a {RoleAdminChanged} event.
     */
    function _setRoleAdmin(bytes32 role, bytes32 adminRole) internal virtual {
        emit RoleAdminChanged(role, getRoleAdmin(role), adminRole);
        _roles[role].adminRole = adminRole;
    }

    function _grantRole(bytes32 role, address account) private {
        if (!hasRole(role, account)) {
            _roles[role].members[account] = true;
            emit RoleGranted(role, account, _msgSender());
        }
    }

    function _revokeRole(bytes32 role, address account) private {
        if (hasRole(role, account)) {
            _roles[role].members[account] = false;
            emit RoleRevoked(role, account, _msgSender());
        }
    }
}

// File: @openzeppelin/contracts/utils/structs/EnumerableSet.sol



pragma solidity ^0.8.0;

/**
 * @dev Library for managing
 * https://en.wikipedia.org/wiki/Set_(abstract_data_type)[sets] of primitive
 * types.
 *
 * Sets have the following properties:
 *
 * - Elements are added, removed, and checked for existence in constant time
 * (O(1)).
 * - Elements are enumerated in O(n). No guarantees are made on the ordering.
 *
 * ```
 * contract Example {
 *     // Add the library methods
 *     using EnumerableSet for EnumerableSet.AddressSet;
 *
 *     // Declare a set state variable
 *     EnumerableSet.AddressSet private mySet;
 * }
 * ```
 *
 * As of v3.3.0, sets of type `bytes32` (`Bytes32Set`), `address` (`AddressSet`)
 * and `uint256` (`UintSet`) are supported.
 */
library EnumerableSet {
    // To implement this library for multiple types with as little code
    // repetition as possible, we write it in terms of a generic Set type with
    // bytes32 values.
    // The Set implementation uses private functions, and user-facing
    // implementations (such as AddressSet) are just wrappers around the
    // underlying Set.
    // This means that we can only create new EnumerableSets for types that fit
    // in bytes32.

    struct Set {
        // Storage of set values
        bytes32[] _values;

        // Position of the value in the `values` array, plus 1 because index 0
        // means a value is not in the set.
        mapping (bytes32 => uint256) _indexes;
    }

    /**
     * @dev Add a value to a set. O(1).
     *
     * Returns true if the value was added to the set, that is if it was not
     * already present.
     */
    function _add(Set storage set, bytes32 value) private returns (bool) {
        if (!_contains(set, value)) {
            set._values.push(value);
            // The value is stored at length-1, but we add 1 to all indexes
            // and use 0 as a sentinel value
            set._indexes[value] = set._values.length;
            return true;
        } else {
            return false;
        }
    }

    /**
     * @dev Removes a value from a set. O(1).
     *
     * Returns true if the value was removed from the set, that is if it was
     * present.
     */
    function _remove(Set storage set, bytes32 value) private returns (bool) {
        // We read and store the value's index to prevent multiple reads from the same storage slot
        uint256 valueIndex = set._indexes[value];

        if (valueIndex != 0) { // Equivalent to contains(set, value)
            // To delete an element from the _values array in O(1), we swap the element to delete with the last one in
            // the array, and then remove the last element (sometimes called as 'swap and pop').
            // This modifies the order of the array, as noted in {at}.

            uint256 toDeleteIndex = valueIndex - 1;
            uint256 lastIndex = set._values.length - 1;

            // When the value to delete is the last one, the swap operation is unnecessary. However, since this occurs
            // so rarely, we still do the swap anyway to avoid the gas cost of adding an 'if' statement.

            bytes32 lastvalue = set._values[lastIndex];

            // Move the last value to the index where the value to delete is
            set._values[toDeleteIndex] = lastvalue;
            // Update the index for the moved value
            set._indexes[lastvalue] = valueIndex; // Replace lastvalue's index to valueIndex

            // Delete the slot where the moved value was stored
            set._values.pop();

            // Delete the index for the deleted slot
            delete set._indexes[value];

            return true;
        } else {
            return false;
        }
    }

    /**
     * @dev Returns true if the value is in the set. O(1).
     */
    function _contains(Set storage set, bytes32 value) private view returns (bool) {
        return set._indexes[value] != 0;
    }

    /**
     * @dev Returns the number of values on the set. O(1).
     */
    function _length(Set storage set) private view returns (uint256) {
        return set._values.length;
    }

   /**
    * @dev Returns the value stored at position `index` in the set. O(1).
    *
    * Note that there are no guarantees on the ordering of values inside the
    * array, and it may change when more values are added or removed.
    *
    * Requirements:
    *
    * - `index` must be strictly less than {length}.
    */
    function _at(Set storage set, uint256 index) private view returns (bytes32) {
        require(set._values.length > index, "EnumerableSet: index out of bounds");
        return set._values[index];
    }

    // Bytes32Set

    struct Bytes32Set {
        Set _inner;
    }

    /**
     * @dev Add a value to a set. O(1).
     *
     * Returns true if the value was added to the set, that is if it was not
     * already present.
     */
    function add(Bytes32Set storage set, bytes32 value) internal returns (bool) {
        return _add(set._inner, value);
    }

    /**
     * @dev Removes a value from a set. O(1).
     *
     * Returns true if the value was removed from the set, that is if it was
     * present.
     */
    function remove(Bytes32Set storage set, bytes32 value) internal returns (bool) {
        return _remove(set._inner, value);
    }

    /**
     * @dev Returns true if the value is in the set. O(1).
     */
    function contains(Bytes32Set storage set, bytes32 value) internal view returns (bool) {
        return _contains(set._inner, value);
    }

    /**
     * @dev Returns the number of values in the set. O(1).
     */
    function length(Bytes32Set storage set) internal view returns (uint256) {
        return _length(set._inner);
    }

   /**
    * @dev Returns the value stored at position `index` in the set. O(1).
    *
    * Note that there are no guarantees on the ordering of values inside the
    * array, and it may change when more values are added or removed.
    *
    * Requirements:
    *
    * - `index` must be strictly less than {length}.
    */
    function at(Bytes32Set storage set, uint256 index) internal view returns (bytes32) {
        return _at(set._inner, index);
    }

    // AddressSet

    struct AddressSet {
        Set _inner;
    }

    /**
     * @dev Add a value to a set. O(1).
     *
     * Returns true if the value was added to the set, that is if it was not
     * already present.
     */
    function add(AddressSet storage set, address value) internal returns (bool) {
        return _add(set._inner, bytes32(uint256(uint160(value))));
    }

    /**
     * @dev Removes a value from a set. O(1).
     *
     * Returns true if the value was removed from the set, that is if it was
     * present.
     */
    function remove(AddressSet storage set, address value) internal returns (bool) {
        return _remove(set._inner, bytes32(uint256(uint160(value))));
    }

    /**
     * @dev Returns true if the value is in the set. O(1).
     */
    function contains(AddressSet storage set, address value) internal view returns (bool) {
        return _contains(set._inner, bytes32(uint256(uint160(value))));
    }

    /**
     * @dev Returns the number of values in the set. O(1).
     */
    function length(AddressSet storage set) internal view returns (uint256) {
        return _length(set._inner);
    }

   /**
    * @dev Returns the value stored at position `index` in the set. O(1).
    *
    * Note that there are no guarantees on the ordering of values inside the
    * array, and it may change when more values are added or removed.
    *
    * Requirements:
    *
    * - `index` must be strictly less than {length}.
    */
    function at(AddressSet storage set, uint256 index) internal view returns (address) {
        return address(uint160(uint256(_at(set._inner, index))));
    }


    // UintSet

    struct UintSet {
        Set _inner;
    }

    /**
     * @dev Add a value to a set. O(1).
     *
     * Returns true if the value was added to the set, that is if it was not
     * already present.
     */
    function add(UintSet storage set, uint256 value) internal returns (bool) {
        return _add(set._inner, bytes32(value));
    }

    /**
     * @dev Removes a value from a set. O(1).
     *
     * Returns true if the value was removed from the set, that is if it was
     * present.
     */
    function remove(UintSet storage set, uint256 value) internal returns (bool) {
        return _remove(set._inner, bytes32(value));
    }

    /**
     * @dev Returns true if the value is in the set. O(1).
     */
    function contains(UintSet storage set, uint256 value) internal view returns (bool) {
        return _contains(set._inner, bytes32(value));
    }

    /**
     * @dev Returns the number of values on the set. O(1).
     */
    function length(UintSet storage set) internal view returns (uint256) {
        return _length(set._inner);
    }

   /**
    * @dev Returns the value stored at position `index` in the set. O(1).
    *
    * Note that there are no guarantees on the ordering of values inside the
    * array, and it may change when more values are added or removed.
    *
    * Requirements:
    *
    * - `index` must be strictly less than {length}.
    */
    function at(UintSet storage set, uint256 index) internal view returns (uint256) {
        return uint256(_at(set._inner, index));
    }
}

// File: @openzeppelin/contracts/access/AccessControlEnumerable.sol



pragma solidity ^0.8.0;



/**
 * @dev External interface of AccessControlEnumerable declared to support ERC165 detection.
 */
interface IAccessControlEnumerable {
    function getRoleMember(bytes32 role, uint256 index) external view returns (address);
    function getRoleMemberCount(bytes32 role) external view returns (uint256);
}

/**
 * @dev Extension of {AccessControl} that allows enumerating the members of each role.
 */
abstract contract AccessControlEnumerable is IAccessControlEnumerable, AccessControl {
    using EnumerableSet for EnumerableSet.AddressSet;

    mapping (bytes32 => EnumerableSet.AddressSet) private _roleMembers;

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IAccessControlEnumerable).interfaceId
            || super.supportsInterface(interfaceId);
    }

    /**
     * @dev Returns one of the accounts that have `role`. `index` must be a
     * value between 0 and {getRoleMemberCount}, non-inclusive.
     *
     * Role bearers are not sorted in any particular way, and their ordering may
     * change at any point.
     *
     * WARNING: When using {getRoleMember} and {getRoleMemberCount}, make sure
     * you perform all queries on the same block. See the following
     * https://forum.openzeppelin.com/t/iterating-over-elements-on-enumerableset-in-openzeppelin-contracts/2296[forum post]
     * for more information.
     */
    function getRoleMember(bytes32 role, uint256 index) public view override returns (address) {
        return _roleMembers[role].at(index);
    }

    /**
     * @dev Returns the number of accounts that have `role`. Can be used
     * together with {getRoleMember} to enumerate all bearers of a role.
     */
    function getRoleMemberCount(bytes32 role) public view override returns (uint256) {
        return _roleMembers[role].length();
    }

    /**
     * @dev Overload {grantRole} to track enumerable memberships
     */
    function grantRole(bytes32 role, address account) public virtual override {
        super.grantRole(role, account);
        _roleMembers[role].add(account);
    }

    /**
     * @dev Overload {revokeRole} to track enumerable memberships
     */
    function revokeRole(bytes32 role, address account) public virtual override {
        super.revokeRole(role, account);
        _roleMembers[role].remove(account);
    }

    /**
     * @dev Overload {renounceRole} to track enumerable memberships
     */
    function renounceRole(bytes32 role, address account) public virtual override {
        super.renounceRole(role, account);
        _roleMembers[role].remove(account);
    }

    /**
     * @dev Overload {_setupRole} to track enumerable memberships
     */
    function _setupRole(bytes32 role, address account) internal virtual override {
        super._setupRole(role, account);
        _roleMembers[role].add(account);
    }
}

// File: @openzeppelin/contracts/token/ERC20/IERC20.sol



pragma solidity ^0.8.0;

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20 {
    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `recipient`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address recipient, uint256 amount) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev Moves `amount` tokens from `sender` to `recipient` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

// File: @openzeppelin/contracts/utils/Address.sol



pragma solidity ^0.8.0;

/**
 * @dev Collection of functions related to the address type
 */
library Address {
    /**
     * @dev Returns true if `account` is a contract.
     *
     * [IMPORTANT]
     * ====
     * It is unsafe to assume that an address for which this function returns
     * false is an externally-owned account (EOA) and not a contract.
     *
     * Among others, `isContract` will return false for the following
     * types of addresses:
     *
     *  - an externally-owned account
     *  - a contract in construction
     *  - an address where a contract will be created
     *  - an address where a contract lived, but was destroyed
     * ====
     */
    function isContract(address account) internal view returns (bool) {
        // This method relies on extcodesize, which returns 0 for contracts in
        // construction, since the code is only stored at the end of the
        // constructor execution.

        uint256 size;
        // solhint-disable-next-line no-inline-assembly
        assembly { size := extcodesize(account) }
        return size > 0;
    }

    /**
     * @dev Replacement for Solidity's `transfer`: sends `amount` wei to
     * `recipient`, forwarding all available gas and reverting on errors.
     *
     * https://eips.ethereum.org/EIPS/eip-1884[EIP1884] increases the gas cost
     * of certain opcodes, possibly making contracts go over the 2300 gas limit
     * imposed by `transfer`, making them unable to receive funds via
     * `transfer`. {sendValue} removes this limitation.
     *
     * https://diligence.consensys.net/posts/2019/09/stop-using-soliditys-transfer-now/[Learn more].
     *
     * IMPORTANT: because control is transferred to `recipient`, care must be
     * taken to not create reentrancy vulnerabilities. Consider using
     * {ReentrancyGuard} or the
     * https://solidity.readthedocs.io/en/v0.5.11/security-considerations.html#use-the-checks-effects-interactions-pattern[checks-effects-interactions pattern].
     */
    function sendValue(address payable recipient, uint256 amount) internal {
        require(address(this).balance >= amount, "Address: insufficient balance");

        // solhint-disable-next-line avoid-low-level-calls, avoid-call-value
        (bool success, ) = recipient.call{ value: amount }("");
        require(success, "Address: unable to send value, recipient may have reverted");
    }

    /**
     * @dev Performs a Solidity function call using a low level `call`. A
     * plain`call` is an unsafe replacement for a function call: use this
     * function instead.
     *
     * If `target` reverts with a revert reason, it is bubbled up by this
     * function (like regular Solidity function calls).
     *
     * Returns the raw returned data. To convert to the expected return value,
     * use https://solidity.readthedocs.io/en/latest/units-and-global-variables.html?highlight=abi.decode#abi-encoding-and-decoding-functions[`abi.decode`].
     *
     * Requirements:
     *
     * - `target` must be a contract.
     * - calling `target` with `data` must not revert.
     *
     * _Available since v3.1._
     */
    function functionCall(address target, bytes memory data) internal returns (bytes memory) {
      return functionCall(target, data, "Address: low-level call failed");
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`], but with
     * `errorMessage` as a fallback revert reason when `target` reverts.
     *
     * _Available since v3.1._
     */
    function functionCall(address target, bytes memory data, string memory errorMessage) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0, errorMessage);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but also transferring `value` wei to `target`.
     *
     * Requirements:
     *
     * - the calling contract must have an ETH balance of at least `value`.
     * - the called Solidity function must be `payable`.
     *
     * _Available since v3.1._
     */
    function functionCallWithValue(address target, bytes memory data, uint256 value) internal returns (bytes memory) {
        return functionCallWithValue(target, data, value, "Address: low-level call with value failed");
    }

    /**
     * @dev Same as {xref-Address-functionCallWithValue-address-bytes-uint256-}[`functionCallWithValue`], but
     * with `errorMessage` as a fallback revert reason when `target` reverts.
     *
     * _Available since v3.1._
     */
    function functionCallWithValue(address target, bytes memory data, uint256 value, string memory errorMessage) internal returns (bytes memory) {
        require(address(this).balance >= value, "Address: insufficient balance for call");
        require(isContract(target), "Address: call to non-contract");

        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory returndata) = target.call{ value: value }(data);
        return _verifyCallResult(success, returndata, errorMessage);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but performing a static call.
     *
     * _Available since v3.3._
     */
    function functionStaticCall(address target, bytes memory data) internal view returns (bytes memory) {
        return functionStaticCall(target, data, "Address: low-level static call failed");
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-string-}[`functionCall`],
     * but performing a static call.
     *
     * _Available since v3.3._
     */
    function functionStaticCall(address target, bytes memory data, string memory errorMessage) internal view returns (bytes memory) {
        require(isContract(target), "Address: static call to non-contract");

        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory returndata) = target.staticcall(data);
        return _verifyCallResult(success, returndata, errorMessage);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but performing a delegate call.
     *
     * _Available since v3.4._
     */
    function functionDelegateCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionDelegateCall(target, data, "Address: low-level delegate call failed");
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-string-}[`functionCall`],
     * but performing a delegate call.
     *
     * _Available since v3.4._
     */
    function functionDelegateCall(address target, bytes memory data, string memory errorMessage) internal returns (bytes memory) {
        require(isContract(target), "Address: delegate call to non-contract");

        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory returndata) = target.delegatecall(data);
        return _verifyCallResult(success, returndata, errorMessage);
    }

    function _verifyCallResult(bool success, bytes memory returndata, string memory errorMessage) private pure returns(bytes memory) {
        if (success) {
            return returndata;
        } else {
            // Look for revert reason and bubble it up if present
            if (returndata.length > 0) {
                // The easiest way to bubble the revert reason is using memory via assembly

                // solhint-disable-next-line no-inline-assembly
                assembly {
                    let returndata_size := mload(returndata)
                    revert(add(32, returndata), returndata_size)
                }
            } else {
                revert(errorMessage);
            }
        }
    }
}

// File: @openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol



pragma solidity ^0.8.0;



/**
 * @title SafeERC20
 * @dev Wrappers around ERC20 operations that throw on failure (when the token
 * contract returns false). Tokens that return no value (and instead revert or
 * throw on failure) are also supported, non-reverting calls are assumed to be
 * successful.
 * To use this library you can add a `using SafeERC20 for IERC20;` statement to your contract,
 * which allows you to call the safe operations as `token.safeTransfer(...)`, etc.
 */
library SafeERC20 {
    using Address for address;

    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeWithSelector(token.transfer.selector, to, value));
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeWithSelector(token.transferFrom.selector, from, to, value));
    }

    /**
     * @dev Deprecated. This function has issues similar to the ones found in
     * {IERC20-approve}, and its usage is discouraged.
     *
     * Whenever possible, use {safeIncreaseAllowance} and
     * {safeDecreaseAllowance} instead.
     */
    function safeApprove(IERC20 token, address spender, uint256 value) internal {
        // safeApprove should only be called when setting an initial allowance,
        // or when resetting it to zero. To increase and decrease it, use
        // 'safeIncreaseAllowance' and 'safeDecreaseAllowance'
        // solhint-disable-next-line max-line-length
        require((value == 0) || (token.allowance(address(this), spender) == 0),
            "SafeERC20: approve from non-zero to non-zero allowance"
        );
        _callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, value));
    }

    function safeIncreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        uint256 newAllowance = token.allowance(address(this), spender) + value;
        _callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, newAllowance));
    }

    function safeDecreaseAllowance(IERC20 token, address spender, uint256 value) internal {
      unchecked {
          uint256 oldAllowance = token.allowance(address(this), spender);
          require(oldAllowance >= value, "SafeERC20: decreased allowance below zero");
          uint256 newAllowance = oldAllowance - value;
          _callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, newAllowance));
      }
    }

    /**
     * @dev Imitates a Solidity high-level call (i.e. a regular function call to a contract), relaxing the requirement
     * on the return value: the return value is optional (but if data is returned, it must not be false).
     * @param token The token targeted by the call.
     * @param data The call data (encoded using abi.encode or one of its variants).
     */
    function _callOptionalReturn(IERC20 token, bytes memory data) private {
        // We need to perform a low level call here, to bypass Solidity's return data size checking mechanism, since
        // we're implementing it ourselves. We use {Address.functionCall} to perform this call, which verifies that
        // the target address contains contract code and also asserts for success in the low-level call.

        bytes memory returndata = address(token).functionCall(data, "SafeERC20: low-level call failed");
        if (returndata.length > 0) { // Return data is optional
            // solhint-disable-next-line max-line-length
            require(abi.decode(returndata, (bool)), "SafeERC20: ERC20 operation did not succeed");
        }
    }
}

// File: contracts/mining/interfaces/IStakeManager.sol




pragma solidity 0.8.0;
interface IStakeManager {
    ///@dev Returns whether this StakeManager performs token transfers on deposit
    /// (i.e. whether the user should {IERC20.approve} this contract's address).
    function transfersStakeDeposit(uint256 pid, IERC20 stakeToken, address user, address recipient, uint256 deposit, uint256 totalStake) external view returns (bool);

    ///@dev Called upon stake deposit by a user. Returns whether the token transfer has been handled by the StakeManager (and no further transfer should be performed).
    function onStakeDeposit(uint256 pid, IERC20 stakeToken, address user, address recipient, uint256 deposit, uint256 totalStake) external returns (bool);

    ///@dev Called upon stake withdrawal by a user. Returns whether the token transfer has been handled by the StakeManager (and no further transfer should be performed).
    function onStakeWithdraw(uint256 pid, IERC20 stakeToken, address user, address recipient, uint256 withdrawal, uint256 totalStake) external returns (bool);

    ///@dev Called upon Rara reward harvest by a staker. Returns whether the harvest has been handled by the StakeManager (and no further transfer should be performed).
    function onRewardHarvest(uint256 pid, IERC20 stakeToken, address user, address recipient, uint256 rewardAmount, uint256 totalStake) external returns (bool);
}

// File: contracts/mining/interfaces/IMiningPool.sol





/// @dev A staking / mining pool for receiving a reward by staking LP tokens.
pragma solidity ^0.8.0;
interface IMiningPool {
    function poolLength() external view returns (uint256);

    function add(uint256 _allocPoint, IERC20 _lpToken, IStakeManager _stakeManager) external;
    function set(uint256 _pid, uint256 _allocPoint, IStakeManager _stakeManager, bool overwrite) external;

    function stakeManager(uint256 _pid) external returns (IStakeManager);

    function pendingReward(uint256 _pid, address  _user) external view returns (uint256);
    function totalReceived() external view returns (uint256);
    function totalRetained() external view returns (uint256);
    function totalMined() external view returns (uint256);

    function deposit(uint256 _pid, uint256 _amount, address _to) external;
    function withdraw(uint256 _pid, uint256 _amount, address _to) external;
    function harvest(uint256 _pid, address _to) external;
    function withdrawAndHarvest(uint256 _pid, uint256 _amount, address _to) external;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount, address indexed to);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount, address indexed to);
    event Harvest(address indexed user, uint256 indexed pid, uint256 amount);

    event PoolAdd(uint256 indexed pid, uint256 allocPoint, IERC20 indexed lpToken, IStakeManager indexed manager);
    event PoolSet(uint256 indexed pid, uint256 allocPoint, IStakeManager indexed manager, bool overwrite);
    event PoolUpdate(uint256 indexed pid, uint256 lastRewardBlock, uint256 lastRewardBlockRetainedRara, uint256 lpSupply, uint256 accRaraPerShare);

    event LendingApproved(uint256 indexed pid, address indexed to, uint256 amount);
}

// File: contracts/mining/interfaces/IStakeMigrator.sol




pragma solidity ^0.8.0;
interface IStakeMigrator {
    // Take the current LP token address and return the new LP token address.
    // Migrator should have full access to the caller's LP token.
    function migrate(IERC20 token) external returns (IERC20);
}

// File: contracts/token/interfaces/IToken.sol

pragma solidity ^0.8.0;
interface IToken is IERC20 {
    function burn(uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;
}

// File: contracts/token/interfaces/ITokenEmitter.sol

// An ITokenEmitter accumulates tokens on its own internal schedule,
// allocating it to specific recipients.
pragma solidity ^0.8.0;
interface ITokenEmitter {
    /**
     * @dev Returns token address
     */
    function token() external view returns (IERC20);

    /**
     * @dev Claims tokens owed to the caller, sending it to the designated address.
     * No effect if the caller is not a targetted recipient.
     *
     * No need to call {mint} before making this call.
     *
     * Returns the amount transferred; for recipients, emits a {RaraEmitted} event.
     */
    function claim(address _to) external returns (uint256);

    /**
     * @dev Returns the amount of tokens currently owed to the _recipient
     * (the amount to transfer on a call to {claim}).
     *
     * For recipients, this value changes each block.
     */
    function owed(address _recipient) external view returns (uint256);

    /**
     * @dev Returns the total token amount emitted by the emitter
     * up to this block, whether or not they have been claimed.
     * (e.g. for an emitter that operates by mint-and-burn patterns,
     * reports only the number left after burning.)
     */
    function emitted() external view returns (uint256);
}

// File: contracts/utils/boring-solidity/IPermitERC20.sol


pragma solidity ^0.8.0;

interface IPermitERC20 {
    /// @notice EIP 2612
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

// File: contracts/utils/boring-solidity/BoringBatchable.sol


pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

// solhint-disable avoid-low-level-calls
// solhint-disable no-inline-assembly

// Audit on 5-Jan-2021 by Keno and BoringCrypto


// From https://github.com/boringcrypto/BoringSolidity/blob/master/contracts/BoringBatchable.sol
contract BaseBoringBatchable {
    /// @dev Helper function to extract a useful revert message from a failed call.
    /// If the returned data is malformed or not correctly abi encoded then this call can fail itself.
    function _getRevertMsg(bytes memory _returnData) internal pure returns (string memory) {
        // If the _res length is less than 68, then the transaction failed silently (without a revert message)
        if (_returnData.length < 68) return "Transaction reverted silently";

        assembly {
            // Slice the sighash.
            _returnData := add(_returnData, 0x04)
        }
        return abi.decode(_returnData, (string)); // All that remains is the revert string
    }

    /// @notice Allows batched call to self (this contract).
    /// @param calls An array of inputs for each call.
    /// @param revertOnFail If True then reverts after a failed call and stops doing further calls.
    // F1: External is ok here because this is the batch function, adding it to a batch makes no sense
    // F2: Calls in the batch may be payable, delegatecall operates in the same context, so each call in the batch has access to msg.value
    // C3: The length of the loop is fully under user control, so can't be exploited
    // C7: Delegatecall is only used on the same contract, so it's safe
    function batch(bytes[] calldata calls, bool revertOnFail) external payable {
        for (uint256 i = 0; i < calls.length; i++) {
            (bool success, bytes memory result) = address(this).delegatecall(calls[i]);
            if (!success && revertOnFail) {
                revert(_getRevertMsg(result));
            }
        }
    }
}

contract BoringBatchable is BaseBoringBatchable {
    /// @notice Call wrapper that performs `ERC20.permit` on `token`.
    /// Lookup `IPermitERC20.permit`.
    // F6: Parameters can be used front-run the permit and the user's permit will fail (due to nonce or other revert)
    //     if part of a batch this could be used to grief once as the second call would not need the permit
    function permitToken(
        IPermitERC20 token,
        address from,
        address to,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        token.permit(from, to, amount, deadline, v, r, s);
    }
}

// File: contracts/utils/lending/ILendingPool.sol




/// @notice A contract which holds tokens that can be lent (without internal
/// bookkeeping). Address(es) with LENDER_ROLE can prompt the approval of
/// outgoing token transfers. LENDER_ROLE is administrated by DEFAULT_ADMIN_ROLE.
pragma solidity ^0.8.0;
interface ILendingPool {
    function approveLending(IERC20 _token, address _to, uint256 _amount) external;
    function lend(IERC20 _token, address _to, uint256 _amount) external;
}

// File: contracts/utils/lending/LendingPool.sol







/// @notice A contract which holds tokens that can be lent (without internal
/// bookkeeping). Address(es) with LENDER_ROLE can prompt the approval of
/// outgoing token transfers. LENDER_ROLE is administrated by DEFAULT_ADMIN_ROLE.
pragma solidity ^0.8.0;
abstract contract LendingPool is Context, AccessControlEnumerable, ILendingPool {
    // Role that can access LP tokens in the mining pool, for automatic lending.
    bytes32 public constant LENDER_ROLE = keccak256("LENDER_ROLE");

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());   // admin; can add/remove managers
    }

    function approveLending(IERC20 _token, address _to, uint256 _amount) external override {
        require(hasRole(LENDER_ROLE, _msgSender()), "LendingPool: must have LENDER role to approveLending");
        _token.approve(_to, _amount);
    }

    function lend(IERC20 _token, address _to, uint256 _amount) external override {
        require(hasRole(LENDER_ROLE, _msgSender()), "LendingPool: must have LENDER role to lend");
        _token.transfer(_to, _amount);
    }
}

// File: contracts/mining/RaraMiningPool.sol














/// @notice A staking / mining pool for receiving Rara by staking LP tokens.
/// The supply of Rara is governed by a RaraEmitter; Rara provided by the emitter
/// into this pool is then distributed to staking pools according to their
/// alloction points, and within the pools according to the user's stake size.
pragma solidity ^0.8.0;
contract RaraMiningPool is IMiningPool, BoringBatchable, LendingPool {
    using SafeERC20 for IERC20;

    // Role that manages reward pools and burn rates.
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    /// @notice Info of each RMP user.
    /// `amount` LP token amount the user has provided.
    /// `rewardDebt` The amount of RARA entitled to the user.
    struct UserInfo {
        uint256 amount;
        int256 rewardDebt;
    }

    /// @notice Info of each RMP pool.
    /// `allocPoint` The amount of allocation points assigned to the pool.
    /// Also known as the amount of RARA to distribute per block.
    struct PoolInfo {
        uint256 accRaraPerShare;
        uint256 lastRewardBlockRetainedRara;
        uint256 lastRewardBlock;
        uint256 allocPoint;
    }

    /// @notice Address of RARA token contract.
    IToken public immutable rara;
    uint256 public raraReceived;
    uint256 public raraRetained;
    uint256 public raraMined;
    /// @notice Address of RARA emitter.
    ITokenEmitter public immutable emitter;
    // @notice The migrator contract. It has a lot of power. Can only be set through governance (owner).
    IStakeMigrator public migrator;

    /// @notice Info of each RMP pool.
    PoolInfo[] public poolInfo;
    /// @notice Shares of the pool staked.
    uint256[] public poolShares;
    /// @notice Address of the LP token for each RMP pool.
    IERC20[] public lpToken;
    /// @notice Address of each `IStakeManager` contract in RMP.
    IStakeManager[] public override stakeManager;

    /// @notice Info of each user that stakes LP tokens.
    mapping (uint256 => mapping (address => UserInfo)) public userInfo;
    /// @dev Total allocation points. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint;
    /// @dev Total staked allocation points. Must be the sum of all allocation points in all pools with nonzero stake.
    uint256 public totalStakedAllocPoint;

    /// @notice Rara accumulates, but cannot be harvested before this block
    uint256 public unlockBlock;

    /// @notice Burn quantity (numerator of a fraction)
    uint256 public burnNumerator;
    /// @notice Burn quantity (denominator of a fraction)
    uint256 public burnDenominator;
    /// @notice Burn address (address to receive burned Rara -- 0x0 default)
    address public burnAddress;

    uint256 private constant PRECISION = 1e20;

    /// @param _rara The RaraToken address
    /// @param _emitter The RaraEmitter address
    constructor(IToken _rara, ITokenEmitter _emitter, uint256 _unlockBlock) {
        rara = _rara;
        emitter = _emitter;
        unlockBlock = _unlockBlock;

        // start with a 5% burn
        burnNumerator = 5;
        burnDenominator = 100;

        // set up roles
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());   // admin; can add/remove managers
        _setupRole(MANAGER_ROLE, _msgSender());         // manager; can add/remove pools
    }

    /// @notice Returns the number of RMP pools.
    function poolLength() public override view returns (uint256 pools) {
        pools = poolInfo.length;
    }

    /// @notice Add a new LP to the pool.
    /// Performs safety checks and data-integrity operations; this increases
    /// in complexity and will become unusable if the total number of pools
    /// grows. Switch to batch-execution of {updatePool} and {unsafeAdd} at that point.
    /// @param _allocPoint AP of the new pool.
    /// @param _lpToken Address of the LP ERC-20 token.
    /// @param _stakeManager Address of the stake manager.
    function add(uint256 _allocPoint, IERC20 _lpToken, IStakeManager _stakeManager) public override {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraMiningPool: must have MANAGER role to add");

        // note: becomes progressively more expensive, nigh unusable as pools
        // are added. Switch to batch operations with {unsafeAdd}.
        claimFromEmitter();
        uint256 len = poolInfo.length;
        for (uint256 i = 0; i < len; i++) {
            if (poolInfo[i].allocPoint > 0) {
                updatePool(i);
            }
        }
        _add(_allocPoint, _lpToken, _stakeManager);
    }

    /// @notice Update the given pool's Rara allocation point and `IStakeManager`.
    /// Performs safety checks and data-integrity operations; this increases
    /// in complexity and will become unusable if the total number of pools
    /// grows. Switch to batch-execution of {updatePool} and {unsafeSet} at that point.
    /// @param _pid The index of the pool. See `poolInfo`.
    /// @param _allocPoint New AP of the pool.
    /// @param _stakeManager Address of the stake manager.
    /// @param overwrite True if _stakeManager should be `set`. Otherwise `_stakeManager` is ignored.
    function set(uint256 _pid, uint256 _allocPoint, IStakeManager _stakeManager, bool overwrite) public override {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraMiningPool: must have MANAGER role to set");
        require(_pid <= poolInfo.length, "RaraMiningPool: no such pid");

        // note: becomes progressively more expensive, nigh unusable as pools
        // are added. Switch to batch operations with {unsafeSet}.
        claimFromEmitter();
        uint256 len = poolInfo.length;
        for (uint256 i = 0; i < len; i++) {
            if (poolInfo[i].allocPoint > 0 || i == _pid) {
                updatePool(i);
            }
        }
        _set(_pid, _allocPoint, _stakeManager, overwrite);
    }

    /// @notice Safely update the Rara burn rate.
    /// @param _numerator The share of emitted Rara to burn
    /// @param _denominator The share of all Rara out of which {_numerator} is burned.
    /// e.g. _numerator = 5, _denominator = 100 will burn 5%.
    /// @param _burnAddress Address of the burner; the indicated Rara proportion will
    /// be transferred here (e.g. 0x0).
    /// @param overwrite True if the _burnAddress should be set. Otherwise, `_burnAddress` is ignored.
    function setBurnRate(uint256 _numerator, uint256 _denominator, address _burnAddress, bool overwrite) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraMiningPool: must have MANAGER role to setBurnRate");

        // altering burn rates changes Rara calculations; claim first
        claimFromEmitter();
        _setBurnRate(_numerator, _denominator, _burnAddress, overwrite);
    }

    /// @notice Unsafely add a new LP to the pool. Use in a batch after updating
    /// active pools.
    /// DO NOT add without {claimFromEmitter} and updating active pools. Rewards will be messed up if you do.
    /// @param _allocPoint AP of the new pool.
    /// @param _lpToken Address of the LP ERC-20 token.
    /// @param _stakeManager Address of the stack manager.
    function unsafeAdd(uint256 _allocPoint, IERC20 _lpToken, IStakeManager _stakeManager) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraMiningPool: must have MANAGER role to unsafeAdd");
        _add(_allocPoint, _lpToken, _stakeManager);
    }

    /// @notice Unsafely update the given pool's Rara allocation point and `IStakeManager`.
    /// DO NOT call without {claimFromEmitter} and updating active pools. Rewards will be messed up if you do.
    /// @param _pid The index of the pool. See `poolInfo`.
    /// @param _allocPoint New AP of the pool.
    /// @param _stakeManager Address of the stake manager.
    /// @param overwrite True if _stakeManager should be `set`. Otherwise `_stakeManager` is ignored.
    function unsafeSet(uint256 _pid, uint256 _allocPoint, IStakeManager _stakeManager, bool overwrite) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraMiningPool: must have MANAGER role to unsafeSet");
        _set(_pid, _allocPoint, _stakeManager, overwrite);
    }

    /// @notice Unsafely update the Rara burn rate.
    /// DO NOT call this function except as a batch starting with {claimFromEmitter}.
    /// @param _numerator The share of emitted Rara to burn
    /// @param _denominator The share of all Rara out of which {_numerator} is burned.
    /// e.g. _numerator = 5, _denominator = 100 will burn 5%.
    /// @param _burnAddress Address of the burner; the indicated Rara proportion will
    /// be transferred here (e.g. 0x0).
    /// @param overwrite True if the _burnAddress should be set. Otherwise, `_burnAddress` is ignored.
    function unsafeSetBurnRate(uint256 _numerator, uint256 _denominator, address _burnAddress, bool overwrite) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraMiningPool: must have MANAGER role to unsafeSetBurnRate");
        _setBurnRate(_numerator, _denominator, _burnAddress, overwrite);
    }

    /// @notice Add a new LP to the pool.
    /// DO NOT add without updating active pools. Rewards will be messed up if you do.
    /// @param _allocPoint AP of the new pool.
    /// @param _lpToken Address of the LP ERC-20 token.
    /// @param _stakeManager Address of the stake manager.
    function _add(uint256 _allocPoint, IERC20 _lpToken, IStakeManager _stakeManager) internal {
        uint256 lastRewardBlock = block.number;
        uint256 retained = totalRetained();
        totalAllocPoint = totalAllocPoint + _allocPoint;
        lpToken.push(_lpToken);
        stakeManager.push(_stakeManager);

        poolInfo.push(PoolInfo({
            allocPoint: _allocPoint,
            lastRewardBlock: lastRewardBlock,
            lastRewardBlockRetainedRara: retained,
            accRaraPerShare: 0
        }));
        poolShares.push(0);
        emit PoolAdd(lpToken.length - 1, _allocPoint, _lpToken, _stakeManager);
    }

    /// @dev Update the given pool's Rara allocation point and `IStakeManager`.
    /// DO NOT call without updating active pools, INCLUDING this one.
    /// Rewards will be messed up if you do.
    /// @param _pid The index of the pool. See `poolInfo`.
    /// @param _allocPoint New AP of the pool.
    /// @param _stakeManager Address of the stake manager.
    /// @param overwrite True if _stakeManager should be `set`. Otherwise `_stakeManager` is ignored.
    function _set(uint256 _pid, uint256 _allocPoint, IStakeManager _stakeManager, bool overwrite) internal {
        totalAllocPoint = totalAllocPoint + _allocPoint - poolInfo[_pid].allocPoint;
        if (poolShares[_pid] > 0) {
          totalStakedAllocPoint = totalStakedAllocPoint + _allocPoint - poolInfo[_pid].allocPoint;
        }
        poolInfo[_pid].allocPoint = _allocPoint;
        if (overwrite) { stakeManager[_pid] = _stakeManager; }
        emit PoolSet(_pid, _allocPoint, overwrite ? _stakeManager : stakeManager[_pid], overwrite);
    }

    /// @dev Update the Rara burn rate.
    /// DO NOT call without claiming any emitted Rara. Rewards will be messed up if you do.
    /// @param _numerator The share of emitted Rara to burn
    /// @param _denominator The share of all Rara out of which {_numerator} is burned.
    /// e.g. _numerator = 5, _denominator = 100 will burn 5%.
    /// @param _burnAddress Address of the burner; the indicated Rara proportion will
    /// be transferred here (e.g. 0x0).
    /// @param overwrite True if the _burnAddress should be set. Otherwise, `_burnAddress` is ignored.
    function _setBurnRate(uint256 _numerator, uint256 _denominator, address _burnAddress, bool overwrite) internal {
        require(_denominator > 0, "RaraMiningPool: burn rate denominator must be non-zero");
        require(_numerator <= _denominator, "RaraMiningPool: burn rate numerator must be <= denominator");
        require(_numerator <= PRECISION &&  _denominator <= PRECISION, "RaraMiningPool: burn rate precision too high");

        burnNumerator = _numerator;
        burnDenominator = _denominator;
        if (overwrite) { burnAddress = _burnAddress; }
    }

    /// @notice Set the `migrator` contract. Can only be called by the manager.
    /// @param _migrator The contract address to set.
    function setMigrator(IStakeMigrator _migrator) public {
        require(hasRole(MANAGER_ROLE, _msgSender()), "RaraMiningPool: must have MANAGER role to setMigrator");
        migrator = _migrator;
    }

    /// @notice Migrate LP token to another LP contract through the `migrator` contract.
    /// @param _pid The index of the pool. See `poolInfo`.
    function migrate(uint256 _pid) public {
        require(address(migrator) != address(0), "RareMiningPool: no migrator set");
        IERC20 _lpToken = lpToken[_pid];
        uint256 bal = _lpToken.balanceOf(address(this));
        _lpToken.approve(address(migrator), bal);
        IERC20 newLpToken = migrator.migrate(_lpToken);
        require(bal == newLpToken.balanceOf(address(this)), "RareMiningPool: migrated balance must match");
        lpToken[_pid] = newLpToken;
    }

    /// @notice View function to see pending Rara on frontend.
    /// @param _pid The index of the pool. See `poolInfo`.
    /// @param _user Address of user.
    /// @return pending Rara reward for a given user.
    function pendingReward(uint256 _pid, address _user) external override view returns (uint256 pending) {
        PoolInfo memory pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accRaraPerShare = pool.accRaraPerShare;
        uint256 lpSupply = poolShares[_pid];
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 rewardSince = totalRetained() - pool.lastRewardBlockRetainedRara;
            uint256 poolReward = (rewardSince * pool.allocPoint) / totalAllocPoint;

            accRaraPerShare = accRaraPerShare + (poolReward * PRECISION) / lpSupply;
        }
        pending = uint256(int256((user.amount * accRaraPerShare) / PRECISION) - user.rewardDebt);
    }

    // total received: actual amount emitted
    // total retained: actual amount after ~5% burn
    // total mined: portion of retain coins allocated to populated pools

    /// @notice Calculates and returns the total Rara mined in the lifetime of
    /// this contract (including Rara that this contract burned)
    function totalReceived() public override view returns (uint256 amount) {
        uint256 owed = emitter.owed(address(this));
        amount = raraReceived + owed;
    }

    function totalRetained() public override view returns (uint256 amount) {
        amount = raraRetained;
        uint256 owed = emitter.owed(address(this));
        uint256 burn = (owed * burnNumerator) / burnDenominator;
        amount += owed - burn;
    }

    function totalMined() public override view returns (uint256 amount) {
        amount = raraMined;
        if (totalStakedAllocPoint != 0) {
          uint256 owed = emitter.owed(address(this));
          uint256 burn = (owed * burnNumerator) / burnDenominator;
          amount += ((owed - burn) * totalStakedAllocPoint) / totalAllocPoint;
        }
    }

    /// @notice Claim any Rara owed from the emitter, transferring it into this
    /// contract. Called by this contract as-needed to fulfill Rara harvests,
    /// but can be triggered from outside to square accounts.
    function claimFromEmitter() public {
        if (emitter.owed(address(this)) > 0) {
            uint256 claimed = emitter.claim(address(this));
            raraReceived = raraReceived + claimed;

            uint256 burned = (claimed * burnNumerator) / burnDenominator;
            uint256 retained = claimed - burned;
            raraRetained = raraRetained + retained;

            uint256 mined = 0;
            if (totalStakedAllocPoint != 0) {
              mined = ((claimed - burned) * totalStakedAllocPoint) / totalAllocPoint;
              raraMined = raraMined + mined;
            }

            if (burned != 0) {  // destroy coins explicitly burned, possibly sending to an address
                _burnRara(burnAddress, burned);
            }
            if (retained > mined) { // destroy coins "mined" for unstaked pools (really destroy)
                _burnRara(address(0), retained - mined);
            }
        }
    }

    /// @notice Update reward variables for all pools. Be careful of gas spending!
    /// @param pids Pool IDs of all to be updated. Make sure to update all active pools.
    function massUpdatePools(uint256[] calldata pids) external {
        uint256 len = pids.length;
        for (uint256 i = 0; i < len; ++i) {
            updatePool(pids[i]);
        }
    }

    /// @notice Update reward variables of the given pool.
    /// @param pid The index of the pool. See `poolInfo`.
    /// @return pool Returns the pool that was updated.
    function updatePool(uint256 pid) public returns (PoolInfo memory pool) {
        pool = poolInfo[pid];
        if (block.number > pool.lastRewardBlock) {
            uint256 lpSupply = poolShares[pid];
            uint256 retained = totalRetained();
            if (lpSupply > 0) {
                uint256 retainedSince = retained - pool.lastRewardBlockRetainedRara;
                uint256 poolReward = (retainedSince * pool.allocPoint) / totalAllocPoint;

                pool.accRaraPerShare = pool.accRaraPerShare + ((poolReward * PRECISION) / lpSupply);
            }
            pool.lastRewardBlock = block.number;
            pool.lastRewardBlockRetainedRara = retained;
            poolInfo[pid] = pool;
            emit PoolUpdate(pid, pool.lastRewardBlock, pool.lastRewardBlockRetainedRara, lpSupply, pool.accRaraPerShare);
        }
    }

    /// @notice Deposit LP tokens to RMP for RARA allocation.
    /// @param pid The index of the pool. See `poolInfo`.
    /// @param amount LP token amount to deposit.
    /// @param to The receiver of `amount` deposit benefit.
    function deposit(uint256 pid, uint256 amount, address to) public override {
        PoolInfo memory pool = updatePool(pid);
        UserInfo storage user = userInfo[pid][to];

        // Effects
        if (poolShares[pid] == 0) {
            claimFromEmitter();
            totalStakedAllocPoint = totalStakedAllocPoint + pool.allocPoint;
        }
        user.amount = user.amount + amount;
        user.rewardDebt = user.rewardDebt + int256((amount * pool.accRaraPerShare) / PRECISION);
        poolShares[pid] = poolShares[pid] + amount;

        // Transfer funds: handled either by the manager, or this contract.
        IERC20 token = lpToken[pid];
        IStakeManager _manager = stakeManager[pid];
        if (address(_manager) == address(0) || !_manager.onStakeDeposit(
            pid,
            token,
            msg.sender,
            to,
            amount,
            user.amount
        )) {
            token.safeTransferFrom(msg.sender, address(this), amount);
        }

        emit Deposit(msg.sender, pid, amount, to);
    }

    /// @notice Withdraw LP tokens from RMP.
    /// @param pid The index of the pool. See `poolInfo`.
    /// @param amount LP token amount to withdraw.
    /// @param to Receiver of the LP tokens.
    function withdraw(uint256 pid, uint256 amount, address to) public override {
        PoolInfo memory pool = updatePool(pid);
        UserInfo storage user = userInfo[pid][msg.sender];

        // Effects
        if (poolShares[pid] == amount) {
            claimFromEmitter();
            totalStakedAllocPoint = totalStakedAllocPoint - pool.allocPoint;
        }
        user.rewardDebt = user.rewardDebt - int256((amount * pool.accRaraPerShare) / PRECISION);
        user.amount = user.amount - amount;
        poolShares[pid] = poolShares[pid] - amount;

        // Transfer funds: handled either by the manager, or this contract.
        IERC20 token = lpToken[pid];
        IStakeManager _manager = stakeManager[pid];
        if (address(_manager) == address(0) || !_manager.onStakeWithdraw(
            pid,
            token,
            msg.sender,
            to,
            amount,
            user.amount
        )) {
            token.safeTransfer(to, amount);
        }

        emit Withdraw(msg.sender, pid, amount, to);
    }

    /// @notice Harvest proceeds for transaction sender to `to`.
    /// @param pid The index of the pool. See `poolInfo`.
    /// @param to Receiver of RARA rewards.
    function harvest(uint256 pid, address to) public override {
        require(block.number >= unlockBlock, "RaraMiningPool: no harvest before unlockBlock");
        PoolInfo memory pool = updatePool(pid);
        UserInfo storage user = userInfo[pid][msg.sender];
        int256 accumulatedRara = int256((user.amount * pool.accRaraPerShare) / PRECISION);
        uint256 _pendingRara = uint256(accumulatedRara - user.rewardDebt);

        // Effects
        user.rewardDebt = accumulatedRara;

        // Transfer rewards: handled either by the manager, or this contract.
        IERC20 token = lpToken[pid];
        IStakeManager _manager = stakeManager[pid];
        if (address(_manager) == address(0) || !_manager.onRewardHarvest(
            pid,
            token,
            msg.sender,
            to,
            _pendingRara,
            user.amount
        )) {
            if (_pendingRara != 0) {
                _transferRara(to, _pendingRara);
            }
        }

        emit Harvest(msg.sender, pid, _pendingRara);
    }

    /// @notice Withdraw LP tokens from RMP and harvest proceeds for transaction sender to `to`.
    /// @param pid The index of the pool. See `poolInfo`.
    /// @param amount LP token amount to withdraw.
    /// @param to Receiver of the LP tokens and RARA rewards.
    function withdrawAndHarvest(uint256 pid, uint256 amount, address to) public override {
        require(block.number >= unlockBlock, "RaraMiningPool: no harvest before unlockBlock");
        PoolInfo memory pool = updatePool(pid);
        UserInfo storage user = userInfo[pid][msg.sender];
        uint256 _pendingLp = amount;
        int256 accumulatedRara = int256((user.amount * pool.accRaraPerShare) / PRECISION);
        uint256 _pendingRara = uint256(accumulatedRara - user.rewardDebt);
        uint256 _previousLp = user.amount;

        // Effects
        if (poolShares[pid] == amount) {
            claimFromEmitter();
            totalStakedAllocPoint = totalStakedAllocPoint - pool.allocPoint;
        }
        user.rewardDebt = accumulatedRara - int256((amount * pool.accRaraPerShare) / PRECISION);
        user.amount = user.amount - amount;
        poolShares[pid] = poolShares[pid] - amount;

        // Interactions
        IERC20 token = lpToken[pid];
        IStakeManager _manager = stakeManager[pid];
        if (address(_manager) != address(0)) {
            if (_manager.onRewardHarvest(pid, token, msg.sender, to, _pendingRara, _previousLp)) {
                _pendingRara = 0;
            }
            if (_manager.onStakeWithdraw(pid, token, msg.sender, to, _pendingLp, user.amount)) {
                _pendingLp = 0;
            }
        }
        if (_pendingRara != 0) { _transferRara(to, _pendingRara); }
        if (_pendingLp != 0) { token.safeTransfer(to, _pendingLp); }

        emit Harvest(msg.sender, pid, _pendingRara);
        emit Withdraw(msg.sender, pid, amount, to);
    }

    /// @dev Transfer the indicated Rara to the indicated recipient, or as
    /// much of it as possible. Will automatically claim Rara from the
    /// emitter if necessary.
    function _transferRara(address _to, uint256 _amount) internal {
        uint256 raraBal = rara.balanceOf(address(this));
        if (_amount > raraBal) {
            claimFromEmitter();
            raraBal = rara.balanceOf(address(this));
        }

        if (_amount > raraBal) {
            rara.transfer(_to, raraBal);
        } else {
            rara.transfer(_to, _amount);
        }
    }

    function _burnRara(address _to, uint _amount) internal {
        if (_to == address(0)) {
            rara.burn(_amount);
        } else {
            rara.transfer(burnAddress, _amount);
        }
    }
}
