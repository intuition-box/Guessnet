import { ethers } from "hardhat";

async function main() {
  console.log("🔍 Debug Oracle Data...");
  
  // Get Oracle contract
  const oracle = await ethers.getContract("PredictionMarketOracle");
  const oracleAddress = await oracle.getAddress();
  
  console.log(`🔮 Oracle Address: ${oracleAddress}`);
  
  // Get current transaction data
  const currentData = await oracle.currentTransactionData();
  console.log(`📊 Oracle Data:`, {
    totalTransactions: currentData.totalTransactions.toString(),
    timestamp: Number(currentData.timestamp),
    blockNumber: Number(currentData.blockNumber),
    isValid: currentData.isValid
  });
  
  // Check if data is fresh
  const isDataFresh = await oracle.isDataFresh();
  console.log(`⏰ Is Data Fresh: ${isDataFresh}`);
  
  // Check current block timestamp
  const currentBlock = await ethers.provider.getBlock('latest');
  console.log(`🕐 Current Block Timestamp: ${currentBlock?.timestamp}`);
  console.log(`🕐 Oracle Timestamp: ${Number(currentData.timestamp)}`);
  
  // Calculate age
  const dataAge = currentBlock!.timestamp - Number(currentData.timestamp);
  console.log(`📅 Data Age: ${dataAge} seconds`);
  console.log(`📅 Max Age Allowed: ${60 * 60} seconds (1 hour)`);
  
  // Check if data is too old
  console.log(`❓ Data too old? ${dataAge > 60 * 60}`);
  console.log(`❓ Data valid flag: ${currentData.isValid}`);
  
  console.log("\n🎯 Summary:");
  if (!currentData.isValid) {
    console.log("❌ Data marked as INVALID in contract");
  } else if (dataAge > 60 * 60) {
    console.log("❌ Data is TOO OLD (> 1 hour)");
  } else {
    console.log("✅ Data should be VALID");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });