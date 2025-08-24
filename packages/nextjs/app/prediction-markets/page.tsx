"use client";

import { useState, useEffect, useCallback } from "react";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { EtherInput } from "~~/components/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import deployedContracts from "~~/contracts/deployedContracts";
import { formatEther, parseEther, Address } from "viem";  
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MarketReader } from "./MarketReader";
import { useWriteContract } from "wagmi";
import { TRANSACTION_PREDICTION_MARKET_ABI } from "./contracts/TransactionPredictionMarketABI";

interface Market {
  address: string;
  description: string;
  threshold: bigint;
  deadline: bigint;
  status: number;
  totalValueLocked: bigint;
  aboveBets: bigint;
  belowBets: bigint;
}

interface ApiData {
  total_transactions: string;
  transactions_today: string;
  timestamp: number;
}

export default function PredictionMarkets() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [apiData, setApiData] = useState<ApiData[]>([]);
  const [currentTransactions, setCurrentTransactions] = useState<string>("0");
  
  // Form states
  const [transactionThreshold, setTransactionThreshold] = useState<string>("");
  const [selectedHours, setSelectedHours] = useState<number>(2); // Default to 2 hours (minimum)
  const [initialLiquidity, setInitialLiquidity] = useState<string>(""); // ETH amount for initial liquidity
  const [betAmount, setBetAmount] = useState<string>("");
  const [selectedMarket, setSelectedMarket] = useState<string>("");
  const [betType, setBetType] = useState<0 | 1>(0); // 0 = ABOVE, 1 = BELOW

  // Contract interactions (keeping for future use)
  // const { data: factory } = useScaffoldContract({
  //   contractName: "PredictionMarketFactory",
  // });

  // const { data: oracle } = useScaffoldContract({
  //   contractName: "PredictionMarketOracle",
  // });

  // Read all markets from factory
  const { data: allMarkets, refetch: refetchMarkets } = useScaffoldReadContract({
    contractName: "PredictionMarketFactory",
    functionName: "getAllMarkets",
  });

  // Write contract functions
  const { writeContractAsync: createMarket } = useScaffoldWriteContract("PredictionMarketFactory");

  // Hook to get market info from factory for first market as example
  const firstMarketAddress = allMarkets?.[0] as Address | undefined;
  const { data: factoryMarketInfo } = useScaffoldReadContract({
    contractName: "PredictionMarketFactory",
    functionName: "getMarketInfoByAddress",
    args: firstMarketAddress ? [firstMarketAddress] : undefined,
    enabled: !!firstMarketAddress
  });

  // REMOVED: getMarketDetails function - we now use only real data from MarketReader components
  // No more placeholder data, only real blockchain data

  // Initialize empty markets array when allMarkets changes
  // Real data will be populated by MarketReader components via handleMarketData callback
  useEffect(() => {
    console.log("🔄 Markets from Factory changed...");
    console.log("allMarkets from Factory:", allMarkets);
    console.log("Deployed contracts:", deployedContracts);
    const factoryAddress = deployedContracts?.[31337]?.PredictionMarketFactory?.address;
    console.log("Factory address:", factoryAddress);
    
    if (allMarkets && allMarkets.length > 0) {
      console.log(`📊 Found ${allMarkets.length} markets from Factory - waiting for MarketReader data...`);
      // Clear markets, will be populated by MarketReader components
      setMarkets([]);
    } else {
      console.log("⚠️ No markets from Factory - clearing market list");
      setMarkets([]);
    }
  }, [allMarkets]);

  // Fetch API data for chart
  useEffect(() => {
    const fetchApiData = async () => {
      try {
        const response = await fetch('https://intuition-testnet.explorer.caldera.xyz/api/v2/stats');
        const data = await response.json();
        
        setCurrentTransactions(data.total_transactions);
        
        // Add to chart data
        const newDataPoint = {
          total_transactions: data.total_transactions,
          transactions_today: data.transactions_today,
          timestamp: Date.now(),
        };
        
        setApiData(prev => [...prev.slice(-20), newDataPoint]); // Keep last 20 points
      } catch (error) {
        console.error('Failed to fetch API data:', error);
      }
    };

    fetchApiData();
    const interval = setInterval(fetchApiData, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const createMarketReal = async () => {
    if (!transactionThreshold || !selectedHours) {
      notification.error("Please fill all fields");
      return;
    }

    try {
      // Calculate deadline from selected hours
      const nowTimestamp = Math.floor(Date.now() / 1000);
      const deadlineTimestamp = nowTimestamp + (selectedHours * 60 * 60); // Convert hours to seconds
      
      const thresholdBigInt = BigInt(transactionThreshold);
      const description = `Will Intuition have more than ${parseInt(transactionThreshold).toLocaleString()} transactions in ${selectedHours} hour${selectedHours > 1 ? 's' : ''}?`;
      
      // Validate parameters (minimum 1 hour already enforced by button selection)
      if (selectedHours < 1) {
        notification.error("Duration must be at least 1 hour");
        return;
      }
      
      if (thresholdBigInt <= 0) {
        notification.error("Threshold must be greater than 0");
        return;
      }

      notification.loading("Creating market...");

      // Use real Oracle contract address
      const oracleAddress = "0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82";
      
      console.log("Creating market with params:", {
        description,
        threshold: thresholdBigInt.toString(),
        deadline: deadlineTimestamp,
        oracle: oracleAddress
      });

      // Call the real Factory contract
      await createMarket({
        functionName: "createTransactionMarket",
        args: [
          description,
          thresholdBigInt,
          BigInt(deadlineTimestamp),
          oracleAddress
        ],
        value: initialLiquidity ? parseEther(initialLiquidity) : BigInt(0),
      });

      notification.success("Market created successfully!");
      
      // Refresh markets list
      setTimeout(() => {
        refetchMarkets();
      }, 2000);
      
      // Reset form
      setTransactionThreshold("");
      setSelectedHours(2);
      setInitialLiquidity("");
      
    } catch (error: any) {
      notification.error(`Failed to create market: ${error.message}`);
    }
  };

  // Write contract function for placing bets on ANY TransactionPredictionMarket
  const { writeContractAsync } = useWriteContract();

  const placeBet = async () => {
    if (!selectedMarket || !betAmount) {
      notification.error("Please select a market and enter bet amount");
      return;
    }

    // VALIDATION: Check if selected market is in allMarkets array from Factory
    console.log("🔍 DEBUG - Validating market selection:");
    console.log("Selected Market:", selectedMarket);
    console.log("All Markets from Factory:", allMarkets);
    const factoryAddress = deployedContracts?.[31337]?.PredictionMarketFactory?.address;
    console.log("Factory Address:", factoryAddress);
    
    if (!allMarkets || !allMarkets.includes(selectedMarket)) {
      console.error("❌ VALIDATION FAILED: Selected market not in Factory's market list!");
      notification.error(`Invalid market selection. Market ${selectedMarket} is not in Factory's list.`);
      return;
    }

    console.log("✅ VALIDATION PASSED: Market exists in Factory's list");

    try {
      notification.loading("Placing bet...");
      
      console.log("🎯 Placing real bet with VALIDATED market:", {
        marketAddress: selectedMarket,
        betType: betType, // 0 = ABOVE, 1 = BELOW
        amount: betAmount,
        value: parseEther(betAmount),
        factoryMarkets: allMarkets,
        isValidMarket: allMarkets?.includes(selectedMarket)
      });
      
      // Call the real placeBet function on VALIDATED TransactionPredictionMarket contract
      await writeContractAsync({
        address: selectedMarket as Address,
        abi: TRANSACTION_PREDICTION_MARKET_ABI,
        functionName: "placeBet",
        args: [betType], // 0 for ABOVE_THRESHOLD, 1 for BELOW_THRESHOLD
        value: parseEther(betAmount),
      });
      
      notification.success(`🎯 Real bet placed: ${betAmount} ETH on ${betType === 0 ? 'ABOVE' : 'BELOW'} threshold!`);
      setBetAmount("");
      setSelectedMarket("");
      
      // Refresh markets after bet
      setTimeout(() => {
        refetchMarkets();
      }, 3000);
      
    } catch (error: any) {
      console.error("Bet placement error:", error);
      notification.error(`Failed to place bet: ${error.shortMessage || error.message || error}`);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatLargeNumber = (num: string) => {
    return parseInt(num).toLocaleString();
  };

  // Callback pour recevoir les données des marchés
  const handleMarketData = useCallback((marketData: any) => {
    console.log("📊 Real market data received:", {
      address: marketData.address,
      threshold: marketData.threshold?.toString(),
      description: marketData.description,
      totalValueLocked: marketData.totalValueLocked?.toString(),
      aboveBets: marketData.aboveBets?.toString(),
      belowBets: marketData.belowBets?.toString()
    });
    
    setMarkets(prev => {
      const filtered = prev.filter(m => m.address !== marketData.address);
      const newMarket: Market = {
        address: marketData.address,
        description: marketData.description || `Market ${marketData.address.slice(0, 8)}...`,
        threshold: marketData.threshold || BigInt(0),
        deadline: marketData.deadline || BigInt(0),
        status: marketData.status || 0,
        totalValueLocked: marketData.totalValueLocked || BigInt(0),
        aboveBets: marketData.aboveBets || BigInt(0),
        belowBets: marketData.belowBets || BigInt(0)
      };
      
      console.log(`✅ Market updated: ${newMarket.address.slice(0, 10)}... - Threshold: ${newMarket.threshold.toString()}`);
      return [...filtered, newMarket];
    });
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Composants pour lire les données de chaque marché */}
      {allMarkets?.map((marketAddress) => (
        <MarketReader 
          key={marketAddress} 
          marketAddress={marketAddress as Address}
          onMarketData={handleMarketData}
        />
      ))}
      
      <h1 className="text-4xl font-bold text-center mb-8">
        🔮 Prediction Markets - Intuition Blockchain
      </h1>

      {/* Market Cache Management */}
      <div className="card bg-base-100 shadow-xl mb-6">
        <div className="card-body py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="stats stats-vertical sm:stats-horizontal shadow">
                <div className="stat">
                  <div className="stat-title">Factory Markets</div>
                  <div className="stat-value text-sm">{allMarkets?.length || 0}</div>
                  <div className="stat-desc">From Factory Contract</div>
                </div>
                <div className="stat">
                  <div className="stat-title">Loaded Markets</div>
                  <div className="stat-value text-sm">{markets.length}</div>
                  <div className="stat-desc">With Market Data</div>
                </div>
              </div>
            </div>
            
            <button 
              className="btn btn-outline btn-primary"
              onClick={async () => {
                console.log("🔄 Manual refresh triggered");
                // Clear current markets
                setMarkets([]);
                setSelectedMarket("");
                // Refetch from Factory
                await refetchMarkets();
                notification.info("Markets refreshed from Factory");
              }}
            >
              🔄 Refresh Markets
            </button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 mb-8">
        {/* Create Market Form */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-4">📈 Create New Market</h2>
            
            {/* Live Transaction Counter */}
            <div className="alert alert-info mb-4">
              <div className="flex flex-col sm:flex-row items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <span className="loading loading-dots loading-sm"></span>
                  <span className="font-semibold">Current Transactions:</span>
                </div>
                <div className="text-2xl font-bold text-primary">
                  {formatLargeNumber(currentTransactions)}
                </div>
              </div>
            </div>
            
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text font-semibold">Transaction Threshold</span>
              </label>
              <input
                type="number"
                placeholder={`Enter threshold (current: ${formatLargeNumber(currentTransactions)})`}
                className="input input-bordered"
                value={transactionThreshold}
                onChange={(e) => setTransactionThreshold(e.target.value)}
              />
              <label className="label">
                <span className="label-text-alt">Users will bet if transactions will be ABOVE or BELOW this number</span>
              </label>
            </div>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text font-semibold">Market Duration</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                <button 
                  type="button"
                  className={`btn ${selectedHours === 2 ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setSelectedHours(2)}
                >
                  +2h
                </button>
                <button 
                  type="button"
                  className={`btn ${selectedHours === 4 ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setSelectedHours(4)}
                >
                  +4h
                </button>
                <button 
                  type="button"
                  className={`btn ${selectedHours === 8 ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setSelectedHours(8)}
                >
                  +8h
                </button>
                <button 
                  type="button"
                  className={`btn ${selectedHours === 12 ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setSelectedHours(12)}
                >
                  +12h
                </button>
              </div>
              <label className="label">
                <span className="label-text-alt">Market will end in {selectedHours} hour{selectedHours > 1 ? 's' : ''} from creation</span>
              </label>
            </div>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text font-semibold">Initial Liquidity (ETH)</span>
              </label>
              <EtherInput
                value={initialLiquidity}
                onChange={setInitialLiquidity}
                placeholder="0.1"
              />
              <label className="label">
                <span className="label-text-alt">Add ETH to provide initial liquidity to your market</span>
              </label>
            </div>

            <button 
              className="btn btn-primary btn-block"
              onClick={createMarketReal}
              disabled={!transactionThreshold || !selectedHours}
            >
              🚀 Create Market
            </button>
          </div>
        </div>

        {/* Real-time Chart */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-4">📊 Live Transaction Data</h2>
            
            <div className="stats stats-vertical lg:stats-horizontal shadow mb-4">
              <div className="stat">
                <div className="stat-title">Current Transactions</div>
                <div className="stat-value text-primary">{formatLargeNumber(currentTransactions)}</div>
                <div className="stat-desc">Real-time from Intuition API</div>
              </div>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={apiData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={formatTimestamp}
                    type="number"
                    scale="time"
                    domain={['dataMin', 'dataMax']}
                  />
                  <YAxis tickFormatter={(value) => (value / 1000000).toFixed(1) + 'M'} />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                    formatter={(value: any) => [formatLargeNumber(value.toString()), 'Transactions']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="total_transactions" 
                    stroke="#8884d8" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Betting Interface */}
      <div className="card bg-base-100 shadow-xl mb-8">
        <div className="card-body">
          <h2 className="card-title text-2xl mb-4">💰 Place Your Bet</h2>
          
          <div className="grid md:grid-cols-3 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Select Market</span>
              </label>
              <select 
                className="select select-bordered"
                value={selectedMarket}
                onChange={(e) => {
                  console.log("🔄 Market selected:", e.target.value);
                  console.log("🔍 Available markets from Factory:", allMarkets);
                  setSelectedMarket(e.target.value);
                }}
              >
                <option value="">Choose a market...</option>
                {allMarkets?.map((marketAddress, idx) => {
                  const market = markets.find(m => m.address === marketAddress);
                  return (
                    <option key={idx} value={marketAddress}>
                      {market ? `Threshold: ${formatLargeNumber(market.threshold.toString())} (${marketAddress.slice(0, 10)}...)` : `Market ${marketAddress.slice(0, 10)}...`}
                    </option>
                  );
                })}
              </select>
              
              {/* DEBUG INFO */}
              <div className="text-xs text-base-content/60 mt-2">
                <div>🔍 Factory Markets: {allMarkets?.length || 0} available</div>
                {allMarkets?.length === 0 && (
                  <div className="text-warning">⚠️ No markets from Factory - create one first</div>
                )}
                {selectedMarket && (
                  <div className="mt-1">
                    <div>✅ Selected: {selectedMarket}</div>
                    <div>✅ Valid: {allMarkets?.includes(selectedMarket) ? "Yes" : "❌ NO - Invalid market!"}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Your Prediction</span>
              </label>
              <div className="btn-group">
                <button 
                  className={`btn ${betType === 0 ? 'btn-success' : 'btn-outline'}`}
                  onClick={() => setBetType(0)}
                >
                  📈 ABOVE
                </button>
                <button 
                  className={`btn ${betType === 1 ? 'btn-error' : 'btn-outline'}`}
                  onClick={() => setBetType(1)}
                >
                  📉 BELOW
                </button>
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Bet Amount (ETH)</span>
              </label>
              <EtherInput
                value={betAmount}
                onChange={setBetAmount}
                placeholder="0.1"
              />
            </div>
          </div>

          <button 
            className="btn btn-primary btn-block mt-4"
            onClick={placeBet}
            disabled={!selectedMarket || !betAmount}
          >
            🎯 Place Real Bet (Any Market)
          </button>
          
          <div className="alert alert-success mt-2">
            <div className="flex items-center gap-2">
              <span>✅</span>
              <span className="text-sm">Can bet on ANY TransactionPredictionMarket address!</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Markets Dashboard */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-2xl mb-4">🏪 Active Markets</h2>
          
          {!allMarkets || allMarkets.length === 0 ? (
            <div className="alert alert-info">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>No active markets yet. Create the first one above!</span>
            </div>
          ) : (
            <div className="grid gap-4">
              {allMarkets.map((marketAddress, idx) => {
                const market = markets.find(m => m.address === marketAddress);
                return (
                  <div key={idx} className="card bg-base-200 shadow">
                    <div className="card-body p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-semibold">
                            {market?.description || `Market at ${marketAddress.slice(0, 10)}...`}
                          </h3>
                          <p className="text-sm opacity-70">
                            Market at {marketAddress.slice(0, 10)}... |
                            Threshold: {market ? formatLargeNumber(market.threshold.toString()) : '2,500,000'} | 
                            Ends: {market ? new Date(Number(market.deadline) * 1000).toLocaleString() : 'Loading...'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{market ? formatEther(market.totalValueLocked) : '0'} ETH</p>
                          <p className="text-xs opacity-70">Total Locked</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 mt-2">
                        <div className="badge badge-success">
                          ABOVE: {market ? formatEther(market.aboveBets) : '0'} ETH
                        </div>
                        <div className="badge badge-error">
                          BELOW: {market ? formatEther(market.belowBets) : '0'} ETH
                        </div>
                      </div>
                      
                      {factoryMarketInfo && marketAddress === firstMarketAddress && (
                        <div className="mt-2 p-2 bg-base-300 rounded">
                          <p className="text-xs text-success">✅ Real data from factory contract</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}