pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "../interfaces/IERC721TypeExchangeable.sol";

library ERC721Exchange {

    function massTransferFrom(address _token, address _from, address _to, uint256[] calldata _tokenIds) internal {
        if (isTypeExchangeable(_token)) {
            IERC721TypeExchangeable(_token).massTransferFrom(_from, _to, _tokenIds);
        } else {
            for (uint256 i = 0; i < _tokenIds.length; i++) {
                IERC721(_token).transferFrom(_from, _to, _tokenIds[i]);
            }
        }
    }

    function massBurnFrom(address _token, address _from, uint256[] calldata _tokenIds, address _burnVault) internal {
        if (isTypeExchangeable(_token)) {
            IERC721TypeExchangeable(_token).massBurnFrom(_from, _tokenIds);
        } else {
            for (uint256 i = 0; i < _tokenIds.length; i++) {
                IERC721(_token).transferFrom(_from, _burnVault, _tokenIds[i]);
            }
        }
    }

    function burnFrom(address _token, address _from, uint256 _tokenId, address _burnVault) internal {
        if (isTypeExchangeable(_token)) {
            IERC721TypeExchangeable(_token).burnFrom(_from, _tokenId);
        } else {
            IERC721(_token).transferFrom(_from, _burnVault, _tokenId);
        }
    }

    function exchange(address _tokenFrom, address _tokenTo, address _owner, uint256[] calldata _burnTokenIds, uint256[] calldata _tokenTypes, address _burnVault) internal returns (uint256[] memory tokenIds) {
        bool sameToken = _tokenFrom == _tokenTo;
        bool tokenFromExchangeable = isTypeExchangeable(_tokenFrom);

        if (tokenFromExchangeable && sameToken) {
            tokenIds = IERC721TypeExchangeable(_tokenFrom).exchange(_owner, _burnTokenIds, _tokenTypes);
        } else {
            // two-step; burn, then mint
            if (tokenFromExchangeable) {
                IERC721TypeExchangeable(_tokenFrom).massBurnFrom(_owner, _burnTokenIds);
            } else {
                for (uint256 i = 0; i < _burnTokenIds.length; i++) {
                    IERC721(_tokenFrom).transferFrom(_owner, _burnVault, _burnTokenIds[i]);
                }
            }

            // now mint
            tokenIds = IERC721TypeExchangeable(_tokenTo).massMint(_owner, _tokenTypes);
        }
    }

    function isTypeExchangeable(address _token) internal returns (bool) {
      (bool success, bytes memory data) = _token.call(
          abi.encodeWithSignature("supportsInterface(bytes4)", type(IERC721TypeExchangeable).interfaceId)
      );

      return success && abi.decode(data, (bool));
    }
}
