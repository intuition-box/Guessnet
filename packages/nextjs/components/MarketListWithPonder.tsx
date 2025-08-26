"use client";

import React from "react";
import { usePonderQuery, GET_ACTIVE_MARKETS } from "../hooks/usePonderQuery";
import { formatEther } from "viem";

export const MarketListWithPonder: React.FC = () => {
  const { data, isLoading, error } = usePonderQuery(GET_ACTIVE_MARKETS);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 p-4">
        Error loading markets: {(error as Error).message}
      </div>
    );
  }

  const markets = data?.markets?.items || [];

  if (markets.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500">
        No active markets found
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {markets.map((market: any) => {
        const totalBets = BigInt(market.totalBets);
        const aboveBets = BigInt(market.totalAboveBets);
        const belowBets = BigInt(market.totalBelowBets);
        const deadline = new Date(Number(market.deadline) * 1000);
        
        const abovePercentage = totalBets > 0n 
          ? Number((aboveBets * 100n) / totalBets)
          : 50;

        return (
          <div 
            key={market.id} 
            className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow"
          >
            <div className="card-body">
              <h2 className="card-title text-lg">{market.description}</h2>
              
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Threshold:</span>
                  <span className="font-semibold">{market.transactionThreshold}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-500">Deadline:</span>
                  <span className="font-semibold">
                    {deadline.toLocaleDateString()} {deadline.toLocaleTimeString()}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Pool:</span>
                  <span className="font-semibold">
                    {formatEther(totalBets)} ETH
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-500">Participants:</span>
                  <span className="font-semibold">{market.bettorsCount}</span>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex justify-between text-xs mb-1">
                  <span>Above ({abovePercentage}%)</span>
                  <span>Below ({100 - abovePercentage}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ width: `${abovePercentage}%` }}
                  ></div>
                </div>
              </div>

              <div className="card-actions justify-end mt-4">
                <a 
                  href={`/market/${market.id}`}
                  className="btn btn-primary btn-sm"
                >
                  View Details
                </a>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};