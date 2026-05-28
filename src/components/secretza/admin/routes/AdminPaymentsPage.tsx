"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle, ExternalLink, XCircle } from "lucide-react";

type ManualPayment = {
  id: string;
  paymentType: "boost" | "feature" | "premium";
  amount: number;
  utrNumber: string;
  screenshotUrl: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  user: { email: string; name: string | null };
};

const statuses = ["pending", "approved", "rejected"] as const;

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<ManualPayment[]>([]);
  const [status, setStatus] = useState<(typeof statuses)[number]>("pending");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/payments/manual?status=${status}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load payments");
      setPayments(data.submissions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  async function reviewPayment(id: string, action: "approve" | "reject") {
    const response = await fetch(`/api/admin/payments/manual/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Payment review failed");
      return;
    }

    await loadPayments();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payments</h1>
        <p className="text-sm text-[#A1A1AA] mt-1">Review manual payment proofs for featured and boosted listings.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {statuses.map((item) => (
          <button
            key={item}
            onClick={() => setStatus(item)}
            className={`rounded-lg border px-3 py-2 text-xs capitalize ${
              status === item
                ? "border-[#7C3AED]/30 bg-[#7C3AED]/15 text-[#8B5CF6]"
                : "border-[rgba(255,255,255,0.08)] text-[#A1A1AA] hover:bg-white/[0.04]"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#15151D]">
        <div className="border-b border-[rgba(255,255,255,0.08)] px-4 py-3 text-xs uppercase tracking-wide text-[#A1A1AA]">
          {loading ? "Loading..." : `${payments.length} payment proofs`}
        </div>

        {payments.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#A1A1AA]">No payment proofs found</div>
        ) : (
          payments.map((payment) => (
            <div key={payment.id} className="grid gap-4 border-b border-[rgba(255,255,255,0.06)] p-4 lg:grid-cols-[1fr_auto]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold capitalize">{payment.paymentType} payment</h2>
                  <span className="rounded-full border border-[#7C3AED]/30 bg-[#7C3AED]/15 px-2 py-0.5 text-[10px] uppercase text-[#8B5CF6]">
                    {payment.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#A1A1AA]">
                  {payment.user.email} · ₹{payment.amount} · UTR {payment.utrNumber}
                </p>
                <p className="mt-1 text-xs text-[#52525B]">{new Date(payment.createdAt).toLocaleString()}</p>
                {payment.notes && <p className="mt-2 text-sm text-[#A1A1AA]">{payment.notes}</p>}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {payment.screenshotUrl && (
                  <a href={payment.screenshotUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-2 text-xs text-[#A1A1AA] hover:bg-white/[0.04]">
                    <ExternalLink className="inline size-3.5 mr-1" />
                    Proof
                  </a>
                )}
                <button onClick={() => reviewPayment(payment.id, "approve")} className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                  <CheckCircle className="inline size-3.5 mr-1" />
                  Approve
                </button>
                <button onClick={() => reviewPayment(payment.id, "reject")} className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  <XCircle className="inline size-3.5 mr-1" />
                  Reject
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
