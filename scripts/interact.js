const hre = require("hardhat");

async function main() {
    const TestNFT = await hre.ethers.getContractFactory("TestNFT");
    const collection = TestNFT.attach("0xA326bD0974673C5F5A38652566148Ab4fd3b9d1A");
    const token = await collection.mint();
    console.log("Minted token", token);
  }
  
  // We recommend this pattern to be able to use async/await everywhere
  // and properly handle errors.
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });