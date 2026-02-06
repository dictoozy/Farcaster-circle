// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title FarcasterCircle
 * @dev Simple NFT contract for minting Farcaster Circle visualizations on Base
 */
contract FarcasterCircle is ERC721, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    constructor() ERC721("Farcaster Circle", "FCIRCLE") Ownable(msg.sender) {}

    /**
     * @dev Mint a new Farcaster Circle NFT
     * @param uri The metadata URI (base64 encoded JSON or IPFS)
     */
    function mintCircle(string memory uri) external {
        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);
    }

    /**
     * @dev Returns the total number of minted tokens
     */
    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }

    // Required overrides
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
