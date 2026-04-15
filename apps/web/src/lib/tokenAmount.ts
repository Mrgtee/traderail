import { parseUnits } from "viem";

export function toRawAmount(amount: string, decimals?: number | null) {
  if (!amount || decimals === null || decimals === undefined) return null;

  const cleaned = amount.trim();

  if (!cleaned) return null;
  if (Number(cleaned) <= 0) return null;

  try {
    return parseUnits(cleaned, decimals).toString();
  } catch {
    return null;
  }
}
