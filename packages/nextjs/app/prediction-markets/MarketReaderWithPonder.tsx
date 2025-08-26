"use client";

import React, { useEffect } from "react";
import { Address, formatEther } from "viem";
import { usePonderQuery, GET_MARKET_DETAILS } from "~~/hooks/usePonderQuery";

interface MarketReaderProps {
  marketAddress: Address;
  onMarketData: (data: any) => void;
}

export function MarketReaderWithPonder({ marketAddress, onMarketData }: MarketReaderProps) {
  const { data, isLoading, error } = usePonderQuery(GET_MARKET_DETAILS, {
    id: marketAddress,
  });

  useEffect(() => {
    if (data && data.market) {
      const market = data.market;
      const bets = data.bets?.items || [];
      
      // Transformer les données Ponder au format attendu par le frontend
      const transformedData = {
        marketInfo: [
          market.creator,
          market.oracle,
          market.description,
          market.transactionThreshold,
          market.deadline,
          market.createdAt,
          market.status === "ACTIVE" ? 0 : market.status === "RESOLVED" ? 1 : 2,
          market.totalAboveBets,
          market.totalBelowBets,
          market.bettorsCount,
          market.actualTransactionCount || 0n,
          market.winningType === "ABOVE_THRESHOLD" ? 0 : 1,
        ],
        tvl: market.totalBets,
        bets: bets,
      };
      
      onMarketData(transformedData);
    }
  }, [data, onMarketData]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-4">
        <span className="loading loading-spinner loading-md"></span>
        <span className="ml-2">Loading market data from indexer...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span>Error loading market data: {(error as Error).message}</span>
      </div>
    );
  }

  if (!data?.market) {
    return (
      <div className="alert alert-warning">
        <span>Market not found in indexer. It may not have been indexed yet.</span>
      </div>
    );
  }

  const market = data.market;

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">{market.description}</h2>
        
        <div className="stats stats-vertical lg:stats-horizontal shadow">
          <div className="stat">
            <div className="stat-title">Total Volume</div>
            <div className="stat-value text-primary">
              {formatEther(BigInt(market.totalBets || 0))} ETH
            </div>
            <div className="stat-desc">{market.bettorsCount} participants</div>
          </div>
          
          <div className="stat">
            <div className="stat-title">Above Threshold</div>
            <div className="stat-value text-success">
              {formatEther(BigInt(market.totalAboveBets || 0))} ETH
            </div>
            <div className="stat-desc">
              {market.totalBets > 0 
                ? Math.round((Number(market.totalAboveBets) / Number(market.totalBets)) * 100) 
                : 0}%
            </div>
          </div>
          
          <div className="stat">
            <div className="stat-title">Below Threshold</div>
            <div className="stat-value text-error">
              {formatEther(BigInt(market.totalBelowBets || 0))} ETH
            </div>
            <div className="stat-desc">
              {market.totalBets > 0 
                ? Math.round((Number(market.totalBelowBets) / Number(market.totalBets)) * 100) 
                : 0}%
            </div>
          </div>
        </div>

        <div className="divider"></div>

        <div className="space-y-2">
          <p><strong>Status:</strong> 
            <span className={`badge ml-2 ${
              market.status === "ACTIVE" ? "badge-success" : 
              market.status === "RESOLVED" ? "badge-info" : "badge-error"
            }`}>
              {market.status}
            </span>
          </p>
          <p><strong>Threshold:</strong> {market.transactionThreshold} transactions</p>
          <p><strong>Deadline:</strong> {new Date(Number(market.deadline) * 1000).toLocaleString()}</p>
          {market.actualTransactionCount && (
            <p><strong>Actual Count:</strong> {market.actualTransactionCount}</p>
          )}
          {market.winningType && (
            <p><strong>Winner:</strong> 
              <span className={`badge ml-2 ${
                market.winningType === "ABOVE_THRESHOLD" ? "badge-success" : "badge-error"
              }`}>
                {market.winningType.replace("_", " ")}
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}