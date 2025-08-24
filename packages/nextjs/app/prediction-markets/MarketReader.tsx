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
  const { data: marketInfo, error: marketInfoError, isLoading: marketInfoLoading } = useReadContract({
    address: marketAddress,
    abi: TRANSACTION_PREDICTION_MARKET_ABI,
    functionName: 'getMarketInfo',
  });

  const { data: totalValueLocked, error: tvlError, isLoading: tvlLoading } = useReadContract({
    address: marketAddress,
    abi: TRANSACTION_PREDICTION_MARKET_ABI,
    functionName: 'getTotalValueLocked',
  });

  // Debug logging
  React.useEffect(() => {
    console.log(`🔍 MarketReader ${marketAddress.slice(0, 10)}...`, {
      marketInfoLoading,
      tvlLoading,
      hasMarketInfo: !!marketInfo,
      hasTotalValueLocked: !!totalValueLocked,
      marketInfoError: marketInfoError?.message,
      tvlError: tvlError?.message
    });
  }, [marketAddress, marketInfoLoading, tvlLoading, marketInfo, totalValueLocked, marketInfoError, tvlError]);

  // Transmettre les données au composant parent
  React.useEffect(() => {
    if (marketInfo && totalValueLocked !== undefined) {
      console.log(`📊 MarketReader RAW DATA for ${marketAddress.slice(0, 10)}...`);
      console.log("Raw marketInfo:", marketInfo);
      console.log("Raw totalValueLocked:", totalValueLocked);
      
      const [creator, oracle, description, threshold, deadline, createdAt, status, aboveBets, belowBets, bettorCount, actualCount, winningType] = marketInfo;
      
      console.log(`📊 PARSED DATA for ${marketAddress.slice(0, 10)}...`, {
        threshold: threshold?.toString(),
        description,
        aboveBets: aboveBets?.toString(),
        belowBets: belowBets?.toString(),
        totalValueLocked: totalValueLocked?.toString(),
        status
      });
      
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
    } else if (marketInfoError || tvlError) {
      console.error(`❌ MarketReader error for ${marketAddress.slice(0, 10)}...`, {
        marketInfoError: marketInfoError?.message,
        tvlError: tvlError?.message
      });
    }
  }, [marketInfo, totalValueLocked, marketAddress, onMarketData, marketInfoError, tvlError]);

  return null; // Ce composant ne rend rien, il ne fait que lire les données
}