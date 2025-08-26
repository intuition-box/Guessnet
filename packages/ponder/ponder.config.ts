import { createConfig } from "@ponder/core";
import { http } from "viem";

import PredictionMarketFactoryABI from "./abis/PredictionMarketFactory.json";
import TransactionPredictionMarketABI from "./abis/TransactionPredictionMarket.json";

export default createConfig({
  networks: {
    hardhat: {
      chainId: 31337,
      transport: http("http://127.0.0.1:8545"),
    },
  },
  contracts: {
    PredictionMarketFactory: {
      abi: PredictionMarketFactoryABI as any,
      network: "hardhat",
      address: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" as `0x${string}`,
      startBlock: 0,
    },
    TransactionPredictionMarket: {
      abi: TransactionPredictionMarketABI as any,
      network: "hardhat",
      factory: {
        address: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" as `0x${string}`,
        event: PredictionMarketFactoryABI.find((e: any) => e.name === "MarketCreated"),
        parameter: "marketAddress",
      },
      startBlock: 0,
    },
  },
});