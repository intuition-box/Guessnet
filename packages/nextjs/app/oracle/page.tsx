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
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-center mb-8">
        🔮 Oracle Validation Dashboard
      </h1>

      <div className="grid lg:grid-cols-2 gap-8 mb-8">
        {/* Oracle Status */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-4">📊 Oracle Status</h2>
            
            <div className="stats stats-vertical shadow">
              <div className="stat">
                <div className="stat-title">Validation Status</div>
                <div className="stat-value text-lg">{getValidationStatus()}</div>
                <div className="stat-desc">Oracle vs Live API</div>
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
                <div className="stat-value text-primary">
                  {totalMarketsResolved ? totalMarketsResolved.toString() : "0"}
                </div>
                <div className="stat-desc">Total automatic resolutions</div>
              </div>
            </div>

            <div className="divider">Resolver Authorization</div>
            
            <div className="space-y-2">
              <h3 className="font-semibold">Authorized Resolvers:</h3>
              {authorizedResolvers && authorizedResolvers.length > 0 ? (
                <div className="space-y-1">
                  {authorizedResolvers.map((resolver: string, idx: number) => (
                    <div key={idx} className="badge badge-success gap-2">
                      <span className="font-mono text-xs">{resolver.slice(0, 8)}...{resolver.slice(-6)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="alert alert-warning">
                  <span>No authorized resolvers found</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Data Comparison */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-4">📈 Data Validation</h2>
            
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Transaction Count</th>
                    <th>Last Update</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-bold">🔮 Oracle</td>
                    <td className="font-mono">
                      {currentTransactionData && currentTransactionData.totalTransactions 
                        ? formatLargeNumber(currentTransactionData.totalTransactions.toString())
                        : "No data"
                      }
                    </td>
                    <td className="text-sm">
                      {currentTransactionData && currentTransactionData.timestamp && Number(currentTransactionData.timestamp) > 0
                        ? formatTimestamp(Number(currentTransactionData.timestamp))
                        : "Never"
                      }
                    </td>
                    <td>
                      <div className={`badge ${currentTransactionData && currentTransactionData.isValid ? 'badge-success' : 'badge-error'}`}>
                        {currentTransactionData && currentTransactionData.isValid ? 'Valid' : 'Invalid'}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="font-bold">🌐 Live API</td>
                    <td className="font-mono">
                      {apiData ? formatLargeNumber(apiData.total_transactions) : "Loading..."}
                    </td>
                    <td className="text-sm">
                      {apiData ? new Date().toLocaleString() : "Loading..."}
                    </td>
                    <td>
                      <div className={`badge ${apiData ? 'badge-success' : 'badge-warning'}`}>
                        {apiData ? 'Connected' : 'Loading'}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="divider">Additional Metrics</div>
            
            {apiData && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold">Today's Transactions:</span>
                  <br />
                  <span className="font-mono">{formatLargeNumber(apiData.transactions_today)}</span>
                </div>
                <div>
                  <span className="font-semibold">Total Blocks:</span>
                  <br />
                  <span className="font-mono">{formatLargeNumber(apiData.total_blocks)}</span>
                </div>
                <div>
                  <span className="font-semibold">Network Addresses:</span>
                  <br />
                  <span className="font-mono">{formatLargeNumber(apiData.total_addresses)}</span>
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
      <div className="card bg-base-100 shadow-xl mb-8">
        <div className="card-body">
          <h2 className="card-title text-2xl mb-4">⚖️ Markets Awaiting Resolution</h2>
          
          {resolvableMarkets && resolvableMarkets.length > 0 ? (
            <div className="space-y-4">
              {resolvableMarkets.map((marketAddress: string, idx: number) => (
                <div key={idx} className="alert alert-info">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <div>
                    <h3 className="font-bold">Market Ready for Resolution</h3>
                    <div className="text-xs font-mono">{marketAddress}</div>
                    <div className="text-sm">This market has expired and can be resolved by the Oracle</div>
                  </div>
                </div>
              ))}
              
              <div className="alert alert-warning">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
                <span>Oracle will automatically resolve these markets when the API service is running</span>
              </div>
            </div>
          ) : (
            <div className="alert alert-success">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>No markets awaiting resolution - All markets are up to date!</span>
            </div>
          )}
        </div>
      </div>

      {/* Recent Resolutions */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-2xl mb-4">📋 Recent Oracle Validations</h2>
          
          {totalMarketsResolved && parseInt(totalMarketsResolved.toString()) > 0 ? (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Market</th>
                    <th>Final Count</th>
                    <th>Result</th>
                    <th>Funds Distributed</th>
                    <th>Resolution Time</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="text-xs font-mono">0x...example</td>
                    <td className="font-mono">2,314,088</td>
                    <td>
                      <div className="badge badge-success">ABOVE THRESHOLD</div>
                    </td>
                    <td>
                      {totalFundsDistributed ? formatEther(totalFundsDistributed) + " ETH" : "0 ETH"}
                    </td>
                    <td className="text-sm">
                      {new Date().toLocaleDateString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="alert alert-info">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>No market resolutions yet. Create and wait for markets to expire to see Oracle validations.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}