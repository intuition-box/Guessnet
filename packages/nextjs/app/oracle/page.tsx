"use client";

import { useState, useEffect } from "react";
import { useScaffoldReadContract, useScaffoldContract } from "~~/hooks/scaffold-eth";
import { formatEther } from "viem";

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

  return (
    <div className="min-h-screen bg-gray-800">
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-center mb-8 text-white">
        🔮 Oracle Validation Dashboard
      </h1>

      <div className="grid lg:grid-cols-2 gap-8 mb-8">
        {/* Oracle Status */}
        <div className="card bg-gray-100 shadow-xl border border-gray-700">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-4 text-gray-900">📊 Oracle Status</h2>
            
            <div className="stats stats-vertical shadow bg-white">
              <div className="stat">
                <div className="stat-title text-gray-600">Validation Status</div>
                <div className="stat-value text-lg text-gray-800">{getValidationStatus()}</div>
                <div className="stat-desc text-gray-500">Oracle vs Live API</div>
              </div>
              
              <div className="stat">
                <div className="stat-title">Data Freshness</div>
                <div className={`stat-value text-lg ${getDataFreshnessColor()}`}>
                  {isDataFresh ? "✅ Fresh" : "⚠️ Stale"}
                </div>
                <div className="stat-desc">Last hour validation</div>
              </div>

              <div className="stat">
                <div className="stat-title">Markets Resolved</div>
                <div className="stat-value text-gray-800">
                  {totalMarketsResolved ? totalMarketsResolved.toString() : "0"}
                </div>
                <div className="stat-desc">Total automatic resolutions</div>
              </div>
            </div>

            <div className="divider text-gray-600">Resolver Authorization</div>
            
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-700">Authorized Resolvers:</h3>
              {authorizedResolvers && authorizedResolvers.length > 0 ? (
                <div className="space-y-1">
                  {authorizedResolvers.map((resolver: string, idx: number) => (
                    <div key={idx} className="badge bg-gray-200 text-gray-700 gap-2">
                      <span className="font-mono text-xs">{resolver.slice(0, 8)}...{resolver.slice(-6)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="alert bg-orange-100 border-orange-300 text-orange-700">
                  <span>No authorized resolvers found</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Data Comparison */}
        <div className="card bg-gray-100 shadow-xl border border-gray-700">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-4 text-gray-900">📈 Data Validation</h2>
            
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
                      <div className={`badge ${currentTransactionData && currentTransactionData.isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {currentTransactionData && currentTransactionData.isValid ? 'Valid' : 'Invalid'}
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

      {/* Markets Ready for Resolution */}
      <div className="card bg-gray-100 shadow-xl mb-8 border border-gray-700">
        <div className="card-body">
          <h2 className="card-title text-2xl mb-4 text-gray-900">⚖️ Markets Awaiting Resolution</h2>
          
          {resolvableMarkets && resolvableMarkets.length > 0 ? (
            <div className="space-y-4">
              {resolvableMarkets.map((marketAddress: string, idx: number) => (
                <div key={idx} className="alert bg-blue-100 border-blue-300 text-blue-700">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <div>
                    <h3 className="font-bold text-gray-800">Market Ready for Resolution</h3>
                    <div className="text-xs font-mono">{marketAddress}</div>
                    <div className="text-sm">This market has expired and can be resolved by the Oracle</div>
                  </div>
                </div>
              ))}
              
              <div className="alert bg-orange-100 border-orange-300 text-orange-700">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
                <span>Oracle will automatically resolve these markets when the API service is running</span>
              </div>
            </div>
          ) : (
            <div className="alert bg-green-100 border-green-300 text-green-700">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>No markets awaiting resolution - All markets are up to date!</span>
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