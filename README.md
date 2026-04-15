# TradeRail

TradeRail is a **pre-trade intelligence layer on X Layer**.  
Instead of swapping blindly, users and agents can preview a route for free, then unlock premium analysis through **x402** to decide whether a route looks good to take, needs caution, or is too weak to trust before execution.

## Live Links

- **Frontend:** https://traderail.vercel.app
- **API:** https://traderail-production.up.railway.app
- **Repository:** https://github.com/Mrgtee/traderail

## Overview

TradeRail helps users answer one question before they swap:

**“Is this route worth taking?”**

It provides:

- **Free route preview** for supported X Layer token pairs
- **Execution Guard** premium scout report with a verdict:
  - **Optimal**
  - **Caution**
  - **Avoid**
- **Premium Route Quote** for builders who want deeper route data and calldata
- **x402-powered paid access** with onchain settlement to a project vault on X Layer

Example:

If a user wants to swap **WOKB → USDT**, TradeRail can preview the route first, then unlock premium analysis to tell them whether that route looks healthy enough to take before they spend money.

## Why TradeRail

Most DEX interfaces focus on **execution**.  
TradeRail focuses on **decision-making before execution**.

That means:

- a DEX answers: **“Do you want to swap?”**
- TradeRail answers: **“Should you swap this route at all?”**

This makes it useful for:

- everyday users trying to avoid weak routes
- treasury or portfolio workflows
- bots and agents that need a pre-trade decision layer
- developers who want execution-ready route data

## Core Product Flow

1. A user enters a token pair and amount
2. TradeRail fetches token metadata and converts the amount internally
3. The user runs a **free preview**
4. If deeper conviction is needed, the user unlocks **Execution Guard** through **x402**
5. TradeRail returns a premium verdict with route analytics
6. Builders can optionally unlock **Premium Route Quote** for deeper route data and calldata

## Features

### Free Route Preview

Users can preview:

- input amount
- estimated output
- net output after gas

### Execution Guard

A premium scout report that returns:

- verdict
- reason
- gas-adjusted route quality
- analytics for route evaluation

### Premium Route Quote

A builder-focused premium response that returns:

- route quote
- gas-adjusted output
- execution-ready calldata

### Human-Readable Amounts

Users enter normal amounts like:

- `1`
- `0.5`
- `0.001`

TradeRail reads token decimals and converts to raw units internally.

### x402 Premium Unlock

Premium endpoints are protected using the **OnchainOS x402 payment stack** on X Layer.

## Official OnchainOS Modules Used

TradeRail uses these OnchainOS payment modules:

- `@okxweb3/x402-express`
- `@okxweb3/x402-core`
- `@okxweb3/x402-evm`
- `@okxweb3/x402-evm/exact/server`

These modules are used to:

- protect premium endpoints with `paymentMiddleware(...)`
- manage seller-side payment resources with `x402ResourceServer`
- facilitate payment verification and settlement with `OKXFacilitatorClient`
- enable exact EVM payment handling on X Layer with `ExactEvmScheme`

They power:

- `/x402/scout`
- `/x402/router-quote`

and route premium fees to the project vault on X Layer.

## Tech Stack

### Frontend

- Next.js
- React
- wagmi
- viem

### Backend

- Node.js
- Express
- ethers
- OKX x402 / OnchainOS payment modules

### Routing / Quote Layer

- Uniswap-based route logic on X Layer

### Network

- X Layer mainnet
- Chain ID: `196`

## Architecture

### Frontend (`apps/web`)

Responsible for:

- wallet connection
- token pair input
- token metadata lookup
- free preview UI
- x402 premium unlock flow
- verdict and builder result display

### Backend (`apps/api`)

Responsible for:

- route preview API
- premium scout API
- premium router quote API
- token metadata API
- x402 payment middleware and settlement
- vault-directed premium fee handling

## API Endpoints

### Free Preview

`GET /api/preview-quote`

Query params:

- `fromTokenAddress`
- `toTokenAddress`
- `amount`

### Token Metadata

`GET /api/token-meta`

Query params:

- `address`

Returns:

- address
- symbol
- name
- decimals

### Premium Scout

`GET /x402/scout`

Returns:

- premium verdict
- reason
- analytics
- gas-adjusted route quality

### Premium Route Quote

`GET /x402/router-quote`

Returns:

- deeper route data
- builder-friendly execution response
- calldata when available

## Example Usage

### Free Preview

```bash
curl "https://traderail-production.up.railway.app/api/preview-quote?fromTokenAddress=0x1E4a5963aBFD975d8c9021ce480b42188849D41d&toTokenAddress=0x74b7F16337b8972027F6196A17a631aC6dE26d22&amount=1000000"

Premium Scout

curl -i "https://traderail-production.up.railway.app/x402/scout?fromTokenAddress=0x1E4a5963aBFD975d8c9021ce480b42188849D41d&toTokenAddress=0x74b7F16337b8972027F6196A17a631aC6dE26d22&amount=1000000"

Premium Route Quote

curl -i "https://traderail-production.up.railway.app/x402/router-quote?fromTokenAddress=0x1E4a5963aBFD975d8c9021ce480b42188849D41d&toTokenAddress=0x74b7F16337b8972027F6196A17a631aC6dE26d22&amount=1000000"

Decision Logic

TradeRail’s current premium decision logic is based on:

stable-pair parity deviation for stable-to-stable routes

gas-adjusted execution quality for non-stable pairs


That means the current verdict is primarily based on:

how much value is lost after gas

and, for stable pairs, how far the result is from expected parity


Verdict Meanings

Optimal = route looks healthy

Caution = route may be usable, but with weaker execution quality

Avoid = route looks too weak to trust


Usage Patterns

TradeRail can be used by:

Everyday Users

Users who want a simple answer before swapping.

Developers

Developers who want:

route preview

premium route intelligence

calldata

a decision layer before execution


Agents

TradeRail can serve as a pre-trade intelligence API for:

treasury agents

rebalancing bots

portfolio assistants

settlement agents


Typical agent flow:

1. call preview


2. check if route exists


3. pay for scout if needed


4. read verdict


5. pay for route quote if deeper route data is needed


6. execute elsewhere



Deployment

Frontend

Hosted on Vercel

URL: https://traderail.vercel.app

Root directory: apps/web


Backend

Hosted on Railway

URL: https://traderail-production.up.railway.app

Root directory: apps/api


Required Frontend Environment Variables

NEXT_PUBLIC_API_URL=https://traderail-production.up.railway.app
NEXT_PUBLIC_EXPLORER=https://www.okx.com/web3/explorer/xlayer
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

Required Backend Environment Variables

PORT=4000
CORS_ORIGIN=https://traderail.vercel.app
OKX_API_KEY=
OKX_SECRET_KEY=
OKX_API_PASSPHRASE=
XLAYER_RPC_URL=https://rpc.xlayer.tech
CHAIN_INDEX=196
ENABLE_X402=true
PAY_TO_ADDRESS=0x36A506A5C69CAA346F2c5799C5D8450cB041ee2b
AGENT_REGISTRY_ADDRESS=0x63039e789aB98dDB109bFC6fE1e7200f1eBE4Bc7
REVENUE_VAULT_ADDRESS=0x36A506A5C69CAA346F2c5799C5D8450cB041ee2b

Onchain Deployment

Network: X Layer mainnet

Contracts used in the current TradeRail deployment:

AgentRegistry: 0x63039e789aB98dDB109bFC6fE1e7200f1eBE4Bc7

RevenueVault: 0x36A506A5C69CAA346F2c5799C5D8450cB041ee2b

PAY_TO_ADDRESS: 0x36A506A5C69CAA346F2c5799C5D8450cB041ee2b

Agentic Wallet Address: 0x826245F607F18cb8DecDA493e606C4DF12A39758


Premium fees are directed to the RevenueVault.

Why the Premium Payment Uses USDT0

The premium fee is separate from the swap route itself.

TradeRail prices premium access in a USD-denominated way, so the payment challenge resolves to USDT0 on X Layer. That means:

the swap pair can change

but the premium payment asset can stay the same


For example:

a user analyzes WOKB → USDT

premium payment is still made in USDT0

the fee goes to the RevenueVault


Hackathon Fit

TradeRail is built as a full-stack agentic app for the X Layer Arena.

It combines:

a live user-facing app

X Layer mainnet contracts

OnchainOS x402 premium payment flow

route intelligence for both users and agents

builder-friendly premium route data


Local Development

Install Dependencies

npm install

Run Backend

npm run dev:api

Run Frontend

npm run dev:web

Demo Flow

1. Connect wallet


2. Use a supported token pair


3. Run free preview


4. Unlock Execution Guard


5. Approve x402 payment


6. Review premium verdict


7. Optionally unlock Premium Route Quote



Current Limitations

not every pair on X Layer will return a valid route

unsupported pairs may fail because no usable route exists

the premium payment asset can remain the same even when the swap pair changes, because premium payment is separate from the swap route itself

the current decision logic is stronger on gas-adjusted route quality than on advanced slippage modeling


Roadmap

explicit slippage and price impact scoring

deeper liquidity awareness

better pair support guidance

route alert agent

wait-or-swap agent

richer builder integrations


Project Summary

TradeRail is a pre-trade intelligence layer on X Layer. It lets users preview routes for free, unlock premium execution analysis through x402, and decide whether a route looks healthy before spending capital. For developers and agents, it also provides deeper premium route data that can plug into automated workflows.

Repository

GitHub: https://github.com/Mrgtee/traderail

License

MIT

