import { onchainTable } from "@ponder/core";

export const factory = onchainTable("factory", (t) => ({
  id: t.text().primaryKey(),
  defaultOracle: t.text().notNull(),
  totalMarketsCreated: t.bigint().notNull(),
  activeMarketsCount: t.bigint().notNull(),
  lastUpdated: t.bigint().notNull(),
}));

export const market = onchainTable("market", (t) => ({
  id: t.text().primaryKey(), // market address
  factoryAddress: t.text().notNull(),
  creator: t.text().notNull(),
  oracle: t.text().notNull(),
  description: t.text().notNull(),
  transactionThreshold: t.bigint().notNull(),
  deadline: t.bigint().notNull(),
  createdAt: t.bigint().notNull(),
  status: t.text().notNull(), // "ACTIVE", "RESOLVED", "CANCELLED"
  isActive: t.boolean().notNull(),
  
  // Betting totals
  totalAboveBets: t.bigint().notNull(),
  totalBelowBets: t.bigint().notNull(),
  totalBets: t.bigint().notNull(),
  bettorsCount: t.integer().notNull(),
  
  // Resolution data
  resolvedAt: t.bigint(),
  actualTransactionCount: t.bigint(),
  winningType: t.text(), // "ABOVE_THRESHOLD" or "BELOW_THRESHOLD"
  totalClaimed: t.bigint(),
}));

export const bet = onchainTable("bet", (t) => ({
  id: t.text().primaryKey(), // marketAddress-bettorAddress-timestamp
  marketAddress: t.text().notNull(),
  bettor: t.text().notNull(),
  amount: t.bigint().notNull(),
  betType: t.text().notNull(), // "ABOVE_THRESHOLD" or "BELOW_THRESHOLD"
  timestamp: t.bigint().notNull(),
  claimed: t.boolean().notNull(),
  claimedAt: t.bigint(),
  winnings: t.bigint(),
  marketId: t.text().notNull(),
}));

export const user = onchainTable("user", (t) => ({
  id: t.text().primaryKey(), // user address
  totalBetsPlaced: t.bigint().notNull(),
  totalWinnings: t.bigint().notNull(),
  totalMarketsCreated: t.integer().notNull(),
  betsWon: t.integer().notNull(),
  betsLost: t.integer().notNull(),
  lastActivity: t.bigint().notNull(),
}));

export const oracle = onchainTable("oracle", (t) => ({
  id: t.text().primaryKey(), // oracle address
  totalMarketsResolved: t.integer().notNull(),
  lastResolvedAt: t.bigint(),
  assignedMarketsCount: t.integer().notNull(),
}));

export const marketStats = onchainTable("market_stats", (t) => ({
  id: t.text().primaryKey(), // marketAddress-hourlyTimestamp
  marketAddress: t.text().notNull(),
  timestamp: t.bigint().notNull(),
  hourlyVolume: t.bigint().notNull(),
  hourlyBetsCount: t.integer().notNull(),
  aboveBetsRatio: t.real().notNull(),
  belowBetsRatio: t.real().notNull(),
  marketId: t.text().notNull(),
}));