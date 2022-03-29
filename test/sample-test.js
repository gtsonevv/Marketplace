const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Marketplace Tests", function () {
  let marketplace;
  let testNFT;
  let owner, addr1, addr2;

  before(async() => {
    [owner, addr1, addr2] = await ethers.getSigners();
    let marketplaceFactory = await ethers.getContractFactory("Marketplace");
    marketplace = await marketplaceFactory.deploy();
    await marketplace.deployed();
    let testNFTFactory = await ethers.getContractFactory("TestNFT");
    testNFT = await testNFTFactory.deploy();
    await testNFT.deployed();
  });

  it("Should add TestNFT collection", async function() { 
    marketplace.addCollection(testNFT.address);
    expect(await marketplace.idToCollection(1)).to.equal(testNFT.address);
  });

  it("Should throw an error when try to add a collection that's already been added", async function() { 
    marketplace.addCollection(testNFT.address);
    expect(await marketplace.idToCollection(1)).to.equal(testNFT.address);
  });

  it("Should throw an error when try to add a token that's owned by another address", async function() {
    let tokenId = await testNFT.connect(addr1).mint();
    expect(marketplace.connect(addr1).addItem(testNFT.address, tokenId)).to.be.revertedWith('You are not the owner of that token.');;
  });
  
  it("Should throw an error when try to add a token from a collection that doesn't exist", async function() {
    expect(marketplace.connect(addr1).addItem(0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB, 1)).to.be.revertedWith("Collection doesn't exist.");
  });

  it("Should add a new item", async function() {
    await marketplace.connect(addr1).addItem(testNFT.address, 1);
    expect(await marketplace.itemCount()).to.equal(1);
  });

  it("Should throw an error when try to list an item that's owned by another address", async function() {
    expect(marketplace.listItem(1, 1)).to.be.revertedWith("You are not the owner of that token.");
  });

  it("Should throw an error when try to list an that doesn't exist", async function() {
    expect(marketplace.listItem(2, 1)).to.be.revertedWith("Item doesn't exist.");
  });

  it("Should throw an error when try to list a free item", async function() {
    expect(marketplace.listItem(1, 1)).to.be.revertedWith("Price must be greater than zero.");
  });

  it("Should list a new item", async function() {
    await marketplace.connect(addr1).listItem(1, 1);
    await testNFT.connect(addr1).approve(marketplace.address, 1);
    expect(await testNFT.getApproved(1)).to.equal(marketplace.address);
  });

  it("Should throw an error when try to list an item that's already been listed", async function() {
    expect(marketplace.listItem(1, 1)).to.be.revertedWith("Item is already listed.");
  });

  it("Should throw an error when try to buy an item with insufficient funds", async function() {
    expect(marketplace.buyItem(1, {value: 0.5})).to.be.revertedWith("Insufficient funds.");
  });

  it("Should throw an error when try to buy an item that doesn't exist", async function() {
    expect(marketplace.buyItem(2, {value: 1})).to.be.revertedWith("Item doesn't exist.");
  });

  it("Should buy the item", async function() {
    await marketplace.buyItem(1, {value: 1});
    expect(await testNFT.ownerOf(1)).to.equal(owner.address);
  });

  it("Should list an item", async function() {
    await marketplace.listItem(1, 1);
    await testNFT.approve(marketplace.address, 1);
    expect(await testNFT.getApproved(1)).to.equal(marketplace.address);
  });

  it("Should send an offer", async function() {
    let balance = await ethers.provider.getBalance(marketplace.address);
    await marketplace.connect(addr1).sendOffer(1, {value: 5}); // Offer Id: 1
    let newBalance = await ethers.provider.getBalance(marketplace.address);
    expect(newBalance - 5).to.equal(balance);
  });

  it("Should throw an error when try to accept an offer for a token that's owned by another address", async function() {
    expect(marketplace.connect(addr2).acceptOffer(1, 1)).to.be.revertedWith("You are not the owner of that token.");
  });

  it("Should accept the offer", async function() {
    await testNFT.approve(marketplace.address, 1);
    await marketplace.acceptOffer(1, 1);
    expect(await testNFT.ownerOf(1)).to.equal(addr1.address);
  });

  it("Should throw an error when try to accept an offer that doesn't exist", async function() {
    expect(marketplace.acceptOffer(1, 1)).to.be.revertedWith("Offer doesn't exist.");
  });
});