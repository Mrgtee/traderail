import { evaluateRouteRisk } from "./risk.js";
import express from "express";
import cors, { CorsOptions } from "cors";
import dotenv from "dotenv";
import { z } from "zod";
import { ethers } from "ethers";
import {
  paymentMiddleware,
  x402ResourceServer,
} from "@okxweb3/x402-express";
import { ExactEvmScheme } from "@okxweb3/x402-evm/exact/server";
import { OKXFacilitatorClient } from "@okxweb3/x402-core";
import { getUniswapQuote } from "./uniswapQuote.js";

dotenv.config();

const env = z
  .object({
    PORT: z.coerce.number().default(4000),
    CORS_ORIGIN: z.string().default("http://localhost:3000"),

    OKX_API_KEY: z.string(),
    OKX_SECRET_KEY: z.string(),
    OKX_API_PASSPHRASE: z.string(),

    XLAYER_RPC_URL: z.string().url(),
    CHAIN_INDEX: z.string().default("196"),

    ENABLE_X402: z.string().default("true"),
    PAY_TO_ADDRESS: z.string(),

    AGENT_REGISTRY_ADDRESS: z.string(),
    REVENUE_VAULT_ADDRESS: z.string(),
  })
  .parse(process.env);

const app = express();

const corsOptions: CorsOptions = {
  origin: env.CORS_ORIGIN,
  credentials: false,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "PAYMENT-SIGNATURE"],
  exposedHeaders: ["PAYMENT-REQUIRED", "PAYMENT-RESPONSE"],
};

app.use(cors(corsOptions));
app.use(express.json());

const provider = new ethers.JsonRpcProvider(env.XLAYER_RPC_URL);

const agentRegistryAbi = [
  "function agentCount() view returns (uint256)",
  "function getAgent(uint256 id) view returns ((uint256 id,string role,string name,address agentWallet,string endpoint,string metadataURI,bool active))",
];

const erc20MetaAbi = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
];

const agentRegistry = new ethers.Contract(
  env.AGENT_REGISTRY_ADDRESS,
  agentRegistryAbi,
  provider
);

const enableX402 = env.ENABLE_X402.toLowerCase() === "true";
const networkId = `eip155:${env.CHAIN_INDEX}`;

if (enableX402) {
  const facilitatorClient = new OKXFacilitatorClient({
    apiKey: env.OKX_API_KEY,
    secretKey: env.OKX_SECRET_KEY,
    passphrase: env.OKX_API_PASSPHRASE,
  });

  const resourceServer = new x402ResourceServer(facilitatorClient);
  resourceServer.register(networkId, new ExactEvmScheme());

  resourceServer.onAfterVerify(async (ctx: any) => {
    console.log("[x402 verify ok]", {
      payer: ctx?.result?.payer,
      isValid: ctx?.result?.isValid,
    });
  });

  resourceServer.onVerifyFailure(async (ctx: any) => {
    console.error("[x402 verify fail]", {
      message: ctx?.error?.message,
      invalidReason: ctx?.error?.invalidReason,
      invalidMessage: ctx?.error?.invalidMessage,
      payer: ctx?.error?.payer,
    });
  });

  resourceServer.onAfterSettle(async (ctx: any) => {
    console.log("[x402 settle ok]", {
      success: ctx?.result?.success,
      status: ctx?.result?.status,
      payer: ctx?.result?.payer,
      transaction: ctx?.result?.transaction,
      network: ctx?.result?.network,
      errorReason: ctx?.result?.errorReason,
      errorMessage: ctx?.result?.errorMessage,
    });
  });

  resourceServer.onSettleFailure(async (ctx: any) => {
    console.error("[x402 settle fail]", {
      message: ctx?.error?.message,
      errorReason: ctx?.error?.errorReason,
      errorMessage: ctx?.error?.errorMessage,
      payer: ctx?.error?.payer,
      transaction: ctx?.error?.transaction,
      network: ctx?.error?.network,
    });
  });

  app.use(
    paymentMiddleware(
      {
        "GET /x402/scout": {
          accepts: [
            {
              scheme: "exact",
              network: networkId,
              payTo: env.PAY_TO_ADDRESS,
              price: "$0.05",
            },
          ],
          description: "Premium X Layer scout report",
          mimeType: "application/json",
        },
        "GET /x402/router-quote": {
          accepts: [
            {
              scheme: "exact",
              network: networkId,
              payTo: env.PAY_TO_ADDRESS,
              price: "$0.02",
            },
          ],
          description: "Premium X Layer execution route",
          mimeType: "application/json",
        },
      },
      resourceServer
    )
  );
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    network: networkId,
    chainIndex: env.CHAIN_INDEX,
    payTo: env.PAY_TO_ADDRESS,
    x402Enabled: enableX402,
  });
});

