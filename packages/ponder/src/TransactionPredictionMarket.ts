import { ponder } from "@/generated";
import { bet, market, user, oracle, marketStats } from "../ponder.schema";

// Track bet placements
ponder.on("TransactionPredictionMarket:BetPlaced", async ({ event, context }) => {
  const betId = `${event.log.address}-${event.args.bettor}-${event.block.timestamp}`;
  const betType = event.args.betType === 0 ? "ABOVE_THRESHOLD" : "BELOW_THRESHOLD";
  
  // Create bet entry
  await context.db.insert(bet).values({
    id: betId,
    marketAddress: event.log.address,
    marketId: event.log.address,
    bettor: event.args.bettor,
    amount: event.args.amount,
    betType: betType,
    timestamp: BigInt(event.block.timestamp),
    claimed: false,
  });
  
  // Update market stats using Store API
  const existingMarket = await context.db.find(market, { id: event.log.address });
  if (existingMarket) {
    await context.db.update(market, { id: event.log.address }).set({
      totalBets: existingMarket.totalBets + event.args.amount,
      totalAboveBets: existingMarket.totalAboveBets + (betType === "ABOVE_THRESHOLD" ? event.args.amount : 0n),
      totalBelowBets: existingMarket.totalBelowBets + (betType === "BELOW_THRESHOLD" ? event.args.amount : 0n),
      bettorsCount: existingMarket.bettorsCount + 1,
    });
  }
  
  // Upsert user stats
  await context.db.insert(user).values({
    id: event.args.bettor,
    totalBetsPlaced: event.args.amount,
    totalWinnings: 0n,
    totalMarketsCreated: 0,
    betsWon: 0,
    betsLost: 0,
    lastActivity: BigInt(event.block.timestamp),
  }).onConflictDoUpdate((row) => ({
    totalBetsPlaced: row.totalBetsPlaced + event.args.amount,
    lastActivity: BigInt(event.block.timestamp),
  }));
  
  // Simple hourly stats tracking
  const hourlyTimestamp = BigInt(Math.floor(Number(event.block.timestamp) / 3600) * 3600);
  const statsId = `${event.log.address}-${hourlyTimestamp}`;
  
  await context.db
    .insert(marketStats)
    .values({
      id: statsId,
      marketAddress: event.log.address,
      marketId: event.log.address,
      timestamp: hourlyTimestamp,
      hourlyVolume: event.args.amount,
      hourlyBetsCount: 1,
      aboveBetsRatio: betType === "ABOVE_THRESHOLD" ? 1.0 : 0.0,
      belowBetsRatio: betType === "BELOW_THRESHOLD" ? 1.0 : 0.0,
    })
    .onConflictDoNothing();
});

// Track market resolutions
ponder.on("TransactionPredictionMarket:MarketResolved", async ({ event, context }) => {
  const winningType = event.args.winningBetType === 0 ? "ABOVE_THRESHOLD" : "BELOW_THRESHOLD";
  
  // Update market with resolution data
  await context.db.update(market, { id: event.log.address }).set({
    status: "RESOLVED",
    isActive: false,
    resolvedAt: BigInt(event.block.timestamp),
    actualTransactionCount: event.args.actualTransactionCount,
    winningType: winningType,
  });
  
  // Update oracle stats - first get the market to find oracle
  const marketRecord = await context.db.find(market, { id: event.log.address });
  if (marketRecord) {
    const existingOracle = await context.db.find(oracle, { id: marketRecord.oracle });
    if (existingOracle) {
      await context.db.update(oracle, { id: marketRecord.oracle }).set({
        totalMarketsResolved: existingOracle.totalMarketsResolved + 1,
        lastResolvedAt: BigInt(event.block.timestamp),
      });
    }
  }
});

// Track winnings claims
ponder.on("TransactionPredictionMarket:WinningsClaimed", async ({ event, context }) => {
  // For bets, we need to find the bet to update - this is complex without a compound query
  // For now, let's update the first matching bet
  // In a real implementation, you'd want a better way to identify the specific bet
  
  // Update user winnings
  const existingUser = await context.db.find(user, { id: event.args.winner });
  if (existingUser) {
    await context.db.update(user, { id: event.args.winner }).set({
      totalWinnings: existingUser.totalWinnings + event.args.amount,
    });
  }
  
  // Update market total claimed
  const existingMarket = await context.db.find(market, { id: event.log.address });
  if (existingMarket) {
    await context.db.update(market, { id: event.log.address }).set({
      totalClaimed: (existingMarket.totalClaimed || 0n) + event.args.amount,
    });
  }
});