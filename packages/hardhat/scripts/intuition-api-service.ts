import axios, { AxiosResponse } from 'axios';
import { ethers } from 'hardhat';
import * as cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { PredictionMarketOracle } from '../typechain-types';

/**
 * Service d'intégration avec l'API Intuition
 * Récupère les données blockchain en temps réel et alimente l'Oracle
 * 
 * Basé sur la documentation : https://testnet.explorer.intuition.systems/api-docs
 */

/**
 * Interface pour la réponse de l'API Intuition Stats
 * Basée sur l'exemple de réponse dans task.md
 */
interface IntuitionStatsResponse {
  average_block_time: number;
  coin_image?: string | null;
  coin_price?: string | null;
  coin_price_change_percentage?: string | null;
  gas_price_updated_at: string;
  gas_prices: {
    slow: number;
    average: number;
    fast: number;
  };
  gas_prices_update_in: number;
  gas_used_today: string;
  market_cap: string;
  network_utilization_percentage: number;
  secondary_coin_image?: string | null;
  secondary_coin_price?: string | null;
  static_gas_price?: string | null;
  total_addresses: string;
  total_blocks: string;
  total_gas_used: string;
  total_transactions: string;
  transactions_today: string;
  tvl?: string | null;
}

/**
 * Configuration du service
 */
interface ServiceConfig {
  apiUrl: string;
  updateInterval: string; // Format cron
  retryAttempts: number;
  retryDelay: number;
  timeout: number;
  enableLogging: boolean;
  logFilePath: string;
}

/**
 * Statistiques de performance du service
 */
interface ServiceStats {
  startTime: Date;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  lastSuccessfulUpdate: Date | null;
  lastError: string | null;
  oracleUpdates: number;
  marketsResolved: number;
}

class IntuitionApiService {
  private oracle: PredictionMarketOracle;
  private config: ServiceConfig;
  private stats: ServiceStats;
  private cronJob?: cron.ScheduledTask;
  private logStream?: fs.WriteStream;
  private isRunning = false;

  constructor(oracle: PredictionMarketOracle, config?: Partial<ServiceConfig>) {
    this.oracle = oracle;
    
    // Configuration par défaut
    this.config = {
      apiUrl: 'https://intuition-testnet.explorer.caldera.xyz/api/v2/stats',
      updateInterval: '*/5 * * * *', // Toutes les 5 minutes
      retryAttempts: 3,
      retryDelay: 5000, // 5 secondes
      timeout: 10000, // 10 secondes
      enableLogging: true,
      logFilePath: './logs/intuition-api-service.log',
      ...config
    };

    // Initialisation des statistiques
    this.stats = {
      startTime: new Date(),
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      lastSuccessfulUpdate: null,
      lastError: null,
      oracleUpdates: 0,
      marketsResolved: 0
    };
  }

