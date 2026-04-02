import TransactionDetailClient from "./transaction-detail-client";

/**
 * Static export: journal rows are API-backed, so by default no HTML is pre-generated.
 * Set STATIC_EXPORT_JOURNAL_TRANSACTION_IDS (comma-separated) in CI to pre-render
 * specific transaction detail pages.
 */
function transactionIdsFromEnv(): string[] {
  const raw = process.env.STATIC_EXPORT_JOURNAL_TRANSACTION_IDS?.trim();
  if (!raw) return [];
  return raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
}

export function generateStaticParams(): { transactionId: string }[] {
  const ids = transactionIdsFromEnv().map((transactionId) => ({ transactionId }));
  if (ids.length > 0) return ids;
  // output:export + [] is treated as "missing" generateStaticParams (vercel/next.js#71862).
  return [{ transactionId: "0" }];
}

export default function TransactionDetailPage() {
  return <TransactionDetailClient />;
}
