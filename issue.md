# Troubleshooting

Created a market of 250000 threshold 
+2h


**block page**
Transaction Market Created 
Bet Created 

# Issue 

**block page**
Bet created but unknow function called 

Transaction Hash:	0x478d9ad2331d2bab5729c16971d7efd7ee1c72f146fb1e9e4b4408374f578a6e
Block Number:	18
From:	
0x09708E3215a3d970e6d27B0af5F709d57ff78dA4 avatar
0x09708E3215a3d970e6d27B0af5F709d57ff78dA4

To:	
0x9f1ac54BEF0DD2f6f3462EA0fa94fC62300d3a8e avatar
0x9f1ac54BEF0DD2f6f3462EA0fa94fC62300d3a8e

Value:	0.9 ETH
Function called:	
0x43046844
Gas Price:	1.100676883 Gwei
Data:	
0x430468440000000000000000000000000000000000000000000000000000000000000000
Logs:	
Log 0 topics: [ "0xe8bcec081119392599b60e1206c80b5ce85381e4a7371cc28ec1050e93681189", "0x00000000000000000000000009708e3215a3d970e6d27b0af5f709d57ff78da4", "0x0000000000000000000000000000000000000000000000000000000000000001" ]

## Prediction Market Page 

**Infinite loading :** 
Creating market
Placing bet


## Oracle page : 
⚖️ Markets Awaiting Resolution
No markets awaiting resolution - All markets are up to date!

🔮 Oracle	No data	Never	Invalid



# Block Explorer 
**transaction details**

Transaction Hash:	0x478d9ad2331d2bab5729c16971d7efd7ee1c72f146fb1e9e4b4408374f578a6e
Block Number:	18
From:	
0x09708E3215a3d970e6d27B0af5F709d57ff78dA4 avatar
0x09708E3215a3d970e6d27B0af5F709d57ff78dA4

To:	
0x9f1ac54BEF0DD2f6f3462EA0fa94fC62300d3a8e avatar
0x9f1ac54BEF0DD2f6f3462EA0fa94fC62300d3a8e

Value:	0.9 ETH
Function called:	
0x43046844
Gas Price:	1.100676883 Gwei
Data:	
0x430468440000000000000000000000000000000000000000000000000000000000000000
Logs:	
Log 0 topics: [ "0xe8bcec081119392599b60e1206c80b5ce85381e4a7371cc28ec1050e93681189", "0x00000000000000000000000009708e3215a3d970e6d27b0af5f709d57ff78da4", "0x0000000000000000000000000000000000000000000000000000000000000001" ]

Transaction Hash:	0x72a8ed3ed79e0e9c9c1a03c26b91f97c6ab8f912e183b27d35f0412687f1e30f
Block Number:	17
From:	
0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 avatar
0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

To:	
0x09708E3215a3d970e6d27B0af5F709d57ff78dA4 avatar
0x09708E3215a3d970e6d27B0af5F709d57ff78dA4

Value:	1 ETH
Function called:	
This transaction did not call any function.
Gas Price:	1.115036287 Gwei
Data:	
0x
Logs:



<!-- # Solution 
1. Interface non synchronisée avec les contrats

  - Le frontend (page.tsx:62-87) simule les données des marchés au lieu d'appeler les vraies fonctions de
  contrat
  - Commentaire ligne 67: "In a real implementation, you'd call getMarketInfo on each market contract"
  - Les données affichées sont des valeurs par défaut (lignes 70-76) qui ne reflètent pas l'état réel

  2. Fonction de pari non implémentée

  - La fonction placeBet (lignes 185-207) est entièrement simulée
  - Elle utilise setTimeout au lieu d'appeler le vrai contrat TransactionPredictionMarket.placeBet()
  - Aucune transaction blockchain n'est effectuée

  3. Données des marchés statiques

  - Les valeurs affichées sont codées en dur :
    - totalValueLocked: BigInt(0)
    - aboveBets: BigInt(0)
    - belowBets: BigInt(0)
  - Pas d'appels aux fonctions getTotalValueLocked(), totalAboveBets, totalBelowBets du contrat

  4. Transaction créée mais non reflétée

  La transaction 0x25902... a bien créé le marché mais l'interface :
  - Ne récupère pas les vraies données du contrat déployé
  - N'appelle pas getMarketInfo() sur le contrat TransactionPredictionMarket
  - N'utilise pas les hooks Scaffold-ETH pour lire les états des contrats

  Solution requise :

  Implémenter les vrais appels de contrat pour :
  - Lire les données réelles des marchés avec useScaffoldReadContract
  - Implémenter la vraie fonction placeBet avec useScaffoldWriteContract
  - Supprimer les simulations et utiliser les vraies données blockchain -->