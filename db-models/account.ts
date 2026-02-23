export type AccountType = "asset" | "liability" | "equity" | "revenue" | "cogs" | "expense";

export interface Account {
  number: number;   // e.g. 1101 — follows standard chart-of-accounts numbering
  name: string;     // e.g. "Chase Checking 5371"
  type: AccountType;
  balance: number;
}
