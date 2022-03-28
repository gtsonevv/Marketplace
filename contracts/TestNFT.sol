//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract TestNFT is ERC721 {
    uint public tokenCount;

    constructor() ERC721("TestNFT", "tnft") {

    }

    function mint() public returns(uint) {
        tokenCount++;
        _safeMint(msg.sender, tokenCount);
        return tokenCount;
    }
}