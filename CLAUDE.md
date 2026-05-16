# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Node.js + TypeScript API backend for StrideChain — sits between Strava and the `StrideBadge` smart contract on Base. It owns the minter wallet private key and is the only component authorized to call `mint()` on the contract. See `backend.md` for the full spec; the contract ABI and deployed address come from the stride-chain Foundry repo.

## Stack

- **Runtime**: Node.js 20+, TypeScript
- **Framework**: Express
- **Blockchain**: viem (not ethers)
- **Strava auth**: `passport` + `passport-strava-oauth2`
- **Env**: dotenv

## Development Commands

```bash
# Install dependencies
npm install

# Dev server with hot reload
npm run dev          # nodemon + ts-node

# Build
npm run build        # tsc

# Production
npm start            # node dist/index.js
```

## Project Structure

```
src/
├── index.ts                  # Express app + server bootstrap (runs DB migration on start)
├── db/
│   ├── pool.ts               # pg Pool singleton
│   ├── redis.ts              # ioredis client + connect-redis adapter
│   ├── migrate.ts            # Idempotent schema migration (CREATE TABLE IF NOT EXISTS)
│   ├── users.ts              # User CRUD — upsertUser, getUser, updateTokens
│   └── mints.ts              # recordMint — off-chain mint history
├── routes/
│   ├── auth.ts               # GET /auth/strava, GET /auth/strava/callback
│   ├── runs.ts               # GET /runs
│   ├── mint.ts               # POST /mint
│   └── dev.ts                # POST /dev/mint (non-production only)
├── services/
│   ├── strava.ts             # Strava OAuth strategy, token refresh, API calls
│   └── contract.ts           # viem walletClient + mint call
└── middleware/
    └── requireAuth.ts        # Session guard for authenticated routes
```

## Database Schema

**`users`** — one row per Strava athlete; tokens stored here, not in the session cookie.
**`mints`** — off-chain record of every successful mint (activity_id is unique).

Sessions store only `stravaId`; `deserializeUser` fetches the full user (with tokens) from Postgres on each request. Token refresh writes updated tokens back to Postgres directly — no `req.logIn()` needed in routes.

## Core Mint Flow

`POST /mint` is the critical path:
1. Verify Strava session exists
2. Fetch activity from `https://www.strava.com/api/v3/activities/:activityId`
3. Assert `activity.athlete.id` matches the authenticated user and `activity.type === "Run"`
4. Call `activityMinted(activityId)` on-chain — return `409` if already minted
5. Call `contract.mint(to, activityId, distance, startDateUnix)` via viem walletClient
6. Await receipt, return `{ txHash, tokenId }`

## Contract ABI (minimal)

```typescript
const ABI = [
  "function mint(address to, uint256 activityId, uint256 distance, uint256 runAt) returns (uint256)",
  "function activityMinted(uint256 activityId) view returns (bool)",
] as const;
```

## Required Environment Variables

```env
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_REDIRECT_URI=http://localhost:3001/auth/strava/callback
MINTER_PRIVATE_KEY=      # dedicated wallet — only enough ETH for gas
CONTRACT_ADDRESS=        # deployed StrideBadge address
RPC_URL=                 # Base Sepolia: https://sepolia.base.org
CHAIN_ID=84532           # 84532 = Base Sepolia, 8453 = Base mainnet
PORT=3001
SESSION_SECRET=
DATABASE_URL=postgresql://user:password@localhost:5432/stride
REDIS_URL=redis://localhost:6379
```

## Key Constraints

- Strava access tokens expire every 6 hours — `strava.ts` must handle refresh token flow automatically.
- Strava distance is in metres — pass directly to the contract (no conversion needed).
- `activity.start_date` is ISO 8601 — convert to unix timestamp before passing to contract.
- Always call `activityMinted()` before sending a mint tx to avoid on-chain revert and wasted gas.
- Error codes: `400` wrong owner, `409` already minted, `422` not a run, `500` tx failure.
