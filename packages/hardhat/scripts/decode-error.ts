import { ethers } from "hardhat";

/**
 * Script pour décoder l'erreur 0x679d6ba9
 */

async function main() {
  console.log("🔍 Decoding Error Hash: 0x679d6ba9");
  console.log("=====================================");
  
  // Liste des erreurs possibles du Factory
  const factoryErrors = [
    "PredictionMarketFactory__InvalidDeadline()",
    "PredictionMarketFactory__InvalidThreshold()",
    "PredictionMarketFactory__EmptyDescription()",
    "PredictionMarketFactory__MarketNotFound()",
    "PredictionMarketFactory__InvalidOracleAddress()",
    "PredictionMarketFactory__MarketCreationFailed()"
  ];
  
  // Liste des erreurs possibles du TransactionPredictionMarket
  const marketErrors = [
    "TransactionPredictionMarket__InvalidBetAmount()",
    "TransactionPredictionMarket__InvalidBetType()",
    "TransactionPredictionMarket__MarketNotActive()",
    "TransactionPredictionMarket__MarketAlreadyResolved()",
    "TransactionPredictionMarket__OnlyOracleCanResolve()",
    "TransactionPredictionMarket__MarketNotResolved()",
    "TransactionPredictionMarket__NoWinningsToClaim()",
    "TransactionPredictionMarket__AlreadyClaimedWinnings()",
    "TransactionPredictionMarket__BettingClosed()",
    "TransactionPredictionMarket__InvalidThreshold()",
    "TransactionPredictionMarket__EmptyDescription()"
  ];
  
  const targetHash = "0x679d6ba9";
  
  console.log("🔍 Factory Errors:");
  for (const error of factoryErrors) {
    const hash = ethers.id(error).substring(0, 10);
    const match = hash === targetHash;
    console.log(`  ${match ? '✅' : '❌'} ${error}: ${hash}`);
    if (match) {
      console.log(`  🎯 MATCH FOUND: ${error}`);
    }
  }
  
  console.log("\n🔍 Market Errors:");
  for (const error of marketErrors) {
    const hash = ethers.id(error).substring(0, 10);
    const match = hash === targetHash;
    console.log(`  ${match ? '✅' : '❌'} ${error}: ${hash}`);
    if (match) {
      console.log(`  🎯 MATCH FOUND: ${error}`);
    }
  }
  
  // Liste des erreurs possibles du Oracle
  const oracleErrors = [
    "Oracle__OnlyAuthorizedResolver()",
    "Oracle__MarketNotExpired()",
    "Oracle__MarketAlreadyResolved()",
    "Oracle__InvalidMarketAddress()",
    "Oracle__InvalidTransactionData()",
    "Oracle__ResolverAlreadyExists()",
    "Oracle__ResolverNotFound()",
    "Oracle__EmptyMarketsList()",
    "Oracle__DistributionFailed()"
  ];
  
  console.log("\n🔍 Oracle Errors:");
  for (const error of oracleErrors) {
    const hash = ethers.id(error).substring(0, 10);
    const match = hash === targetHash;
    console.log(`  ${match ? '✅' : '❌'} ${error}: ${hash}`);
    if (match) {
      console.log(`  🎯 MATCH FOUND: ${error}`);
    }
  }
  
  // Erreurs standard OpenZeppelin
  const ozErrors = [
    "ReentrancyGuardReentrantCall()",
    "OwnableUnauthorizedAccount(address)",
    "OwnableInvalidOwner(address)"
  ];
  
  console.log("\n🔍 OpenZeppelin Errors:");
  for (const error of ozErrors) {
    // Pour les erreurs avec paramètres, on prend juste le nom de la fonction
    const errorName = error.split('(')[0] + '()';
    const hash = ethers.id(errorName).substring(0, 10);
    const match = hash === targetHash;
    console.log(`  ${match ? '✅' : '❌'} ${error}: ${hash}`);
    if (match) {
      console.log(`  🎯 MATCH FOUND: ${error}`);
    }
  }
  
  console.log("\n🎯 Target Hash:", targetHash);
  console.log("📋 If no match found, the error might be from a different source or have different signature.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });