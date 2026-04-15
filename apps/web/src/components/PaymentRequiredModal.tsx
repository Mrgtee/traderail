"use client";

type Requirement = {
  asset: string;
  amount: string;
  payTo: string;
  network: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, any>;
};

function shortAddress(value?: string) {
  if (!value) return "--";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function PaymentRequiredModal({
  open,
  title,
  requirement,
  onClose,
  onConfirm,
  isSubmitting,
  error,
}: {
  open: boolean;
  title: string;
  requirement: Requirement | null;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  error: string;
}) {
  if (!open || !requirement) return null;

  const assetName =
    (requirement.extra?.eip712?.name as string) ||
    (requirement.extra?.name as string) ||
    "Token";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "grid",
        placeItems: "center",
        zIndex: 1000,
        padding: 24,
      }}
    >
      <div
        className="panel"
        style={{
          width: "100%",
          maxWidth: 560,
          padding: 28,
          borderRadius: 24,
        }}
      >
        <div className="kicker">x402 payment required</div>
        <h3 style={{ marginTop: 12, fontSize: 28, fontWeight: 700 }}>{title}</h3>
        <p className="subtle" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.8 }}>
          Review the premium payment details below, sign the authorization, and unlock the result.
        </p>

        <div style={{ display: "grid", gap: 12, marginTop: 22 }}>
          <div className="panel-soft" style={{ padding: 16 }}>
            <div className="label">Asset</div>
            <div>{assetName}</div>
            <div className="subtle" style={{ marginTop: 6, fontSize: 12 }}>
              {shortAddress(requirement.asset)}
            </div>
          </div>

          <div className="panel-soft" style={{ padding: 16 }}>
            <div className="label">Amount (smallest unit)</div>
            <div>{requirement.amount}</div>
          </div>

          <div className="panel-soft" style={{ padding: 16 }}>
            <div className="label">Pay to</div>
            <div>{shortAddress(requirement.payTo)}</div>
            <div className="subtle" style={{ marginTop: 6, fontSize: 12 }}>
              {requirement.payTo}
            </div>
          </div>

          <div className="panel-soft" style={{ padding: 16 }}>
            <div className="label">Network</div>
            <div>{requirement.network}</div>
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 16, color: "#ff7a7a", fontSize: 14 }}>{error}</div>
        )}

        <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button className="btn-primary" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? "Processing..." : "Pay and unlock"}
          </button>
        </div>
      </div>
    </div>
  );
}