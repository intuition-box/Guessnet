// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "./TransactionPredictionMarket.sol";
import "./PredictionMarketFactory.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PredictionMarketOracle
 * @notice Oracle de clôture automatique pour les marchés de prédiction
 * @dev Surveille les dates de fin et clôture automatiquement les marchés expirés
 * 
 * RÔLE DANS LE SYSTÈME GLOBAL :
 * - Surveille en permanence tous les marchés créés via la Factory
 * - Vérifie les dates de fin et identifie les marchés expirés
 * - Récupère les données de transaction via l'API Intuition (via backend)
 * - Détermine automatiquement les résultats et distribue les gains
 * - Assure la sécurité et l'intégrité de tout le processus de clôture
 */
contract PredictionMarketOracle is Ownable, ReentrancyGuard {
    
    /////////////////
    /// Erreurs /////
    /////////////////
    
    error Oracle__OnlyAuthorizedResolver();
    error Oracle__MarketNotExpired();
    error Oracle__MarketAlreadyResolved();
    error Oracle__InvalidMarketAddress();
    error Oracle__InvalidTransactionData();
    error Oracle__ResolverAlreadyExists();
    error Oracle__ResolverNotFound();
    error Oracle__EmptyMarketsList();
    error Oracle__DistributionFailed();

    //////////////////////////
    /// Variables d'État /////
    //////////////////////////
    
    /**
     * @notice Structure pour stocker les données de transaction Intuition
     * @param totalTransactions Nombre total de transactions sur la blockchain
     * @param timestamp Timestamp de récupération des données
     * @param blockNumber Numéro de bloc au moment de la récupération
     * @param isValid Indique si les données sont valides
     */
    struct TransactionData {
        uint256 totalTransactions;
        uint256 timestamp;
        uint256 blockNumber;
        bool isValid;
    }
    
    /**
     * @notice Structure pour suivre l'état de résolution d'un marché
     * @param isResolved Indique si le marché a été résolu
     * @param resolutionTimestamp Timestamp de résolution
     * @param finalTransactionCount Nombre final de transactions utilisé pour la résolution
     * @param winningType Type gagnant déterminé
     */
    struct MarketResolution {
        bool isResolved;
        uint256 resolutionTimestamp;
        uint256 finalTransactionCount;
        TransactionPredictionMarket.BetType winningType;
    }

    // Factory de marchés de prédiction
    PredictionMarketFactory public immutable factory;
    
    // Données de transaction actuelles depuis l'API Intuition
    TransactionData public currentTransactionData;
    
    // Mapping des résolutions de marchés
    mapping(address => MarketResolution) public marketResolutions;
    
    // Résolveurs autorisés (services backend qui alimentent l'oracle)
    mapping(address => bool) public authorizedResolvers;
    
    // Liste des résolveurs pour énumération
    address[] public resolversList;
    
    // Paramètres de sécurité
    uint256 public constant MAX_DATA_AGE = 1 hours; // Age max des données acceptées
    uint256 public constant MIN_RESOLUTION_DELAY = 5 minutes; // Délai min après expiration
    
    // Statistiques
    uint256 public totalMarketsResolved;
    uint256 public totalFundsDistributed;
    
    ///////////////////////
    /// Événements ////////
    ///////////////////////
    
    /**
     * @notice Émis quand un marché est automatiquement clôturé
     * @param marketAddress Adresse du marché clôturé
     * @param finalTransactionCount Nombre final de transactions
     * @param winningType Type gagnant (ABOVE_THRESHOLD ou BELOW_THRESHOLD)
     * @param resolutionTimestamp Timestamp de clôture
     */
    event MarketClosed(
        address indexed marketAddress,
        uint256 finalTransactionCount,
        TransactionPredictionMarket.BetType winningType,
        uint256 resolutionTimestamp
    );
    
    /**
     * @notice Émis quand le résultat d'un marché est validé
     * @param marketAddress Adresse du marché
     * @param threshold Seuil du marché
     * @param actualTransactions Transactions réelles
     * @param isAboveThreshold Résultat : true si au-dessus du seuil
     */
    event ResultValidated(
        address indexed marketAddress,
        uint256 threshold,
        uint256 actualTransactions,
        bool isAboveThreshold
    );
    
    /**
     * @notice Émis quand la distribution des gains est effectuée
     * @param marketAddress Adresse du marché
     * @param totalDistributed Montant total distribué
     * @param winnersCount Nombre de gagnants
     * @param distributionTimestamp Timestamp de distribution
     */
    event DistributionCompleted(
        address indexed marketAddress,
        uint256 totalDistributed,
        uint256 winnersCount,
        uint256 distributionTimestamp
    );
    
    /**
     * @notice Émis quand les données de transaction sont mises à jour
     * @param totalTransactions Nouveau nombre total de transactions
     * @param timestamp Timestamp de mise à jour
     * @param resolver Adresse du résolveur qui a fourni les données
     */
    event TransactionDataUpdated(
        uint256 totalTransactions,
        uint256 timestamp,
        address indexed resolver
    );
    
    /**
     * @notice Émis quand un résolveur autorisé est ajouté
     * @param resolver Adresse du nouveau résolveur
     */
    event ResolverAdded(address indexed resolver);
    
    /**
     * @notice Émis quand un résolveur est supprimé
     * @param resolver Adresse du résolveur supprimé
     */
    event ResolverRemoved(address indexed resolver);

    /////////////////////
    /// Modificateurs ///
    /////////////////////
    
    /**
     * @notice Vérifie que l'appelant est un résolveur autorisé
     */
    modifier onlyAuthorizedResolver() {
        if (!authorizedResolvers[msg.sender]) {
            revert Oracle__OnlyAuthorizedResolver();
        }
        _;
    }
    
    /**
     * @notice Vérifie que le marché existe et n'est pas encore résolu
     * @param marketAddress Adresse du marché à vérifier
     */
    modifier validUnresolvedMarket(address marketAddress) {
        if (marketAddress == address(0)) {
            revert Oracle__InvalidMarketAddress();
        }
        if (marketResolutions[marketAddress].isResolved) {
            revert Oracle__MarketAlreadyResolved();
        }
        _;
    }

    //////////////////
    /// Constructeur /
    //////////////////
    
    /**
     * @notice Initialise l'Oracle avec la Factory de marchés
     * @param _factory Adresse de la Factory de marchés de prédiction
     */
    constructor(address _factory) Ownable(msg.sender) {
        if (_factory == address(0)) {
            revert Oracle__InvalidMarketAddress();
        }
        
        factory = PredictionMarketFactory(_factory);
        
        // Ajouter le déployeur comme premier résolveur autorisé
        authorizedResolvers[msg.sender] = true;
        resolversList.push(msg.sender);
        
        emit ResolverAdded(msg.sender);
    }

    ////////////////////////
    /// Fonctions Principales
    ////////////////////////
    
    /**
     * @notice Met à jour les données de transaction depuis l'API Intuition
     * @dev Appelée par le service backend qui interroge l'API
     * @param _totalTransactions Nombre total de transactions sur la blockchain
     * @param _timestamp Timestamp de récupération des données depuis l'API
     */
    function updateTransactionData(
        uint256 _totalTransactions,
        uint256 _timestamp
    ) external onlyAuthorizedResolver {
        // Vérification que les données ne sont pas trop anciennes
        if (_timestamp < block.timestamp - MAX_DATA_AGE) {
            revert Oracle__InvalidTransactionData();
        }
        
        // Vérification que le timestamp n'est pas dans le futur
        if (_timestamp > block.timestamp) {
            revert Oracle__InvalidTransactionData();
        }
        
        // Mise à jour des données
        currentTransactionData = TransactionData({
            totalTransactions: _totalTransactions,
            timestamp: _timestamp,
            blockNumber: block.number,
            isValid: true
        });
        
        emit TransactionDataUpdated(_totalTransactions, _timestamp, msg.sender);
    }
    
    /**
     * @notice Clôture automatiquement un marché expiré
     * @dev Vérifie l'expiration, récupère les données et détermine le gagnant
     * @param marketAddress Adresse du marché à clôturer
     */
    function closeExpiredMarket(address marketAddress) 
        external 
        onlyAuthorizedResolver 
        validUnresolvedMarket(marketAddress)
        nonReentrant 
    {
        TransactionPredictionMarket market = TransactionPredictionMarket(payable(marketAddress));
        
        // Récupération des informations du marché
        (
            address creator,
            address oracle,
            string memory description,
            uint256 threshold,
            uint256 deadline,
            uint256 createdAt,
            TransactionPredictionMarket.MarketStatus status,
            uint256 aboveBets,
            uint256 belowBets,
            uint256 bettorCount,
            uint256 totalValueLocked,
            TransactionPredictionMarket.BetType winningType
        ) = market.getMarketInfo();
        
        // Vérification que le marché est actif
        if (status != TransactionPredictionMarket.MarketStatus.ACTIVE) {
            revert Oracle__MarketAlreadyResolved();
        }
        
        // Vérification que le marché est bien expiré + délai de sécurité
        if (block.timestamp < deadline + MIN_RESOLUTION_DELAY) {
            revert Oracle__MarketNotExpired();
        }
        
        // Vérification que nous avons des données valides
        if (!currentTransactionData.isValid) {
            revert Oracle__InvalidTransactionData();
        }
        
        // Détermination du type gagnant
        TransactionPredictionMarket.BetType determinedWinningType;
        bool isAboveThreshold = currentTransactionData.totalTransactions >= threshold;
        
        if (isAboveThreshold) {
            determinedWinningType = TransactionPredictionMarket.BetType.ABOVE_THRESHOLD;
        } else {
            determinedWinningType = TransactionPredictionMarket.BetType.BELOW_THRESHOLD;
        }
        
        // Enregistrement de la résolution
        marketResolutions[marketAddress] = MarketResolution({
            isResolved: true,
            resolutionTimestamp: block.timestamp,
            finalTransactionCount: currentTransactionData.totalTransactions,
            winningType: determinedWinningType
        });
        
        // Résolution effective du marché
        market.resolveMarket(currentTransactionData.totalTransactions);
        
        // Mise à jour des statistiques
        totalMarketsResolved++;
        totalFundsDistributed += totalValueLocked;
        
        // Émission des événements
        emit MarketClosed(
            marketAddress,
            currentTransactionData.totalTransactions,
            determinedWinningType,
            block.timestamp
        );
        
        emit ResultValidated(
            marketAddress,
            threshold,
            currentTransactionData.totalTransactions,
            isAboveThreshold
        );
        
        emit DistributionCompleted(
            marketAddress,
            totalValueLocked,
            bettorCount,
            block.timestamp
        );
    }
    
    /**
     * @notice Clôture par lot plusieurs marchés expirés
     * @dev Optimise le gas en traitant plusieurs marchés en une transaction
     * @param marketAddresses Tableau des adresses de marchés à clôturer
     */
    function closeMultipleExpiredMarkets(address[] calldata marketAddresses) 
        external 
        onlyAuthorizedResolver 
        nonReentrant 
    {
        if (marketAddresses.length == 0) {
            revert Oracle__EmptyMarketsList();
        }
        
        for (uint256 i = 0; i < marketAddresses.length; i++) {
            try this.closeExpiredMarket(marketAddresses[i]) {
                // Marché clôturé avec succès
            } catch {
                // Continue avec les autres marchés en cas d'erreur sur un marché
                continue;
            }
        }
    }
    
    /**
     * @notice Récupère automatiquement tous les marchés expirés et les clôture
     * @dev Fonction pratique pour les résolveurs automatisés
     */
    function closeAllExpiredMarkets() external onlyAuthorizedResolver {
        // Récupération des marchés à résoudre depuis la Factory
        address[] memory expiredMarkets = factory.getResolvableMarkets();
        
        if (expiredMarkets.length == 0) {
            return; // Aucun marché à résoudre
        }
        
        // Clôture de tous les marchés expirés
        this.closeMultipleExpiredMarkets(expiredMarkets);
    }

    ///////////////////////////////
    /// Gestion des Résolveurs ////
    ///////////////////////////////
    
    /**
     * @notice Ajoute un nouveau résolveur autorisé
     * @dev Seul le propriétaire peut ajouter des résolveurs
     * @param resolver Adresse du nouveau résolveur
     */
    function addResolver(address resolver) external onlyOwner {
        if (resolver == address(0)) {
            revert Oracle__InvalidMarketAddress();
        }
        if (authorizedResolvers[resolver]) {
            revert Oracle__ResolverAlreadyExists();
        }
        
        authorizedResolvers[resolver] = true;
        resolversList.push(resolver);
        
        emit ResolverAdded(resolver);
    }
    
    /**
     * @notice Supprime un résolveur autorisé
     * @dev Seul le propriétaire peut supprimer des résolveurs
     * @param resolver Adresse du résolveur à supprimer
     */
    function removeResolver(address resolver) external onlyOwner {
        if (!authorizedResolvers[resolver]) {
            revert Oracle__ResolverNotFound();
        }
        
        authorizedResolvers[resolver] = false;
        
        // Suppression de la liste
        for (uint256 i = 0; i < resolversList.length; i++) {
            if (resolversList[i] == resolver) {
                resolversList[i] = resolversList[resolversList.length - 1];
                resolversList.pop();
                break;
            }
        }
        
        emit ResolverRemoved(resolver);
    }

    ////////////////////////////
    /// Fonctions de Lecture ///
    ////////////////////////////
    
    /**
     * @notice Récupère les informations de résolution d'un marché
     * @param marketAddress Adresse du marché
     * @return Informations complètes de résolution
     */
    function getMarketResolution(address marketAddress) 
        external 
        view 
        returns (MarketResolution memory) 
    {
        return marketResolutions[marketAddress];
    }
    
    /**
     * @notice Récupère les données de transaction actuelles
     * @return Données de transaction depuis l'API Intuition
     */
    function getCurrentTransactionData() 
        external 
        view 
        returns (TransactionData memory) 
    {
        return currentTransactionData;
    }
    
    /**
     * @notice Vérifie si les données de transaction sont fraîches
     * @return true si les données sont fraîches et valides
     */
    function isDataFresh() external view returns (bool) {
        return currentTransactionData.isValid && 
               (block.timestamp - currentTransactionData.timestamp <= MAX_DATA_AGE);
    }
    
    /**
     * @notice Récupère la liste de tous les résolveurs autorisés
     * @return Tableau des adresses des résolveurs
     */
    function getAuthorizedResolvers() external view returns (address[] memory) {
        return resolversList;
    }
    
    /**
     * @notice Récupère les statistiques globales de l'Oracle
     * @return totalResolved Nombre total de marchés résolus
     * @return totalDistributed Montant total distribué
     * @return activeResolvers Nombre de résolveurs actifs
     */
    function getOracleStats() 
        external 
        view 
        returns (
            uint256 totalResolved,
            uint256 totalDistributed,
            uint256 activeResolvers
        ) 
    {
        return (
            totalMarketsResolved,
            totalFundsDistributed,
            resolversList.length
        );
    }
    
    /**
     * @notice Vérifie si un marché peut être résolu
     * @param marketAddress Adresse du marché
     * @return true si le marché peut être résolu maintenant
     */
    function canResolveMarket(address marketAddress) external view returns (bool) {
        if (marketResolutions[marketAddress].isResolved) {
            return false;
        }
        
        if (!currentTransactionData.isValid) {
            return false;
        }
        
        try TransactionPredictionMarket(payable(marketAddress)).getMarketInfo() 
            returns (
                address,
                address,
                string memory,
                uint256,
                uint256 deadline,
                uint256,
                TransactionPredictionMarket.MarketStatus status,
                uint256,
                uint256,
                uint256,
                uint256,
                TransactionPredictionMarket.BetType
            ) 
        {
            return status == TransactionPredictionMarket.MarketStatus.ACTIVE && 
                   block.timestamp >= deadline + MIN_RESOLUTION_DELAY;
        } catch {
            return false;
        }
    }
    
    /**
     * @notice Récupère tous les marchés qui peuvent être résolus actuellement
     * @return Tableau des adresses de marchés résolvables
     */
    function getResolvableMarkets() external view returns (address[] memory) {
        return factory.getResolvableMarkets();
    }
}