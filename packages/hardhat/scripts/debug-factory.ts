import { ethers } from "hardhat";

/**
 * Script de debug pour identifier le problème avec la Factory
 */

async function main() {
  const [deployer, user1] = await ethers.getSigners();
  
  console.log("🔍 Debugging Factory Issue");
  console.log("===========================");
  console.log("👤 Deployer:", deployer.address);
  console.log("👤 User1:", user1.address);

  // Récupérer les contrats
  const oracle = await ethers.getContract("PredictionMarketOracle");
  const factory = await ethers.getContract("PredictionMarketFactory");
  
  const oracleAddress = await oracle.getAddress();
  const factoryAddress = await factory.getAddress();
  
  console.log("🏛️ Oracle:", oracleAddress);
  console.log("🏭 Factory:", factoryAddress);
  
  // Vérifier l'oracle par défaut de la factory
  const defaultOracle = await factory.defaultOracle();
  console.log("🔮 Factory Default Oracle:", defaultOracle);
  console.log("✅ Oracle matches:", defaultOracle === oracleAddress);

  // Test avec des paramètres simples
  console.log("\n🧪 Testing with simple parameters...");
  
  // Récupérer le block timestamp actuel depuis le contrat
  const block = await ethers.provider.getBlock("latest");
  const blockTimestamp = block?.timestamp || Math.floor(Date.now() / 1000);
  
  const description = "Test market";
  const threshold = 1000;
  const deadline = blockTimestamp + 3700; // 1 heure + 100 secondes de marge
  
  console.log("📋 Parameters:");
  console.log("  - Description:", description);
  console.log("  - Threshold:", threshold);
  console.log("  - Block Timestamp:", blockTimestamp, "(" + new Date(blockTimestamp * 1000).toISOString() + ")");
  console.log("  - Deadline:", deadline, "(" + new Date(deadline * 1000).toISOString() + ")");
  console.log("  - Oracle:", oracleAddress);

  try {
    // Tenter de créer un marché
    console.log("\n🎯 Attempting to create market...");
    
    const tx = await factory.connect(user1).createTransactionMarket(
      description,
      threshold,
      deadline,
      oracleAddress
    );
    
    console.log("⏳ Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Market created successfully!");
    console.log("⛽ Gas used:", receipt?.gasUsed.toString());
    
  } catch (error: any) {
    console.error("❌ Failed to create market:", error.message);
    
    // Essayer avec l'oracle par défaut (pas de custom oracle)
    console.log("\n🔄 Trying with default oracle (address(0))...");
    
    try {
      const tx2 = await factory.connect(user1).createTransactionMarket(
        description,
        threshold,
        deadline,
        ethers.ZeroAddress // Utiliser l'oracle par défaut
      );
      
      console.log("⏳ Transaction sent:", tx2.hash);
      const receipt2 = await tx2.wait();
      console.log("✅ Market created successfully with default oracle!");
      console.log("⛽ Gas used:", receipt2?.gasUsed.toString());
      
    } catch (error2: any) {
      console.error("❌ Also failed with default oracle:", error2.message);
      
      // Essayer avec le deployer comme oracle
      console.log("\n🔄 Trying with deployer as oracle...");
      
      try {
        const tx3 = await factory.connect(user1).createTransactionMarket(
          description,
          threshold,
          deadline,
          deployer.address
        );
        
        console.log("⏳ Transaction sent:", tx3.hash);
        const receipt3 = await tx3.wait();
        console.log("✅ Market created successfully with deployer as oracle!");
        console.log("⛽ Gas used:", receipt3?.gasUsed.toString());
        
      } catch (error3: any) {
        console.error("❌ All attempts failed:", error3.message);
        
        // Afficher l'erreur décodée si possible
        if (error3.data) {
          console.log("🔍 Error data:", error3.data);
        }
      }
    }
  }

  // Vérifier les constantes de la Factory
  console.log("\n📊 Factory Constants Check:");
  try {
    console.log("⏰ MIN_MARKET_DURATION:", "1 hour"); // Constante
    console.log("⏰ MAX_MARKET_DURATION:", "365 days"); // Constante
    console.log("🔢 MIN_TRANSACTION_THRESHOLD:", "1"); // Constante
    console.log("🔢 MAX_TRANSACTION_THRESHOLD:", "1000000000"); // Constante
    
    // Vérifier si nos paramètres respectent les contraintes
    const minDeadline = blockTimestamp + 3600; // 1 heure minimum
    const maxDeadline = blockTimestamp + (365 * 24 * 3600); // 365 jours maximum
    
    console.log("\n✅ Parameter Validation:");
    console.log("  - Threshold (1000) >= 1:", threshold >= 1);
    console.log("  - Threshold (1000) <= 1B:", threshold <= 1000000000);
    console.log("  - Deadline > now + 1h:", deadline >= minDeadline);
    console.log("  - Deadline < now + 365d:", deadline <= maxDeadline);
    console.log("  - Description not empty:", description.length > 0);
    
  } catch (error) {
    console.error("❌ Error checking constraints:", error);
  }

  console.log("\n🎯 Debug completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });