//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract Marketplace is Ownable, ReentrancyGuard {
    uint private fees;
    uint public constant feePercent = 5;
    uint public itemCount;
    uint public collectionCount;

    struct Item {
        address contractAddress;
        uint tokenId;
        uint price;
        bool forSale;
    }

    event CollectionAdded(address contractAddress);
    event ItemAdded(uint itemId, address nftContract, uint tokenId);
    event ItemListed(uint itemId, address nftContract, uint tokenId, uint price);
    event ItemSold(uint itemId, address nftContract, uint tokenId, uint price, address seller, address buyer);
    event OfferSent(uint itemId, address buyer, uint price);
    event OfferRejected(uint itemId);

    mapping(uint => Item) public idToItem;
    mapping(uint => address) public idToCollection;
    mapping(address => bool) public collectionExists;

    mapping(uint => mapping(address => uint)) internal itemIdToBuyerToPrice;
    mapping(uint => mapping (uint => address)) internal itemIdToOfferIdToBuyer;
    mapping(uint => uint) internal itemIdToOfferCount;

    modifier itemExists(uint _itemId) {
        require(_itemId <= itemCount, "Item doesn't exist.");
        _;
    }

    function withdrawFees() external onlyOwner {
        payable(this.owner()).transfer(fees);
        fees = 0;
    }

    function addCollection(address _contractAddress) external {
        require(!collectionExists[_contractAddress], "Collection already exists.");

        collectionCount++;
        idToCollection[collectionCount] = _contractAddress;
        collectionExists[_contractAddress] = true;

        emit CollectionAdded(_contractAddress);
    }

    function addItem(address _contractAddress, uint _tokenId) external {
        require(collectionExists[_contractAddress], "Collection doesn't exist.");
        address owner = ERC721(_contractAddress).ownerOf(_tokenId);
        require(owner == msg.sender, "You are not the owner of that token.");

        itemCount++;
        idToItem[itemCount] = Item(_contractAddress, _tokenId, 0, false);

        emit ItemAdded(itemCount, _contractAddress, _tokenId);
    }

    function listItem(uint _itemId, uint _price) external itemExists(_itemId) {
        require(!idToItem[_itemId].forSale, "Item is already listed.");
        address nftAddress = idToItem[_itemId].contractAddress;
        uint tokenId = idToItem[_itemId].tokenId;
        address owner = ERC721(nftAddress).ownerOf(tokenId);
        require(owner == msg.sender, "You are not the owner of that token.");
        require(_price > 0, "Price must be greater than zero.");

        idToItem[_itemId].price = _price;
        idToItem[_itemId].forSale = true;

        emit ItemListed(_itemId, nftAddress, tokenId, _price);
    }

    function sendOffer(uint _itemId) external payable itemExists(_itemId) {
        require(msg.value > 0, "The value must be greater than 0.");
        address owner = ERC721(idToItem[_itemId].contractAddress).ownerOf(idToItem[_itemId].tokenId);
        require(msg.sender != owner, "You are the owner of that item.");
        uint offerId = ++itemIdToOfferCount[_itemId];
        itemIdToBuyerToPrice[_itemId][msg.sender] = msg.value;
        itemIdToOfferIdToBuyer[_itemId][offerId] = msg.sender;

        emit OfferSent(_itemId, msg.sender, msg.value);
    }

    function acceptOffer(uint _itemId, uint _offerId) external nonReentrant itemExists(_itemId) { 
        require(_offerId <= itemIdToOfferCount[_itemId], "Offer doesn't exist.");
        address nftAddress = idToItem[_itemId].contractAddress;
        address owner = ERC721(nftAddress).ownerOf(idToItem[_itemId].tokenId);
        require(msg.sender == owner, "You are not the owner of that token.");

        uint tokenId = idToItem[_itemId].tokenId;
        address buyer = itemIdToOfferIdToBuyer[_itemId][_offerId];
        uint itemPrice = itemIdToBuyerToPrice[_itemId][buyer];
        uint actualPrice = itemPrice - (itemPrice  / feePercent);
        payable(msg.sender).transfer(actualPrice);
        fees += (itemPrice - actualPrice);

        ERC721(nftAddress).safeTransferFrom(msg.sender, buyer, tokenId);
        idToItem[_itemId].forSale = false;
        
        uint offerCount = itemIdToOfferCount[_itemId];
        for(uint i = 1; i <= offerCount; i++) {
            address offerSender = itemIdToOfferIdToBuyer[_itemId][i];
            itemIdToOfferIdToBuyer[_itemId][i] = address(0);
            uint amount = itemIdToBuyerToPrice[_itemId][buyer];
            itemIdToBuyerToPrice[_itemId][buyer] = 0;
            if (i == _offerId) continue;
            payable(offerSender).transfer(amount);
        }
        itemIdToOfferCount[_itemId] = 0;

        emit ItemSold(_itemId, nftAddress, tokenId, itemPrice, msg.sender, buyer);
    }

    function buyItem(uint _itemId) external payable nonReentrant itemExists(_itemId) {
        require(idToItem[_itemId].forSale, "Item is not for sale.");
        uint itemPrice = idToItem[_itemId].price;
        require(msg.value >= itemPrice, "Insufficient funds.");
        
        address contractAddress = idToItem[_itemId].contractAddress;
        uint tokenId = idToItem[_itemId].tokenId;
        address owner = ERC721(contractAddress).ownerOf(tokenId);
        uint fee = itemPrice - (itemPrice * feePercent) / 100;
        payable(owner).transfer(itemPrice - fee);
        fees += fee;

        ERC721(contractAddress).safeTransferFrom(owner, msg.sender, tokenId);
        idToItem[_itemId].forSale = false;

        emit ItemSold(_itemId, contractAddress, tokenId, itemPrice, owner, msg.sender);
    }
}