  /**
   * Initialise le système de logging
   */
  private initializeLogging(): void {
    if (!this.config.enableLogging) return;

    try {
      const logDir = path.dirname(this.config.logFilePath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      this.logStream = fs.createWriteStream(this.config.logFilePath, { flags: 'a' });
      this.log('📝 Logging initialized for Intuition API Service');
    } catch (error) {
      console.error('❌ Failed to initialize logging:', error);
    }
  }

  /**
   * Logger personnalisé avec timestamp
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    
    console.log(logMessage);
    
    if (this.logStream) {
      this.logStream.write(logMessage + '\n');
    }
  }

  /**
   * Récupère les données depuis l'API Intuition avec retry logic
   */
  private async fetchIntuitionStats(attempt = 1): Promise<IntuitionStatsResponse> {
    try {
      this.log(`🔍 Fetching data from Intuition API (attempt ${attempt}/${this.config.retryAttempts})...`);
      
      const response: AxiosResponse<IntuitionStatsResponse> = await axios.get(
        this.config.apiUrl,
        {
          headers: {
            'accept': 'application/json'
          },
          timeout: this.config.timeout
        }
      );

      if (response.status !== 200) {
        throw new Error(`API returned status ${response.status}`);
      }

      this.log('✅ Successfully fetched data from Intuition API');
      return response.data;

    } catch (error: any) {
      this.log(`❌ API request failed (attempt ${attempt}): ${error.message}`);
      
      // Retry logic
      if (attempt < this.config.retryAttempts) {
        this.log(`⏳ Waiting ${this.config.retryDelay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        return this.fetchIntuitionStats(attempt + 1);
      }
      
      throw error;
    }
  }

  /**
   * Met à jour l'Oracle avec les données de l'API
   */
  private async updateOracle(data: IntuitionStatsResponse): Promise<void> {
    try {
      this.log('📤 Updating Oracle with Intuition API data...');
      
      // Conversion des données string en BigInt pour Solidity
      const totalTransactions = BigInt(data.total_transactions);
      const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));

      this.log(`📊 Data to update: ${totalTransactions.toString()} total transactions`);

      // Estimation du gas avant la transaction
      const estimatedGas = await this.oracle.updateTransactionData.estimateGas(
        totalTransactions,
        currentTimestamp
      );

      // Ajout d'un buffer de 20% sur l'estimation de gas
      const gasLimit = (estimatedGas * 120n) / 100n;

      // Envoi de la transaction
      const tx = await this.oracle.updateTransactionData(
        totalTransactions,
        currentTimestamp,
        {
          gasLimit: gasLimit
        }
      );

      this.log('⏳ Transaction sent to Oracle, waiting for confirmation...');
      this.log(`📋 Transaction hash: ${tx.hash}`);

      const receipt = await tx.wait();
      
      if (receipt?.status === 1) {
        this.stats.oracleUpdates++;
        this.log('✅ Oracle updated successfully!');
        this.log(`📊 Updated with ${totalTransactions.toString()} total transactions`);
        this.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);
      } else {
        throw new Error('Transaction failed');
      }

    } catch (error: any) {
      this.log(`❌ Failed to update Oracle: ${error.message}`);
      throw error;
    }
  }

  /**
   * Vérifie et résout les marchés expirés
   */
  private async resolveExpiredMarkets(): Promise<void> {
    try {
      this.log('⚖️ Checking for expired markets to resolve...');
      
      // Vérifier si nous pouvons résoudre des marchés
      const resolvableMarkets = await this.oracle.getResolvableMarkets();
      
      if (resolvableMarkets.length === 0) {
        this.log('✅ No expired markets found');
        return;
      }

      this.log(`📊 Found ${resolvableMarkets.length} expired markets to resolve`);

      // Résoudre tous les marchés expirés
      const tx = await this.oracle.closeAllExpiredMarkets();
      const receipt = await tx.wait();

      if (receipt?.status === 1) {
        this.stats.marketsResolved += resolvableMarkets.length;
        this.log('✅ All expired markets resolved successfully!');
        this.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);
      }

    } catch (error: any) {
      this.log(`❌ Failed to resolve expired markets: ${error.message}`);
      // Ne pas throw ici pour ne pas arrêter le service
    }
  }

  /**
   * Cycle complet de mise à jour
   */
  private async updateCycle(): Promise<void> {
    try {
      this.log('\n🔄 Starting update cycle...');
      this.stats.totalRequests++;

      // 1. Récupérer les données de l'API Intuition
      const apiData = await this.fetchIntuitionStats();
      this.stats.successfulRequests++;
      this.stats.lastSuccessfulUpdate = new Date();

      // Afficher les données importantes
      this.log('📈 API Data Summary:');
      this.log(`  - Total Transactions: ${parseInt(apiData.total_transactions).toLocaleString()}`);
      this.log(`  - Transactions Today: ${parseInt(apiData.transactions_today).toLocaleString()}`);
      this.log(`  - Total Blocks: ${parseInt(apiData.total_blocks).toLocaleString()}`);
      this.log(`  - Total Addresses: ${parseInt(apiData.total_addresses).toLocaleString()}`);
      this.log(`  - Average Block Time: ${apiData.average_block_time}ms`);

      // 2. Mettre à jour l'Oracle
      await this.updateOracle(apiData);

      // 3. Résoudre les marchés expirés
      await this.resolveExpiredMarkets();

      this.log('✅ Update cycle completed successfully\n');

    } catch (error: any) {
      this.stats.failedRequests++;
      this.stats.lastError = error.message;
      this.log(`❌ Update cycle failed: ${error.message}\n`);
    }
  }

  /**
   * Affiche les statistiques de performance
   */
  private async printStats(): Promise<void> {
    const uptime = Date.now() - this.stats.startTime.getTime();
    const successRate = this.stats.totalRequests > 0 
      ? (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2)
      : '0';

    // Récupérer les stats de l'Oracle
    const [totalResolved, totalDistributed, activeResolvers] = await this.oracle.getOracleStats();
    
    // Vérifier l'état des données
    const currentData = await this.oracle.getCurrentTransactionData();
    const isDataFresh = await this.oracle.isDataFresh();

    this.log('\n📊 Service Performance Statistics');
    this.log('==================================');
    this.log(`⏱️  Service Uptime: ${Math.floor(uptime / 1000)} seconds`);
    this.log(`📡 Total API Requests: ${this.stats.totalRequests}`);
    this.log(`✅ Successful Requests: ${this.stats.successfulRequests} (${successRate}%)`);
    this.log(`❌ Failed Requests: ${this.stats.failedRequests}`);
    this.log(`🔄 Oracle Updates: ${this.stats.oracleUpdates}`);
    this.log(`⚖️ Markets Resolved: ${this.stats.marketsResolved}`);
    this.log(`⏰ Last Success: ${this.stats.lastSuccessfulUpdate?.toISOString() || 'Never'}`);
    this.log(`🚨 Last Error: ${this.stats.lastError || 'None'}`);
    
    this.log('\n🔮 Oracle Status');
    this.log('================');
    this.log(`📊 Current Transactions: ${currentData.totalTransactions.toString()}`);
    this.log(`⏰ Data Fresh: ${isDataFresh}`);
    this.log(`📈 Total Markets Resolved: ${totalResolved.toString()}`);
    this.log(`💰 Total Distributed: ${ethers.formatEther(totalDistributed)} ETH`);
    this.log(`👥 Active Resolvers: ${activeResolvers.toString()}`);
  }

  /**
   * Démarre le service automatisé
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.log('⚠️ Service is already running');
      return;
    }

    this.log('🚀 Starting Intuition API Service...');
    
    // Initialiser le logging
    this.initializeLogging();
    
    // Vérifier la connexion à l'Oracle
    try {
      const oracleAddress = await this.oracle.getAddress();
      const [deployer] = await ethers.getSigners();
      const isAuthorized = await this.oracle.authorizedResolvers(deployer.address);
      
      this.log(`🏛️ Oracle Address: ${oracleAddress}`);
      this.log(`👤 Deployer Address: ${deployer.address}`);
      this.log(`🔐 Is Authorized Resolver: ${isAuthorized}`);
      
      if (!isAuthorized) {
        throw new Error('Current signer is not authorized to update Oracle');
      }
      
    } catch (error: any) {
      this.log(`❌ Oracle connection failed: ${error.message}`);
      throw error;
    }

    this.log(`📡 API Endpoint: ${this.config.apiUrl}`);
    this.log(`⏱️ Update Schedule: ${this.config.updateInterval}`);
    this.log(`🔄 Retry Attempts: ${this.config.retryAttempts}`);
    
    this.isRunning = true;

    // Effectuer une première mise à jour immédiate
    this.log('🎯 Performing initial update...');
    await this.updateCycle();

    // Programmer les mises à jour automatiques
    this.cronJob = cron.schedule(this.config.updateInterval, async () => {
      if (this.isRunning) {
        await this.updateCycle();
      }
    });

    // Programmer l'affichage des statistiques toutes les 30 minutes
    cron.schedule('*/30 * * * *', async () => {
      if (this.isRunning) {
        await this.printStats();
      }
    });

    this.log('✅ Intuition API Service started successfully!');
    this.log('Press Ctrl+C to stop the service');
  }

  /**
   * Arrête le service
   */
  stop(): void {
    if (!this.isRunning) {
      this.log('⚠️ Service is not running');
      return;
    }

    this.log('🛑 Stopping Intuition API Service...');
    
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = undefined;
    }

    if (this.logStream) {
      this.logStream.end();
    }

    this.isRunning = false;
    this.log('✅ Intuition API Service stopped');
  }

  /**
   * Exécute une mise à jour manuelle pour tests
   */
  async manualUpdate(): Promise<void> {
    this.log('🔧 Manual update requested...');
    await this.updateCycle();
  }

  /**
   * Récupère les statistiques actuelles
   */
  getStats(): ServiceStats {
    return { ...this.stats };
  }

  /**
   * Teste la connexion à l'API
   */
  async testApiConnection(): Promise<boolean> {
    try {
      this.log('🧪 Testing API connection...');
      await this.fetchIntuitionStats();
      this.log('✅ API connection test successful');
      return true;
    } catch (error: any) {
      this.log(`❌ API connection test failed: ${error.message}`);
      return false;
    }
  }
}

/**
 * Fonction principale pour lancer le service
 */
async function main() {
  try {
    // Récupérer l'Oracle déployé
    const oracle = await ethers.getContract('PredictionMarketOracle') as PredictionMarketOracle;
    
    // Créer le service avec configuration personnalisée
    const apiService = new IntuitionApiService(oracle, {
      updateInterval: '*/5 * * * *', // Toutes les 5 minutes
      retryAttempts: 3,
      retryDelay: 5000,
      timeout: 15000,
      enableLogging: true
    });

    // Gestion de l'arrêt gracieux
    process.on('SIGINT', async () => {
      console.log('\n🛑 Received interrupt signal...');
      apiService.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Received termination signal...');
      apiService.stop();
      process.exit(0);
    });

    // Test de connexion avant de démarrer
    const isConnected = await apiService.testApiConnection();
    if (!isConnected) {
      console.log('❌ Cannot connect to Intuition API, exiting...');
      process.exit(1);
    }

    // Démarrer le service
    await apiService.start();

    // Maintenir le processus actif
    process.stdin.resume();
    
  } catch (error) {
    console.error('❌ Failed to start Intuition API Service:', error);
    process.exit(1);
  }
}

// Export pour utilisation externe
export { IntuitionApiService, IntuitionStatsResponse };

// Exécuter si appelé directement
if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}