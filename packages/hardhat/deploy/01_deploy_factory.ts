import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

/**
 * Deploys the PredictionMarketFactory contract
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployFactory: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  /*
    On localhost, the deployer account is the one that comes with Hardhat, which is already funded.

    When deploying to live networks (e.g `yarn deploy --network sepolia`), the deployer account
    should have sufficient balance to pay for the gas fees for contract creation.

    You can generate a random account with `yarn generate` which will fill DEPLOYER_PRIVATE_KEY
    with a random private key in the .env file (then used on hardhat.config.ts)
    You can run the `yarn account` command to check your balance in every network.
  */
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // Pour l'instant, utiliser le deployer comme oracle par défaut
  // L'Oracle sera déployé et configuré après
  const defaultOracle = deployer;
  console.log("🔮 Deploying Factory with temporary oracle (deployer):", defaultOracle);

  await deploy("PredictionMarketFactory", {
    from: deployer,
    // Contract constructor arguments
    args: [defaultOracle],
    log: true,
    // autoMine: can be passed to the deploy function to make the deployment process faster on local networks by
    // automatically mining the contract deployment transaction. There is no effect on live networks.
    autoMine: true,
  });

  // Get the deployed contract to interact with it after deploying.
  const predictionMarketFactory = await hre.ethers.getContract<PredictionMarketFactory>("PredictionMarketFactory", deployer);
  console.log("📈 PredictionMarketFactory deployed to:", await predictionMarketFactory.getAddress());
  console.log("🔮 Default Oracle set to:", await predictionMarketFactory.defaultOracle());
  
  // Log some initial stats
  const stats = await predictionMarketFactory.getFactoryStats();
  console.log("📊 Factory Stats:");
  console.log("  - Total Markets:", stats[0].toString());
  console.log("  - Active Markets:", stats[1].toString());
  console.log("  - Resolved Markets:", stats[2].toString());
};

export default deployFactory;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags PredictionMarketFactory
deployFactory.tags = ["PredictionMarketFactory"];
// Removed Oracle dependency to break circular dependency