import { ethers } from "hardhat";
import axios from "axios";

const PONDER_URL = process.env.PONDER_URL || "http://localhost:42069";
const ORACLE_CONTRACT_ADDRESS = process.env.ORACLE_CONTRACT_ADDRESS;
const FACTORY_CONTRACT_ADDRESS = process.env.FACTORY_CONTRACT_ADDRESS;

// GraphQL query to get markets ready for resolution
const GET_RESOLVABLE_MARKETS = `
  query GetResolvableMarkets($currentTimestamp: BigInt!) {
    markets(
      where: { 
        status: "ACTIVE",
        deadline_lte: $currentTimestamp
      }
    ) {
      items {
        id
        description
        transactionThreshold
        deadline
        oracle
        totalAboveBets
        totalBelowBets
      }
    }
  }
`;

// GraphQL query to get market bets for Intuition check
const GET_MARKET_BETTORS = `
  query GetMarketBettors($marketAddress: String!) {
    bets(where: { marketAddress: $marketAddress }) {
      items {
        bettor
        betType
        amount
      }
    }
  }
`;

interface IntuitionAPIResponse {
  address: string;
  transactionCount: number;
}

async function fetchFromPonder(query: string, variables: any) {
  try {
    const response = await axios.post(PONDER_URL, {
      query,
      variables,
    });
    
    if (response.data.errors) {
      throw new Error(response.data.errors[0].message);
    }
    
    return response.data.data;
  } catch (error) {
    console.error("Error fetching from Ponder:", error);
    throw error;
  }
}

async function fetchIntuitionData(): Promise<number> {
  // Fetch total transactions from Intuition API
  console.log("Fetching total transactions from Intuition API...");
  
  try {
    const response = await axios.get('https://intuition-testnet.explorer.caldera.xyz/api/v2/stats');
    const totalTransactions = response.data?.total_transactions || "0";
    const transactionCount = parseInt(totalTransactions.replace(/,/g, ''));
    
    console.log(`Intuition API - Total transactions: ${transactionCount}`);
    return transactionCount;
  } catch (error) {
    console.error("Error fetching Intuition data:", error);
    throw error;
  }
}

async function getActualTransactionCount(): Promise<number> {
  // For TransactionPredictionMarket, we care about the total blockchain transactions
  // not individual user transactions
  return await fetchIntuitionData();
}

async function resolveMarkets() {
  console.log("Oracle Service: Starting market resolution check...");
  
  try {
    // Get current timestamp as string for GraphQL BigInt type
    const currentTimestamp = Math.floor(Date.now() / 1000).toString();
    
    // Fetch markets ready for resolution from Ponder
    const marketsData = await fetchFromPonder(GET_RESOLVABLE_MARKETS, { 
      currentTimestamp 
    });
    
    const markets = marketsData.markets?.items || [];
    console.log(`Found ${markets.length} markets ready for resolution`);
    
    if (markets.length === 0) {
      console.log("No markets to resolve");
      return;
    }
    
    // Connect to Oracle contract
    const [signer] = await ethers.getSigners();
    const oracleContract = await ethers.getContractAt(
      "PredictionMarketOracle",
      ORACLE_CONTRACT_ADDRESS!,
      signer
    );
    
    // Process each market
    for (const market of markets) {
      console.log(`\nProcessing market: ${market.id}`);
      console.log(`Description: ${market.description}`);
      console.log(`Threshold: ${market.transactionThreshold}`);
      
      try {
        // Check if this oracle is authorized for this market
        if (market.oracle.toLowerCase() !== ORACLE_CONTRACT_ADDRESS?.toLowerCase()) {
          console.log(`Skipping - different oracle: ${market.oracle}`);
          continue;
        }
        
        // Get actual transaction count from Intuition API
        const actualCount = await getActualTransactionCount();
        console.log(`Actual transaction count: ${actualCount}`);
        
        // Resolve market through Oracle contract
        console.log("Sending resolution transaction...");
        const tx = await oracleContract.resolveMarket(
          market.id,
          actualCount,
          { gasLimit: 500000 }
        );
        
        console.log(`Transaction hash: ${tx.hash}`);
        await tx.wait();
        console.log(`✅ Market ${market.id} resolved successfully`);
        
      } catch (error) {
        console.error(`Error resolving market ${market.id}:`, error);
      }
    }
    
  } catch (error) {
    console.error("Error in oracle service:", error);
  }
}

async function main() {
  if (!ORACLE_CONTRACT_ADDRESS || !FACTORY_CONTRACT_ADDRESS) {
    console.error("Please set ORACLE_CONTRACT_ADDRESS and FACTORY_CONTRACT_ADDRESS environment variables");
    process.exit(1);
  }
  
  console.log("Oracle Service Configuration:");
  console.log("- Ponder URL:", PONDER_URL);
  console.log("- Oracle Contract:", ORACLE_CONTRACT_ADDRESS);
  console.log("- Factory Contract:", FACTORY_CONTRACT_ADDRESS);
  console.log("");
  
  // Run once on start
  await resolveMarkets();
  
  // Then run every 5 minutes
  console.log("Oracle service started. Checking for markets to resolve every 5 minutes...");
  setInterval(resolveMarkets, 5 * 60 * 1000);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});