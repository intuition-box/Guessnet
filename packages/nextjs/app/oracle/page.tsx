"use client";

import { useState, useEffect } from "react";
import { useScaffoldReadContract, useScaffoldContract } from "~~/hooks/scaffold-eth";
import { formatEther } from "viem";
import { usePonderQuery, GET_ALL_MARKETS } from "~~/hooks/usePonderQuery";

interface MarketResolution {
  marketAddress: string;
  isResolved: boolean;
  resolutionTimestamp: number;
  finalTransactionCount: number;
  winningType: number; // 0 = ABOVE, 1 = BELOW
  description?: string;
}

interface TransactionData {
  totalTransactions: string;
  timestamp: number;
  blockNumber: number;
  isValid: boolean;
}

export default function OraclePage() {
  const [apiData, setApiData] = useState<any>(null);
  const [resolvedMarkets, setResolvedMarkets] = useState<MarketResolution[]>([]);
  
  // Get all markets from Ponder
  const { data: marketsData, isLoading: marketsLoading } = usePonderQuery(GET_ALL_MARKETS);
  
  // Get Oracle contract data
  const { data: currentTransactionData } = useScaffoldReadContract({
    contractName: "PredictionMarketOracle",
    functionName: "currentTransactionData",
  });

  const { data: totalMarketsResolved } = useScaffoldReadContract({
    contractName: "PredictionMarketOracle",
    functionName: "totalMarketsResolved",
  });

  const { data: totalFundsDistributed } = useScaffoldReadContract({
    contractName: "PredictionMarketOracle",
    functionName: "totalFundsDistributed",
  });

  const { data: isDataFresh } = useScaffoldReadContract({
    contractName: "PredictionMarketOracle",
    functionName: "isDataFresh",
  });

  const { data: authorizedResolvers } = useScaffoldReadContract({
    contractName: "PredictionMarketOracle",
    functionName: "getAuthorizedResolvers",
  });

  const { data: resolvableMarkets } = useScaffoldReadContract({
    contractName: "PredictionMarketOracle",
    functionName: "getResolvableMarkets",
  });

  // Fetch live API data
  useEffect(() => {
    const fetchApiData = async () => {
      try {
        const response = await fetch('https://intuition-testnet.explorer.caldera.xyz/api/v2/stats');
        const data = await response.json();
        setApiData(data);
      } catch (error) {
        console.error('Failed to fetch API data:', error);
      }
    };

    fetchApiData();
    const interval = setInterval(fetchApiData, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatLargeNumber = (num: string | number) => {
    return parseInt(num.toString()).toLocaleString();
  };

  const getValidationStatus = () => {
    if (!currentTransactionData || !apiData) return "❓ Unknown";
    
    const oracleCount = currentTransactionData.totalTransactions?.toString() || "0";
    const apiCount = apiData.total_transactions;
    
    if (oracleCount === "0") return "⚠️ No Data";
    if (oracleCount === apiCount) return "✅ Synchronized";
    return "🔄 Updating...";
  };

  const getDataFreshnessColor = () => {
    if (!isDataFresh) return "text-error";
    return "text-success";
  };

  const formatTimeUntilDeadline = (deadline: string) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = parseInt(deadline) - now;
    
    if (diff <= 0) return "Expired";
    
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getMarketStatus = (deadline: string, status: string) => {
    const now = Math.floor(Date.now() / 1000);
    const isExpired = parseInt(deadline) <= now;
    
    if (status === "RESOLVED") return { text: "Resolved", color: "bg-green-100 text-green-800" };
    if (isExpired) return { text: "Ready to Resolve", color: "bg-orange-100 text-orange-800" };
    return { text: "Active", color: "bg-blue-100 text-blue-800" };
  };

  return (
    <div className="min-h-screen bg-gray-800">
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-center mb-8 text-white">
        🔮 Oracle Validation Dashboard
      </h1>

      {/* Data Validation */}
      <div className="mb-8">
        <div className="card bg-gray-100 shadow-xl border border-gray-700">
          <div className="card-body">
            <h2 className="card-title text-3xl mb-6 text-gray-900 text-center w-full">Data Validation</h2>
            
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr className="border-gray-200">
                    <th className="text-gray-600">Source</th>
                    <th className="text-gray-600">Transaction Count</th>
                    <th className="text-gray-600">Last Update</th>
                    <th className="text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-gray-50">
                    <td className="font-bold text-gray-900">🔮 Oracle</td>
                    <td className="font-mono text-gray-900">
                      {currentTransactionData && currentTransactionData.totalTransactions 
                        ? formatLargeNumber(currentTransactionData.totalTransactions.toString())
                        : "No data"
                      }
                    </td>
                    <td className="text-sm text-gray-700">
                      {currentTransactionData && currentTransactionData.timestamp && Number(currentTransactionData.timestamp) > 0
                        ? formatTimestamp(Number(currentTransactionData.timestamp))
                        : "Never"
                      }
                    </td>
                    <td>
                      <div className="badge bg-violet-200 text-gray-900">
                        Valid
                      </div>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="font-bold text-gray-900">🌐 Live API</td>
                    <td className="font-mono text-gray-900">
                      {apiData ? formatLargeNumber(apiData.total_transactions) : "Loading..."}
                    </td>
                    <td className="text-sm text-gray-700">
                      {apiData ? new Date().toLocaleString() : "Loading..."}
                    </td>
                    <td>
                      <div className={`badge ${apiData ? 'bg-green-200 text-green-700' : 'bg-orange-200 text-orange-700'}`}>
                        {apiData ? 'Connected' : 'Loading'}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="divider text-gray-600">Additional Metrics</div>
            
            {apiData && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold text-gray-700">Today's Transactions:</span>
                  <br />
                  <span className="font-mono text-gray-800">{formatLargeNumber(apiData.transactions_today)}</span>
                </div>
                <div>
                  <span className="font-semibold">Total Blocks:</span>
                  <br />
                  <span className="font-mono text-gray-800">{formatLargeNumber(apiData.total_blocks)}</span>
                </div>
                <div>
                  <span className="font-semibold">Network Addresses:</span>
                  <br />
                  <span className="font-mono text-gray-800">{formatLargeNumber(apiData.total_addresses)}</span>
                </div>
                <div>
                  <span className="font-semibold">Avg Block Time:</span>
                  <br />
                  <span className="font-mono">{apiData.average_block_time}ms</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* All Markets Status */}
      <div className="card bg-gray-100 shadow-xl mb-8 border border-gray-700">
        <div className="card-body">
          <h2 className="card-title text-2xl mb-4 text-gray-900">📊 All Markets</h2>
          
          {marketsLoading ? (
            <div className="text-center py-8">
              <span className="loading loading-spinner loading-lg text-gray-600"></span>
              <p className="mt-4 text-gray-600">Loading markets...</p>
            </div>
          ) : marketsData?.markets?.items?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr className="border-gray-200">
                    <th className="text-gray-600">Market</th>
                    <th className="text-gray-600">Threshold</th>
                    <th className="text-gray-600">Deadline</th>
                    <th className="text-gray-600">Time Left</th>
                    <th className="text-gray-600">Total Liquidity</th>
                    <th className="text-gray-600">Bets Distribution</th>
                    <th className="text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {marketsData.markets.items.map((market: any) => {
                    const marketStatus = getMarketStatus(market.deadline, market.status);
                    const totalAbove = parseFloat(market.totalAboveBets || "0") / 1e18;
                    const totalBelow = parseFloat(market.totalBelowBets || "0") / 1e18;
                    const initialLiquidity = parseFloat(market.totalBets || "0") / 1e18;
                    const userBetsLiquidity = totalAbove + totalBelow;
                    const totalLiquidity = initialLiquidity;
                    const abovePercentage = totalLiquidity > 0 ? (totalAbove / totalLiquidity * 100).toFixed(1) : "0";
                    const belowPercentage = totalLiquidity > 0 ? (totalBelow / totalLiquidity * 100).toFixed(1) : "0";
                    
                    return (
                      <tr key={market.id} className="hover:bg-gray-50">
                        <td className="max-w-xs">
                          <div className="text-sm text-gray-900 font-medium truncate">
                            {market.description}
                          </div>
                          <div className="text-xs font-mono text-gray-500">
                            {market.id.slice(0, 8)}...{market.id.slice(-6)}
                          </div>
                        </td>
                        <td className="text-gray-900 font-mono">
                          {parseInt(market.transactionThreshold).toLocaleString()}
                        </td>
                        <td className="text-sm text-gray-700">
                          {new Date(parseInt(market.deadline) * 1000).toLocaleString()}
                        </td>
                        <td className="text-sm text-gray-700 font-medium">
                          {formatTimeUntilDeadline(market.deadline)}
                        </td>
                        <td className="text-center">
                          <div className="text-lg font-bold text-gray-900">
                            {totalLiquidity.toFixed(3)} ETH
                          </div>
                          <div className="text-xs text-gray-500">
                            {initialLiquidity > userBetsLiquidity ? 
                              `Initial: ${initialLiquidity.toFixed(3)} ETH` : 
                              `User Bets: ${userBetsLiquidity.toFixed(3)} ETH`
                            }
                          </div>
                        </td>
                        <td className="text-sm">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-green-600 font-medium">👆 Above:</span>
                              <span className="font-mono">{totalAbove.toFixed(3)} ETH ({abovePercentage}%)</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-red-600 font-medium">👇 Below:</span>
                              <span className="font-mono">{totalBelow.toFixed(3)} ETH ({belowPercentage}%)</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                              <div 
                                className="bg-green-500 h-2 rounded-l-full" 
                                style={{ width: `${abovePercentage}%` }}
                              ></div>
                              <div 
                                className="bg-red-500 h-2 rounded-r-full" 
                                style={{ width: `${belowPercentage}%`, marginTop: '-8px' }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className={`badge ${marketStatus.color}`}>
                            {marketStatus.text}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="alert bg-blue-100 border-blue-300 text-blue-700">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>No markets found</span>
            </div>
          )}
        </div>
      </div>

      {/* Recent Resolutions */}
      <div className="card bg-white shadow-xl border border-gray-200">
        <div className="card-body">
          <h2 className="card-title text-2xl mb-4 text-gray-900">📋 Recent Oracle Validations</h2>
          
          {totalMarketsResolved && parseInt(totalMarketsResolved.toString()) > 0 ? (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr className="border-gray-200">
                    <th className="text-gray-600">Market</th>
                    <th className="text-gray-600">Final Count</th>
                    <th className="text-gray-600">Result</th>
                    <th className="text-gray-600">Funds Distributed</th>
                    <th className="text-gray-600">Resolution Time</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-gray-50">
                    <td className="text-xs font-mono text-gray-900">0x...example</td>
                    <td className="font-mono text-gray-900">2,314,088</td>
                    <td>
                      <div className="badge bg-green-100 text-green-800">ABOVE THRESHOLD</div>
                    </td>
                    <td className="text-gray-900">
                      {totalFundsDistributed ? formatEther(totalFundsDistributed) + " ETH" : "0 ETH"}
                    </td>
                    <td className="text-sm text-gray-700">
                      {new Date().toLocaleDateString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="alert bg-blue-100 border-blue-300 text-blue-700">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>No market resolutions yet. Create and wait for markets to expire to see Oracle validations.</span>
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}