"use client";

import { useReadContract } from "wagmi";
import { Address } from "viem";
import React from "react";
import { TRANSACTION_PREDICTION_MARKET_ABI } from "./contracts/TransactionPredictionMarketABI";

interface MarketReaderProps {
  marketAddress: Address;
  onMarketData: (data: any) => void;
}

export function MarketReader({ marketAddress, onMarketData }: MarketReaderProps) {
  // Lecture des données du marché
  const { data: marketInfo } = useReadContract({
    address: marketAddress,
    abi: TRANSACTION_PREDICTION_MARKET_ABI,
    functionName: 'getMarketInfo',
  });

  const { data: totalValueLocked } = useReadContract({
    address: marketAddress,
    abi: TRANSACTION_PREDICTION_MARKET_ABI,
    functionName: 'getTotalValueLocked',
  });

  // Transmettre les données au composant parent
  React.useEffect(() => {
    if (marketInfo && totalValueLocked) {
      const [creator, oracle, description, threshold, deadline, createdAt, status, aboveBets, belowBets, bettorCount, actualCount, winningType] = marketInfo;
      
      onMarketData({
        address: marketAddress,
        creator,
        oracle,
        description,
        threshold,
        deadline,
        createdAt,
        status,
        aboveBets,
        belowBets,
        bettorCount,
        actualCount,
        winningType,
        totalValueLocked
      });
    }
  }, [marketInfo, totalValueLocked, marketAddress, onMarketData]);

  return null; // Ce composant ne rend rien, il ne fait que lire les données
}