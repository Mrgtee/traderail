"use client";

export type PaymentRequirements = {
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, any>;
};

export type PaymentRequired = {
  x402Version: number;
  error?: string;
  resource: {
    url: string;
    description?: string;
    mimeType?: string;
  };
  accepts: PaymentRequirements[];
  extensions?: Record<string, any>;
};

export type PaymentPayload = {
  x402Version: number;
  resource?: {
    url: string;
    description?: string;
    mimeType?: string;
  };
  accepted: PaymentRequirements;
  payload: {
    signature: `0x${string}`;
    authorization: {
      from: `0x${string}`;
      to: `0x${string}`;
      value: string;
      validAfter: string;
      validBefore: string;
      nonce: `0x${string}`;
    };
  };
  extensions?: Record<string, any>;
};

function normalizeBase64(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = padded.length % 4;
  if (remainder === 0) return padded;
  return padded + "=".repeat(4 - remainder);
}

function decodeBase64Json<T>(value: string): T {
  const normalized = normalizeBase64(value);
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json) as T;
}

function encodeBase64Json(value: unknown): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function randomHex32(): `0x${string}` {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `0x${hex}`;
}

export function decodePaymentRequiredHeader(header: string): PaymentRequired {
  return decodeBase64Json<PaymentRequired>(header);
}

export function encodePaymentSignatureHeader(payload: PaymentPayload): string {
  return encodeBase64Json(payload);
}

export function selectBestRequirement(
  required: PaymentRequired,
  network = "eip155:196"
): PaymentRequirements {
  const exact = required.accepts.find(
    (item) => item.scheme === "exact" && item.network === network
  );

  if (!exact) {
    throw new Error("No supported exact EVM payment requirement found.");
  }

  return exact;
}

export async function buildExactEvmPaymentPayload(args: {
  required: PaymentRequired;
  accepted: PaymentRequirements;
  payer: `0x${string}`;
  chainId: number;
  signTypedData: (params: {
    domain: Record<string, any>;
    types: Record<string, any>;
    primaryType: string;
    message: Record<string, any>;
  }) => Promise<`0x${string}`>;
}): Promise<PaymentPayload> {
  const { required, accepted, payer, chainId, signTypedData } = args;

  const now = Math.floor(Date.now() / 1000);
  const validAfter = Math.max(0, now - 60);
  const validBefore = now + (accepted.maxTimeoutSeconds || 300);
  const nonce = randomHex32();

  const extra = accepted.extra || {};
  const eip712 = typeof extra.eip712 === "object" && extra.eip712 ? extra.eip712 : {};

  const domain = {
    name: eip712.name || extra.name || "Token",
    version: eip712.version || extra.version || "1",
    chainId,
    verifyingContract: accepted.asset,
  };

  const types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  };

  const authorization = {
    from: payer,
    to: accepted.payTo as `0x${string}`,
    value: accepted.amount,
    validAfter: String(validAfter),
    validBefore: String(validBefore),
    nonce,
  };

  const signature = await signTypedData({
    domain,
    types,
    primaryType: "TransferWithAuthorization",
    message: authorization,
  });

  return {
    x402Version: required.x402Version,
    resource: required.resource,
    accepted,
    payload: {
      signature,
      authorization,
    },
    extensions: required.extensions,
  };
}