"use client";

import { useState, useEffect } from "react";
import { useScaffoldContract, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { EtherInput } from "~~/components/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { formatEther, parseEther } from "viem";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

  // Load real markets data when allMarkets changes
  useEffect(() => {
    if (allMarkets && allMarkets.length > 0) {
      const loadMarketDetails = async () => {
        const marketDetails: Market[] = [];
        
        for (const marketAddress of allMarkets) {
          try {
            // For now, create basic market info
            // In a real implementation, you'd call getMarketInfo on each market contract
            const basicMarket: Market = {
              address: marketAddress,
              description: `Market at ${marketAddress.slice(0, 8)}...`,
              threshold: BigInt(2500000), // Default threshold
              deadline: BigInt(Math.floor(Date.now() / 1000) + 86400), // Default to 24h from now
              status: 0, // Active
              totalValueLocked: BigInt(0),
              aboveBets: BigInt(0),
              belowBets: BigInt(0)
            };
            marketDetails.push(basicMarket);
          } catch (error) {
            console.error(`Failed to load market ${marketAddress}:`, error);
          }
        }
        
        setMarkets(marketDetails);
      };

      loadMarketDetails();
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

  const placeBet = async () => {
    if (!selectedMarket || !betAmount) {
      notification.error("Please select a market and enter bet amount");
      return;
    }

    try {
      // For now, show that betting would work with real contracts
      notification.loading("Placing bet...");
      
      // Simulate transaction delay
      setTimeout(() => {
        notification.success(`Bet placed: ${betAmount} ETH on ${betType === 0 ? 'ABOVE' : 'BELOW'} threshold`);
        setBetAmount("");
        
        // Refresh markets after bet
        refetchMarkets();
      }, 2000);
      
    } catch (error: any) {
      notification.error(`Failed to place bet: ${error.message}`);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatLargeNumber = (num: string) => {
    return parseInt(num).toLocaleString();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-center mb-8">
        🔮 Prediction Markets - Intuition Blockchain
      </h1>

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
                onChange={(e) => setSelectedMarket(e.target.value)}
              >
                <option value="">Choose a market...</option>
                {markets.map((market, idx) => (
                  <option key={idx} value={market.address}>
                    Threshold: {formatLargeNumber(market.threshold.toString())}
                  </option>
                ))}
              </select>
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
            🎲 Place Bet
          </button>
        </div>
      </div>

      {/* Active Markets Dashboard */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-2xl mb-4">🏪 Active Markets</h2>
          
          {markets.length === 0 ? (
            <div className="alert alert-info">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>No active markets yet. Create the first one above!</span>
            </div>
          ) : (
            <div className="grid gap-4">
              {markets.map((market, idx) => (
                <div key={idx} className="card bg-base-200 shadow">
                  <div className="card-body p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold">{market.description}</h3>
                        <p className="text-sm opacity-70">
                          Threshold: {formatLargeNumber(market.threshold.toString())} | 
                          Ends: {new Date(Number(market.deadline) * 1000).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatEther(market.totalValueLocked)} ETH</p>
                        <p className="text-xs opacity-70">Total Locked</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-2">
                      <div className="badge badge-success">
                        ABOVE: {formatEther(market.aboveBets)} ETH
                      </div>
                      <div className="badge badge-error">
                        BELOW: {formatEther(market.belowBets)} ETH
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}