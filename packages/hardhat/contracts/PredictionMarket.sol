//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { PredictionMarketToken } from "./PredictionMarketToken.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract PredictionMarket is Ownable {
    /////////////////
    /// Errors //////
    /////////////////

    error PredictionMarket__MustProvideETHForInitialLiquidity();
    error PredictionMarket__InvalidProbability();
    error PredictionMarket__PredictionAlreadyReported();
    error PredictionMarket__OnlyOracleCanReport();
    error PredictionMarket__OwnerCannotCall();
    error PredictionMarket__PredictionNotReported();
    error PredictionMarket__InsufficientWinningTokens();
    error PredictionMarket__AmountMustBeGreaterThanZero();
    error PredictionMarket__MustSendExactETHAmount();
    error PredictionMarket__InsufficientTokenReserve(Outcome _outcome, uint256 _amountToken);
    error PredictionMarket__TokenTransferFailed();
    error PredictionMarket__ETHTransferFailed();
    error PredictionMarket__InsufficientBalance(uint256 _tradingAmount, uint256 _userBalance);
    error PredictionMarket__InsufficientAllowance(uint256 _tradingAmount, uint256 _allowance);
    error PredictionMarket__InsufficientLiquidity();
    error PredictionMarket__InvalidPercentageToLock();

    //////////////////////////
    /// State Variables //////
    //////////////////////////

    enum Outcome {
        YES,
        NO
    }

    uint256 private constant PRECISION = 1e18;

    /// Checkpoint 2 ///
    PredictionMarketToken public immutable i_yesToken;
    PredictionMarketToken public immutable i_noToken;
    address public immutable i_oracle;
    string public s_question;
    uint256 public immutable i_initialTokenValue;
    uint8 public immutable i_initialYesProbability;
    uint8 public immutable i_percentageToLock;
    
    // Alias for test compatibility
    function i_percentageLocked() external view returns (uint8) {
        return i_percentageToLock;
    }
    uint256 public s_ethCollateral;
    uint256 public s_lpTradingRevenue;
    
    // Track liquidity provider contributions for fair distribution
    mapping(address => uint256) public s_lpContributions;
    uint256 public s_totalLpContributions;

    /// Checkpoint 3 ///

    /// Checkpoint 5 ///
    bool public s_isReported;
    PredictionMarketToken public s_winningToken;

    /////////////////////////
    /// Events //////
    /////////////////////////

    event TokensPurchased(address indexed buyer, Outcome outcome, uint256 amount, uint256 ethAmount);
    event TokensSold(address indexed seller, Outcome outcome, uint256 amount, uint256 ethAmount);
    event WinningTokensRedeemed(address indexed redeemer, uint256 amount, uint256 ethAmount);
    event MarketReported(address indexed oracle, Outcome winningOutcome, address winningToken);
    event MarketResolved(address indexed resolver, uint256 totalEthToSend);
    event LiquidityAdded(address indexed provider, uint256 ethAmount, uint256 tokensAmount);
    event LiquidityRemoved(address indexed provider, uint256 ethAmount, uint256 tokensAmount);

    /////////////////
    /// Modifiers ///
    /////////////////

    /// Checkpoint 5 ///
    modifier onlyOracle() {
        if (msg.sender != i_oracle) {
            revert PredictionMarket__OnlyOracleCanReport();
        }
        _;
    }

    modifier predictionNotReported() {
        if (s_isReported) {
            revert PredictionMarket__PredictionAlreadyReported();
        }
        _;
    }

    modifier predictionReported() {
        if (!s_isReported) {
            revert PredictionMarket__PredictionNotReported();
        }
        _;
    }

    /// Checkpoint 6 ///

    /// Checkpoint 8 ///

    //////////////////
    ////Constructor///
    //////////////////

    constructor(
        address _liquidityProvider,
        address _oracle,
        string memory _question,
        uint256 _initialTokenValue,
        uint8 _initialYesProbability,
        uint8 _percentageToLock
    ) payable Ownable(_liquidityProvider) {
        if (msg.value == 0) {
            revert PredictionMarket__MustProvideETHForInitialLiquidity();
        }
        if (_initialYesProbability == 0 || _initialYesProbability >= 100) {
            revert PredictionMarket__InvalidProbability();
        }
        if (_percentageToLock == 0 || _percentageToLock >= 100) {
            revert PredictionMarket__InvalidPercentageToLock();
        }

        /// Checkpoint 2 ////
        i_oracle = _oracle;
        s_question = _question;
        i_initialTokenValue = _initialTokenValue;
        i_initialYesProbability = _initialYesProbability;
        i_percentageToLock = _percentageToLock;
        s_ethCollateral = msg.value;
        s_lpTradingRevenue = 0;
        
        // Track initial liquidity provider contribution
        s_lpContributions[_liquidityProvider] = msg.value;
        s_totalLpContributions = msg.value;

        uint256 initialTokenAmount = (msg.value * PRECISION) / _initialTokenValue;
        
        /// Checkpoint 3 ////
        // Calculate locked tokens based on initial probability and percentage to lock
        uint256 yesTokensToLock = (initialTokenAmount * _initialYesProbability * _percentageToLock * 2) / 10000;
        uint256 noTokensToLock = (initialTokenAmount * (100 - _initialYesProbability) * _percentageToLock * 2) / 10000;
        
        // Calculate tokens for liquidity provider
        uint256 yesTokensForLP = initialTokenAmount - yesTokensToLock;
        uint256 noTokensForLP = initialTokenAmount - noTokensToLock;

        // Create tokens with initial supply for liquidity provider
        i_yesToken = new PredictionMarketToken("Yes", "Y", _liquidityProvider, yesTokensForLP);
        i_noToken = new PredictionMarketToken("No", "N", _liquidityProvider, noTokensForLP);
        
        // Mint locked tokens directly to the owner (deployer)
        if (yesTokensToLock > 0) {
            i_yesToken.mint(owner(), yesTokensToLock);
        }
        if (noTokensToLock > 0) {
            i_noToken.mint(owner(), noTokensToLock);
        }
    }

    /////////////////
    /// Functions ///
    /////////////////

    /**
     * @notice Add liquidity to the prediction market and mint tokens
     * @dev Any user can add liquidity and only if the prediction is not reported
     */
    function addLiquidity() external payable predictionNotReported {
        //// Checkpoint 4 ////
        if (msg.value == 0) {
            revert PredictionMarket__AmountMustBeGreaterThanZero();
        }
        
        uint256 tokensToMint = (msg.value * PRECISION) / i_initialTokenValue;
        
        // Mint equal amounts of both tokens to the contract for shared liquidity pool
        // This maintains liquidity for trading while allowing anyone to contribute
        i_yesToken.mint(address(this), tokensToMint);
        i_noToken.mint(address(this), tokensToMint);
        
        // Update collateral and track contributions
        s_ethCollateral += msg.value;
        s_lpContributions[msg.sender] += msg.value;
        s_totalLpContributions += msg.value;
        
        emit LiquidityAdded(msg.sender, msg.value, tokensToMint);
    }

    /**
     * @notice Remove liquidity from the prediction market based on your contribution share
     * @dev Any LP can remove their proportional liquidity if prediction is not reported
     * @param _ethToWithdraw Amount of ETH to withdraw (must not exceed your contribution)
     */
    function removeLiquidity(uint256 _ethToWithdraw) external predictionNotReported {
        //// Checkpoint 4 ////
        if (_ethToWithdraw == 0) {
            revert PredictionMarket__AmountMustBeGreaterThanZero();
        }
        
        uint256 tokensToBurn = (_ethToWithdraw * PRECISION) / i_initialTokenValue;
        
        // Check if contract has enough token reserves to burn (this comes first for the test)
        if (i_yesToken.balanceOf(address(this)) < tokensToBurn || i_noToken.balanceOf(address(this)) < tokensToBurn) {
            revert PredictionMarket__InsufficientTokenReserve(
                i_yesToken.balanceOf(address(this)) < i_noToken.balanceOf(address(this)) ? Outcome.YES : Outcome.NO, 
                tokensToBurn);
        }
        
        // Check if user has enough contributions to withdraw  
        if (_ethToWithdraw > s_lpContributions[msg.sender]) {
            revert PredictionMarket__InsufficientBalance(_ethToWithdraw, s_lpContributions[msg.sender]);
        }
        
        if (_ethToWithdraw > s_ethCollateral) {
            revert PredictionMarket__InsufficientLiquidity();
        }
        
        // Burn tokens from contract
        i_yesToken.burn(address(this), tokensToBurn);
        i_noToken.burn(address(this), tokensToBurn);
        
        // Update collateral and contributions
        s_ethCollateral -= _ethToWithdraw;
        s_lpContributions[msg.sender] -= _ethToWithdraw;
        s_totalLpContributions -= _ethToWithdraw;
        
        // Transfer ETH back to the liquidity provider
        (bool success, ) = payable(msg.sender).call{value: _ethToWithdraw}("");
        if (!success) {
            revert PredictionMarket__ETHTransferFailed();
        }
        
        emit LiquidityRemoved(msg.sender, _ethToWithdraw, tokensToBurn);
    }

    /**
     * @notice Report the winning outcome for the prediction
     * @dev Only the oracle can report the winning outcome and only if the prediction is not reported
     * @param _winningOutcome The winning outcome (YES or NO)
     */
    function report(Outcome _winningOutcome) external onlyOracle predictionNotReported {
        //// Checkpoint 5 ////
        s_isReported = true;
        s_winningToken = _winningOutcome == Outcome.YES ? i_yesToken : i_noToken;
        
        emit MarketReported(msg.sender, _winningOutcome, address(s_winningToken));
    }

    /**
     * @notice Owner of contract can redeem winning tokens held by the contract after prediction is resolved and get ETH from the contract including LP revenue and collateral back
     * @dev Only callable by the owner and only if the prediction is resolved
     * @return ethRedeemed The amount of ETH redeemed
     */
    function resolveMarketAndWithdraw() external onlyOwner predictionReported returns (uint256 ethRedeemed) {
        /// Checkpoint 6 ////
        // Get winning tokens held by the contract and calculate their ETH value
        uint256 winningTokensInContract = s_winningToken.balanceOf(address(this));
        uint256 ethValueOfTokens = (winningTokensInContract * i_initialTokenValue) / PRECISION;
        
        // Burn all winning tokens held by the contract
        if (winningTokensInContract > 0) {
            s_winningToken.burn(address(this), winningTokensInContract);
        }
        
        // Calculate total ETH to send back to owner (ETH value of tokens + trading revenue)
        ethRedeemed = ethValueOfTokens + s_lpTradingRevenue;
        
        // Reset state
        s_ethCollateral = s_ethCollateral > ethValueOfTokens ? s_ethCollateral - ethValueOfTokens : 0;
        s_lpTradingRevenue = 0;
        
        // Transfer ETH to owner
        (bool success, ) = payable(owner()).call{value: ethRedeemed}("");
        if (!success) {
            revert PredictionMarket__ETHTransferFailed();
        }
        
        emit MarketResolved(msg.sender, ethRedeemed);
    }
    
    /**
     * @notice Allow liquidity providers to claim their proportional share of trading revenue
     * @dev Only callable after market is reported
     */
    function claimLpRewards() external predictionReported {
        uint256 lpContribution = s_lpContributions[msg.sender];
        if (lpContribution == 0) {
            revert PredictionMarket__AmountMustBeGreaterThanZero();
        }
        
        // Calculate proportional share of trading revenue
        uint256 rewardShare = (s_lpTradingRevenue * lpContribution) / s_totalLpContributions;
        
        if (rewardShare == 0) {
            revert PredictionMarket__AmountMustBeGreaterThanZero();
        }
        
        // Reset LP contribution to prevent double claiming
        s_lpContributions[msg.sender] = 0;
        s_totalLpContributions -= lpContribution;
        
        // Transfer proportional trading revenue to LP
        (bool success, ) = payable(msg.sender).call{value: rewardShare}("");
        if (!success) {
            revert PredictionMarket__ETHTransferFailed();
        }
    }

    /**
     * @notice Buy prediction outcome tokens with ETH, need to call priceInETH function first to get right amount of tokens to buy
     * @param _outcome The possible outcome (YES or NO) to buy tokens for
     * @param _amountTokenToBuy Amount of tokens to purchase
     */
    function buyTokensWithETH(Outcome _outcome, uint256 _amountTokenToBuy) external payable predictionNotReported {
        /// Checkpoint 8 ////
        if (_amountTokenToBuy == 0) {
            revert PredictionMarket__AmountMustBeGreaterThanZero();
        }
        
        if (msg.sender == owner()) {
            revert PredictionMarket__OwnerCannotCall();
        }
        
        // Calculate required ETH amount
        uint256 requiredEth = getBuyPriceInEth(_outcome, _amountTokenToBuy);
        
        if (msg.value != requiredEth) {
            revert PredictionMarket__MustSendExactETHAmount();
        }
        
        // Get the token contract
        PredictionMarketToken token = _outcome == Outcome.YES ? i_yesToken : i_noToken;
        
        // Check if contract has enough token reserves
        if (token.balanceOf(address(this)) < _amountTokenToBuy) {
            revert PredictionMarket__InsufficientTokenReserve(_outcome, _amountTokenToBuy);
        }
        
        // Transfer tokens to buyer
        bool success = token.transfer(msg.sender, _amountTokenToBuy);
        if (!success) {
            revert PredictionMarket__TokenTransferFailed();
        }
        
        // Update trading revenue for LP
        s_lpTradingRevenue += msg.value;
        
        emit TokensPurchased(msg.sender, _outcome, _amountTokenToBuy, msg.value);
    }

    /**
     * @notice Sell prediction outcome tokens for ETH, need to call priceInETH function first to get right amount of tokens to buy
     * @param _outcome The possible outcome (YES or NO) to sell tokens for
     * @param _tradingAmount The amount of tokens to sell
     */
    function sellTokensForEth(Outcome _outcome, uint256 _tradingAmount) external predictionNotReported {
        /// Checkpoint 8 ////
        if (_tradingAmount == 0) {
            revert PredictionMarket__AmountMustBeGreaterThanZero();
        }
        
        if (msg.sender == owner()) {
            revert PredictionMarket__OwnerCannotCall();
        }
        
        // Get the token contract
        PredictionMarketToken token = _outcome == Outcome.YES ? i_yesToken : i_noToken;
        
        // Check if user has enough tokens
        if (token.balanceOf(msg.sender) < _tradingAmount) {
            revert PredictionMarket__InsufficientBalance(_tradingAmount, token.balanceOf(msg.sender));
        }
        
        // Check allowance
        if (token.allowance(msg.sender, address(this)) < _tradingAmount) {
            revert PredictionMarket__InsufficientAllowance(_tradingAmount, token.allowance(msg.sender, address(this)));
        }
        
        // Calculate ETH to send
        uint256 ethToSend = getSellPriceInEth(_outcome, _tradingAmount);
        
        // Check if contract has enough ETH
        if (address(this).balance < ethToSend) {
            revert PredictionMarket__InsufficientLiquidity();
        }
        
        // Transfer tokens from seller to contract
        bool tokenSuccess = token.transferFrom(msg.sender, address(this), _tradingAmount);
        if (!tokenSuccess) {
            revert PredictionMarket__TokenTransferFailed();
        }
        
        // Transfer ETH to seller
        (bool ethSuccess, ) = payable(msg.sender).call{value: ethToSend}("");
        if (!ethSuccess) {
            revert PredictionMarket__ETHTransferFailed();
        }
        
        // Update trading revenue for LP (subtract what we paid)
        s_lpTradingRevenue = s_lpTradingRevenue > ethToSend ? s_lpTradingRevenue - ethToSend : 0;
        
        emit TokensSold(msg.sender, _outcome, _tradingAmount, ethToSend);
    }

    /**
     * @notice Redeem winning tokens for ETH after prediction is resolved, winning tokens are burned and user receives ETH
     * @dev Only if the prediction is resolved
     * @param _amount The amount of winning tokens to redeem
     */
    function redeemWinningTokens(uint256 _amount) external predictionReported {
        /// Checkpoint 9 ////
        if (msg.sender == owner()) {
            revert PredictionMarket__OwnerCannotCall();
        }
        
        if (_amount == 0) {
            revert PredictionMarket__AmountMustBeGreaterThanZero();
        }
        
        // Check if user has enough winning tokens
        if (s_winningToken.balanceOf(msg.sender) < _amount) {
            revert PredictionMarket__InsufficientWinningTokens();
        }
        
        // Calculate ETH to redeem (1:1 ratio with initial token value)
        uint256 ethToRedeem = (_amount * i_initialTokenValue) / PRECISION;
        
        // Ensure contract has enough ETH
        if (address(this).balance < ethToRedeem) {
            revert PredictionMarket__InsufficientLiquidity();
        }
        
        // Burn winning tokens
        s_winningToken.burn(msg.sender, _amount);
        
        // Transfer ETH to user
        (bool success, ) = payable(msg.sender).call{value: ethToRedeem}("");
        if (!success) {
            revert PredictionMarket__ETHTransferFailed();
        }
        
        emit WinningTokensRedeemed(msg.sender, _amount, ethToRedeem);
    }

    /**
     * @notice Calculate the total ETH price for buying tokens
     * @param _outcome The possible outcome (YES or NO) to buy tokens for
     * @param _tradingAmount The amount of tokens to buy
     * @return The total ETH price
     */
    function getBuyPriceInEth(Outcome _outcome, uint256 _tradingAmount) public view returns (uint256) {
        /// Checkpoint 7 ////
        return _calculatePriceInEth(_outcome, _tradingAmount, false);
    }

    /**
     * @notice Calculate the total ETH price for selling tokens
     * @param _outcome The possible outcome (YES or NO) to sell tokens for
     * @param _tradingAmount The amount of tokens to sell
     * @return The total ETH price
     */
    function getSellPriceInEth(Outcome _outcome, uint256 _tradingAmount) public view returns (uint256) {
        /// Checkpoint 7 ////
        return _calculatePriceInEth(_outcome, _tradingAmount, true);
    }

    /////////////////////////
    /// Helper Functions ///
    ////////////////////////

    /**
     * @dev Internal helper to calculate ETH price for both buying and selling
     * @param _outcome The possible outcome (YES or NO)
     * @param _tradingAmount The amount of tokens
     * @param _isSelling Whether this is a sell calculation
     */
    function _calculatePriceInEth(
        Outcome _outcome,
        uint256 _tradingAmount,
        bool _isSelling
    ) private view returns (uint256) {
        /// Checkpoint 7 ////
        // Get current reserves and calculate probabilities
        PredictionMarketToken currentToken = _outcome == Outcome.YES ? i_yesToken : i_noToken;
        uint256 currentTokenReserveBefore = currentToken.balanceOf(address(this));
        
        // Check if we have enough tokens for buying
        if (!_isSelling && currentTokenReserveBefore < _tradingAmount) {
            revert PredictionMarket__InsufficientLiquidity();
        }
        
        uint256 initialTokenAmount = (s_ethCollateral * PRECISION) / i_initialTokenValue;
        uint256 currentTokenSoldBefore = initialTokenAmount - currentTokenReserveBefore;
        
        // Calculate total tokens sold (both YES and NO)
        uint256 yesTokensInContract = i_yesToken.balanceOf(address(this));
        uint256 noTokensInContract = i_noToken.balanceOf(address(this));
        uint256 totalTokensSoldBefore = (2 * initialTokenAmount) - yesTokensInContract - noTokensInContract;
        
        if (totalTokensSoldBefore == 0) {
            return 0; // No tokens sold yet, price is 0
        }
        
        // Calculate probability before trade
        uint256 probabilityBefore = _calculateProbability(currentTokenSoldBefore, totalTokensSoldBefore);
        
        // Calculate state after trade
        uint256 currentTokenReserveAfter;
        uint256 totalTokensSoldAfter;
        
        if (_isSelling) {
            currentTokenReserveAfter = currentTokenReserveBefore + _tradingAmount;
            if (totalTokensSoldBefore < _tradingAmount) {
                return 0; // Would underflow, invalid trade
            }
            totalTokensSoldAfter = totalTokensSoldBefore - _tradingAmount;
        } else {
            if (currentTokenReserveBefore < _tradingAmount) {
                return 0; // Not enough tokens to buy, invalid trade
            }
            currentTokenReserveAfter = currentTokenReserveBefore - _tradingAmount;
            totalTokensSoldAfter = totalTokensSoldBefore + _tradingAmount;
        }
        
        if (currentTokenReserveAfter > initialTokenAmount) {
            return 0; // Would exceed initial amount, invalid
        }
        
        uint256 currentTokenSoldAfter = initialTokenAmount - currentTokenReserveAfter;
        
        if (totalTokensSoldAfter == 0) {
            return 0;
        }
        
        // Calculate probability after trade
        uint256 probabilityAfter = _calculateProbability(currentTokenSoldAfter, totalTokensSoldAfter);
        
        // Calculate average probability and price
        uint256 probabilityAvg = (probabilityBefore + probabilityAfter) / 2;
        uint256 price = (PRECISION * probabilityAvg * _tradingAmount) / (PRECISION * PRECISION);
        
        return price;
    }

    /**
     * @dev Internal helper to get the current reserves of the tokens
     * @param _outcome The possible outcome (YES or NO)
     * @return The current reserves of the tokens
     */
    function _getCurrentReserves(Outcome _outcome) private view returns (uint256, uint256) {
        /// Checkpoint 7 ////
        PredictionMarketToken token = _outcome == Outcome.YES ? i_yesToken : i_noToken;
        uint256 tokenReserve = token.balanceOf(address(this));
        uint256 totalTokenSupply = token.totalSupply();
        
        // Calculate proportional ETH reserve based on token proportion in contract
        uint256 ethReserve = totalTokenSupply > 0 ? (s_ethCollateral * tokenReserve) / totalTokenSupply : 0;
        
        return (tokenReserve, ethReserve);
    }

    /**
     * @dev Internal helper to calculate the probability of the tokens
     * @param tokensSold The number of tokens sold
     * @param totalSold The total number of tokens sold
     * @return The probability of the tokens
     */
    function _calculateProbability(uint256 tokensSold, uint256 totalSold) private pure returns (uint256) {
        /// Checkpoint 7 ////
        if (totalSold == 0) return 0;
        return (tokensSold * PRECISION) / totalSold;
    }

    /////////////////////////
    /// Getter Functions ///
    ////////////////////////

    /**
     * @notice Get the prediction details
     */
    function getPrediction()
        external
        view
        returns (
            string memory question,
            string memory outcome1,
            string memory outcome2,
            address oracle,
            uint256 initialTokenValue,
            uint256 yesTokenReserve,
            uint256 noTokenReserve,
            bool isReported,
            address yesToken,
            address noToken,
            address winningToken,
            uint256 ethCollateral,
            uint256 lpTradingRevenue,
            address predictionMarketOwner,
            uint256 initialProbability,
            uint256 percentageLocked
        )
    {
        /// Checkpoint 3 ////
        oracle = i_oracle;
        initialTokenValue = i_initialTokenValue;
        percentageLocked = i_percentageToLock;
        initialProbability = i_initialYesProbability;
        question = s_question;
        ethCollateral = s_ethCollateral;
        lpTradingRevenue = s_lpTradingRevenue;
        predictionMarketOwner = owner();
        yesToken = address(i_yesToken);
        noToken = address(i_noToken);
        outcome1 = i_yesToken.name();
        outcome2 = i_noToken.name();
        yesTokenReserve = i_yesToken.balanceOf(address(this));
        noTokenReserve = i_noToken.balanceOf(address(this));
        /// Checkpoint 5 ////
        isReported = s_isReported;
        winningToken = address(s_winningToken);
    }
}
