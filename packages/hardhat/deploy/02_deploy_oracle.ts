import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

/**
 * Deploys the PredictionMarketOracle contract and connects it to the Factory
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployOracle: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // Get the deployed Factory contract
  const factoryDeployment = await hre.deployments.get("PredictionMarketFactory");
  const factoryAddress = factoryDeployment.address;

  console.log("🔮 Deploying Oracle connected to Factory:", factoryAddress);

  // Deploy Oracle with Factory address
  await deploy("PredictionMarketOracle", {
    from: deployer,
    args: [factoryAddress],
    log: true,
    autoMine: true,
  });

  // Get deployed contracts
  const oracle = await hre.ethers.getContract("PredictionMarketOracle", deployer);
  const factory = await hre.ethers.getContract("PredictionMarketFactory", deployer);

  const oracleAddress = await oracle.getAddress();
  console.log("✅ Oracle deployed to:", oracleAddress);

  // Update Factory's default oracle
  console.log("🔄 Updating Factory's default oracle...");
  const updateTx = await factory.updateDefaultOracle(oracleAddress);
  await updateTx.wait();

  console.log("✅ Factory's default oracle updated to:", await factory.defaultOracle());

  // Verify Oracle has access to Factory
  const factoryFromOracle = await oracle.factory();
  console.log("🔗 Oracle's factory reference:", factoryFromOracle);
  console.log("✅ Oracle-Factory connection:", factoryFromOracle === factoryAddress ? "CONNECTED" : "ERROR");

  // Log Oracle stats
  console.log("📊 Oracle Stats:");
  console.log("  - Total Markets Resolved:", (await oracle.totalMarketsResolved()).toString());
  console.log("  - Total Funds Distributed:", hre.ethers.formatEther(await oracle.totalFundsDistributed()), "ETH");
  console.log("  - Authorized Resolvers:", (await oracle.authorizedResolvers(deployer)) ? "deployer authorized" : "no resolvers");

  // Set environment variables for the Oracle service
  console.log("\n💡 To start the Oracle service, use these addresses:");
  console.log(`export ORACLE_CONTRACT_ADDRESS=${oracleAddress}`);
  console.log(`export FACTORY_CONTRACT_ADDRESS=${factoryAddress}`);
};

export default deployOracle;

deployOracle.tags = ["PredictionMarketOracle"];
deployOracle.dependencies = ["PredictionMarketFactory"]; // Deploy after Factory