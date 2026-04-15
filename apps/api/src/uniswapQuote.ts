import sdkCore from "@uniswap/sdk-core";
import sor from "@uniswap/smart-order-router";
import ethers5Pkg from "ethers5";

const { CurrencyAmount, Percent, Token, TradeType } = sdkCore as any;
const { AlphaRouter, SwapType } = sor as any;
const { ethers: ethers5 } = ethers5Pkg as any;

const CHAIN_ID = 196;
const NETWORK = { chainId: 196, name: "xlayer" };

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
];

function getProvider() {
  const rpcUrl = process.env.XLAYER_RPC_URL;
  if (!rpcUrl) {
    throw new Error("XLAYER_RPC_URL is missing");
  }

  return new ethers5.providers.StaticJsonRpcProvider(rpcUrl, NETWORK);
}

function getRouter() {
  return new AlphaRouter({
    chainId: CHAIN_ID,
    provider: getProvider()
  });
}

function normalizeAddress(address: string) {
  return ethers5.utils.getAddress(address);
}

async function resolveToken(address: string) {
  const provider = getProvider();
  const tokenAddress = normalizeAddress(address);
  const contract = new ethers5.Contract(tokenAddress, ERC20_ABI, provider);

  const [decimalsRaw, symbolRaw, nameRaw] = await Promise.all([
    contract.decimals(),
    contract.symbol().catch(() => "TOKEN"),
    contract.name().catch(() => "Token")
  ]);

  return new Token(
    CHAIN_ID,
    tokenAddress,
    Number(decimalsRaw),
    String(symbolRaw),
    String(nameRaw)
  );
}

export async function getUniswapQuote(params: {
  fromTokenAddress: string;
  toTokenAddress: string;
  amount: string;
}) {
  const router = getRouter();

  const tokenIn = await resolveToken(params.fromTokenAddress);
  const tokenOut = await resolveToken(params.toTokenAddress);

  const amountIn = CurrencyAmount.fromRawAmount(tokenIn, params.amount);

  const route: any = await router.route(
    amountIn,
    tokenOut,
    TradeType.EXACT_INPUT,
    {
      type: SwapType.SWAP_ROUTER_02,
      recipient: "0x0000000000000000000000000000000000000001",
      slippageTolerance: new Percent(50, 10_000),
      deadlineOrPreviousBlockhash: Math.floor(Date.now() / 1000) + 1800
    }
  );

  if (!route) {
    throw new Error("No Uniswap route found on X Layer for this pair and amount");
  }

  return {
    engine: "uniswap-sor",
    tokenIn: {
      address: tokenIn.address,
      symbol: tokenIn.symbol,
      decimals: tokenIn.decimals
    },
    tokenOut: {
      address: tokenOut.address,
      symbol: tokenOut.symbol,
      decimals: tokenOut.decimals
    },
    amountInRaw: params.amount,
    quote: route.quote?.toExact?.() ?? null,
    quoteGasAdjusted: route.quoteGasAdjusted?.toExact?.() ?? null,
    estimatedGasUsed: route.estimatedGasUsed?.toString?.() ?? null,
    estimatedGasUsedQuoteToken: route.estimatedGasUsedQuoteToken?.toExact?.() ?? null,
    gasPriceWei: route.gasPriceWei?.toString?.() ?? null,
    methodParameters: route.methodParameters
      ? {
          calldata: route.methodParameters.calldata,
          value: route.methodParameters.value
        }
      : null
  };
}
