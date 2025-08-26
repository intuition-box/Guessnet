"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { formatEther, Address } from "viem";
import { notification } from "~~/utils/scaffold-eth";
import { usePonderQuery, GET_ALL_MARKETS, GET_USER_BETS } from "~~/hooks/usePonderQuery";
import ClientOnly from "~~/components/ClientOnly";

interface UserBet {
  marketAddress: string;
  marketDescription: string;
  betType: number; // 0 = ABOVE, 1 = BELOW
  amount: bigint;
  threshold: bigint;
  deadline: bigint;
  status: "active" | "won" | "lost" | "resolved";
  potentialWinnings: bigint;
  canWithdraw: boolean;
  betId: number;
  claimed: boolean;
}

// Dynamic imports to avoid SSR issues
const DynamicMyBetsContent = dynamic(() => Promise.resolve(MyBetsContent), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="loading loading-spinner loading-lg text-violet-400"></div>
    </div>
  )
});

export default function MyBetsPage() {
  return (
    <ClientOnly>
      <DynamicMyBetsContent />
    </ClientOnly>
  );
}

function MyBetsContent() {
  const { useAccount } = require("wagmi");
  const { useWriteContract } = require("wagmi");
  const { address: userAddress } = useAccount();
  const [userBets, setUserBets] = useState<UserBet[]>([]);
  const [isClient, setIsClient] = useState(false);

  // Get markets data from Ponder
  const { data: marketsData, isLoading: marketsLoading } = usePonderQuery(GET_ALL_MARKETS);
  
  // Get user's bets from Ponder
  const { data: userBetsData, isLoading: userBetsLoading } = usePonderQuery(
    GET_USER_BETS, 
    { address: userAddress || "" }
  );

  // Initialize client-side rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load REAL user bets from Ponder indexed data
  useEffect(() => {
    if (!isClient || !userAddress || !userBetsData || !marketsData) return;

    const loadUserBets = () => {
      const allUserBets: UserBet[] = [];
      
      // Create a map of markets for quick lookup
      const marketsMap = new Map();
      if (marketsData?.markets?.items) {
        marketsData.markets.items.forEach((market: any) => {
          marketsMap.set(market.id, market);
        });
      }

      if (userBetsData?.bets?.items) {
        userBetsData.bets.items.forEach((bet: any) => {
          const market = marketsMap.get(bet.marketAddress);
          if (!market) return; // Skip if market not found
          
          const now = Math.floor(Date.now() / 1000);
          const isExpired = parseInt(market.deadline) <= now;
          const isResolved = market.status === "RESOLVED";
          
          let status: "active" | "won" | "lost" | "resolved" = "active";
          let canWithdraw = false;
          let potentialWinnings = BigInt(bet.winnings || "0");
          
          if (isResolved) {
            // Market is resolved
            status = potentialWinnings > BigInt(0) ? "won" : "lost";
            canWithdraw = potentialWinnings > BigInt(0) && !bet.claimed;
          } else if (isExpired) {
            // Market expired but not resolved yet  
            status = "resolved";
            canWithdraw = false; // Will be determined after auto-resolution
          }

          const userBet: UserBet = {
            marketAddress: bet.marketAddress,
            marketDescription: market.description,
            betType: bet.betType === "ABOVE_THRESHOLD" ? 0 : 1,
            amount: BigInt(bet.amount), // Real bet amount from Ponder
            threshold: BigInt(market.transactionThreshold),
            deadline: BigInt(market.deadline),
            status,
            potentialWinnings, // Real winnings from Ponder (calculated on-chain)
            canWithdraw,
            betId: parseInt(bet.id.split('-').pop() || "0"), // Extract bet ID from composite key
            claimed: bet.claimed // Real claimed status from Ponder
          };

          allUserBets.push(userBet);
        });
      }

      setUserBets(allUserBets);
    };

    loadUserBets();
  }, [isClient, userAddress, userBetsData, marketsData]);

  const { writeContractAsync } = useWriteContract();

  const handleWithdrawWinnings = async (marketAddress: string) => {
    if (!userAddress) {
      notification.error("Please connect your wallet");
      return;
    }

    try {
      notification.loading("Claiming winnings...");
      
      // Import the ABI for TransactionPredictionMarket
      let TransactionPredictionMarketABI;
      try {
        const abiModule = await import("~~/contracts/TransactionPredictionMarketABI");
        TransactionPredictionMarketABI = abiModule.TransactionPredictionMarketABI;
      } catch (error) {
        console.error("Failed to import ABI:", error);
        notification.error("Failed to load contract ABI");
        return;
      }
      
      // Call the real claimWinnings function on the specific market contract
      const result = await writeContractAsync({
        address: marketAddress as Address,
        abi: TransactionPredictionMarketABI,
        functionName: "claimWinnings",
        args: [],
      });
      
      console.log("✅ Winnings claimed:", result);
      
      notification.remove();
      notification.success("🎉 Winnings claimed successfully!");
      
      // Update the bet status - mark as claimed
      setUserBets(prev => 
        prev.map(bet => 
          bet.marketAddress === marketAddress 
            ? { ...bet, canWithdraw: false, claimed: true }
            : bet
        )
      );
      
    } catch (error: any) {
      console.error("Claim winnings error:", error);
      notification.remove();
      notification.error(`Failed to claim winnings: ${error.shortMessage || error.message || error}`);
    }
  };

  const handleCancelBet = async (marketAddress: string) => {
    // Mock cancel bet functionality - in production this might not be possible depending on market rules
    notification.info("Cancel bet functionality not implemented yet");
  };

  const getBetTypeDisplay = (betType: number) => {
    return betType === 0 ? "📈 Above" : "📉 Below";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <div className="badge bg-violet-200 text-gray-900">Active</div>;
      case "won":
        return <div className="badge bg-green-100 text-green-800">Won</div>;
      case "lost":
        return <div className="badge bg-gray-100 text-gray-600">Lost</div>;
      case "resolved":
        return <div className="badge bg-yellow-100 text-yellow-800">Ready to Claim</div>;
      default:
        return <div className="badge bg-gray-100 text-gray-600">Unknown</div>;
    }
  };

  const formatTimeRemaining = (deadline: bigint) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = Number(deadline) - now;
    
    if (diff <= 0) return "Expired";
    
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const totalBetAmount = userBets.reduce((sum, bet) => sum + Number(formatEther(bet.amount)), 0);
  const totalPotentialWinnings = userBets
    .filter(bet => bet.potentialWinnings && bet.canWithdraw)
    .reduce((sum, bet) => sum + Number(formatEther(bet.potentialWinnings)), 0);
    
  const userStats = userBetsData?.user || null;
  const isLoading = marketsLoading || userBetsLoading;

  // Render loading state during SSR and initial client load
  if (!isClient || typeof window === 'undefined') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="loading loading-spinner loading-lg text-violet-400"></div>
      </div>
    );
  }

  if (!userAddress) {
    return (
      <div className="min-h-screen bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold text-center mb-8 text-gray-100">
            💰 My Bets
          </h1>
          <div className="text-center py-16">
            <div className="text-gray-400 text-6xl mb-4">🔒</div>
            <p className="text-xl text-gray-300 mb-4">Connect your wallet to view your bets</p>
            <p className="text-gray-500">Your betting history and winnings will appear here</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-100">
          💰 My Bets
        </h1>

        {/* Portfolio Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card bg-white shadow-xl border border-gray-200">
            <div className="card-body text-center">
              <h3 className="text-lg font-semibold text-gray-800">Total Bet Amount</h3>
              <div className="text-2xl font-bold text-gray-900">
                {totalBetAmount.toFixed(3)} ETH
              </div>
              <div className="text-sm text-gray-500">{userBets.length} active positions</div>
            </div>
          </div>
          
          <div className="card bg-white shadow-xl border border-gray-200">
            <div className="card-body text-center">
              <h3 className="text-lg font-semibold text-gray-800">Potential Winnings</h3>
              <div className="text-2xl font-bold text-green-600">
                {totalPotentialWinnings.toFixed(3)} ETH
              </div>
              <div className="text-sm text-gray-500">Available to claim</div>
            </div>
          </div>
          
          <div className="card bg-white shadow-xl border border-gray-200">
            <div className="card-body text-center">
              <h3 className="text-lg font-semibold text-gray-800">Win Rate</h3>
              <div className="text-2xl font-bold text-violet-600">
                {userStats ? 
                  (userStats.betsWon + userStats.betsLost > 0 ? 
                    Math.round((userStats.betsWon / (userStats.betsWon + userStats.betsLost)) * 100) : 0) + '%'
                  : (userBets.length > 0 ? Math.round((userBets.filter(bet => bet.status === "won").length / userBets.length) * 100) : 0) + '%'
                }
              </div>
              <div className="text-sm text-gray-500">
                {userStats ? `${userStats.betsWon}W / ${userStats.betsLost}L` : 'Success rate'}
              </div>
            </div>
          </div>
        </div>

        {/* My Bets Table */}
        <div className="card bg-white shadow-xl border border-gray-200">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-4 text-gray-800">📊 Betting History</h2>
            
            {isLoading ? (
              <div className="text-center py-12">
                <div className="loading loading-spinner loading-lg mb-4 text-violet-400"></div>
                <p className="text-lg text-gray-700">Loading your bets...</p>
              </div>
            ) : userBets.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">📊</div>
                <p className="text-xl text-gray-700 mb-2">No bets placed yet</p>
                <p className="text-gray-500">Start betting on prediction markets to see your history here!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr className="border-gray-200 bg-gray-50">
                      <th className="text-gray-800 font-semibold">Market</th>
                      <th className="text-gray-800 font-semibold">Bet</th>
                      <th className="text-gray-800 font-semibold">Amount</th>
                      <th className="text-gray-800 font-semibold">Status</th>
                      <th className="text-gray-800 font-semibold">Time Left</th>
                      <th className="text-gray-800 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userBets.map((bet, index) => (
                      <tr key={index} className="border-gray-200 hover:bg-gray-50">
                        <td className="p-4 max-w-xs">
                          <div className="text-sm font-medium text-gray-900 line-clamp-2">
                            {bet.marketDescription}
                          </div>
                          <div className="text-xs text-gray-500 font-mono mt-1">
                            {bet.marketAddress.slice(0, 10)}...
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900">
                              {getBetTypeDisplay(bet.betType)}
                            </span>
                            <span className="text-xs text-gray-500">
                              Threshold: {Number(bet.threshold).toLocaleString()}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="font-mono text-gray-900">
                            {formatEther(bet.amount)} ETH
                          </div>
                          {bet.potentialWinnings && (
                            <div className="text-xs text-green-600">
                              Win: {formatEther(bet.potentialWinnings)} ETH
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          {getStatusBadge(bet.status)}
                        </td>
                        <td className="p-4 text-sm text-gray-600">
                          {formatTimeRemaining(bet.deadline)}
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            {bet.canWithdraw && (
                              <button
                                className="btn btn-xs bg-violet-200 hover:bg-violet-300 text-gray-900 border-violet-200"
                                onClick={() => handleWithdrawWinnings(bet.marketAddress)}
                              >
                                💰 Withdraw
                              </button>
                            )}
                            {bet.status === "resolved" && !bet.canWithdraw && (
                              <button
                                className="btn btn-xs bg-violet-200 hover:bg-violet-300 text-gray-900 border-violet-200"
                                onClick={() => handleWithdrawWinnings(bet.marketAddress)}
                              >
                                💰 Check & Claim
                              </button>
                            )}
                            {(bet.status === "lost" || (bet.status === "resolved" && !bet.canWithdraw && bet.claimed)) && (
                              <span className="text-xs text-gray-400">No actions</span>
                            )}
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

        {/* Quick Actions */}
        <div className="card bg-white shadow-xl border border-gray-200 mt-8">
          <div className="card-body">
            <h2 className="card-title text-xl mb-4 text-gray-800">⚡ Quick Actions</h2>
            <div className="flex flex-wrap gap-4">
              <button 
                className="btn bg-violet-200 hover:bg-violet-300 text-gray-900 border-violet-200"
                onClick={() => window.location.href = '/'}
              >
                🎯 Place New Bet
              </button>
              <button 
                className="btn bg-white hover:bg-gray-900 hover:text-white text-gray-700 border-gray-300"
                onClick={() => setUserBets(prev => [...prev])} // Refresh mock data
              >
                🔄 Refresh Bets
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}