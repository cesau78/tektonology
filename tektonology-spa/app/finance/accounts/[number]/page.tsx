import AccountDetailClient from "./account-detail-client";

/**
 * Static export: accounts come from the API at runtime. Optional
 * STATIC_EXPORT_FINANCE_ACCOUNT_NUMBERS (comma-separated) pre-renders those paths.
 */
function accountNumbersFromEnv(): string[] {
  const raw = process.env.STATIC_EXPORT_FINANCE_ACCOUNT_NUMBERS?.trim();
  if (!raw) return [];
  return raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
}

export function generateStaticParams(): { number: string }[] {
  const nums = accountNumbersFromEnv().map((number) => ({ number }));
  if (nums.length > 0) return nums;
  // output:export + [] is treated as "missing" generateStaticParams (vercel/next.js#71862).
  return [{ number: "0" }];
}

export default function AccountDetailPage() {
  return <AccountDetailClient />;
}
