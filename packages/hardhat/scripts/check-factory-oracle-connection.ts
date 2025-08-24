import { ethers } from "hardhat";

async function main() {
  console.log("🔍 Checking Factory-Oracle Connection...");
  console.log("=====================================");
  
  // Get contracts
  const factory = await ethers.getContract("PredictionMarketFactory");
  const oracle = await ethers.getContract("PredictionMarketOracle");
  
  const factoryAddress = await factory.getAddress();
  const oracleAddress = await oracle.getAddress();
  
  console.log(`🏭 Factory Address: ${factoryAddress}`);
  console.log(`🔮 Oracle Address: ${oracleAddress}`);
  
  // Check what Oracle the Factory is using
  const factoryDefaultOracle = await factory.defaultOracle();
  console.log(`🔗 Factory's default Oracle: ${factoryDefaultOracle}`);
  
  // Check what Factory the Oracle is connected to
  const oracleFactory = await oracle.factory();
  console.log(`🔗 Oracle's Factory: ${oracleFactory}`);
  
  // Check connections
  console.log("\n📊 Connection Analysis:");
  console.log(`✅ Factory → Oracle: ${factoryDefaultOracle === oracleAddress ? 'CONNECTED' : 'DISCONNECTED'}`);
  console.log(`✅ Oracle → Factory: ${oracleFactory === factoryAddress ? 'CONNECTED' : 'DISCONNECTED'}`);
  
  // Check Oracle permissions
  const [deployer] = await ethers.getSigners();
  const isAuthorizedResolver = await oracle.authorizedResolvers(deployer.address);
  console.log(`✅ Deployer authorized in Oracle: ${isAuthorizedResolver}`);
  
  // Check if Oracle can resolve markets
  const allMarkets = await factory.getAllMarkets();
  console.log(`\n📈 Markets in Factory: ${allMarkets.length}`);
  
  if (allMarkets.length > 0) {
    for (let i = 0; i < allMarkets.length; i++) {
      const marketAddress = allMarkets[i];
      console.log(`  - Market ${i}: ${marketAddress}`);
      
      const marketContract = await ethers.getContractAt("TransactionPredictionMarket", marketAddress);
      const marketOracle = await marketContract.oracle();
      console.log(`    Oracle: ${marketOracle}`);
      console.log(`    Connected: ${marketOracle === oracleAddress ? 'YES' : 'NO'}`);
    }
  }
  
  console.log("\n🎯 Summary:");
  if (factoryDefaultOracle !== oracleAddress) {
    console.log("❌ PROBLEM: Factory is using wrong Oracle address!");
    console.log(`   Factory expects: ${factoryDefaultOracle}`);
    console.log(`   But Oracle is: ${oracleAddress}`);
  } else if (oracleFactory !== factoryAddress) {
    console.log("❌ PROBLEM: Oracle is connected to wrong Factory!");
    console.log(`   Oracle expects: ${oracleFactory}`);
    console.log(`   But Factory is: ${factoryAddress}`);
  } else if (!isAuthorizedResolver) {
    console.log("❌ PROBLEM: Deployer not authorized as Oracle resolver!");
  } else {
    console.log("✅ Factory-Oracle connection looks good!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });