"use client";

import { useState, useEffect, useCallback } from "react";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { EtherInput } from "~~/components/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import deployedContracts from "~~/contracts/deployedContracts";
import { formatEther, parseEther, Address } from "viem";  
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MarketReader } from "./prediction-markets/MarketReader";
import { useWriteContract } from "wagmi";
import { TRANSACTION_PREDICTION_MARKET_ABI } from "./prediction-markets/contracts/TransactionPredictionMarketABI";
import type { NextPage } from "next";

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

interface ApiDataPoint {
  timestamp: string;
  transactions: number;
}

const Home: NextPage = () => {
  // États pour les données
  const [markets, setMarkets] = useState<Market[]>([]);
  const [transactionThreshold, setTransactionThreshold] = useState("");
  const [selectedHours, setSelectedHours] = useState(2);
  const [initialLiquidity, setInitialLiquidity] = useState("");
  const [selectedMarket, setSelectedMarket] = useState("");
  const [betAmount, setBetAmount] = useState("");
  const [betType, setBetType] = useState(0); // 0 = ABOVE, 1 = BELOW
  const [apiData, setApiData] = useState<ApiDataPoint[]>([]);
  const [currentTransactions, setCurrentTransactions] = useState(0);

  // Récupérer tous les marchés depuis la Factory
  const { data: allMarkets, refetch: refetchMarkets } = useScaffoldReadContract({
    contractName: "PredictionMarketFactory",
    functionName: "getAllMarkets",
  });

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
        
        const totalTransactions = data?.total_transactions || "0";
        const transactionCount = parseInt(totalTransactions.replace(/,/g, ''));
        
        setCurrentTransactions(transactionCount);
        
        // Add to chart data
        const now = new Date();
        const newDataPoint: ApiDataPoint = {
          timestamp: now.toLocaleTimeString(),
          transactions: transactionCount
        };
        
        setApiData(prev => {
          const updated = [...prev, newDataPoint].slice(-20); // Keep last 20 points
          return updated;
        });
      } catch (error) {
        console.error('Error fetching API data:', error);
      }
    };

    // Initial fetch
    fetchApiData();
    
    // Set up interval to fetch every 30 seconds
    const interval = setInterval(fetchApiData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Write contract function for market creation
  const { writeContractAsync: createMarket } = useScaffoldWriteContract("PredictionMarketFactory");

  const createMarketReal = async () => {
    if (!transactionThreshold || !selectedHours) {
      notification.error("Please fill all fields");
      return;
    }

    try {
      const thresholdBigInt = BigInt(parseInt(transactionThreshold.replace(/,/g, '')));
      const deadlineTimestamp = Math.floor(Date.now() / 1000) + (selectedHours * 3600);
      const oracleAddress = deployedContracts?.[31337]?.PredictionMarketOracle?.address || "0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82";
      
      const description = `Will Intuition have more than ${formatLargeNumber(transactionThreshold)} transactions in ${selectedHours} hours?`;
      
      console.log("Creating market with params:", {
        description,
        threshold: transactionThreshold,
        deadline: deadlineTimestamp,
        oracle: oracleAddress
      });

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
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Composants pour lire les données de chaque marché */}
        {allMarkets?.map((marketAddress) => (
          <MarketReader 
            key={marketAddress} 
            marketAddress={marketAddress as Address}
            onMarketData={handleMarketData}
          />
        ))}
        
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-100">
          🔮 Prediction Markets - Intuition Blockchain
        </h1>

        {/* Market Cache Management */}
        <div className="card bg-gray-700 shadow-xl mb-6 border border-gray-600">
          <div className="card-body py-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="stats stats-vertical sm:stats-horizontal bg-gray-600 text-gray-100 shadow">
                  <div className="stat">
                    <div className="stat-title text-gray-300">Factory Markets</div>
                    <div className="stat-value text-sm text-gray-100">{allMarkets?.length || 0}</div>
                    <div className="stat-desc text-gray-400">From Factory Contract</div>
                  </div>
                  <div className="stat">
                    <div className="stat-title text-gray-300">Loaded Markets</div>
                    <div className="stat-value text-sm text-gray-100">{markets.length}</div>
                    <div className="stat-desc text-gray-400">With Market Data</div>
                  </div>
                </div>
              </div>
              
              <button 
                className="btn bg-gray-500 hover:bg-gray-400 text-gray-100 border-gray-500 hover:border-gray-400"
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
          <div className="card bg-gray-700 shadow-xl border border-gray-600">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-4 text-gray-100">📈 Create New Market</h2>
              
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text font-semibold text-gray-200">Transaction Threshold</span>
                </label>
                <input
                  type="text"
                  placeholder="2,850,000"
                  className="input input-bordered bg-gray-600 border-gray-500 text-gray-100 placeholder-gray-400 focus:border-gray-400 mb-2"
                  value={transactionThreshold}
                  onChange={(e) => setTransactionThreshold(e.target.value)}
                />
                
                {/* Quick increment buttons - Based on current real transactions */}
                <div className="flex flex-wrap gap-1 mb-2">
                  <div className="text-xs text-gray-400 w-full mb-1">
                    Actuelle: {formatLargeNumber(currentTransactions.toString())} transactions
                  </div>
                  {[
                    { label: '+50K', value: 50000 },
                    { label: '+10K', value: 10000 },
                    { label: '+100K', value: 100000 },
                    { label: '+1M', value: 1000000 },
                    { label: '+10M', value: 10000000 },
                    { label: '+100M', value: 100000000 }
                  ].map(({ label, value }) => (
                    <button
                      key={label}
                      type="button"
                      className="btn btn-xs bg-gray-500 hover:bg-gray-400 text-gray-100 border-gray-500 hover:border-gray-400"
                      onClick={() => {
                        const newValue = currentTransactions + value;
                        setTransactionThreshold(newValue.toLocaleString());
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                
                <label className="label">
                  <span className="label-text-alt text-gray-400">Users will bet if Intuition exceeds this number</span>
                </label>
              </div>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text font-semibold text-gray-200">Duration</span>
                </label>
                <div className="btn-group">
                  {[1, 2, 5, 12, 24].map(hours => (
                    <button 
                      key={hours}
                      className={`btn ${selectedHours === hours ? 'bg-gray-500 border-gray-500 text-gray-100' : 'btn-outline border-gray-500 text-gray-300 hover:bg-gray-600 hover:border-gray-400'}`}
                      onClick={() => setSelectedHours(hours)}
                    >
                      +{hours}h
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text font-semibold text-gray-200">Initial Liquidity (Optional)</span>
                </label>
                <EtherInput
                  value={initialLiquidity}
                  onChange={setInitialLiquidity}
                  placeholder="0.1"
                />
                <label className="label">
                  <span className="label-text-alt text-gray-400">Add ETH to provide initial liquidity to your market</span>
                </label>
              </div>

              <button 
                className="btn bg-gray-500 hover:bg-gray-400 text-gray-100 border-gray-500 hover:border-gray-400 btn-block"
                onClick={createMarketReal}
                disabled={!transactionThreshold || !selectedHours}
              >
                🚀 Create Market
              </button>
            </div>
          </div>

          {/* Real-time Chart */}
          <div className="card bg-gray-700 shadow-xl border border-gray-600">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-4 text-gray-100">📊 Live Transaction Data</h2>
              
              <div className="stats stats-vertical lg:stats-horizontal bg-gray-600 text-gray-100 shadow mb-4">
                <div className="stat">
                  <div className="stat-title text-gray-300">Current Transactions</div>
                  <div className="stat-value text-gray-100">{formatLargeNumber(currentTransactions.toString())}</div>
                  <div className="stat-desc text-gray-400">Real-time from Intuition API</div>
                </div>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={apiData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => formatLargeNumber(value.toString())}
                    />
                    <Tooltip 
                      formatter={(value) => [formatLargeNumber(value.toString()), 'Transactions']}
                      labelFormatter={(label) => `Time: ${label}`}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="transactions" 
                      stroke="#2563eb" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Betting Interface */}
        <div className="card bg-gray-700 shadow-xl mb-8 border border-gray-600">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-4 text-gray-100">💰 Place Your Bet</h2>
            
            <div className="grid md:grid-cols-3 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold text-gray-200">Select Market</span>
                </label>
                <select 
                  className="select select-bordered bg-gray-600 border-gray-500 text-gray-100 focus:border-gray-400"
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
                <div className="text-xs text-gray-400 mt-2">
                  <div>🔍 Factory Markets: {allMarkets?.length || 0} available</div>
                  {allMarkets?.length === 0 && (
                    <div className="text-yellow-400">⚠️ No markets from Factory - create one first</div>
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
                  <span className="label-text font-semibold text-gray-200">Your Prediction</span>
                </label>
                <div className="btn-group">
                  <button 
                    className={`btn ${betType === 0 ? 'bg-gray-500 border-gray-500 text-gray-100' : 'btn-outline border-gray-500 text-gray-300 hover:bg-gray-600 hover:border-gray-400'}`}
                    onClick={() => setBetType(0)}
                  >
                    📈 ABOVE
                  </button>
                  <button 
                    className={`btn ${betType === 1 ? 'bg-gray-500 border-gray-500 text-gray-100' : 'btn-outline border-gray-500 text-gray-300 hover:bg-gray-600 hover:border-gray-400'}`}
                    onClick={() => setBetType(1)}
                  >
                    📉 BELOW
                  </button>
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold text-gray-200">Bet Amount (ETH)</span>
                </label>
                <EtherInput
                  value={betAmount}
                  onChange={setBetAmount}
                  placeholder="0.1"
                />
              </div>
            </div>

            <button 
              className="btn bg-gray-500 hover:bg-gray-400 text-gray-100 border-gray-500 hover:border-gray-400 btn-block mt-4"
              onClick={placeBet}
              disabled={!selectedMarket || !betAmount}
            >
              🎯 Place Real Bet (Any Market)
            </button>

            <div className="alert bg-gray-600 border-gray-500 mt-4">
              <div>
                <strong className="text-gray-100">✅ Can bet on ANY TransactionPredictionMarket address!</strong>
                <br />
                <span className="text-gray-300">This interface validates each bet against the Factory's market list and calls the contract directly.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Active Markets List */}
        <div className="card bg-gray-700 shadow-xl border border-gray-600">
          <div className="card-body">
            <div className="flex justify-between items-center mb-4">
              <h2 className="card-title text-2xl text-gray-100">🏪 Active Markets</h2>
              <button 
                className="btn btn-sm bg-gray-500 hover:bg-gray-400 text-gray-100 border-gray-500 hover:border-gray-400"
                onClick={() => {
                  console.log("🔄 Debug: Current markets state:", markets);
                  console.log("🔄 Debug: All market addresses from Factory:", allMarkets);
                  // Force re-render by clearing and refreshing
                  setMarkets([]);
                  setTimeout(() => refetchMarkets(), 500);
                }}
              >
                🔄 Debug Refresh
              </button>
            </div>
            
            {markets.length === 0 ? (
              <div className="text-center py-8">
                <div className="loading loading-spinner loading-lg mb-4 text-gray-400"></div>
                <p className="text-lg text-gray-200">Loading markets from Factory...</p>
                <p className="text-sm text-gray-400">Factory Markets: {allMarkets?.length || 0}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr className="border-gray-600">
                      <th className="text-gray-300">Market</th>
                      <th className="text-gray-300">Threshold</th>
                      <th className="text-gray-300">Deadline</th>
                      <th className="text-gray-300">Total Locked</th>
                      <th className="text-gray-300">Above Bets</th>
                      <th className="text-gray-300">Below Bets</th>
                      <th className="text-gray-300">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {markets.map((market, idx) => (
                      <tr key={idx} className="border-gray-600 hover:bg-gray-600">
                        <td>
                          <div className="font-mono text-sm text-gray-200">
                            {market.address.slice(0, 10)}...
                          </div>
                          <div className="text-xs text-gray-400">
                            ✅ Real data from factory contract
                          </div>
                        </td>
                        <td className="font-semibold text-gray-100">
                          {formatLargeNumber(market.threshold.toString())}
                        </td>
                        <td className="text-gray-200">
                          {formatTimestamp(Number(market.deadline) * 1000)}
                        </td>
                        <td>
                          <span className="font-semibold text-gray-200">
                            {formatEther(market.totalValueLocked)} ETH
                          </span>
                        </td>
                        <td>
                          <span className="text-gray-300">
                            {formatEther(market.aboveBets)} ETH
                          </span>
                        </td>
                        <td>
                          <span className="text-gray-300">
                            {formatEther(market.belowBets)} ETH
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${market.status === 0 ? 'bg-gray-500 text-gray-100' : 'bg-gray-600 text-gray-200'}`}>
                            {market.status === 0 ? 'Active' : 'Resolved'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;