# Task 

**curl :** 
curl -X 'GET' \
  'https://intuition-testnet.explorer.caldera.xyz/api/v2/stats' \
  -H 'accept: application/json'
 	
**Response body**
{
  "average_block_time": 454,
  "coin_image": null,
  "coin_price": null,
  "coin_price_change_percentage": null,
  "gas_price_updated_at": "2025-08-23T15:04:32.776454Z",
  "gas_prices": {
    "slow": 0.1,
    "average": 0.1,
    "fast": 0.1
  },
  "gas_prices_update_in": 16912,
  "gas_used_today": "10477783767",
  "market_cap": "0",
  "network_utilization_percentage": 6.300162169736723e-9,
  "secondary_coin_image": null,
  "secondary_coin_price": null,
  "static_gas_price": null,
  "total_addresses": "324933",
  "total_blocks": "1047579",
  "total_gas_used": "61472754318",
  "total_transactions": "2256864",
  "transactions_today": "245563",
  "tvl": null
}

**Response headers**
 cache-control: max-age=0,private,must-revalidate 
 content-type: application/json; charset=utf-8

**Doc :**
https://testnet.explorer.intuition.systems/api-docs
 
**Challenge Ethereum**
https://speedrunethereum.com/challenge/prediction-markets


# Front-end 

**Page de création de marchés - Formulaire pour créer des prédictions**
Les utilisateurs doivent pariés sur le le total des transactions à venir
ils auront deux champs à modifier : 
- le nombre de transactions
- date et heure de fin 

**Monitoring en temps réel - Status des marchés avec API Intuition**
Un graphique linéaire doit etre visible pour aider les utilisateurs dans leurs prédictions. 

Les utilisateurs pourrons miser le nombre d'eth qu'ils souhaitent.

**Liste des marchés actifs - Voir tous les marchés disponibles**
Un dashboard sera visible montrant les derniers votes. 


 Procédure de redémarrage complet :

  1. Arrêter tous les processus

  # Arrêter tous les terminaux en cours
  # Ctrl+C dans chaque terminal ouvert

  2. Nettoyer et redéployer

  # Terminal 1 : Nettoyer et redémarrer le nœud
  cd packages/hardhat
  yarn hardhat clean
  yarn hardhat node --network hardhat

  3. Redéployer les contrats

  # Terminal 2 : Redéployer depuis zéro
  yarn deploy --reset

  4. Relancer le frontend

  # Terminal 3 : Redémarrer NextJS
  cd packages/nextjs
  yarn dev

  5. Tester l'API (optionnel)

  # Terminal 4 : Tester l'intégration
  cd packages/hardhat
  npx ts-node scripts/simple-api-test.ts