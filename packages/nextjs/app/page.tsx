"use client";

import { useState, useEffect } from "react";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { EtherInput } from "~~/components/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import deployedContracts from "~~/contracts/deployedContracts";
import { formatEther, parseEther, Address } from "viem";  
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePonderQuery, GET_ALL_MARKETS } from "~~/hooks/usePonderQuery";
import { useWriteContract } from "wagmi";
import { TransactionPredictionMarketABI } from "~~/contracts/TransactionPredictionMarketABI";
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
  const [initialLiquidity, setInitialLiquidity] = useState("0.1");
  const [selectedMarket, setSelectedMarket] = useState("");
  const [betAmount, setBetAmount] = useState("");
  const [betType, setBetType] = useState(0); // 0 = ABOVE, 1 = BELOW
  const [apiData, setApiData] = useState<ApiDataPoint[]>([]);
  const [currentTransactions, setCurrentTransactions] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isClient, setIsClient] = useState(false);

  // Récupérer les données des marchés depuis Ponder
  const { data: ponderData, isLoading: isPonderLoading, error: ponderError, refetch: refetchPonder } = usePonderQuery(GET_ALL_MARKETS);

  // REMOVED: getMarketDetails function - we now use only real data from MarketReader components
  // No more placeholder data, only real blockchain data

  // Initialize client-side rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Update markets with Ponder data
  useEffect(() => {
    if (!isClient) return; // Only run on client
    
    console.log("🔄 Ponder data changed:", { ponderData, isPonderLoading, ponderError });
    
    if (ponderData?.markets?.items) {
      console.log("🔍 RAW Ponder data:", ponderData.markets.items);
      
      const ponderMarkets = ponderData.markets.items.map((market: any) => {
        console.log(`🔍 Processing market ${market.id}:`, {
          rawTransactionThreshold: market.transactionThreshold,
          typeOfThreshold: typeof market.transactionThreshold,
          rawDescription: market.description
        });
        
        return {
          address: market.id,
          description: market.description || `Market ${market.id.slice(0, 8)}...`,
          threshold: BigInt(market.transactionThreshold || 0),
          deadline: BigInt(market.deadline || 0),
          status: market.status === "ACTIVE" ? 0 : 1,
          totalValueLocked: BigInt(market.totalBets || 0),
          aboveBets: BigInt(market.totalAboveBets || 0),
          belowBets: BigInt(market.totalBelowBets || 0)
        };
      });
      
      console.log(`📊 Setting markets from Ponder:`, ponderMarkets.map((m: any) => ({
        address: m.address.slice(0, 10),
        threshold: m.threshold.toString(),
        description: m.description,
        aboveBets: m.aboveBets.toString(),
        belowBets: m.belowBets.toString(),
        totalBets: m.totalValueLocked.toString()
      })));
      
      setMarkets(ponderMarkets);
      setRefreshKey(Date.now()); // Force component refresh
    } else if (!isPonderLoading) {
      console.log("⚠️ No markets from Ponder or still loading");
      setMarkets([]);
    }
  }, [ponderData, isPonderLoading, ponderError, isClient]);

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
      const cleanThreshold = transactionThreshold.replace(/[\s,]/g, '');
      const thresholdBigInt = BigInt(parseInt(cleanThreshold));
      const deadlineTimestamp = Math.floor(Date.now() / 1000) + (selectedHours * 3600) + 60; // Add 60 seconds buffer
      const oracleAddress = deployedContracts?.[31337]?.PredictionMarketOracle?.address || "0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82";
      
      const description = `Will Intuition have more than ${formatLargeNumber(cleanThreshold)} transactions in ${selectedHours} hours?`;
      
      console.log("Creating market with params:", {
        description,
        threshold: transactionThreshold,
        thresholdBigInt: thresholdBigInt.toString(),
        deadline: deadlineTimestamp,
        oracle: oracleAddress
      });

      console.log("🔧 Final contract args:", [
        description,
        thresholdBigInt,
        BigInt(deadlineTimestamp),
        oracleAddress
      ]);

      console.log("💰 DEBUG Initial Liquidity:", {
        initialLiquidity,
        hasValue: !!initialLiquidity,
        parsedValue: initialLiquidity ? parseEther(initialLiquidity) : BigInt(0)
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
      
      // Refresh markets from Ponder
      setTimeout(() => {
        refetchPonder();
      }, 2000);
      
      // Reset form
      setTransactionThreshold("");
      setSelectedHours(2);
      setInitialLiquidity("0.1");
      
    } catch (error: any) {
      notification.error(`Failed to create market: ${error.message}`);
    }
  };

  // Write contract function for placing bets on ANY TransactionPredictionMarket
  const { writeContractAsync } = useWriteContract();

  const placeBet = async () => {
    if (typeof window === 'undefined') {
      return;
    }
    
    if (!selectedMarket || !betAmount) {
      notification.error("Please select a market and enter bet amount");
      return;
    }

    // VALIDATION: Check if selected market exists in Ponder data
    console.log("🔍 DEBUG - Validating market selection:");
    console.log("Selected Market:", selectedMarket);
    console.log("All Markets from Ponder:", markets.map(m => m.address));
    
    const selectedMarketData = markets.find(m => m.address === selectedMarket);
    if (!selectedMarketData) {
      console.error("❌ VALIDATION FAILED: Selected market not found in Ponder data!");
      notification.error(`Invalid market selection. Market ${selectedMarket} not found in Ponder.`);
      return;
    }

    console.log("✅ VALIDATION PASSED: Market exists in Ponder data:", selectedMarketData);

    try {
      notification.loading("Placing bet...");
      
      console.log("🎯 Placing real bet with VALIDATED market:", {
        marketAddress: selectedMarket,
        betType: betType, // 0 = ABOVE, 1 = BELOW
        amount: betAmount,
        value: parseEther(betAmount),
        marketData: selectedMarketData,
        threshold: selectedMarketData.threshold.toString()
      });
      
      console.log("🔧 Using TransactionPredictionMarket ABI...");
      
      const result = await writeContractAsync({
        address: selectedMarket as Address,
        abi: TransactionPredictionMarketABI,
        functionName: "placeBet",
        args: [betType], // 0 for ABOVE_THRESHOLD, 1 for BELOW_THRESHOLD
        value: parseEther(betAmount),
      });
      
      console.log("✅ Transaction completed:", result);
      
      notification.remove(); // Remove loading notification
      notification.success(`🎯 Real bet placed: ${betAmount} ETH on ${betType === 0 ? 'ABOVE' : 'BELOW'} threshold!`);
      setBetAmount("");
      setSelectedMarket("");
      
      // Refresh markets from Ponder after bet
      setTimeout(() => {
        refetchPonder();
      }, 3000);
      
    } catch (error: any) {
      console.error("Bet placement error:", error);
      notification.remove(); // Remove loading notification
      notification.error(`Failed to place bet: ${error.shortMessage || error.message || error}`);
    }
  };


  const formatLargeNumber = (num: string) => {
    return parseInt(num).toLocaleString();
  };


  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-100">
          🔮 Prediction Markets - Intuition Blockchain
        </h1>


        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* Create Market Form */}
          <div className="card bg-white shadow-xl border border-gray-200">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-4 text-gray-800">📈 Create New Market</h2>
              
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text font-semibold text-gray-700">Transaction Threshold</span>
                </label>
                <input
                  type="text"
                  placeholder={currentTransactions > 0 ? `${formatLargeNumber((currentTransactions + 50000).toString())}` : "2,850,000"}
                  className="input input-bordered bg-gray-50 border-gray-300 text-gray-800 placeholder-gray-400 focus:border-gray-500 mb-2"
                  value={transactionThreshold}
                  onChange={(e) => setTransactionThreshold(e.target.value)}
                />
                
                {/* Quick increment buttons - Based on current real transactions */}
                <div className="flex flex-wrap gap-1 mb-2">
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
                      className="btn btn-xs bg-white hover:bg-gray-900 hover:text-white text-gray-700 border-gray-300 transition-all duration-200"
                      onClick={() => {
                        const currentValue = transactionThreshold ? 
                          parseInt(transactionThreshold.replace(/[\s,]/g, '')) : 
                          currentTransactions;
                        const newValue = currentValue + value;
                        setTransactionThreshold(newValue.toLocaleString());
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                
                <label className="label">
                  <span className="label-text-alt text-gray-500">Users will bet if Intuition exceeds this number</span>
                </label>
              </div>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text font-semibold text-gray-700">Duration</span>
                </label>
                <div className="btn-group">
                  {[1, 2, 5, 12, 24].map(hours => (
                    <button 
                      key={hours}
                      className={`btn ${selectedHours === hours ? 'bg-gray-900 border-gray-900 text-white hover:bg-black' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-800 hover:text-white hover:border-gray-800'} transition-all duration-200`}
                      onClick={() => setSelectedHours(hours)}
                    >
                      +{hours}h
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text font-semibold text-gray-700">Initial Liquidity (Optional)</span>
                </label>
                <EtherInput
                  value={initialLiquidity}
                  onChange={setInitialLiquidity}
                  placeholder="0.1"
                />
                <label className="label">
                  <span className="label-text-alt text-gray-500">Add ETH to provide initial liquidity to your market</span>
                </label>
              </div>

              <button 
                className="btn bg-violet-200 hover:bg-violet-300 hover:shadow-lg hover:scale-105 text-gray-900 border-violet-200 hover:border-violet-300 btn-block transition-all duration-200 font-bold"
                onClick={createMarketReal}
                disabled={!transactionThreshold || !selectedHours}
              >
                🚀 Create Market
              </button>
            </div>
          </div>

          {/* Real-time Chart */}
          <div className="card bg-white shadow-xl border border-gray-200">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-4 text-gray-800">📊 Live Transaction Data</h2>
              
              <div className="stats stats-vertical lg:stats-horizontal bg-gray-100 text-gray-800 shadow mb-4">
                <div className="stat">
                  <div className="stat-title text-gray-600">Current Transactions</div>
                  <div className="stat-value text-gray-800">{formatLargeNumber(currentTransactions.toString())}</div>
                  <div className="stat-desc text-gray-500">Real-time from Intuition API</div>
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

        {/* Latest Active Markets with Betting */}
        <div className="card bg-white shadow-xl mb-8 border border-gray-200">
          <div className="card-body">
            <div className="flex justify-between items-center mb-4">
              <h2 className="card-title text-2xl text-gray-800">💰 Latest Active Markets</h2>
              <div className="text-sm text-gray-500">
                Sorted by creation date
              </div>
            </div>
            
            {!isClient ? (
              <div className="text-center py-8">
                <div className="loading loading-spinner loading-lg mb-4 text-blue-500"></div>
                <p className="text-lg text-gray-700">Loading...</p>
              </div>
            ) : markets.length === 0 ? (
              <div className="text-center py-8">
                {isPonderLoading ? (
                  <>
                    <div className="loading loading-spinner loading-lg mb-4 text-violet-400"></div>
                    <p className="text-lg text-gray-700">Loading markets...</p>
                  </>
                ) : (
                  <>
                    <div className="text-gray-400 text-2xl mb-4">📭</div>
                    <p className="text-lg text-gray-700">No active markets</p>
                    <p className="text-sm text-gray-500">Create your first market above!</p>
                  </>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr className="border-gray-200 bg-gray-50">
                      <th className="text-gray-800 font-semibold">Market</th>
                      <th className="text-gray-800 font-semibold">Pool</th>
                      <th className="text-gray-800 font-semibold">Initial Liquidity</th>
                      <th className="text-gray-800 font-semibold">Place Bet</th>
                      <th className="text-gray-800 font-semibold">Deadline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {markets
                      .filter(market => market.status === 0)
                      .sort((a, b) => Number(b.deadline) - Number(a.deadline))
                      .map((market) => (
                        <tr key={market.address} className="border-gray-200 hover:bg-gray-50">
                          {/* Market Info */}
                          <td className="p-4">
                            <div className="space-y-1">
                              <div className="font-semibold text-gray-900 text-sm">
                                {formatLargeNumber(market.threshold.toString())} transactions
                              </div>
                              <div className="text-xs text-gray-600">
                                at {new Date(Number(market.deadline) * 1000).toLocaleTimeString()}
                              </div>
                              <div className="text-xs text-gray-500 font-mono">
                                {market.address.slice(0, 10)}...
                              </div>
                            </div>
                          </td>

                          {/* Pool Info */}
                          <td className="p-4">
                            <div className="flex gap-4">
                              <div className="text-center">
                                <div className="text-xs text-gray-600 font-medium">Above</div>
                                <div className="text-sm font-semibold text-gray-900">
                                  {formatEther(market.aboveBets)} ETH
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-xs text-gray-600 font-medium">Below</div>
                                <div className="text-sm font-semibold text-gray-900">
                                  {formatEther(market.belowBets)} ETH
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Initial Liquidity */}
                          <td className="p-4 text-center">
                            <div className="text-sm font-semibold text-gray-900">
                              {formatEther(market.totalValueLocked)} ETH
                            </div>
                            <div className="text-xs text-gray-500">
                              Total Pool
                            </div>
                          </td>

                          {/* Betting Interface */}
                          <td className="p-4">
                            <div className="flex flex-col gap-2">
                              <div className="flex gap-2">
                                <button 
                                  className="btn btn-xs bg-white hover:bg-gray-900 hover:text-white text-gray-700 border-gray-300 flex-1 transition-colors duration-200"
                                  onClick={() => {
                                    setSelectedMarket(market.address);
                                    setBetType(0);
                                    const defaultAmount = "0.01";
                                    setBetAmount(defaultAmount);
                                    setTimeout(() => placeBet(), 100);
                                  }}
                                >
                                  📈 Above
                                </button>
                                <button 
                                  className="btn btn-xs bg-white hover:bg-gray-900 hover:text-white text-gray-700 border-gray-300 flex-1 transition-colors duration-200"
                                  onClick={() => {
                                    setSelectedMarket(market.address);
                                    setBetType(1);
                                    const defaultAmount = "0.01";
                                    setBetAmount(defaultAmount);
                                    setTimeout(() => placeBet(), 100);
                                  }}
                                >
                                  📉 Below
                                </button>
                              </div>
                              <div className="flex gap-1">
                                <div className="flex-1">
                                  <EtherInput
                                    value={selectedMarket === market.address ? betAmount : "0.01"}
                                    onChange={(value) => {
                                      setSelectedMarket(market.address);
                                      setBetAmount(value);
                                    }}
                                    placeholder="0.01"
                                  />
                                </div>
                                <button 
                                  className="btn btn-xs bg-violet-200 hover:bg-violet-300 hover:text-gray-900 text-gray-700 border-violet-200 hover:border-violet-300 transition-colors duration-200"
                                  onClick={() => {
                                    if (selectedMarket === market.address && betAmount) {
                                      placeBet();
                                    }
                                  }}
                                  disabled={selectedMarket !== market.address || !betAmount}
                                >
                                  Bet
                                </button>
                              </div>
                            </div>
                          </td>

                          {/* Deadline & Status */}
                          <td className="p-4 text-center">
                            <div className="space-y-2">
                              <div className="text-xs text-gray-600">
                                {new Date(Number(market.deadline) * 1000).toLocaleDateString()}
                              </div>
                              <div className="text-xs text-gray-600">
                                {new Date(Number(market.deadline) * 1000).toLocaleTimeString()}
                              </div>
                              <div className="badge badge-sm bg-violet-200 text-gray-900 border-violet-200">
                                Active
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Active Markets List */}
        <div className="card bg-white shadow-xl border border-gray-200">
          <div className="card-body">
            <div className="flex justify-between items-center mb-4">
              <h2 className="card-title text-2xl text-gray-800">🏪 Active Markets</h2>
              <div className="flex gap-2">
                <button 
                  className="btn btn-sm bg-white hover:bg-gray-900 hover:text-white text-gray-700 border-gray-300 transition-all duration-200"
                  onClick={() => {
                    console.log("🧹 CLEARING OLD MARKETS");
                    setMarkets([]);
                    setSelectedMarket("");
                    notification.warning("Anciens marchés supprimés. Créez un nouveau TransactionPredictionMarket!");
                  }}
                >
                  🧹 Clear Old Markets
                </button>
                <button 
                  className="btn btn-sm bg-white hover:bg-gray-900 hover:text-white text-gray-700 border-gray-300 transition-all duration-200"
                  onClick={() => {
                    console.log("🔄 Debug: Current markets state:", markets);
                    console.log("🔄 Debug: Ponder data:", ponderData);
                    // Force re-render by refreshing Ponder
                    setMarkets([]);
                    setTimeout(() => refetchPonder(), 500);
                  }}
                >
                  🔄 Debug Refresh Ponder
                </button>
              </div>
            </div>
            
            {!isClient ? (
              <div className="text-center py-8">
                <div className="loading loading-spinner loading-lg mb-4 text-blue-500"></div>
                <p className="text-lg text-gray-700">Loading...</p>
              </div>
            ) : markets.length === 0 ? (
              <div className="text-center py-8">
                {isPonderLoading ? (
                  <>
                    <div className="loading loading-spinner loading-lg mb-4 text-violet-400"></div>
                    <p className="text-lg text-gray-700">Loading markets from Ponder...</p>
                    <p className="text-sm text-gray-500">GraphQL Query in progress</p>
                  </>
                ) : ponderError ? (
                  <>
                    <div className="text-red-500 text-2xl mb-4">❌</div>
                    <p className="text-lg text-red-700">Error loading from Ponder</p>
                    <p className="text-sm text-red-500">{ponderError.message}</p>
                  </>
                ) : (
                  <>
                    <div className="text-gray-400 text-2xl mb-4">📭</div>
                    <p className="text-lg text-gray-700">No markets found</p>
                    <p className="text-sm text-gray-500">Create your first market above!</p>
                  </>
                )}
              </div>
            ) : (
              <div key={`markets-table-${refreshKey}`} className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr className="border-gray-200">
                      <th className="text-gray-600">Market</th>
                      <th className="text-gray-600">Above Bets</th>
                      <th className="text-gray-600">Below Bets</th>
                      <th className="text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {markets.map((market, idx) => (
                      <tr key={idx} className="border-gray-200 hover:bg-gray-50">
                        <td>
                          <div className="font-semibold text-gray-900">
                            {formatLargeNumber(market.threshold.toString())} transactions at {new Date(Number(market.deadline) * 1000).toLocaleTimeString()}
                          </div>
                          <div className="text-xs text-gray-600 font-mono">
                            {market.address.slice(0, 10)}...
                          </div>
                        </td>
                        <td>
                          <span className="text-gray-900">
                            {formatEther(market.aboveBets)} ETH
                          </span>
                        </td>
                        <td>
                          <span className="text-gray-900">
                            {formatEther(market.belowBets)} ETH
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${market.status === 0 ? 'bg-violet-200 text-gray-900' : 'bg-gray-100 text-gray-800'}`}>
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