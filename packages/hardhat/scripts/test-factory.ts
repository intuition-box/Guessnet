import { ethers } from "hardhat";

async function main() {
  const [deployer, user1, user2] = await ethers.getSigners();
  
  // Get deployed factory contract
  const factory = await ethers.getContract("PredictionMarketFactory");
  const factoryAddress = await factory.getAddress();
  
  console.log("\n🏭 Testing PredictionMarketFactory at:", factoryAddress);
  console.log("👤 Deployer:", deployer.address);
  console.log("👤 User1:", user1.address);
  console.log("👤 User2:", user2.address);
  
  // Test 1: Create a new transaction prediction market
  console.log("\n📈 Test 1: Creating a new prediction market...");
  
  const description = "Will there be more than 1000 transactions on Ethereum in the next hour?";
  const transactionThreshold = 1000;
  const deadline = Math.floor(Date.now() / 1000) + 7200; // 2 hours from now (safe margin)
  const customOracle = ethers.ZeroAddress; // Use default oracle
  
  const createTx = await factory.connect(user1).createTransactionMarket(
    description,
    transactionThreshold,
    deadline,
    customOracle
  );
  
  const receipt = await createTx.wait();
  const marketCreatedEvent = receipt?.logs.find(log => {
    try {
      return factory.interface.parseLog(log as any)?.name === "MarketCreated";
    } catch {
      return false;
    }
  });
  
  let marketAddress: string = "";
  if (marketCreatedEvent) {
    const parsedEvent = factory.interface.parseLog(marketCreatedEvent as any);
    marketAddress = parsedEvent?.args.marketAddress;
    console.log("✅ Market created at:", marketAddress);
  }
  
  // Test 2: Get market information
  console.log("\n📊 Test 2: Getting market information...");
  const marketInfo = await factory.getMarketInfo(0);
  console.log("Market Info:");
  console.log("  - Address:", marketInfo.marketAddress);
  console.log("  - Creator:", marketInfo.creator);
  console.log("  - Oracle:", marketInfo.oracle);
  console.log("  - Description:", marketInfo.description);
  console.log("  - Threshold:", marketInfo.transactionThreshold.toString());
  console.log("  - Deadline:", new Date(Number(marketInfo.deadline) * 1000).toISOString());
  console.log("  - Is Active:", marketInfo.isActive);
  
  // Test 3: Place a bet on the market
  console.log("\n💰 Test 3: Placing bets on the market...");
  const market = await ethers.getContractAt("TransactionPredictionMarket", marketAddress);
  
  // User1 bets 1 ETH that transactions will be ABOVE threshold
  const betAmount1 = ethers.parseEther("1.0");
  const betTx1 = await market.connect(user1).placeBet(0, { value: betAmount1 }); // BetType.ABOVE_THRESHOLD = 0
  await betTx1.wait();
  console.log("✅ User1 bet 1 ETH on ABOVE threshold");
  
  // User2 bets 0.5 ETH that transactions will be BELOW threshold  
  const betAmount2 = ethers.parseEther("0.5");
  const betTx2 = await market.connect(user2).placeBet(1, { value: betAmount2 }); // BetType.BELOW_THRESHOLD = 1
  await betTx2.wait();
  console.log("✅ User2 bet 0.5 ETH on BELOW threshold");
  
  // Test 4: Check market state after bets
  console.log("\n📈 Test 4: Market state after bets...");
  const [, , , , , , , aboveBets, belowBets, bettorCount, ,] = await market.getMarketInfo();
  console.log("Market State:");
  console.log("  - Total Above Bets:", ethers.formatEther(aboveBets), "ETH");
  console.log("  - Total Below Bets:", ethers.formatEther(belowBets), "ETH");
  console.log("  - Total Bettors:", bettorCount.toString());
  console.log("  - Total Value Locked:", ethers.formatEther(await market.getTotalValueLocked()), "ETH");
  
  // Test 5: Check user bets
  console.log("\n👥 Test 5: User bet information...");
  const user1Bets = await market.getUserBets(user1.address);
  const user2Bets = await market.getUserBets(user2.address);
  
  console.log("User1 Bets:");
  for (let i = 0; i < user1Bets[0].length; i++) {
    console.log(`  - Bet ${user1Bets[0][i]}: ${ethers.formatEther(user1Bets[1][i])} ETH on ${user1Bets[2][i] === 0n ? 'ABOVE' : 'BELOW'}`);
  }
  
  console.log("User2 Bets:");
  for (let i = 0; i < user2Bets[0].length; i++) {
    console.log(`  - Bet ${user2Bets[0][i]}: ${ethers.formatEther(user2Bets[1][i])} ETH on ${user2Bets[2][i] === 0n ? 'ABOVE' : 'BELOW'}`);
  }
  
  // Test 6: Factory statistics
  console.log("\n🏭 Test 6: Factory statistics...");
  const [totalMarkets, activeMarkets, resolvedMarkets, defaultOracle] = await factory.getFactoryStats();
  console.log("Factory Stats:");
  console.log("  - Total Markets Created:", totalMarkets.toString());
  console.log("  - Active Markets:", activeMarkets.toString());
  console.log("  - Resolved Markets:", resolvedMarkets.toString());
  console.log("  - Default Oracle:", defaultOracle);
  
  // Test 7: Get markets by creator
  console.log("\n👤 Test 7: Markets by creator...");
  const user1Markets = await factory.getMarketsByCreator(user1.address);
  console.log("User1 created markets:", user1Markets.length);
  user1Markets.forEach((addr, i) => console.log(`  - Market ${i}: ${addr}`));
  
  // Test 8: Batch create markets (demo)
  console.log("\n🚀 Test 8: Creating multiple markets in batch...");
  
  const descriptions = [
    "Will there be more than 500 transactions in next 30 minutes?",
    "Will there be more than 2000 transactions in next 2 hours?",
  ];
  const thresholds = [500, 2000];
  const deadlines = [
    Math.floor(Date.now() / 1000) + 7200, // 2 hours (safe minimum)
    Math.floor(Date.now() / 1000) + 14400, // 4 hours
  ];
  
  const batchTx = await factory.connect(user2).batchCreateMarkets(
    descriptions,
    thresholds,
    deadlines,
    await factory.defaultOracle()
  );
  await batchTx.wait();
  
  console.log("✅ Batch created 2 markets");
  
  // Final stats
  const finalStats = await factory.getFactoryStats();
  console.log("\n📊 Final Factory Stats:");
  console.log("  - Total Markets Created:", finalStats[0].toString());
  console.log("  - Active Markets:", finalStats[1].toString());
  
  // Get all markets
  const allMarkets = await factory.getAllMarkets();
  console.log("\n🏪 All Markets:");
  allMarkets.forEach((addr, i) => console.log(`  - Market ${i}: ${addr}`));
  
  console.log("\n✅ Factory testing completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });