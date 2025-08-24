# 🔮 Guide Complet - Lancement et Tests des Marchés de Prédiction

Ce guide vous explique **étape par étape** comment lancer l'application et effectuer vos premiers tests avec l'intégration API Intuition.

## 🏗️ Architecture du Système

```
API Intuition → Service Backend → Oracle Contract → Prediction Markets
     ↑              ↑                    ↑              ↑
  Données        Appels toutes         Stockage      Résolution
temps réel       les 5 minutes        sécurisé      automatique
```

## 🚀 LANCEMENT RAPIDE DE L'APPLICATION

### Étape 1 : Démarrer le Nœud Local
```bash
# Dans le terminal 1 (garder ouvert)
cd packages/hardhat
yarn hardhat node --network hardhat
```

### Étape 2 : Déployer les Contrats
```bash
# Dans le terminal 2
yarn deploy
```

### Étape 3 : Tester l'API Intuition
```bash
# Depuis packages/hardhat/
npx ts-node scripts/simple-api-test.ts

# Ou avec monitoring en temps réel
npx ts-node scripts/simple-api-test.ts --monitor
```

**✅ Script fonctionnel confirmé !**

### Étape 4 : Interface Frontend (optionnel)
```bash
# Depuis packages/hardhat/, aller au frontend
cd ../nextjs && yarn dev
# Ouvrir http://localhost:3001 (ou 3000)
```

## 🧪 TESTS À EFFECTUER

### Test 1 : Vérifier l'API Intuition
```bash
# Test direct de l'API
curl -H "accept: application/json" \
"https://intuition-testnet.explorer.caldera.xyz/api/v2/stats"

# Résultat attendu : JSON avec total_transactions
```

### Test 2 : Statut des Contrats
```bash
# Depuis packages/hardhat/
npx ts-node scripts/check-oracle-status.ts
```

### Test 3 : Créer un Marché de Test
```bash
# Depuis packages/hardhat/
npx ts-node scripts/test-oracle-system.ts
```

### Test 4 : Test d'Intégration Complet
```bash
# Depuis packages/hardhat/
npx ts-node scripts/test-intuition-integration.ts
```

## 📋 SCÉNARIOS DE TEST RECOMMANDÉS

### Scénario A : Test Simple
1. **Objectif** : Créer un marché avec seuil bas (déjà atteint)
2. **Seuil** : 1,000,000 transactions (actuel: 2,314,088)
3. **Résultat attendu** : ABOVE_THRESHOLD
4. **Durée** : 2 minutes

```bash
# Créer un marché avec seuil déjà dépassé
# Le marché sera résolu immédiatement à l'expiration
```

### Scénario B : Test Réaliste  
1. **Objectif** : Marché avec seuil élevé (non atteint)
2. **Seuil** : 3,000,000 transactions  
3. **Résultat attendu** : BELOW_THRESHOLD
4. **Durée** : 5 minutes

### Scénario C : Test de Performance
1. **Objectif** : Créer plusieurs marchés simultanément
2. **Nombre** : 3-5 marchés avec seuils différents
3. **Test** : Résolution automatique en lot

## 🛠️ COMMANDES DE DÉPANNAGE

### Si l'API ne répond pas :
```bash
# Test connectivité
ping intuition-testnet.explorer.caldera.xyz

# Test direct
curl -v "https://intuition-testnet.explorer.caldera.xyz/api/v2/stats"
```

### Si les contrats ne se déploient pas :
```bash
# Nettoyer les artifacts
yarn hardhat clean

# Recompiler
yarn hardhat compile

# Redéployer avec le bon réseau
yarn hardhat deploy --network hardhat --reset
```

### Si l'erreur "hardhat-deploy unsupported network" :
```bash
# Solution: Toujours spécifier --network hardhat
yarn hardhat node --network hardhat
yarn hardhat deploy --network hardhat
```

### Si le service ne démarre pas :
```bash
# Vérifier les dépendances
cd packages/hardhat
npm install axios node-cron

# Relancer
npx ts-node scripts/intuition-api-service.ts
```

## 📊 DONNÉES EN TEMPS RÉEL

**API Intuition Stats actuelles :**
- URL : `https://intuition-testnet.explorer.caldera.xyz/api/v2/stats`
- Transactions totales : ~2.3M (en croissance)
- Mise à jour : Temps réel
- Utilisation : Résolution automatique des marchés

## 🎯 COMMENT TESTER VOS MARCHÉS

### 1. Via les Scripts TypeScript
```bash
# Depuis packages/hardhat/
npx ts-node scripts/test-oracle-system.ts
```

### 2. Via l'Interface Web (Recommandé)
```bash
# Depuis packages/hardhat/, aller au frontend
cd ../nextjs && yarn dev
# Aller à http://localhost:3001 (ou 3000)
# Utiliser l'interface graphique pour créer et gérer des marchés
```

### 3. Via la Console Hardhat
```bash
# Depuis packages/hardhat/
yarn hardhat console --network localhost
# Interagir directement avec les contrats
```

## ⚡ DÉMARRAGE ULTRA-RAPIDE (1 minute)

```bash
# Terminal 1: Nœud local (depuis la racine du projet)
cd packages/hardhat && yarn hardhat node --network hardhat

# Terminal 2: Tout en une fois (depuis la racine)  
yarn deploy && cd packages/hardhat && npx ts-node scripts/intuition-api-service.ts
```

## 🎮 TESTS INTERACTIFS RECOMMANDÉS

### Interface Web + API en Live
1. **Lancer** : `cd ../nextjs && yarn dev`
2. **Ouvrir** : http://localhost:3001 (ou 3000)
3. **Créer** un marché via l'interface
4. **Observer** la résolution automatique via les logs du service API

### Monitoring en Temps Réel
```bash
# Terminal pour les logs du service
tail -f logs/intuition-api-service.log

# Terminal pour surveiller l'API
watch -n 30 'curl -s "https://intuition-testnet.explorer.caldera.xyz/api/v2/stats" | grep total_transactions'
```

## 🏆 VALIDATION COMPLÈTE

**Votre système fonctionne correctement si :**

✅ L'API Intuition répond avec des données JSON  
✅ Les contrats se déploient sans erreur  
✅ Le service démarre et se connecte à l'Oracle  
✅ Un marché de test se crée et se résout automatiquement  
✅ Les logs montrent des mises à jour toutes les 5 minutes  
✅ L'interface web affiche les marchés actifs  

**Données de référence actuelles :**
- Total transactions: 2,314,088
- Seuil test recommandé: 1,500,000 (garanti ABOVE)
- Seuil test realistic: 2,500,000 (probablement BELOW)

---

🚀 **Le système est maintenant prêt !** Suivez les étapes ci-dessus pour lancer et tester votre application de marchés de prédiction.

```bash
yarn hardhat run scripts/test-intuition-integration.ts --network localhost
```

### 4. Lancer en Production

```bash
yarn hardhat run scripts/start-production.ts --network localhost
```

## 📡 API Intuition - Détails Techniques

### Endpoint Principal
```
GET https://intuition-testnet.explorer.caldera.xyz/api/v2/stats
```

### Réponse Type
```json
{
  "total_transactions": "2256864",
  "transactions_today": "245563", 
  "total_blocks": "1047579",
  "total_addresses": "324933",
  "average_block_time": 454
}
```

### Paramètres Utilisés
- `total_transactions`: Nombre total de transactions (utilisé pour résoudre les marchés)
- `transactions_today`: Transactions du jour (statistiques)
- `total_blocks`: Blocs totaux (validation)
- `average_block_time`: Temps moyen par bloc (monitoring)

## 🔮 Oracle de Clôture

### Fonctions Principales

#### `updateTransactionData()`
Met à jour les données depuis l'API Intuition
```solidity
function updateTransactionData(
    uint256 _totalTransactions,
    uint256 _timestamp
) external onlyAuthorizedResolver
```

#### `closeExpiredMarket()`
Clôture un marché expiré automatiquement
```solidity
function closeExpiredMarket(address marketAddress) 
    external onlyAuthorizedResolver
```

#### `closeAllExpiredMarkets()`
Clôture tous les marchés expirés en une fois
```solidity
function closeAllExpiredMarkets() external onlyAuthorizedResolver
```

### Événements Émis

- `MarketClosed`: Marché fermé avec résultat
- `ResultValidated`: Résultat validé avec comparaison
- `DistributionCompleted`: Distribution des gains effectuée
- `TransactionDataUpdated`: Données API mises à jour

## 🤖 Service Backend Automatisé

### Configuration

```typescript
const config = {
  apiUrl: 'https://intuition-testnet.explorer.caldera.xyz/api/v2/stats',
  updateInterval: '*/5 * * * *', // Toutes les 5 minutes
  retryAttempts: 5,
  retryDelay: 10000, // 10 secondes
  timeout: 30000,    // 30 secondes
  enableLogging: true
}
```

### Fonctionnalités

- ✅ **Appels API automatiques** toutes les 5 minutes
- ✅ **Retry logic** avec backoff exponentiel
- ✅ **Logging complet** dans `./logs/`
- ✅ **Résolution automatique** des marchés expirés
- ✅ **Monitoring** et statistiques de performance
- ✅ **Arrêt gracieux** avec gestion des signaux

## 📊 Surveillance et Monitoring

### Vérifier le Statut

```bash
# Statut complet du système
yarn hardhat run scripts/check-oracle-status.ts

# Logs en temps réel
tail -f logs/production-service.log
```

### Métriques Surveillées

- 📡 **API Calls**: Réussite/Échec des appels API
- 🔄 **Oracle Updates**: Mises à jour réussies
- ⚖️ **Markets Resolved**: Marchés résolus automatiquement
- 💰 **Value Distributed**: Montants distribués
- ⏰ **Data Freshness**: Fraîcheur des données

## 🎯 Utilisation des Marchés

### Créer un Marché

```typescript
await factory.createTransactionMarket(
  "Will there be more than 1M transactions?",
  1000000,              // Seuil: 1M transactions
  deadline,             // Timestamp d'expiration
  oracleAddress         // Oracle automatique
);
```

### Placer des Paris

```typescript
// Parier que ça sera AU-DESSUS du seuil
await market.placeBet(0, { value: ethers.parseEther("1.0") });

// Parier que ça sera EN-DESSOUS du seuil  
await market.placeBet(1, { value: ethers.parseEther("0.5") });
```

### Récupérer les Gains

```typescript
// Automatique après résolution par l'Oracle
await market.claimWinnings();
```

## 🔒 Sécurité et Robustesse

### Vérifications Implémentées

- ✅ **Autorisation**: Seuls les résolveurs autorisés peuvent mettre à jour
- ✅ **Fraîcheur**: Données API max 1 heure
- ✅ **Délai de sécurité**: 5 minutes après expiration avant résolution
- ✅ **Prévention double résolution**: Un marché ne peut être résolu qu'une fois
- ✅ **Validation des données**: Vérification des timestamps et montants
- ✅ **ReentrancyGuard**: Protection contre les attaques de réentrance

### Gestion des Erreurs

- 🔄 **Retry automatique** des appels API échoués
- 📝 **Logging détaillé** de tous les événements
- 🛑 **Arrêt gracieux** en cas d'erreur critique
- ⚠️ **Alertes** pour données obsolètes ou invalides

## 🛠️ Scripts Utilitaires

| Script | Usage |
|--------|--------|
| `start-production.ts` | Lancement production avec monitoring |
| `check-oracle-status.ts` | Vérification santé système |
| `test-intuition-integration.ts` | Test complet bout-en-bout |
| `test-oracle-system.ts` | Tests Oracle uniquement |

## 📋 Commandes Utiles

```bash
# Démarrer le service production
yarn hardhat run scripts/start-production.ts --network mainnet

# Vérifier le statut
yarn hardhat run scripts/check-oracle-status.ts --network mainnet

# Test complet
yarn hardhat run scripts/test-intuition-integration.ts --network localhost

# Voir les logs
tail -f logs/production-service.log

# Compiler et déployer
yarn hardhat compile && yarn hardhat deploy --network mainnet
```

## 🌐 Réseaux Supportés

- **Localhost**: Développement et tests
- **Sepolia**: Test sur Ethereum testnet
- **Mainnet**: Production Ethereum
- **Arbitrum**: Production L2
- **Polygon**: Production sidechaine

## 💡 Bonnes Pratiques

1. **🔍 Monitoring**: Surveiller les logs et métriques régulièrement
2. **⏰ Timing**: Laisser 5-10 minutes entre expiration et résolution
3. **💰 Seuils**: Utiliser des seuils réalistes basés sur les données actuelles
4. **🔒 Sécurité**: Maintenir les clés privées sécurisées
5. **📊 Données**: Vérifier la fraîcheur des données avant création de marchés

## 🚨 Dépannage

### Problème: API non accessible
```bash
# Vérifier la connectivité
curl https://intuition-testnet.explorer.caldera.xyz/api/v2/stats
```

### Problème: Oracle non autorisé
```bash
# Ajouter un résolveur
await oracle.addResolver(address);
```

### Problème: Données obsolètes
```bash
# Forcer une mise à jour
yarn hardhat run scripts/intuition-api-service.ts
```

---

🎉 **Le système est maintenant prêt pour la production !**

Pour toute question technique, consultez le code source ou les tests d'intégration.