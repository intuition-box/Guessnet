import { useQuery } from "@tanstack/react-query";

const PONDER_URL = process.env.NEXT_PUBLIC_PONDER_URL || "http://localhost:42069";

export const usePonderQuery = (query: string, variables?: any) => {
  return useQuery({
    queryKey: ["ponder", query, variables],
    queryFn: async () => {
      const response = await fetch(PONDER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const data = await response.json();
      
      if (data.errors) {
        throw new Error(data.errors[0].message);
      }

      return data.data;
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });
};

// Example queries
export const GET_ALL_MARKETS = `
  query GetAllMarkets {
    markets(orderBy: "createdAt", orderDirection: "desc") {
      items {
        id
        creator
        oracle
        description
        transactionThreshold
        deadline
        status
        isActive
        totalAboveBets
        totalBelowBets
        totalBets
        bettorsCount
        createdAt
      }
    }
  }
`;

export const GET_MARKET_DETAILS = `
  query GetMarketDetails($id: String!) {
    market(id: $id) {
      id
      creator
      oracle
      description
      transactionThreshold
      deadline
      status
      isActive
      totalAboveBets
      totalBelowBets
      totalBets
      bettorsCount
      resolvedAt
      actualTransactionCount
      winningType
    }
    bets(where: { marketAddress: $id }) {
      items {
        id
        bettor
        amount
        betType
        timestamp
        claimed
      }
    }
  }
`;

export const GET_USER_BETS = `
  query GetUserBets($address: String!) {
    bets(where: { bettor: $address }, orderBy: "timestamp", orderDirection: "desc") {
      items {
        id
        marketAddress
        amount
        betType
        timestamp
        claimed
        winnings
      }
    }
    user(id: $address) {
      totalBetsPlaced
      totalWinnings
      betsWon
      betsLost
    }
  }
`;

export const GET_ACTIVE_MARKETS = `
  query GetActiveMarkets {
    markets(where: { status: "ACTIVE" }, orderBy: "deadline", orderDirection: "asc") {
      items {
        id
        description
        transactionThreshold
        deadline
        totalAboveBets
        totalBelowBets
        totalBets
        bettorsCount
      }
    }
  }
`;

export const GET_MARKET_STATS = `
  query GetMarketStats($marketAddress: String!) {
    marketStats(
      where: { marketAddress: $marketAddress }
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: 24
    ) {
      items {
        timestamp
        hourlyVolume
        hourlyBetsCount
        aboveBetsRatio
        belowBetsRatio
      }
    }
  }
`;

export const GET_FACTORY_STATS = `
  query GetFactoryStats {
    factory(id: "main") {
      totalMarketsCreated
      activeMarketsCount
      defaultOracle
    }
  }
`;