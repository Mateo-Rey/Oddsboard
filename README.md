# Oddsboard — play-money prediction markets

A Kalshi-style poll/prediction-market app. Users start with 1,000 credits, create or browse markets, bet on outcomes, and watch odds shift live. Built with **React + TypeScript (Vite)** and **Firebase (Auth + Firestore + Hosting)**.

## Setup

1. Create a Firebase project. Enable **Authentication → Email/Password** and create a **Firestore** database.
2. Add a Web App in Project Settings and copy its config.
3. `cp .env.example .env` and fill in the values.
4. Put your project id in `.firebaserc`.
5. `npm install && npm run dev`

## Deploy

```bash
npm install -g firebase-tools && firebase login
firebase deploy --only firestore:rules,firestore:indexes   # rules + collection-group index
npm run build
firebase deploy --only hosting                             # deploy once, when finished
```

The Portfolio page queries every position a user holds (a collection-group query), so `firestore.indexes.json` **must** be deployed.

## How it works

| Piece | Implementation |
|---|---|
| Odds (V1) | `price = pool[outcome] / sum(pool)` (`src/lib.ts`); an empty pool shows an even split |
| Betting | `runTransaction`: reads balance + market pool, then atomically debits the user, updates the pool, and writes the position and price history (`MarketCard.tsx`) |
| Resolution | The creator picks the winner; the market flips to `resolved` |
| Payout | Pari-mutuel: winners split the whole pool pro rata, `payout = wager / winningPool × totalPool`. If nobody backed the winner, everyone is refunded. Losing positions pay 0 |
| Settlement | Each user's Portfolio page auto-settles their unclaimed positions in a transaction (credits balance, sets `payoutClaimed`). This avoids one client writing to many other users' documents |

## Security notes

- Rules block: editing question/outcomes, reopening resolved markets, editing/deleting positions, non-creators changing anything but `pool`, and negative balances.
- **Limitation:** because V1 runs bets and payouts as client transactions, a determined user could still hand-craft a balance write. The proper fix is to move `placeBet` and `resolveMarket` into callable **Cloud Functions** (Blaze plan) and set `allow update: if false` on `balance` and `pool`. The transaction logic in `MarketCard.tsx` and `Portfolio.tsx` ports over directly.

## V2 idea: LMSR

Replace `price()` and the pool update with the LMSR cost function `C(q) = b·ln(Σ e^(qᵢ/b))`; a bet's cost is `C(q') − C(q)`, and price is the softmax `e^(qᵢ/b) / Σ e^(qⱼ/b)`. Resolution and payout stay the same shape (winning shares pay 1 credit each).

## Project layout

```
src/App.tsx                 shell, auth state, live balance
src/components/AuthForm     register / log in
src/components/MarketList   live list of markets
src/components/MarketCard   odds, betting, resolve
src/components/CreateMarket new market form
src/components/Portfolio    balance, open positions, auto-settlement
src/lib.ts                  pricing + payout math
firestore.rules             security rules
```

## Demo Video