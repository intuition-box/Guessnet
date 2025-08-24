# Troubleshooting

Created a market of 250000 threshold 
+2h
Bet amount 2 ETH


**block page**
Transaction Market Created 

# Issue 

**block page**
Bet created but unknow function called 


## Prediction Market Page 

Active Markets Section 
Transaction market is created but the value is not updated 
Bet also not upadted

Market at 0x24B3c7...
Threshold: 2 500 000 | Ends: 25/08/2025 02:15:17
Total Locked
0 ETH
ABOVE: 0 ETH
BELOW: 0 ETH

**Infinite loading :** 
Creating market
Placing bet


## Oracle page : 
⚖️ Markets Awaiting Resolution
No markets awaiting resolution - All markets are up to date!

🔮 Oracle	No data	Never	Invalid



# Block Explorer 
**transaction details**

transaction market created : 

Transaction Hash:	0x25902ad79e227c1e439a796492d05b4bd82bbdab93b61f0a9efa15eae9f3c862
Block Number:	17
From:	
0x2Afb79E9FA766D4a923a4aa72ed5d1e16C6B1063 avatar
0x2Afb79E9FA766D4a923a4aa72ed5d1e16C6B1063

To:	
0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 avatar
0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512

Value:	0.8 ETH
Function called:	
createTransactionMarket(string _description = Will Intuition have more than 2 500 000 transactions in 2 hours?, uint256 _transactionThreshold = 2500000, uint256 _deadline = 1756033777, address _customOracle = 0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82)0xd1b18f79
Gas Price:	1.111651778 Gwei
Data:	
0xd1b18f79000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000002625a00000000000000000000000000000000000000000000000000000000068aaf2f10000000000000000000000000dcd1bf9a1b36ce34237eeafef220932846bcd82000000000000000000000000000000000000000000000000000000000000004457696c6c20496e74756974696f6e2068617665206d6f7265207468616e2032e280af353030e280af303030207472616e73616374696f6e7320696e203220686f7572733f00000000000000000000000000000000000000000000000000000000
Logs:	
Log 0 topics: [ "0x00e658621d94668232e7e5db2279d76e6d8ff89b0252e5655882465d5e8a9bba", "0x000000000000000000000000cafac3dd18ac6c6e92c921884f9e4176737c052c", "0x0000000000000000000000002afb79e9fa766d4a923a4aa72ed5d1e16c6b1063", "0x0000000000000000000000000dcd1bf9a1b36ce34237eeafef220932846bcd82" ]

# Solution 
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
  - Supprimer les simulations et utiliser les vraies données blockchain