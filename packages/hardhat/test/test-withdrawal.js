const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Initial Liquidity Withdrawal", function () {
  let factory, oracle, market, creator, user1, user2;
  const initialLiquidity = ethers.parseEther("1.0"); // 1 ETH initial
  const threshold = 1000000;
  const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

  before(async function () {
    [creator, user1, user2] = await ethers.getSigners();

    // Deploy Factory with creator as temporary oracle
    const Factory = await ethers.getContractFactory("PredictionMarketFactory");
    factory = await Factory.deploy(creator.address); // Use creator as temporary oracle
    await factory.waitForDeployment();

    // Deploy Oracle with factory address
    const Oracle = await ethers.getContractFactory("PredictionMarketOracle");
    oracle = await Oracle.deploy(await factory.getAddress());
    await oracle.waitForDeployment();

    // Update factory's default oracle
    await factory.updateDefaultOracle(await oracle.getAddress());

    // Create market with initial liquidity
    const tx = await factory.connect(creator).createTransactionMarket(
      "Test market",
      threshold,
      deadline,
      await oracle.getAddress(),
      { value: initialLiquidity }
    );
    
    const receipt = await tx.wait();
    const event = receipt.logs.find(log => log.topics[0] === ethers.id("MarketCreated(address,address,address,string,uint256,uint256)"));
    const marketAddress = ethers.AbiCoder.defaultAbiCoder().decode(['address'], event.topics[1])[0];

    market = await ethers.getContractAt("TransactionPredictionMarket", marketAddress);
  });

  it("Should allow users to place bets", async function () {
    // User1 bets 0.5 ETH ABOVE
    await market.connect(user1).placeBet(0, { value: ethers.parseEther("0.5") }); // 0 = ABOVE
    
    // User2 bets 0.3 ETH BELOW  
    await market.connect(user2).placeBet(1, { value: ethers.parseEther("0.3") }); // 1 = BELOW

    const [,,,,,,, aboveBets, belowBets] = await market.getMarketInfo();
    expect(aboveBets).to.equal(ethers.parseEther("0.5"));
    expect(belowBets).to.equal(ethers.parseEther("0.3"));
  });

  it("Should resolve market and calculate winnings correctly", async function () {
    // Fast forward past deadline
    await ethers.provider.send("evm_increaseTime", [3700]);
    await ethers.provider.send("evm_mine");

    // Resolve market (ABOVE wins since 2000000 > 1000000)
    await market.resolveMarket(2000000);

    // Check User1 can claim winnings (ABOVE winner)
    const winnings = await market.calculateWinnings(user1.address);
    expect(winnings).to.be.gt(ethers.parseEther("0.5")); // Should get original bet + share of losing pool

    await market.connect(user1).claimWinnings();
  });

  it("Should allow creator to withdraw initial liquidity", async function () {
    const creatorBalanceBefore = await ethers.provider.getBalance(creator.address);
    
    // Withdraw initial liquidity
    const tx = await market.connect(creator).withdrawInitialLiquidity();
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed * receipt.gasPrice;

    const creatorBalanceAfter = await ethers.provider.getBalance(creator.address);
    
    // Creator should have received initial liquidity minus gas
    const expectedBalance = creatorBalanceBefore + initialLiquidity - gasUsed;
    expect(creatorBalanceAfter).to.be.closeTo(expectedBalance, ethers.parseEther("0.01"));
    
    // Should emit event
    expect(tx).to.emit(market, "InitialLiquidityWithdrawn").withArgs(
      creator.address, 
      initialLiquidity, 
      await time.latest()
    );
  });

  it("Should prevent double withdrawal", async function () {
    await expect(
      market.connect(creator).withdrawInitialLiquidity()
    ).to.be.revertedWith("Initial liquidity already withdrawn");
  });

  it("Should prevent non-creator from withdrawing", async function () {
    // Deploy new market for this test
    const tx = await factory.connect(creator).createTransactionMarket(
      "Test market 2",
      threshold,
      deadline + 7200,
      await oracle.getAddress(),
      { value: initialLiquidity }
    );
    
    const receipt = await tx.wait();
    const event = receipt.logs.find(log => log.topics[0] === ethers.id("MarketCreated(address,address,address,string,uint256,uint256)"));
    const marketAddress2 = ethers.AbiCoder.defaultAbiCoder().decode(['address'], event.topics[1])[0];
    const market2 = await ethers.getContractAt("TransactionPredictionMarket", marketAddress2);

    // Fast forward and resolve
    await ethers.provider.send("evm_increaseTime", [7300]);
    await market2.resolveMarket(500000);

    await expect(
      market2.connect(user1).withdrawInitialLiquidity()
    ).to.be.revertedWith("Only creator can withdraw initial liquidity");
  });
});