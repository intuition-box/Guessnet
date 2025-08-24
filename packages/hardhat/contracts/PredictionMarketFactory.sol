// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "./TransactionPredictionMarket.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PredictionMarketFactory
 * @notice Factory contract for deploying transaction prediction markets
 * @dev Allows users to create and manage multiple prediction market instances
 */
contract PredictionMarketFactory is Ownable, ReentrancyGuard {
    /////////////////
    /// Errors //////
    /////////////////
    
    error PredictionMarketFactory__InvalidDeadline();
    error PredictionMarketFactory__InvalidThreshold();
    error PredictionMarketFactory__EmptyDescription();
    error PredictionMarketFactory__MarketNotFound();
    error PredictionMarketFactory__InvalidOracleAddress();
    error PredictionMarketFactory__MarketCreationFailed();
    
    //////////////////////////
    /// State Variables //////
    //////////////////////////
    
    struct MarketInfo {
        address marketAddress;
        address creator;
        address oracle;
        string description;
        uint256 transactionThreshold;
        uint256 deadline;
        uint256 createdAt;
        bool isActive;
    }
    
    // Array to track all deployed markets
    TransactionPredictionMarket[] public deployedMarkets;
    
    // Mapping for quick market lookups
    mapping(address => uint256) public marketToIndex;
    mapping(address => uint256[]) public creatorToMarkets;
    mapping(address => uint256[]) public oracleToMarkets;
    
    // Market statistics
    uint256 public totalMarketsCreated;
    uint256 public activeMarketsCount;
    
    // Default oracle for markets (can be updated by owner)
    address public defaultOracle;
    
    // Minimum parameters for market creation
    uint256 public constant MIN_MARKET_DURATION = 1 hours;
    uint256 public constant MAX_MARKET_DURATION = 365 days;
    uint256 public constant MIN_TRANSACTION_THRESHOLD = 1;
    uint256 public constant MAX_TRANSACTION_THRESHOLD = 1000000000; // 1 billion
    
    /////////////////////////
    /// Events //////////////
    /////////////////////////
    
    event MarketCreated(
        address indexed marketAddress,
        address indexed creator,
        address indexed oracle,
        string description,
        uint256 transactionThreshold,
        uint256 deadline,
        uint256 marketIndex
    );
    
    event MarketStatusUpdated(
        address indexed marketAddress,
        bool isActive
    );
    
    event DefaultOracleUpdated(
        address indexed oldOracle,
        address indexed newOracle
    );
    
    event MarketResolved(
        address indexed marketAddress,
        uint256 actualTransactionCount,
        uint256 timestamp
    );
    
    /////////////////
    /// Modifiers ///
    /////////////////
    
    modifier validMarketParams(
        string memory _description,
        uint256 _transactionThreshold,
        uint256 _deadline
    ) {
        if (bytes(_description).length == 0) {
            revert PredictionMarketFactory__EmptyDescription();
        }
        if (_transactionThreshold < MIN_TRANSACTION_THRESHOLD || 
            _transactionThreshold > MAX_TRANSACTION_THRESHOLD) {
            revert PredictionMarketFactory__InvalidThreshold();
        }
        if (_deadline <= block.timestamp || 
            _deadline > block.timestamp + MAX_MARKET_DURATION ||
            _deadline < block.timestamp + MIN_MARKET_DURATION) {
            revert PredictionMarketFactory__InvalidDeadline();
        }
        _;
    }
    
    modifier validOracle(address _oracle) {
        if (_oracle == address(0)) {
            revert PredictionMarketFactory__InvalidOracleAddress();
        }
        _;
    }
    
    //////////////////
    ////Constructor///
    //////////////////
    
    /**
     * @notice Initialize the factory with a default oracle
     * @param _defaultOracle Default oracle address for markets
     */
    constructor(address _defaultOracle) Ownable(msg.sender) {
        if (_defaultOracle == address(0)) {
            revert PredictionMarketFactory__InvalidOracleAddress();
        }
        defaultOracle = _defaultOracle;
    }
    
    /////////////////
    /// Functions ///
    /////////////////
    
    /**
     * @notice Create a new transaction prediction market
     * @param _description Human readable description of what is being predicted
     * @param _transactionThreshold The threshold number of transactions
     * @param _deadline Unix timestamp when the market expires
     * @param _customOracle Custom oracle address (use address(0) for default)
     * @return marketAddress Address of the newly created market
     */
    function createTransactionMarket(
        string memory _description,
        uint256 _transactionThreshold,
        uint256 _deadline,
        address _customOracle
    ) 
        external 
        payable
        validMarketParams(_description, _transactionThreshold, _deadline)
        nonReentrant
        returns (address marketAddress) 
    {
        // Use custom oracle or default
        address oracleToUse = _customOracle != address(0) ? _customOracle : defaultOracle;
        
        if (oracleToUse == address(0)) {
            revert PredictionMarketFactory__InvalidOracleAddress();
        }
        
        return _createMarketInternal(_description, _transactionThreshold, _deadline, oracleToUse);
    }
    
    /**
     * @notice Internal function to create a market
     * @dev Used by both single and batch creation functions
     */
    function _createMarketInternal(
        string memory _description,
        uint256 _transactionThreshold,
        uint256 _deadline,
        address _oracle
    ) internal returns (address marketAddress) {
        // Deploy new market contract with initial liquidity
        try new TransactionPredictionMarket{value: msg.value}(
            msg.sender,
            _oracle,
            _description,
            _transactionThreshold,
            _deadline
        ) returns (TransactionPredictionMarket newMarket) {
            marketAddress = address(newMarket);
            
            // Add to tracking arrays and mappings
            deployedMarkets.push(newMarket);
            uint256 marketIndex = deployedMarkets.length - 1;
            
            marketToIndex[marketAddress] = marketIndex;
            creatorToMarkets[msg.sender].push(marketIndex);
            oracleToMarkets[_oracle].push(marketIndex);
            
            // Update statistics
            totalMarketsCreated++;
            activeMarketsCount++;
            
            emit MarketCreated(
                marketAddress,
                msg.sender,
                _oracle,
                _description,
                _transactionThreshold,
                _deadline,
                marketIndex
            );
            
            return marketAddress;
        } catch {
            revert PredictionMarketFactory__MarketCreationFailed();
        }
    }
    
    /**
     * @notice Batch create multiple markets with same oracle
     * @param _descriptions Array of market descriptions
     * @param _thresholds Array of transaction thresholds
     * @param _deadlines Array of market deadlines
     * @param _oracle Oracle address for all markets
     * @return marketAddresses Array of created market addresses
     */
    function batchCreateMarkets(
        string[] memory _descriptions,
        uint256[] memory _thresholds,
        uint256[] memory _deadlines,
        address _oracle
    ) 
        external 
        validOracle(_oracle)
        nonReentrant
        returns (address[] memory marketAddresses) 
    {
        require(_descriptions.length == _thresholds.length && 
                _thresholds.length == _deadlines.length, 
                "Array lengths mismatch");
        require(_descriptions.length > 0, "Empty arrays");
        require(_descriptions.length <= 10, "Too many markets in batch");
        
        marketAddresses = new address[](_descriptions.length);
        
        for (uint256 i = 0; i < _descriptions.length; i++) {
            // Validate parameters for each market
            if (bytes(_descriptions[i]).length == 0) {
                revert PredictionMarketFactory__EmptyDescription();
            }
            if (_thresholds[i] < MIN_TRANSACTION_THRESHOLD || 
                _thresholds[i] > MAX_TRANSACTION_THRESHOLD) {
                revert PredictionMarketFactory__InvalidThreshold();
            }
            if (_deadlines[i] <= block.timestamp || 
                _deadlines[i] > block.timestamp + MAX_MARKET_DURATION ||
                _deadlines[i] < block.timestamp + MIN_MARKET_DURATION) {
                revert PredictionMarketFactory__InvalidDeadline();
            }
            
            marketAddresses[i] = _createMarketInternal(
                _descriptions[i],
                _thresholds[i],
                _deadlines[i],
                _oracle
            );
        }
        
        return marketAddresses;
    }
    
    /**
     * @notice Update default oracle address
     * @param _newDefaultOracle New default oracle address
     */
    function updateDefaultOracle(address _newDefaultOracle) 
        external 
        onlyOwner 
        validOracle(_newDefaultOracle) 
    {
        address oldOracle = defaultOracle;
        defaultOracle = _newDefaultOracle;
        
        emit DefaultOracleUpdated(oldOracle, _newDefaultOracle);
    }
    
    /**
     * @notice Update market status when resolved (called by markets)
     * @param _marketAddress Address of the resolved market
     */
    function notifyMarketResolved(address _marketAddress) external {
        // Verify the caller is a deployed market
        require(marketToIndex[_marketAddress] < deployedMarkets.length, "Invalid market");
        require(address(deployedMarkets[marketToIndex[_marketAddress]]) == msg.sender, 
                "Only market can call");
        
        activeMarketsCount--;
        
        emit MarketStatusUpdated(_marketAddress, false);
    }
    
    /////////////////////////
    /// View Functions //////
    /////////////////////////
    
    /**
     * @notice Get information about a specific market
     * @param _marketIndex Index of the market in deployedMarkets array
     */
    function getMarketInfo(uint256 _marketIndex) 
        external 
        view 
        returns (MarketInfo memory) 
    {
        if (_marketIndex >= deployedMarkets.length) {
            revert PredictionMarketFactory__MarketNotFound();
        }
        
        TransactionPredictionMarket market = deployedMarkets[_marketIndex];
        
        (
            address creator,
            address oracle,
            string memory description,
            uint256 threshold,
            uint256 deadline,
            uint256 createdAt,
            , // status
            , , , , // betting info
             // winning type
        ) = market.getMarketInfo();
        
        return MarketInfo({
            marketAddress: address(market),
            creator: creator,
            oracle: oracle,
            description: description,
            transactionThreshold: threshold,
            deadline: deadline,
            createdAt: createdAt,
            isActive: market.isActive()
        });
    }
    
    /**
     * @notice Get information about a market by its address
     * @param _marketAddress Address of the market contract
     */
    function getMarketInfoByAddress(address _marketAddress) 
        external 
        view 
        returns (MarketInfo memory) 
    {
        uint256 index = marketToIndex[_marketAddress];
        if (index >= deployedMarkets.length || 
            address(deployedMarkets[index]) != _marketAddress) {
            revert PredictionMarketFactory__MarketNotFound();
        }
        
        return this.getMarketInfo(index);
    }
    
    /**
     * @notice Get all markets created by a specific address
     * @param _creator Address of the creator
     */
    function getMarketsByCreator(address _creator) 
        external 
        view 
        returns (address[] memory marketAddresses) 
    {
        uint256[] memory indices = creatorToMarkets[_creator];
        marketAddresses = new address[](indices.length);
        
        for (uint256 i = 0; i < indices.length; i++) {
            marketAddresses[i] = address(deployedMarkets[indices[i]]);
        }
        
        return marketAddresses;
    }
    
    /**
     * @notice Get all markets assigned to a specific oracle
     * @param _oracle Address of the oracle
     */
    function getMarketsByOracle(address _oracle) 
        external 
        view 
        returns (address[] memory marketAddresses) 
    {
        uint256[] memory indices = oracleToMarkets[_oracle];
        marketAddresses = new address[](indices.length);
        
        for (uint256 i = 0; i < indices.length; i++) {
            marketAddresses[i] = address(deployedMarkets[indices[i]]);
        }
        
        return marketAddresses;
    }
    
    /**
     * @notice Get all deployed markets
     * @return marketAddresses Array of all market addresses
     */
    function getAllMarkets() external view returns (address[] memory marketAddresses) {
        marketAddresses = new address[](deployedMarkets.length);
        
        for (uint256 i = 0; i < deployedMarkets.length; i++) {
            marketAddresses[i] = address(deployedMarkets[i]);
        }
        
        return marketAddresses;
    }
    
    /**
     * @notice Get active markets only
     */
    function getActiveMarkets() external view returns (address[] memory activeMarkets) {
        // First pass: count active markets
        uint256 activeCount = 0;
        for (uint256 i = 0; i < deployedMarkets.length; i++) {
            if (deployedMarkets[i].isActive()) {
                activeCount++;
            }
        }
        
        // Second pass: populate active markets array
        activeMarkets = new address[](activeCount);
        uint256 currentIndex = 0;
        
        for (uint256 i = 0; i < deployedMarkets.length; i++) {
            if (deployedMarkets[i].isActive()) {
                activeMarkets[currentIndex] = address(deployedMarkets[i]);
                currentIndex++;
            }
        }
        
        return activeMarkets;
    }
    
    /**
     * @notice Get markets that can be resolved (past deadline but not resolved)
     */
    function getResolvableMarkets() external view returns (address[] memory resolvableMarkets) {
        // First pass: count resolvable markets
        uint256 resolvableCount = 0;
        for (uint256 i = 0; i < deployedMarkets.length; i++) {
            TransactionPredictionMarket market = deployedMarkets[i];
            (, , , , uint256 deadline, , TransactionPredictionMarket.MarketStatus status, , , , ,) 
                = market.getMarketInfo();
            
            if (status == TransactionPredictionMarket.MarketStatus.ACTIVE && 
                block.timestamp >= deadline) {
                resolvableCount++;
            }
        }
        
        // Second pass: populate resolvable markets array
        resolvableMarkets = new address[](resolvableCount);
        uint256 currentIndex = 0;
        
        for (uint256 i = 0; i < deployedMarkets.length; i++) {
            TransactionPredictionMarket market = deployedMarkets[i];
            (, , , , uint256 deadline, , TransactionPredictionMarket.MarketStatus status, , , , ,) 
                = market.getMarketInfo();
            
            if (status == TransactionPredictionMarket.MarketStatus.ACTIVE && 
                block.timestamp >= deadline) {
                resolvableMarkets[currentIndex] = address(market);
                currentIndex++;
            }
        }
        
        return resolvableMarkets;
    }
    
    /**
     * @notice Get factory statistics
     */
    function getFactoryStats() external view returns (
        uint256 totalMarkets,
        uint256 activeMarkets,
        uint256 resolvedMarkets,
        address factoryDefaultOracle
    ) {
        return (
            totalMarketsCreated,
            activeMarketsCount,
            totalMarketsCreated - activeMarketsCount,
            defaultOracle
        );
    }
    
    /**
     * @notice Get total number of deployed markets
     */
    function getMarketsCount() external view returns (uint256) {
        return deployedMarkets.length;
    }
    
    /**
     * @notice Check if an address is a market deployed by this factory
     * @param _marketAddress Address to check
     */
    function isDeployedMarket(address _marketAddress) external view returns (bool) {
        if (deployedMarkets.length == 0) return false;
        
        uint256 index = marketToIndex[_marketAddress];
        return index < deployedMarkets.length && 
               address(deployedMarkets[index]) == _marketAddress;
    }
    
    /**
     * @notice Get paginated markets list
     * @param _offset Starting index
     * @param _limit Number of markets to return
     */
    function getPaginatedMarkets(uint256 _offset, uint256 _limit) 
        external 
        view 
        returns (address[] memory marketAddresses, uint256 totalCount) 
    {
        totalCount = deployedMarkets.length;
        
        if (_offset >= totalCount) {
            return (new address[](0), totalCount);
        }
        
        uint256 end = _offset + _limit;
        if (end > totalCount) {
            end = totalCount;
        }
        
        uint256 length = end - _offset;
        marketAddresses = new address[](length);
        
        for (uint256 i = 0; i < length; i++) {
            marketAddresses[i] = address(deployedMarkets[_offset + i]);
        }
        
        return (marketAddresses, totalCount);
    }
}