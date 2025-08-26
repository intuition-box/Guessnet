"use client";

import { useReadContract } from "wagmi";
import { Address } from "viem";
import React from "react";
import { TransactionPredictionMarketABI } from "~~/contracts/TransactionPredictionMarketABI";

// Using full ABI from separate file
const MARKET_READ_ABI = [
  {
    "inputs": [],
    "name": "getMarketInfo",
    "outputs": [
      { "internalType": "address", "name": "creator", "type": "address" },
      { "internalType": "address", "name": "oracle", "type": "address" },
      { "internalType": "string", "name": "description", "type": "string" },
      { "internalType": "uint256", "name": "threshold", "type": "uint256" },
      { "internalType": "uint256", "name": "deadline", "type": "uint256" },
      { "internalType": "uint256", "name": "createdAt", "type": "uint256" },
      { "internalType": "uint8", "name": "status", "type": "uint8" },
      { "internalType": "uint256", "name": "aboveBets", "type": "uint256" },
      { "internalType": "uint256", "name": "belowBets", "type": "uint256" },
      { "internalType": "uint256", "name": "bettorCount", "type": "uint256" },
      { "internalType": "uint256", "name": "actualCount", "type": "uint256" },
      { "internalType": "uint8", "name": "winningType", "type": "uint8" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTotalValueLocked",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

interface MarketReaderProps {
  marketAddress: Address;
  onMarketData: (data: any) => void;
}

export function MarketReader({ marketAddress, onMarketData }: MarketReaderProps) {
  // Lecture des données du marché avec l'ABI complet
  const { data: marketInfo, error: marketInfoError, isLoading: marketInfoLoading } = useReadContract({
    address: marketAddress,
    abi: TransactionPredictionMarketABI,
    functionName: 'getMarketInfo',
  });

  const { data: totalValueLocked, error: tvlError, isLoading: tvlLoading } = useReadContract({
    address: marketAddress,
    abi: TransactionPredictionMarketABI,
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
      tvlError: tvlError?.message,
      marketAddress: marketAddress
    });

    // Log raw contract read results
    if (marketInfo) {
      console.log(`📋 RAW marketInfo for ${marketAddress}:`, marketInfo);
    }
    if (totalValueLocked !== undefined) {
      console.log(`💰 RAW totalValueLocked for ${marketAddress}:`, totalValueLocked);
    }
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