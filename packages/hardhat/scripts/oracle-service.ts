import { ethers } from "hardhat";
import axios from 'axios';
import * as cron from 'node-cron';

/**
 * Service Oracle - Alimente le contrat Oracle avec les données d'Intuition
 * et résout automatiquement les marchés expirés
 */

interface IntuitionStatsResponse {
  total_transactions: string;
  transactions_today: string;
  total_blocks: string;
  total_addresses: string;
  average_block_time: number;
}

class OracleService {
  private apiUrl = 'https://intuition-testnet.explorer.caldera.xyz/api/v2/stats';
  private oracleContract: any;
  private factoryContract: any;
  private signer: any;

  constructor() {
    console.log('🔮 Oracle Service Starting...');
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('🔧 Initializing Oracle Service...');

      // Get signer
      const [deployer] = await ethers.getSigners();
      this.signer = deployer;
      console.log(`👤 Oracle Operator: ${deployer.address}`);

      // Get deployed contracts
      const oracleAddress = process.env.ORACLE_CONTRACT_ADDRESS;
      const factoryAddress = process.env.FACTORY_CONTRACT_ADDRESS;

      if (!oracleAddress || !factoryAddress) {
        console.log('❌ Missing contract addresses. Run deployment first.');
        return false;
      }

      // Connect to contracts
      this.oracleContract = await ethers.getContractAt("PredictionMarketOracle", oracleAddress);
      this.factoryContract = await ethers.getContractAt("PredictionMarketFactory", factoryAddress);

      console.log(`🏭 Factory Contract: ${factoryAddress}`);
      console.log(`🔮 Oracle Contract: ${oracleAddress}`);

      // Test API connection
      const apiConnected = await this.testApiConnection();
      if (!apiConnected) {
        console.log('❌ Cannot connect to Intuition API');
        return false;
      }

      console.log('✅ Oracle Service initialized successfully');
      return true;

    } catch (error: any) {
      console.error('❌ Failed to initialize Oracle Service:', error.message);
      return false;
    }
  }

  async testApiConnection(): Promise<boolean> {
    try {
      const response = await axios.get<IntuitionStatsResponse>(this.apiUrl, {
        headers: { 'accept': 'application/json' },
        timeout: 10000
      });

      if (response.status === 200) {
        console.log('✅ Intuition API: Connected');
        console.log(`📊 Current TX Count: ${parseInt(response.data.total_transactions).toLocaleString()}`);
        return true;
      }
      return false;

    } catch (error: any) {
      console.error('❌ API Connection Failed:', error.message);
      return false;
    }
  }

  async updateOracleData(): Promise<boolean> {
    try {
      console.log('📡 Fetching latest data from Intuition API...');

      // Get data from API
      const response = await axios.get<IntuitionStatsResponse>(this.apiUrl, {
        timeout: 10000
      });

      const data = response.data;
      const totalTransactions = parseInt(data.total_transactions);
      const timestamp = Math.floor(Date.now() / 1000);

      console.log(`📊 Data: ${totalTransactions.toLocaleString()} transactions`);

      // Update Oracle contract with new data
      console.log('💾 Updating Oracle contract...');
      
      const tx = await this.oracleContract.updateTransactionData(
        totalTransactions,
        timestamp,
        { gasLimit: 300000 }
      );

      const receipt = await tx.wait();
      console.log(`✅ Oracle updated: ${receipt.transactionHash}`);
      
      return true;

    } catch (error: any) {
      console.error('❌ Failed to update Oracle:', error.message);
      return false;
    }
  }

  async checkAndResolveMarkets(): Promise<void> {
    try {
      console.log('🔍 Checking for expired markets...');

      // Get all markets from factory
      const allMarkets = await this.factoryContract.getAllMarkets();
      console.log(`📊 Total markets: ${allMarkets.length}`);

      if (allMarkets.length === 0) {
        console.log('📭 No markets to check');
        return;
      }

      for (let i = 0; i < allMarkets.length; i++) {
        try {
          const marketAddress = allMarkets[i];
          const marketContract = await ethers.getContractAt("TransactionPredictionMarket", marketAddress);

          // Check if market is expired and not resolved
          const deadline = await marketContract.deadline();
          const marketStatus = await marketContract.marketStatus();
          const currentTime = Math.floor(Date.now() / 1000);

          // MarketStatus: 0=ACTIVE, 1=RESOLVED, 2=CANCELLED
          if (currentTime > deadline && marketStatus === 0) {
            console.log(`⏰ Market ${i} expired, resolving...`);
            
            // Resolve market via Oracle
            const tx = await this.oracleContract.resolveMarket(marketAddress, { gasLimit: 500000 });
            const receipt = await tx.wait();
            
            console.log(`✅ Market ${i} resolved: ${receipt.transactionHash}`);
          }

        } catch (error: any) {
          console.error(`❌ Error checking market ${i}:`, error.message);
        }
      }

    } catch (error: any) {
      console.error('❌ Error checking markets:', error.message);
    }
  }

  async startService(): Promise<void> {
    console.log('🚀 Starting Oracle Service...');
    console.log('=====================================');

    // Initial data update
    await this.updateOracleData();
    await this.checkAndResolveMarkets();

    // Schedule regular updates every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      console.log(`\n⏰ ${new Date().toLocaleTimeString()} - Oracle Update`);
      try {
        await this.updateOracleData();
        await this.checkAndResolveMarkets();
      } catch (error: any) {
        console.error('❌ Scheduled update failed:', error.message);
      }
    });

    console.log('✅ Oracle Service is running');
    console.log('📅 Updates: Every 5 minutes');
    console.log('🛑 Press Ctrl+C to stop');
  }

  async stopService(): Promise<void> {
    console.log('\n🛑 Stopping Oracle Service...');
    process.exit(0);
  }
}

async function main() {
  const oracle = new OracleService();
  
  const initialized = await oracle.initialize();
  if (!initialized) {
    console.log('❌ Failed to initialize Oracle Service');
    process.exit(1);
  }

  // Start the service
  await oracle.startService();
}

// Gestion de l'arrêt propre
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, stopping Oracle Service...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, stopping Oracle Service...');
  process.exit(0);
});

// Run the service
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Oracle Service crashed:', error);
    process.exit(1);
  });
}

export { OracleService };