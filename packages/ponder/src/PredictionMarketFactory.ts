import { ponder } from "@/generated";
import { factory, market, user, oracle } from "../ponder.schema";

// Initialize factory stats
ponder.on("PredictionMarketFactory:setup", async ({ context }) => {
  await context.db.insert(factory).values({
    id: "main",
    defaultOracle: "0x0000000000000000000000000000000000000000",
    totalMarketsCreated: 0n,
    activeMarketsCount: 0n,
    lastUpdated: BigInt(Date.now()),
  }).onConflictDoNothing();
});

// Track market creation
ponder.on("PredictionMarketFactory:MarketCreated", async ({ event, context }) => {
  // Get initial liquidity from transaction value
  const initialLiquidity = BigInt(event.transaction.value || 0);
  
  console.log("🔍 DEBUG - Market creation with initial liquidity:", {
    marketAddress: event.args.marketAddress,
    transactionValue: event.transaction.value,
    blockTransactionValue: event.block.transaction?.value,
    initialLiquidity: initialLiquidity.toString(),
    eventArgs: event.args,
    fullTransaction: event.transaction
  });
  
  // Create market entry
  await context.db.insert(market).values({
    id: event.args.marketAddress,
    factoryAddress: event.log.address,
    creator: event.args.creator,
    oracle: event.args.oracle,
    description: event.args.description,
    transactionThreshold: event.args.transactionThreshold,
    deadline: event.args.deadline,
    createdAt: BigInt(event.block.timestamp),
    status: "ACTIVE",
    isActive: true,
    totalAboveBets: 0n,
    totalBelowBets: 0n,
    totalBets: initialLiquidity, // Add initial liquidity to total locked
    bettorsCount: 0,
  });
  
  // Update factory stats
  const factoryRecord = await context.db.find(factory, { id: "main" });
  if (factoryRecord) {
    await context.db.update(factory, { id: "main" }).set({
      totalMarketsCreated: factoryRecord.totalMarketsCreated + 1n,
      activeMarketsCount: factoryRecord.activeMarketsCount + 1n,
      lastUpdated: BigInt(Date.now()),
    });
  }
  
  // Upsert user stats
  await context.db.insert(user).values({
    id: event.args.creator,
    totalBetsPlaced: 0n,
    totalWinnings: 0n,
    totalMarketsCreated: 1,
    betsWon: 0,
    betsLost: 0,
    lastActivity: BigInt(event.block.timestamp),
  }).onConflictDoUpdate((row) => ({
    totalMarketsCreated: row.totalMarketsCreated + 1,
    lastActivity: BigInt(event.block.timestamp),
  }));
  
  // Upsert oracle stats
  await context.db.insert(oracle).values({
    id: event.args.oracle,
    totalMarketsResolved: 0,
    assignedMarketsCount: 1,
  }).onConflictDoUpdate((row) => ({
    assignedMarketsCount: row.assignedMarketsCount + 1,
  }));
});

// Track market status updates
ponder.on("PredictionMarketFactory:MarketStatusUpdated", async ({ event, context }) => {
  const isActive = event.args.isActive;
  
  await context.db.update(market, { id: event.args.marketAddress }).set({
    isActive: isActive,
    status: isActive ? "ACTIVE" : "RESOLVED",
  });
  
  // Update factory active count
  if (!isActive) {
    const factoryRecord = await context.db.find(factory, { id: "main" });
    if (factoryRecord) {
      await context.db.update(factory, { id: "main" }).set({
        activeMarketsCount: factoryRecord.activeMarketsCount - 1n,
        lastUpdated: BigInt(Date.now()),
      });
    }
  }
});

// Track default oracle updates
ponder.on("PredictionMarketFactory:DefaultOracleUpdated", async ({ event, context }) => {
  await context.db.update(factory, { id: "main" }).set({
    defaultOracle: event.args.newOracle,
    lastUpdated: BigInt(Date.now()),
  });
});