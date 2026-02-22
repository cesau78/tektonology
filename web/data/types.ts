export type PrintSettings = Record<string, string>;

export interface DownloadLink {
  label: string;
  url: string;
}

export interface PurchaseLink {
  label: string;
  url: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  printSettings: PrintSettings;
  assemblyGuide: string[];
  stlDownloadUrls: DownloadLink[];
  purchaseLinks: PurchaseLink[];
}

export interface Batch {
  id: string;
  productId: string;
  printedDate: string;
  notes: string;
  quantity: number;
}
