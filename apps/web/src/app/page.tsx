"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useAccount, useChainId, useSwitchChain, useWalletClient } from "wagmi";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { PaymentRequiredModal } from "@/components/PaymentRequiredModal";
import {
  buildExactEvmPaymentPayload,
  decodePaymentRequiredHeader,
  encodePaymentSignatureHeader,
  PaymentRequired,
  PaymentRequirements,
  selectBestRequirement,
} from "@/lib/x402";
import { toRawAmount } from "@/lib/tokenAmount";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;
const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER!;
const XLAYER_CHAIN_ID = 196;

type Agent = {
  id: number;
  role: string;
  name: string;
  agentWallet: string;
  endpoint: string;
  metadataURI: string;
  active: boolean;
};

type TokenInfo = {
  address: string;
  symbol: string;
  decimals: number;
  name?: string;
};

type RouteQuote = {
  engine: string;
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  amountInRaw: string;
  quote: string;
  quoteGasAdjusted: string;
  estimatedGasUsed: string;
  estimatedGasUsedQuoteToken: string;
  gasPriceWei?: string | null;
  methodParameters?: {
    calldata: string;
    value: string;
  } | null;
};

type ScoutResult = {
  premium: true;
  network: string;
  summary: string;
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  quotedOutput: string;
  quoteGasAdjusted: string;
  estimatedGasUsed: string;
  estimatedGasUsedQuoteToken: string;
  verdict: "go" | "caution" | "avoid";
  reason: string;
  analytics?: {
    isStableToStable?: boolean;
    normalizedInput?: number | null;
    parityRatio?: number | null;
    gasCostQuoteToken?: number | null;
  };
  x402Enabled: boolean;
};

type RouterResult = {
  premium: true;
  network: string;
  quote: RouteQuote;
  x402Enabled: boolean;
};

const DEMO_FROM = "0x1E4a5963aBFD975d8c9021ce480b42188849D41d";
const DEMO_TO = "0x74b7F16337b8972027F6196A17a631aC6dE26d22";
const DEMO_AMOUNT = "1";

const verdictTheme = {
  go: {
    label: "Optimal",
    text: "#86efac",
    border: "rgba(34,197,94,0.34)",
    background: "rgba(22,101,52,0.18)",
  },
  caution: {
    label: "Caution",
    text: "#fde68a",
    border: "rgba(245,158,11,0.34)",
    background: "rgba(146,64,14,0.18)",
  },
  avoid: {
    label: "Avoid",
    text: "#fca5a5",
    border: "rgba(239,68,68,0.34)",
    background: "rgba(127,29,29,0.18)",
  },
};

function shortAddress(value?: string) {
  if (!value || value.length < 12) return value || "--";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatRawAmount(raw?: string, decimals = 18, maxFraction = 6) {
  if (!raw) return "--";
  try {
    const formatted = formatUnits(BigInt(raw), decimals);
    const n = Number(formatted);
    if (!Number.isFinite(n)) return formatted;
    return n.toLocaleString(undefined, {
      maximumFractionDigits: maxFraction,
    });
  } catch {
    return raw;
  }
}

function formatDecimal(value?: string | number | null, maxFraction = 6) {
  if (value === null || value === undefined) return "--";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString(undefined, {
    maximumFractionDigits: maxFraction,
  });
}

function normalizeUiError(message: string) {
  if (message.includes("No Uniswap route found")) {
    return "No route found for this pair and amount on X Layer. Try another amount or another token pair.";
  }

  if (message.includes("did not return JSON")) {
    return "Token metadata endpoint did not return JSON. Check that /api/token-meta exists and that port 4000 is public.";
  }

  if (message.includes("Unexpected token '<'")) {
    return "The API returned HTML instead of JSON. Make sure the API is running and port 4000 is public.";
  }

  return message;
}

function isScoutResult(value: unknown): value is ScoutResult {
  return !!value && typeof value === "object" && "verdict" in value;
}

function isRouterResult(value: unknown): value is RouterResult {
  return !!value && typeof value === "object" && "quote" in value;
}

function StatCard({
  label,
  value,
  subvalue,
}: {
  label: string;
  value: string;
  subvalue?: string;
}) {
  return (
    <div
      className="panel-soft"
      style={{
        padding: 16,
        borderRadius: 18,
      }}
    >
      <div
        className="label"
        style={{
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div style={{ marginTop: 8, fontSize: 22, fontWeight: 700 }}>{value}</div>
      {subvalue ? (
        <div className="subtle" style={{ marginTop: 6, fontSize: 13 }}>
          {subvalue}
        </div>
      ) : null}
    </div>
  );
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();

  const [overview, setOverview] = useState<any>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [quote, setQuote] = useState<RouteQuote | null>(null);
  const [premiumResult, setPremiumResult] = useState<ScoutResult | RouterResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [isPaying, setIsPaying] = useState(false);

  const [fromTokenAddress, setFromTokenAddress] = useState(DEMO_FROM);
  const [toTokenAddress, setToTokenAddress] = useState(DEMO_TO);
  const [amountInput, setAmountInput] = useState(DEMO_AMOUNT);

  const [fromTokenMeta, setFromTokenMeta] = useState<TokenInfo | null>(null);
  const [toTokenMeta, setToTokenMeta] = useState<TokenInfo | null>(null);

  const [overviewError, setOverviewError] = useState("");
  const [agentsError, setAgentsError] = useState("");
  const [quoteError, setQuoteError] = useState("");
  const [premiumError, setPremiumError] = useState("");
  const [metaError, setMetaError] = useState("");

  const [paymentRequired, setPaymentRequired] = useState<PaymentRequired | null>(null);
  const [selectedRequirement, setSelectedRequirement] =
    useState<PaymentRequirements | null>(null);
  const [pendingPremiumUrl, setPendingPremiumUrl] = useState("");
  const [premiumTitle, setPremiumTitle] = useState("");

  useEffect(() => {
    async function loadOverview() {
      try {
        const res = await fetch(`${API_URL}/api/overview`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed overview");
        setOverview(data);
      } catch (err) {
        setOverviewError(
          err instanceof Error ? normalizeUiError(err.message) : "Failed to load overview"
        );
      }
    }

    async function loadAgents() {
      try {
        const res = await fetch(`${API_URL}/api/agents`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed agents");
        setAgents(data.agents || []);
      } catch (err) {
        setAgentsError(
          err instanceof Error ? normalizeUiError(err.message) : "Failed to load agents"
        );
      }
    }

    loadOverview();
    loadAgents();
  }, []);

  useEffect(() => {
    async function loadTokenMeta(address: string, setter: (value: TokenInfo | null) => void) {
      if (!address || !address.startsWith("0x")) {
        setter(null);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/token-meta?address=${address}`);
        const contentType = res.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
          throw new Error(
            "Token metadata endpoint did not return JSON. Check that /api/token-meta exists and that port 4000 is public."
          );
        }

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || data.detail || "Failed token metadata");
        }

        setter(data);
        setMetaError("");
      } catch (err) {
        setter(null);
        setMetaError(
          err instanceof Error ? normalizeUiError(err.message) : "Failed to load token metadata"
        );
      }
    }

    loadTokenMeta(fromTokenAddress, setFromTokenMeta);
    loadTokenMeta(toTokenAddress, setToTokenMeta);
  }, [fromTokenAddress, toTokenAddress]);

  const amountRaw = useMemo(() => {
    return toRawAmount(amountInput, fromTokenMeta?.decimals);
  }, [amountInput, fromTokenMeta?.decimals]);

  const scoutUrl = useMemo(() => {
    if (!amountRaw) return "";
    const qs = new URLSearchParams({
      fromTokenAddress,
      toTokenAddress,
      amount: amountRaw,
    });
    return `${API_URL}/x402/scout?${qs.toString()}`;
  }, [fromTokenAddress, toTokenAddress, amountRaw]);

  const routerUrl = useMemo(() => {
    if (!amountRaw) return "";
    const qs = new URLSearchParams({
      fromTokenAddress,
      toTokenAddress,
      amount: amountRaw,
    });
    return `${API_URL}/x402/router-quote?${qs.toString()}`;
  }, [fromTokenAddress, toTokenAddress, amountRaw]);

  function useDemoPair() {
    setFromTokenAddress(DEMO_FROM);
    setToTokenAddress(DEMO_TO);
    setAmountInput(DEMO_AMOUNT);
    setQuoteError("");
    setPremiumError("");
  }

  async function runPreview() {
    try {
      setLoading(true);
      setQuote(null);
      setQuoteError("");

      if (!amountRaw) {
        throw new Error("Enter a valid amount.");
      }

      const qs = new URLSearchParams({
        fromTokenAddress,
        toTokenAddress,
        amount: amountRaw,
      });

      const res = await fetch(`${API_URL}/api/preview-quote?${qs.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.detail || "Preview failed");
      }

      setQuote(data.quote);
    } catch (err) {
      setQuoteError(err instanceof Error ? normalizeUiError(err.message) : "Preview failed");
    } finally {
      setLoading(false);
    }
  }

  async function requestPremium(url: string, title: string) {
    try {
      setPremiumError("");
      setPremiumResult(null);

      if (!isConnected || !address) {
        throw new Error("Connect your wallet first.");
      }

      if (!url) {
        throw new Error("Enter a valid amount first.");
      }

      const res = await fetch(url);

      if (res.status === 402) {
        const header = res.headers.get("PAYMENT-REQUIRED");
        if (!header) {
          throw new Error("Payment challenge header is missing.");
        }

        const required = decodePaymentRequiredHeader(header);
        const accepted = selectBestRequirement(required);

        setPaymentRequired(required);
        setSelectedRequirement(accepted);
        setPendingPremiumUrl(url);
        setPremiumTitle(title);
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.detail || "Premium request failed");
      }

      setPremiumResult(data);
    } catch (err) {
      setPremiumError(
        err instanceof Error ? normalizeUiError(err.message) : "Premium request failed"
      );
    }
  }

  async function confirmPayment() {
    try {
      setIsPaying(true);
      setPremiumError("");

      if (!isConnected || !address) {
        throw new Error("Connect your wallet first.");
      }

      if (!walletClient) {
        throw new Error("Wallet client is not ready.");
      }

      if (!paymentRequired || !selectedRequirement || !pendingPremiumUrl) {
        throw new Error("Payment request is incomplete.");
      }

      if (chainId !== XLAYER_CHAIN_ID) {
        await switchChainAsync({ chainId: XLAYER_CHAIN_ID });
      }

      const payload = await buildExactEvmPaymentPayload({
        required: paymentRequired,
        accepted: selectedRequirement,
        payer: address as `0x${string}`,
        chainId: XLAYER_CHAIN_ID,
        signTypedData: async ({ domain, types, primaryType, message }) => {
          const signature = await walletClient.signTypedData({
            account: address as any,
            domain: domain as any,
            types: types as any,
            primaryType: primaryType as any,
            message: message as any,
          } as any);

          return signature as `0x${string}`;
        },
      });

      const encoded = encodePaymentSignatureHeader(payload);

      const res = await fetch(pendingPremiumUrl, {
        headers: {
          "PAYMENT-SIGNATURE": encoded,
        },
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 402) {
        throw new Error(
          "Payment challenge is still active. Make sure this wallet has USDT0 on X Layer, not only OKB."
        );
      }

      if (!res.ok) {
        throw new Error(data.error || data.detail || "Payment retry failed");
      }

      setPremiumResult(data);
      setPaymentRequired(null);
      setSelectedRequirement(null);
      setPendingPremiumUrl("");
      setPremiumTitle("");
    } catch (err) {
      setPremiumError(err instanceof Error ? normalizeUiError(err.message) : "Payment failed");
    } finally {
      setIsPaying(false);
    }
  }

  function closePaymentModal() {
    setPaymentRequired(null);
    setSelectedRequirement(null);
    setPendingPremiumUrl("");
    setPremiumTitle("");
  }

  async function copyCalldata() {
    if (!premiumResult || !isRouterResult(premiumResult)) return;
    const calldata = premiumResult.quote.methodParameters?.calldata;
    if (!calldata) return;
    await navigator.clipboard.writeText(calldata);
  }

  const scoutTheme =
    premiumResult && isScoutResult(premiumResult)
      ? verdictTheme[premiumResult.verdict]
      : null;

  return (
    <div className="shell">
      <header className="topbar">
        <div
          className="container-xl"
          style={{
            display: "flex",
            height: 78,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Image
              src="/traderail-logo.png"
              alt="TradeRail logo"
              width={42}
              height={42}
              style={{ borderRadius: 10 }}
            />
            <div>
              <div className="kicker">X Layer • Agentic Wallet • x402</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>TradeRail</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <ConnectWalletButton />
            <a className="btn-secondary" href={EXPLORER_URL} target="_blank" rel="noreferrer">
              X Layer Explorer
            </a>
          </div>
        </div>
      </header>

      <main className="container-xl" style={{ paddingTop: 32, paddingBottom: 56 }}>
        <section className="panel" style={{ padding: 32 }}>
          <div
            style={{
              display: "grid",
              gap: 24,
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            }}
          >
            <div>
              <div className="kicker">Pre-trade intelligence on X Layer</div>
              <h1
                style={{
                  marginTop: 14,
                  fontSize: 42,
                  lineHeight: 1.02,
                  fontWeight: 780,
                  maxWidth: 760,
                  letterSpacing: "-0.03em",
                }}
              >
                Check the route before you swap.
              </h1>

              <p
                className="subtle"
                style={{
                  marginTop: 18,
                  maxWidth: 720,
                  fontSize: 15,
                  lineHeight: 1.9,
                }}
              >
                TradeRail helps users and agents judge execution quality before spending capital.
                Preview the route for free, then unlock deeper conviction through x402 when the
                decision actually matters.
              </p>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              <div className="metric">
                <div
                  className="subtle"
                  style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.16em" }}
                >
                  Network
                </div>
                <div style={{ marginTop: 10, fontSize: 28, fontWeight: 700 }}>
                  {overview?.network || "X Layer"}
                </div>
                <div className="subtle" style={{ marginTop: 8, fontSize: 14 }}>
                  Chain ID {overview?.chainId || "196"}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="panel" style={{ marginTop: 28, padding: 28 }}>
          <div
            style={{
              display: "grid",
              gap: 22,
              gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            }}
          >
            <div>
              <div className="kicker">Free preview</div>
              <h2 style={{ marginTop: 12, fontSize: 30, fontWeight: 720 }}>Route preview</h2>
              <p className="subtle" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.8 }}>
                Enter your token pair and amount to preview the route.
              </p>

              <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button className="btn-secondary" onClick={useDemoPair}>
                  Use demo pair
                </button>
                <button className="btn-primary" onClick={runPreview} disabled={loading || !amountRaw}>
                  {loading ? "Loading..." : "Run preview"}
                </button>
              </div>

              <div
                style={{
                  marginTop: 22,
                  display: "grid",
                  gap: 14,
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                }}
              >
                <div>
                  <label className="label">From token address</label>
                  <input
                    className="input"
                    value={fromTokenAddress}
                    onChange={(e) => setFromTokenAddress(e.target.value)}
                    placeholder="0x..."
                  />
                  <div className="subtle" style={{ marginTop: 6, fontSize: 12 }}>
                    {fromTokenMeta
                      ? `${fromTokenMeta.symbol} • ${fromTokenMeta.decimals} decimals`
                      : "Loading token..."}
                  </div>
                </div>

                <div>
                  <label className="label">To token address</label>
                  <input
                    className="input"
                    value={toTokenAddress}
                    onChange={(e) => setToTokenAddress(e.target.value)}
                    placeholder="0x..."
                  />
                  <div className="subtle" style={{ marginTop: 6, fontSize: 12 }}>
                    {toTokenMeta
                      ? `${toTokenMeta.symbol} • ${toTokenMeta.decimals} decimals`
                      : "Loading token..."}
                  </div>
                </div>

                <div>
                  <label className="label">Amount</label>
                  <input
                    className="input"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="1"
                  />
                  <div className="subtle" style={{ marginTop: 6, fontSize: 12 }}>
                    Raw amount: {amountRaw || "--"}
                  </div>
                </div>
              </div>

              {metaError ? (
                <div style={{ marginTop: 16, color: "#ff7a7a", fontSize: 14 }}>{metaError}</div>
              ) : null}

              {quoteError ? (
                <div style={{ marginTop: 16, color: "#ff7a7a", fontSize: 14 }}>{quoteError}</div>
              ) : null}
            </div>

            <div>
              <div className="kicker">Preview summary</div>
              <h3 style={{ marginTop: 12, fontSize: 24, fontWeight: 720 }}>
                What the free route says
              </h3>

              {!quote ? (
                <div
                  className="panel-soft"
                  style={{
                    marginTop: 18,
                    padding: 20,
                    borderRadius: 18,
                    minHeight: 240,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <div className="subtle" style={{ fontSize: 14 }}>
                    Run a preview to see the route before paying for deeper judgment.
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
                  <StatCard
                    label="You pay"
                    value={`${formatRawAmount(quote.amountInRaw, quote.tokenIn.decimals)} ${quote.tokenIn.symbol}`}
                    subvalue={shortAddress(quote.tokenIn.address)}
                  />
                  <StatCard
                    label="Estimated output"
                    value={`${formatDecimal(quote.quote)} ${quote.tokenOut.symbol}`}
                    subvalue="Before gas adjustment"
                  />
                  <StatCard
                    label="Net after gas"
                    value={`${formatDecimal(quote.quoteGasAdjusted)} ${quote.tokenOut.symbol}`}
                    subvalue={`Gas cost: ${formatDecimal(quote.estimatedGasUsedQuoteToken)} ${quote.tokenOut.symbol}`}
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        <section
          style={{
            marginTop: 28,
            display: "grid",
            gap: 24,
            gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          }}
        >
          <div className="panel-soft" style={{ padding: 24 }}>
            <div className="kicker">Primary premium feature</div>
            <h3 style={{ marginTop: 12, fontSize: 28, fontWeight: 740 }}>Execution Guard</h3>
            <p className="subtle" style={{ marginTop: 10, fontSize: 14, lineHeight: 1.8 }}>
              Pay once to turn raw route data into a clean decision: optimal, caution, or avoid.
            </p>

            <div className="panel-soft" style={{ marginTop: 18, padding: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Scout report</div>
              <div className="subtle" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.8 }}>
                Best for everyday users who want a simple answer before executing a swap.
              </div>
              <button
                className="btn-primary"
                style={{ marginTop: 16 }}
                onClick={() => requestPremium(scoutUrl, "Unlock Execution Guard")}
                disabled={!amountRaw}
              >
                Unlock via x402
              </button>
            </div>

            {premiumError ? (
              <div style={{ marginTop: 16, color: "#ff7a7a", fontSize: 14 }}>{premiumError}</div>
            ) : null}
          </div>

          <div className="panel" style={{ padding: 24 }}>
            <div className="kicker">Execution verdict</div>
            <h3 style={{ marginTop: 12, fontSize: 30, fontWeight: 760 }}>Premium result</h3>

            {!premiumResult ? (
              <div
                className="panel-soft"
                style={{
                  marginTop: 18,
                  padding: 22,
                  minHeight: 320,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <div className="subtle" style={{ fontSize: 14 }}>
                  Unlock the scout report to replace guesswork with a real verdict.
                </div>
              </div>
            ) : isScoutResult(premiumResult) ? (
              <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
                <div
                  style={{
                    border: `1px solid ${scoutTheme?.border}`,
                    background: scoutTheme?.background,
                    color: scoutTheme?.text,
                    borderRadius: 20,
                    padding: 18,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      textTransform: "uppercase",
                      letterSpacing: "0.16em",
                      opacity: 0.9,
                    }}
                  >
                    Verdict
                  </div>
                  <div style={{ marginTop: 8, fontSize: 34, fontWeight: 800 }}>
                    {scoutTheme?.label}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 15, lineHeight: 1.8, color: "#f5f5f5" }}>
                    {premiumResult.reason}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  }}
                >
                  <StatCard
                    label="You pay"
                    value={`${formatDecimal(
                      premiumResult.analytics?.normalizedInput ?? 0,
                      6
                    )} ${premiumResult.tokenIn.symbol}`}
                    subvalue={shortAddress(premiumResult.tokenIn.address)}
                  />
                  <StatCard
                    label="Net after gas"
                    value={`${formatDecimal(premiumResult.quoteGasAdjusted)} ${premiumResult.tokenOut.symbol}`}
                    subvalue={shortAddress(premiumResult.tokenOut.address)}
                  />
                  <StatCard
                    label="Parity ratio"
                    value={formatDecimal(premiumResult.analytics?.parityRatio, 6)}
                    subvalue="1.00 means ideal stable parity"
                  />
                  <StatCard
                    label="Gas cost"
                    value={`${formatDecimal(premiumResult.analytics?.gasCostQuoteToken, 6)} ${premiumResult.tokenOut.symbol}`}
                    subvalue={`Estimated gas used: ${premiumResult.estimatedGasUsed}`}
                  />
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  }}
                >
                  <StatCard
                    label="You pay"
                    value={`${formatRawAmount(
                      premiumResult.quote.amountInRaw,
                      premiumResult.quote.tokenIn.decimals
                    )} ${premiumResult.quote.tokenIn.symbol}`}
                    subvalue={shortAddress(premiumResult.quote.tokenIn.address)}
                  />
                  <StatCard
                    label="Net after gas"
                    value={`${formatDecimal(premiumResult.quote.quoteGasAdjusted)} ${premiumResult.quote.tokenOut.symbol}`}
                    subvalue={shortAddress(premiumResult.quote.tokenOut.address)}
                  />
                  <StatCard
                    label="Gas cost"
                    value={`${formatDecimal(premiumResult.quote.estimatedGasUsedQuoteToken)} ${premiumResult.quote.tokenOut.symbol}`}
                    subvalue={`Estimated gas used: ${premiumResult.quote.estimatedGasUsed}`}
                  />
                  <StatCard
                    label="Engine"
                    value={premiumResult.quote.engine}
                    subvalue="Execution-ready route data"
                  />
                </div>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <button className="btn-secondary" onClick={copyCalldata}>
                    Copy calldata
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section
          style={{
            marginTop: 28,
            display: "grid",
            gap: 24,
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          }}
        >
          <details className="panel-soft" style={{ padding: 20 }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>For builders</summary>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Premium Route Quote</div>
              <div className="subtle" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.8 }}>
                Full route data with execution-ready calldata for advanced users, bots, and agents.
              </div>
              <button
                className="btn-secondary"
                style={{ marginTop: 16 }}
                onClick={() => requestPremium(routerUrl, "Unlock Premium Route Quote")}
                disabled={!amountRaw}
              >
                Unlock route data
              </button>
            </div>
          </details>

          <details className="panel-soft" style={{ padding: 20 }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>Project details</summary>
            <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
              <div className="subtle" style={{ fontSize: 14 }}>
                Registry: {overviewError ? "Unavailable" : shortAddress(overview?.registry)}
              </div>
              <div className="subtle" style={{ fontSize: 14 }}>
                Vault: {overviewError ? "Unavailable" : shortAddress(overview?.vault)}
              </div>
              <div className="subtle" style={{ fontSize: 14 }}>
                Agents: {agentsError ? "Unavailable" : agents.map((agent) => agent.name).join(" • ")}
              </div>
            </div>
          </details>
        </section>
      </main>

      <PaymentRequiredModal
        open={!!paymentRequired && !!selectedRequirement}
        title={premiumTitle || "Premium unlock"}
        requirement={selectedRequirement}
        onClose={closePaymentModal}
        onConfirm={confirmPayment}
        isSubmitting={isPaying}
        error={premiumError}
      />
    </div>
  );
}