export interface PrintSettings {
  upperBoot?: string;
  floorPad?: string;
}

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
