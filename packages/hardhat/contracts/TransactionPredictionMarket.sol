// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TransactionPredictionMarket
 * @notice Individual prediction market for betting on blockchain transaction counts
 * @dev Allows users to bet on whether transaction count will be above or below a threshold by a deadline
 */
contract TransactionPredictionMarket is ReentrancyGuard {
    /////////////////
    /// Errors //////
    /////////////////
    
    error TransactionPredictionMarket__MarketExpired();
    error TransactionPredictionMarket__MarketNotExpired();
    error TransactionPredictionMarket__MarketAlreadyResolved();
    error TransactionPredictionMarket__MarketNotResolved();
    error TransactionPredictionMarket__InvalidBetAmount();
    error TransactionPredictionMarket__InvalidThreshold();
    error TransactionPredictionMarket__OnlyOracleCanResolve();
    error TransactionPredictionMarket__NoWinningsToClaim();
    error TransactionPredictionMarket__TransferFailed();
    error TransactionPredictionMarket__AlreadyClaimedWinnings();
    
    //////////////////////////
    /// State Variables //////
    //////////////////////////
    
    enum BetType {
        ABOVE_THRESHOLD,  // Bet that transactions will be >= threshold
        BELOW_THRESHOLD   // Bet that transactions will be < threshold
    }
    
    enum MarketStatus {
        ACTIVE,
        RESOLVED,
        CANCELLED
    }
    
    struct Bet {
        address bettor;
        uint256 amount;
        BetType betType;
        bool claimed;
    }
    
    // Market parameters
    address public immutable creator;
    address public oracle;
    string public description;
    uint256 public immutable transactionThreshold;
    uint256 public immutable deadline;
    uint256 public immutable createdAt;
    
    // Market state
    MarketStatus public marketStatus;
    uint256 public actualTransactionCount;
    BetType public winningBetType;
    
    // Betting pools
    uint256 public totalAboveBets;
    uint256 public totalBelowBets;
    uint256 public totalBettors;
    
    // Liquidity tracking
    uint256 public totalLiquidity; // Total ETH in the market
    address public liquidityProvider; // Creator who provided initial liquidity
    
    // Bet tracking
    Bet[] public bets;
    mapping(address => uint256[]) public userBetIds;
    mapping(address => bool) public hasClaimedWinnings;
    
    // Constants
    uint256 private constant HOUSE_FEE_PERCENTAGE = 2; // 2% house fee
    
    /////////////////////////
    /// Events //////////////
    /////////////////////////
    
    event BetPlaced(
        address indexed bettor,
        uint256 indexed betId,
        uint256 amount,
        BetType betType
    );
    
    event MarketResolved(
        uint256 actualTransactionCount,
        BetType winningBetType,
        uint256 timestamp
    );
    
    event WinningsClaimed(
        address indexed winner,
        uint256 amount,
        uint256 timestamp
    );
    
    event OracleUpdated(
        address indexed oldOracle,
        address indexed newOracle
    );
    
    /////////////////
    /// Modifiers ///
    /////////////////
    
    modifier onlyActiveMarket() {
        if (marketStatus != MarketStatus.ACTIVE) {
            revert TransactionPredictionMarket__MarketAlreadyResolved();
        }
        if (block.timestamp >= deadline) {
            revert TransactionPredictionMarket__MarketExpired();
        }
        _;
    }
    
    modifier onlyAfterDeadline() {
        if (block.timestamp < deadline) {
            revert TransactionPredictionMarket__MarketNotExpired();
        }
        _;
    }
    
    modifier onlyOracle() {
        if (msg.sender != oracle) {
            revert TransactionPredictionMarket__OnlyOracleCanResolve();
        }
        _;
    }
    
    modifier onlyResolved() {
        if (marketStatus != MarketStatus.RESOLVED) {
            revert TransactionPredictionMarket__MarketNotResolved();
        }
        _;
    }
    
    //////////////////
    ////Constructor///
    //////////////////
    
    /**
     * @notice Creates a new transaction prediction market
     * @param _creator Address of the market creator
     * @param _oracle Address of the oracle that will resolve the market
     * @param _description Human readable description of the market
     * @param _transactionThreshold The threshold number of transactions to bet on
     * @param _deadline Unix timestamp when betting ends and market can be resolved
     */
    constructor(
        address _creator,
        address _oracle,
        string memory _description,
        uint256 _transactionThreshold,
        uint256 _deadline
    ) payable {
        if (_transactionThreshold == 0) {
            revert TransactionPredictionMarket__InvalidThreshold();
        }
        if (_deadline <= block.timestamp) {
            revert TransactionPredictionMarket__MarketExpired();
        }
        
        creator = _creator;
        oracle = _oracle;
        description = _description;
        transactionThreshold = _transactionThreshold;
        deadline = _deadline;
        createdAt = block.timestamp;
        marketStatus = MarketStatus.ACTIVE;
        
        // Initialize liquidity if ETH is provided
        if (msg.value > 0) {
            totalLiquidity = msg.value;
            liquidityProvider = _creator;
        }
    }
    
    /////////////////
    /// Functions ///
    /////////////////
    
    /**
     * @notice Place a bet on the market
     * @param _betType Whether betting above or below threshold
     */
    function placeBet(BetType _betType) external payable onlyActiveMarket nonReentrant {
        if (msg.value == 0) {
            revert TransactionPredictionMarket__InvalidBetAmount();
        }
        
        // Create new bet
        Bet memory newBet = Bet({
            bettor: msg.sender,
            amount: msg.value,
            betType: _betType,
            claimed: false
        });
        
        bets.push(newBet);
        uint256 betId = bets.length - 1;
        userBetIds[msg.sender].push(betId);
        
        // Update pool totals
        if (_betType == BetType.ABOVE_THRESHOLD) {
            totalAboveBets += msg.value;
        } else {
            totalBelowBets += msg.value;
        }
        
        // Update total liquidity
        totalLiquidity += msg.value;
        
        // Update bettor count if first bet from this address
        if (userBetIds[msg.sender].length == 1) {
            totalBettors++;
        }
        
        emit BetPlaced(msg.sender, betId, msg.value, _betType);
    }
    
    /**
     * @notice Resolve the market with actual transaction count
     * @param _actualTransactionCount The actual number of transactions observed
     * @dev Only callable by oracle after deadline
     */
    function resolveMarket(uint256 _actualTransactionCount) 
        external 
        onlyOracle 
        onlyAfterDeadline 
        nonReentrant 
    {
        if (marketStatus != MarketStatus.ACTIVE) {
            revert TransactionPredictionMarket__MarketAlreadyResolved();
        }
        
        actualTransactionCount = _actualTransactionCount;
        marketStatus = MarketStatus.RESOLVED;
        
        // Determine winning bet type
        if (_actualTransactionCount >= transactionThreshold) {
            winningBetType = BetType.ABOVE_THRESHOLD;
        } else {
            winningBetType = BetType.BELOW_THRESHOLD;
        }
        
        emit MarketResolved(_actualTransactionCount, winningBetType, block.timestamp);
    }
    
    /**
     * @notice Claim winnings for resolved market
     * @dev Winners receive their proportional share of the losing pool minus house fee
     */
    function claimWinnings() external onlyResolved nonReentrant {
        if (hasClaimedWinnings[msg.sender]) {
            revert TransactionPredictionMarket__AlreadyClaimedWinnings();
        }
        
        uint256 totalWinnings = calculateWinnings(msg.sender);
        if (totalWinnings == 0) {
            revert TransactionPredictionMarket__NoWinningsToClaim();
        }
        
        hasClaimedWinnings[msg.sender] = true;
        
        // Transfer winnings
        (bool success, ) = payable(msg.sender).call{value: totalWinnings}("");
        if (!success) {
            revert TransactionPredictionMarket__TransferFailed();
        }
        
        emit WinningsClaimed(msg.sender, totalWinnings, block.timestamp);
    }
    
    /**
     * @notice Update oracle address (only creator can do this before resolution)
     * @param _newOracle New oracle address
     */
    function updateOracle(address _newOracle) external {
        require(msg.sender == creator, "Only creator can update oracle");
        require(marketStatus == MarketStatus.ACTIVE, "Market already resolved");
        
        address oldOracle = oracle;
        oracle = _newOracle;
        
        emit OracleUpdated(oldOracle, _newOracle);
    }
    
    /////////////////////////
    /// View Functions //////
    /////////////////////////
    
    /**
     * @notice Calculate potential winnings for a user
     * @param _user Address of the user
     * @return totalWinnings Total winnings the user can claim
     */
    function calculateWinnings(address _user) public view returns (uint256 totalWinnings) {
        if (marketStatus != MarketStatus.RESOLVED) {
            return 0;
        }
        
        uint256[] memory userBets = userBetIds[_user];
        uint256 userWinningBets = 0;
        
        // Calculate total winning bets for this user
        for (uint256 i = 0; i < userBets.length; i++) {
            Bet memory bet = bets[userBets[i]];
            if (bet.betType == winningBetType && !bet.claimed) {
                userWinningBets += bet.amount;
            }
        }
        
        if (userWinningBets == 0) {
            return 0;
        }
        
        // Calculate winnings based on proportional share of losing pool
        uint256 winningPool = (winningBetType == BetType.ABOVE_THRESHOLD) ? 
            totalAboveBets : totalBelowBets;
        uint256 losingPool = (winningBetType == BetType.ABOVE_THRESHOLD) ? 
            totalBelowBets : totalAboveBets;
        
        if (winningPool == 0) {
            return 0;
        }
        
        // Calculate share: user's winning bets / total winning pool * losing pool
        uint256 userShare = (userWinningBets * losingPool) / winningPool;
        
        // Apply house fee (2%)
        uint256 houseFee = (userShare * HOUSE_FEE_PERCENTAGE) / 100;
        
        // Return original bet + winnings from losing pool - house fee
        totalWinnings = userWinningBets + userShare - houseFee;
    }
    
    /**
     * @notice Get market information
     */
    function getMarketInfo() external view returns (
        address marketCreator,
        address marketOracle,
        string memory marketDescription,
        uint256 threshold,
        uint256 marketDeadline,
        uint256 marketCreatedAt,
        MarketStatus status,
        uint256 aboveBets,
        uint256 belowBets,
        uint256 bettorCount,
        uint256 actualCount,
        BetType winningType
    ) {
        return (
            creator,
            oracle,
            description,
            transactionThreshold,
            deadline,
            createdAt,
            marketStatus,
            totalAboveBets,
            totalBelowBets,
            totalBettors,
            actualTransactionCount,
            winningBetType
        );
    }
    
    /**
     * @notice Get user's bet information
     * @param _user Address of the user
     */
    function getUserBets(address _user) external view returns (
        uint256[] memory betIds,
        uint256[] memory amounts,
        BetType[] memory betTypes,
        bool[] memory claimedStatus
    ) {
        uint256[] memory userBets = userBetIds[_user];
        uint256 betCount = userBets.length;
        
        betIds = new uint256[](betCount);
        amounts = new uint256[](betCount);
        betTypes = new BetType[](betCount);
        claimedStatus = new bool[](betCount);
        
        for (uint256 i = 0; i < betCount; i++) {
            Bet memory bet = bets[userBets[i]];
            betIds[i] = userBets[i];
            amounts[i] = bet.amount;
            betTypes[i] = bet.betType;
            claimedStatus[i] = bet.claimed;
        }
    }
    
    /**
     * @notice Get total value locked in the market
     */
    function getTotalValueLocked() external view returns (uint256) {
        return totalAboveBets + totalBelowBets;
    }
    
    /**
     * @notice Check if market is active and accepting bets
     */
    function isActive() external view returns (bool) {
        return marketStatus == MarketStatus.ACTIVE && block.timestamp < deadline;
    }
    
    /**
     * @notice Get time remaining until deadline
     */
    function getTimeRemaining() external view returns (uint256) {
        if (block.timestamp >= deadline) {
            return 0;
        }
        return deadline - block.timestamp;
    }
}