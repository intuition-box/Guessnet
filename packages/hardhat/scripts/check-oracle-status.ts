import { ethers } from "hardhat";
import { PredictionMarketOracle, PredictionMarketFactory } from "../typechain-types";

/**
 * Utilitaire pour vérifier le statut de l'Oracle et du système
 */

async function main() {
  console.log("🔍 Checking Oracle System Status");
  console.log("=================================");

  try {
    // Récupérer les contrats
    const oracle = await ethers.getContract('PredictionMarketOracle') as PredictionMarketOracle;
    const factory = await ethers.getContract('PredictionMarketFactory') as PredictionMarketFactory;
    
    const oracleAddress = await oracle.getAddress();
    const factoryAddress = await factory.getAddress();
    
    console.log("🏛️ Contract Addresses:");
    console.log("  - Oracle:", oracleAddress);
    console.log("  - Factory:", factoryAddress);

    // 1. État des données Oracle
    console.log("\n📊 Oracle Data Status:");
    console.log("======================");
    
    const currentData = await oracle.getCurrentTransactionData();
    const isDataFresh = await oracle.isDataFresh();
    
    console.log("📈 Current Data:");
    console.log("  - Total Transactions:", currentData.totalTransactions.toString());
    console.log("  - Last Update:", new Date(Number(currentData.timestamp) * 1000).toISOString());
    console.log("  - Block Number:", currentData.blockNumber.toString());
    console.log("  - Data Valid:", currentData.isValid);
    console.log("  - Data Fresh:", isDataFresh);
    
    // Calculer l'âge des données
    const dataAge = Number(currentData.timestamp) > 0 
      ? Math.floor(Date.now() / 1000) - Number(currentData.timestamp)
      : null;
    
    if (dataAge !== null) {
      console.log("  - Data Age:", Math.floor(dataAge / 60), "minutes", dataAge % 60, "seconds");
      
      if (dataAge > 3600) { // Plus d'1 heure
        console.log("⚠️  WARNING: Data is older than 1 hour");
      } else if (dataAge > 600) { // Plus de 10 minutes
        console.log("⚠️  CAUTION: Data is older than 10 minutes");
      } else {
        console.log("✅ Data age is acceptable");
      }
    }

    // 2. Statistiques Oracle
    console.log("\n📈 Oracle Statistics:");
    console.log("=====================");
    
    const [totalResolved, totalDistributed, activeResolvers] = await oracle.getOracleStats();
    const resolversList = await oracle.getAuthorizedResolvers();
    
    console.log("⚖️  Markets Resolved:", totalResolved.toString());
    console.log("💰 Total Distributed:", ethers.formatEther(totalDistributed), "ETH");
    console.log("👥 Active Resolvers:", activeResolvers.toString());
    
    console.log("\n🔐 Authorized Resolvers:");
    for (let i = 0; i < resolversList.length; i++) {
      console.log(`  ${i + 1}. ${resolversList[i]}`);
    }

    // 3. État des marchés
    console.log("\n🎯 Markets Status:");
    console.log("==================");
    
    const [totalMarkets, activeMarkets, resolvedMarkets] = await factory.getFactoryStats();
    const resolvableMarkets = await oracle.getResolvableMarkets();
    
    console.log("📊 Factory Statistics:");
    console.log("  - Total Markets Created:", totalMarkets.toString());
    console.log("  - Active Markets:", activeMarkets.toString());
    console.log("  - Resolved Markets:", resolvedMarkets.toString());
    console.log("  - Markets Ready for Resolution:", resolvableMarkets.length);
    
    if (resolvableMarkets.length > 0) {
      console.log("\n⚖️ Markets Ready for Resolution:");
      for (let i = 0; i < Math.min(resolvableMarkets.length, 5); i++) {
        console.log(`  ${i + 1}. ${resolvableMarkets[i]}`);
      }
      if (resolvableMarkets.length > 5) {
        console.log(`  ... and ${resolvableMarkets.length - 5} more`);
      }
    }

    // 4. Analyse des marchés actifs
    console.log("\n🟢 Active Markets Analysis:");
    console.log("===========================");
    
    const activeMarketAddresses = await factory.getActiveMarkets();
    console.log("📊 Total Active Markets:", activeMarketAddresses.length);
    
    if (activeMarketAddresses.length > 0) {
      let totalValueLocked = 0n;
      let totalBettors = 0;
      let expiredCount = 0;
      
      for (let i = 0; i < Math.min(activeMarketAddresses.length, 10); i++) {
        try {
          const marketAddr = activeMarketAddresses[i];
          const market = await ethers.getContractAt("TransactionPredictionMarket", marketAddr);
          const [, , description, threshold, deadline, , , , , bettorCount, tvl] = await market.getMarketInfo();
          
          totalValueLocked += tvl;
          totalBettors += Number(bettorCount);
          
          const isExpired = Math.floor(Date.now() / 1000) >= Number(deadline);
          if (isExpired) expiredCount++;
          
          console.log(`\n📋 Market ${i + 1}: ${marketAddr.slice(0, 10)}...`);
          console.log(`  - Description: ${description.length > 50 ? description.slice(0, 50) + '...' : description}`);
          console.log(`  - Threshold: ${threshold.toString()}`);
          console.log(`  - Deadline: ${new Date(Number(deadline) * 1000).toISOString()}`);
          console.log(`  - Value Locked: ${ethers.formatEther(tvl)} ETH`);
          console.log(`  - Bettors: ${bettorCount.toString()}`);
          console.log(`  - Status: ${isExpired ? '🔴 EXPIRED' : '🟢 ACTIVE'}`);
          
        } catch (error) {
          console.log(`❌ Error analyzing market ${i + 1}:`, error);
        }
      }
      
      if (activeMarketAddresses.length > 10) {
        console.log(`\n... and ${activeMarketAddresses.length - 10} more active markets`);
      }
      
      console.log("\n📊 Active Markets Summary:");
      console.log("  - Total Value Locked:", ethers.formatEther(totalValueLocked), "ETH");
      console.log("  - Total Bettors:", totalBettors);
      console.log("  - Expired Markets:", expiredCount);
    }

    // 5. Santé générale du système
    console.log("\n🏥 System Health Check:");
    console.log("========================");
    
    let healthScore = 0;
    let maxScore = 0;
    const issues: string[] = [];
    
    // Vérification des données Oracle
    maxScore += 25;
    if (currentData.isValid && isDataFresh) {
      healthScore += 25;
      console.log("✅ Oracle Data: HEALTHY");
    } else if (currentData.isValid && !isDataFresh) {
      healthScore += 15;
      console.log("⚠️ Oracle Data: STALE");
      issues.push("Oracle data needs refresh");
    } else {
      console.log("❌ Oracle Data: INVALID");
      issues.push("Oracle data is invalid");
    }
    
    // Vérification des résolveurs
    maxScore += 25;
    if (activeResolvers > 0n) {
      healthScore += 25;
      console.log("✅ Resolvers: ACTIVE");
    } else {
      console.log("❌ Resolvers: NONE");
      issues.push("No active resolvers");
    }
    
    // Vérification des marchés
    maxScore += 25;
    if (Number(activeMarkets) > 0) {
      healthScore += 25;
      console.log("✅ Markets: ACTIVE");
    } else {
      healthScore += 10;
      console.log("⚠️ Markets: NONE ACTIVE");
    }
    
    // Vérification de la résolution
    maxScore += 25;
    if (resolvableMarkets.length === 0) {
      healthScore += 25;
      console.log("✅ Resolution: UP TO DATE");
    } else if (resolvableMarkets.length < 5) {
      healthScore += 15;
      console.log("⚠️ Resolution: SOME PENDING");
      issues.push(`${resolvableMarkets.length} markets need resolution`);
    } else {
      healthScore += 5;
      console.log("❌ Resolution: BACKLOG");
      issues.push(`${resolvableMarkets.length} markets need resolution`);
    }
    
    const healthPercentage = Math.round((healthScore / maxScore) * 100);
    
    console.log("\n🎯 Overall System Health:", healthPercentage + "%");
    
    if (healthPercentage >= 90) {
      console.log("🟢 Status: EXCELLENT");
    } else if (healthPercentage >= 70) {
      console.log("🟡 Status: GOOD");
    } else if (healthPercentage >= 50) {
      console.log("🟠 Status: NEEDS ATTENTION");
    } else {
      console.log("🔴 Status: CRITICAL");
    }
    
    if (issues.length > 0) {
      console.log("\n⚠️ Issues Found:");
      issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });
    }

    // 6. Recommandations
    console.log("\n💡 Recommendations:");
    console.log("===================");
    
    if (!isDataFresh) {
      console.log("📡 Run the API service to update Oracle data");
      console.log("   yarn hardhat run scripts/start-production.ts");
    }
    
    if (resolvableMarkets.length > 0) {
      console.log("⚖️ Resolve expired markets manually:");
      console.log("   yarn hardhat run scripts/resolve-markets.ts");
    }
    
    if (Number(activeMarkets) === 0) {
      console.log("🎯 Create some test markets:");
      console.log("   yarn hardhat run scripts/test-factory.ts");
    }
    
    console.log("\n✅ Status check completed!");
    
  } catch (error) {
    console.error("❌ Error checking Oracle status:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });