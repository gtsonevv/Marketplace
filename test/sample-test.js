const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Marketplace Tests", function () {
  let marketplace;
  let testNFT;
  let owner, addr1, addr2, addr3, addr4;

  before(async() => {
    [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();
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
    await testNFT.connect(addr1).mint("https://news.artnet.com/app/news-upload/2022/01/TK-Bored-Ape.jpg")
    expect(await testNFT.tokenCount()).to.equal(1);
    expect(marketplace.addItem(testNFT.address, 1)).to.be.revertedWith('You are not the owner of that token.');;
  });
  
  it("Should throw an error when try to add a token from a collection that doesn't exist", async function() {
    expect(marketplace.connect(addr1).addItem(0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB, 1)).to.be.revertedWith("Collection doesn't exist.");
  });

  it("Should add a new item", async function() {
    await marketplace.connect(addr1).addItem(testNFT.address, 1);
    expect(await marketplace.itemCount()).to.equal(1);
  });

  it("Should throw an error when try to add a token that's already been added", async function() {
    expect(marketplace.connect(addr1).addItem(testNFT.address, 1)).to.be.revertedWith("Token's already been added.");
  });

  it("Should throw an error when try to list an item that's owned by another address", async function() {
    expect(marketplace.listItem(1, 1)).to.be.revertedWith("You are not the owner of that token.");
  });

  it("Should throw an error when try to list an that doesn't exist", async function() {
    expect(marketplace.listItem(2, 1)).to.be.revertedWith("Item doesn't exist.");
  });

  it("Should throw an error when try to list a free item", async function() {
    expect(marketplace.listItem(1, 0)).to.be.revertedWith("Price must be greater than 0.");
  });

  it("Should list a new item", async function() {
    testNFT.connect(addr1).approve(marketplace.address, 1);
    await marketplace.connect(addr1).listItem(1, 1);
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

  it("Should send an offer", async function() {
    let balance = await ethers.provider.getBalance(marketplace.address);
    await marketplace.connect(addr2).sendOffer(1, {value: 5}); // Offer Id: 1
    let newBalance = await ethers.provider.getBalance(marketplace.address);
    expect(newBalance - 5).to.equal(balance);
  });

  it("Should buy the item", async function() {
    await marketplace.connect(addr3).buyItem(1, {value: 1});
    expect(await testNFT.ownerOf(1)).to.equal(addr3.address);
  });

  it("Should list an item", async function() {
    testNFT.connect(addr3).approve(marketplace.address, 1);
    await marketplace.connect(addr3).listItem(1, 1);
    expect(await testNFT.getApproved(1)).to.equal(marketplace.address);
  });

  it("Should buy the item", async function() {
    marketplace.buyItem(1, {value: 1});
    expect(await testNFT.ownerOf(1)).to.equal(owner.address);
  });

  it("Should list an item", async function() {
    testNFT.approve(marketplace.address, 1);
    marketplace.listItem(1, 1);
    expect(await testNFT.getApproved(1)).to.equal(marketplace.address);
  });

  it("Should throw an error when try to send an offer for my item", async function() {
    expect(marketplace.sendOffer(1, {value: 5})).to.be.revertedWith("You are the owner of that item.");
  });

  it("Should throw an error when try to send an offer with no balance", async function() {
    expect(marketplace.sendOffer(1, {value: 0})).to.be.revertedWith("The value must be greater than 0.");
  });

  it("Should send an offer", async function() {
    let balance = await ethers.provider.getBalance(marketplace.address);
    await marketplace.connect(addr1).sendOffer(1, {value: 5}); // Offer Id: 1
    let newBalance = await ethers.provider.getBalance(marketplace.address);
    expect(newBalance - 5).to.equal(balance);
  });

  it("Should throw an error when try to send more than 1 offer for an item", async function() {
    expect(marketplace.sendOffer(1, {value: 3})).to.be.revertedWith("You are not allowed to send more than one offer for an item.");
  });

  it("Should send an offer", async function() {
    let balance = await ethers.provider.getBalance(marketplace.address);
    await marketplace.connect(addr2).sendOffer(1, {value: 15}); // Offer Id: 2
    let newBalance = await ethers.provider.getBalance(marketplace.address);
    expect(newBalance - 15).to.equal(balance);
  });

  it("Should throw an error when try to buy my item", async function() {
    expect(marketplace.buyItem(1, {value: 1})).to.be.revertedWith("You can not buy your own item.");
  });

  it("Should throw an error when try to accept an offer for a token that's owned by another address", async function() {
    expect(marketplace.connect(addr4).acceptOffer(1, 1)).to.be.revertedWith("You are not the owner of that token.");
  });

  it("Should accept the offer", async function() {
    testNFT.approve(marketplace.address, 1);
    marketplace.acceptOffer(1, 2);
    expect(await testNFT.ownerOf(1)).to.equal(addr2.address);
  });

  it("Should throw an error when try to accept an offer that doesn't exist", async function() {
    expect(marketplace.acceptOffer(1, 1)).to.be.revertedWith("Offer doesn't exist.");
  });

  it("Should withdraw all collected fees", async function() {
    marketplace.withdrawFees();
    const marketplaceBalance = await ethers.provider.getBalance(marketplace.address);
    expect(marketplaceBalance).to.equal(0);
  });
});