app.get("/api/overview", async (_req, res) => {
  try {
    const count = Number(await agentRegistry.agentCount());
    const nativeBalance = await provider.getBalance(env.REVENUE_VAULT_ADDRESS);

    res.json({
      app: "TradeRail",
      network: "X Layer",
      chainId: env.CHAIN_INDEX,
      registry: env.AGENT_REGISTRY_ADDRESS,
      vault: env.REVENUE_VAULT_ADDRESS,
      vaultNativeBalance: ethers.formatEther(nativeBalance),
      agentCount: count,
      x402Enabled: enableX402,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed to load overview" });
  }
});

app.get("/api/agents", async (_req, res) => {
  try {
    const count = Number(await agentRegistry.agentCount());
    const agents = [];

    for (let i = 1; i <= count; i++) {
      const a: any = await agentRegistry.getAgent(i);
      agents.push({
        id: Number(a.id),
        role: a.role,
        name: a.name,
        agentWallet: a.agentWallet,
        endpoint: a.endpoint,
        metadataURI: a.metadataURI,
        active: a.active,
      });
    }

    res.json({ agents });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed to load agents" });
  }
});

app.get("/api/token-meta", async (req, res) => {
  try {
    const { address } = req.query;

    if (!address || typeof address !== "string") {
      return res.status(400).json({ error: "missing token address" });
    }

    const tokenAddress = ethers.getAddress(address);
    const contract = new ethers.Contract(tokenAddress, erc20MetaAbi, provider);

    const [decimals, symbol, name] = await Promise.all([
      contract.decimals(),
      contract.symbol().catch(() => "TOKEN"),
      contract.name().catch(() => "Token"),
    ]);

    res.json({
      address: tokenAddress,
      decimals: Number(decimals),
      symbol: String(symbol),
      name: String(name),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "failed to load token metadata",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get("/api/preview-quote", async (req, res) => {
  try {
    const { fromTokenAddress, toTokenAddress, amount } = req.query;

    if (!fromTokenAddress || !toTokenAddress || !amount) {
      return res.status(400).json({ error: "missing query params" });
    }

    const quote = await getUniswapQuote({
      fromTokenAddress: String(fromTokenAddress),
      toTokenAddress: String(toTokenAddress),
      amount: String(amount),
    });

    res.json({ quote });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "quote preview failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get("/x402/scout", async (req, res) => {
  try {
    const { fromTokenAddress, toTokenAddress, amount } = req.query;

    if (!fromTokenAddress || !toTokenAddress || !amount) {
      return res.status(400).json({ error: "missing query params" });
    }

    const quote = await getUniswapQuote({
      fromTokenAddress: String(fromTokenAddress),
      toTokenAddress: String(toTokenAddress),
      amount: String(amount),
    });

    const risk = evaluateRouteRisk(quote);

    const report = {
      premium: true,
      network: "X Layer",
      summary: "Paid premium scout report backed by Uniswap-on-X-Layer route data.",
      tokenIn: quote.tokenIn,
      tokenOut: quote.tokenOut,
      quotedOutput: quote.quote,
      quoteGasAdjusted: quote.quoteGasAdjusted,
      estimatedGasUsed: quote.estimatedGasUsed,
      estimatedGasUsedQuoteToken: quote.estimatedGasUsedQuoteToken,
      verdict: risk.verdict,
      reason: risk.reason,
      analytics: {
        isStableToStable: risk.isStableToStable,
        normalizedInput: risk.normalizedInput,
        parityRatio: risk.parityRatio,
        gasCostQuoteToken: risk.gasCostQuoteToken,
      },
      x402Enabled: enableX402,
    };

    res.json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "scout report failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get("/x402/router-quote", async (req, res) => {
  try {
    const { fromTokenAddress, toTokenAddress, amount } = req.query;

    if (!fromTokenAddress || !toTokenAddress || !amount) {
      return res.status(400).json({ error: "missing query params" });
    }

    const quote = await getUniswapQuote({
      fromTokenAddress: String(fromTokenAddress),
      toTokenAddress: String(toTokenAddress),
      amount: String(amount),
    });

    res.json({
      premium: true,
      network: "X Layer",
      quote,
      x402Enabled: enableX402,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "router quote failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

app.listen(env.PORT, () => {
  console.log(`API running on http://localhost:${env.PORT}`);
  console.log(`x402 enabled: ${enableX402}`);
  console.log(`network: ${networkId}`);
  console.log(`Paid route: http://localhost:${env.PORT}/x402/scout`);
  console.log(`Paid route: http://localhost:${env.PORT}/x402/router-quote`);
  console.log(`Token meta route: http://localhost:${env.PORT}/api/token-meta?address=TOKEN_ADDRESS`);
});