//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract TestNFT is ERC721URIStorage {
    uint public tokenCount;

    constructor() ERC721("TestNFT", "tnft") {

    }

    function mint(string memory _tokenURI) public returns(uint) {
        tokenCount++;
        _safeMint(msg.sender, tokenCount);
        _setTokenURI(tokenCount, _tokenURI);
        return tokenCount;
    }
}