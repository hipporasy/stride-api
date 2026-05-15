# StrideChain Backend

Node.js + TypeScript API that sits between Strava and the StrideBadge smart contract.
It owns the minter wallet private key and is the only thing allowed to call `mint()`.

## Responsibilities

1. Handle Strava OAuth — let users connect their Strava account
2. Fetch verified run data from the Strava API
3. Enforce anti-duplicate logic before minting
4. Call `StrideBadge.mint()` on Base with the verified run data
5. Return the transaction hash to the frontend

## Recommended stack

- **Runtime**: Node.js 20+, TypeScript
- **Framework**: Express
- **Blockchain**: viem (lighter than ethers, excellent TypeScript types)
- **Strava auth**: `passport` + `passport-strava-oauth2`
- **Session/token storage**: Redis or a simple Postgres table
- **Env**: dotenv

```
npm init -y
npm install express viem passport passport-strava-oauth2 axios dotenv
npm install -D typescript @types/express @types/node ts-node nodemon
```

## Environment variables

```env
# Strava
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_REDIRECT_URI=http://localhost:3001/auth/strava/callback

# Blockchain
MINTER_PRIVATE_KEY=        # wallet that is set as minter on the contract
CONTRACT_ADDRESS=           # deployed StrideBadge address
RPC_URL=                    # Base Sepolia: https://sepolia.base.org | Mainnet: https://mainnet.base.org
CHAIN_ID=84532              # 84532 = Base Sepolia, 8453 = Base mainnet

# App
PORT=3001
SESSION_SECRET=
```

> ⚠️ MINTER_PRIVATE_KEY controls the wallet that can mint NFTs.
> Never commit it. Use a dedicated wallet with only enough ETH for gas.

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/strava` | Redirect user to Strava OAuth consent screen |
| GET | `/auth/strava/callback` | Handle OAuth callback, store access token |
| GET | `/runs` | List user's recent runs from Strava (requires auth) |
| POST | `/mint` | Validate run + mint badge (requires auth) |
| GET | `/health` | Liveness check |

### POST /mint

Request body:
```json
{ "activityId": 123456789 }
```

Response:
```json
{
  "txHash": "0x...",
  "tokenId": 0
}
```

Error cases to handle:
- `400` — activity not owned by authenticated user
- `409` — activity already minted (check `activityMinted(activityId)` on contract before sending tx)
- `422` — activity is not a run (type check from Strava)
- `500` — tx failed

## Mint flow (core logic)

```
POST /mint
  1. Verify user is authenticated (has valid Strava token)
  2. Fetch activity from Strava API:
       GET https://www.strava.com/api/v3/activities/:activityId
  3. Validate:
       - activity.athlete.id matches authenticated user
       - activity.type === "Run" (or sport_type === "Run")
  4. Check on-chain: call activityMinted(activityId) — reject if true
  5. Call contract mint(to, activityId, distance, startDateUnix)
  6. Wait for tx receipt
  7. Return { txHash, tokenId }
```

## Strava API notes

- Get credentials at https://www.strava.com/settings/api
- Access token expires every 6 hours — store refresh token and use it
- Activity distance is in metres (matches contract)
- `activity.start_date` is ISO 8601 — convert to unix timestamp for the contract
- Rate limit: 100 requests / 15 min, 1000 / day per access token

## Contract ABI (minimal — just what the backend needs)

```typescript
const ABI = [
  "function mint(address to, uint256 activityId, uint256 distance, uint256 runAt) returns (uint256)",
  "function activityMinted(uint256 activityId) view returns (bool)",
] as const;
```

## Project structure

```
stride-api/
├── src/
│   ├── index.ts          # Express app setup
│   ├── routes/
│   │   ├── auth.ts       # Strava OAuth routes
│   │   ├── runs.ts       # GET /runs
│   │   └── mint.ts       # POST /mint
│   ├── services/
│   │   ├── strava.ts     # Strava API client
│   │   └── contract.ts   # viem wallet client + mint call
│   └── middleware/
│       └── requireAuth.ts
├── .env
├── package.json
└── tsconfig.json
```

## CLAUDE.md note

When you run `/init` in the new repo, tell Claude:
> "This is the backend for StrideChain. See backend.md in stride-chain repo for full spec.
>  The contract ABI and address come from the stride-chain Foundry repo."
