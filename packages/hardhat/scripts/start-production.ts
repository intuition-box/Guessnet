import { OracleService } from "./oracle-service";

/**
 * Script de lancement pour la production
 * Lance le service Oracle avec une configuration optimisée pour la production
 */

async function main() {
  console.log("🚀 Starting Oracle Production Service");
  console.log("====================================");
  
  try {
    // Variables d'environnement requises
    if (!process.env.ORACLE_CONTRACT_ADDRESS || !process.env.FACTORY_CONTRACT_ADDRESS) {
      console.error("❌ Missing required environment variables:");
      console.error("   ORACLE_CONTRACT_ADDRESS");
      console.error("   FACTORY_CONTRACT_ADDRESS");
      console.error("💡 Run deployment first or set these variables");
      process.exit(1);
    }

    // Créer et initialiser le service Oracle
    const oracleService = new OracleService();
    const initialized = await oracleService.initialize();
    
    if (!initialized) {
      console.error("❌ Failed to initialize Oracle Service");
      process.exit(1);
    }

    // Gestion gracieuse de l'arrêt
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      process.exit(0);
    };

    // Écouter les signaux d'arrêt
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Gestion des erreurs non capturées
    process.on('unhandledRejection', (reason) => {
      console.error('❌ Unhandled Rejection:', reason);
    });

    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      process.exit(1);
    });

    console.log("\n🎯 Production Service Starting...");
    console.log("  - Oracle Address:", process.env.ORACLE_CONTRACT_ADDRESS);
    console.log("  - Factory Address:", process.env.FACTORY_CONTRACT_ADDRESS);
    console.log("  - Process ID:", process.pid);

    // Démarrer le service
    await oracleService.startService();
    
  } catch (error) {
    console.error("❌ Failed to start production service:", error);
    process.exit(1);
  }
}

// Lancer le service
main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});