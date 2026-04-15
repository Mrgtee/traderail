export type QuoteLike = {
  tokenIn?: { symbol?: string; decimals?: number };
  tokenOut?: { symbol?: string; decimals?: number };
  amountInRaw?: string;
  quote?: string | null;
  quoteGasAdjusted?: string | null;
  estimatedGasUsed?: string | null;
  estimatedGasUsedQuoteToken?: string | null;
};

const STABLE_SYMBOLS = new Set([
  "USDT",
  "USDC",
  "USDT0",
  "USDG",
  "DAI",
]);

function toNum(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isStableSymbol(symbol?: string) {
  if (!symbol) return false;
  return STABLE_SYMBOLS.has(symbol.toUpperCase());
}

export function evaluateRouteRisk(quote: QuoteLike) {
  const inSymbol = quote.tokenIn?.symbol?.toUpperCase();
  const outSymbol = quote.tokenOut?.symbol?.toUpperCase();

  const inputDecimals = quote.tokenIn?.decimals ?? 18;
  const amountInRawNum = toNum(quote.amountInRaw);
  const quotedOutput = toNum(quote.quote);
  const gasAdjustedOutput = toNum(quote.quoteGasAdjusted);
  const gasCostQuoteToken = toNum(quote.estimatedGasUsedQuoteToken);

  const isStableToStable =
    isStableSymbol(inSymbol) && isStableSymbol(outSymbol);

  const normalizedInput =
    amountInRawNum !== null ? amountInRawNum / Math.pow(10, inputDecimals) : null;

  let parityRatio: number | null = null;
  if (
    isStableToStable &&
    normalizedInput !== null &&
    normalizedInput > 0 &&
    gasAdjustedOutput !== null
  ) {
    parityRatio = gasAdjustedOutput / normalizedInput;
  }

  let verdict: "go" | "caution" | "avoid" = "go";
  let reason = "Route looks acceptable.";

  if (isStableToStable && parityRatio !== null) {
    if (parityRatio >= 0.98) {
      verdict = "go";
      reason = "Stable pair is close to parity.";
    } else if (parityRatio >= 0.93) {
      verdict = "caution";
      reason = "Stable pair is below ideal parity.";
    } else {
      verdict = "avoid";
      reason = "Stable pair deviates too far from parity.";
    }
  } else if (
    quotedOutput !== null &&
    gasAdjustedOutput !== null &&
    quotedOutput > 0
  ) {
    const gasImpactRatio = (quotedOutput - gasAdjustedOutput) / quotedOutput;

    if (gasImpactRatio <= 0.003) {
      verdict = "go";
      reason = "Gas adjustment impact is small.";
    } else if (gasImpactRatio <= 0.01) {
      verdict = "caution";
      reason = "Gas adjustment meaningfully reduces effective output.";
    } else {
      verdict = "avoid";
      reason = "Gas impact is too high for this route.";
    }
  }

  return {
    verdict,
    reason,
    isStableToStable,
    parityRatio,
    normalizedInput,
    gasCostQuoteToken,
  };
}