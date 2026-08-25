export interface Branch {
  id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  taxRate?: number; // e.g. 5, 12, 18 (%)
  invoicePrefix?: string; // e.g. 'INV-MB-', 'INV-B2-'
  isDefault?: boolean;
  createdAt?: Date;
}

export interface Item {
  id: string;
  name: string;
  category: string;
  subCategory?: string;
  quantity?: number;
  branchId?: string;
  imageUrl?: string;
  colorImages?: Record<string, string>;
  description?: string;
}

export interface Purchase {
  id: string;
  itemId: string;
  quantity: number;
  purchasePrice: number;
  saleRealPrice?: number; // Intended selling price before discount
  discountPercentage?: number;
  sellingPrice?: number; // Final selling price after discount
  date: Date;
  color: string;
  size: string;
  vendorName?: string;
  branchId?: string;
  imageUrl?: string;
}

export interface Sale {
  id: string;
  itemId: string;
  quantity: number;
  salePrice: number;
  date: Date;
  color: string;
  size: string;
  customerName?: string;
  discountType?: 'percentage' | 'rupees';
  discountValue?: number;
  branchId?: string;
  invoiceId?: string;
  taxAmount?: number;
  paymentMethod?: 'Cash' | 'UPI' | 'Card' | 'Credit' | 'Other';
  imageUrl?: string;
}

export interface DashboardData extends Item {
  variantId: string;
  color: string;
  size: string;
  totalSold: number;
  totalRevenue: number;
  avgSalePrice: number;
  avgCost: number;
  stock: number;
  profit: number;
  sellingPrice?: number;
  saleRealPrice?: number;
  discountPercentage?: number;
  branchId?: string;
  imageUrl?: string;
}

export interface SummaryMetrics {
    totalRevenue: number;
    totalProfit: number;
    totalItemsSold: number;
    totalStockValue: number;
    outstandingRevenue: number;
}

export type TransactionType = 'purchase' | 'sale';

export interface Transaction {
  id: string;
  itemId: string;
  quantity: number;
  price: number; // Represents purchasePrice for purchases, salePrice for sales
  saleRealPrice?: number; // Only for purchases
  discountPercentage?: number; // Only for purchases
  sellingPrice?: number; // Only for purchases
  date: Date;
  type: TransactionType;
  itemName: string;
  category: string;
  subCategory?: string;
  totalValue: number;
  color: string;
  size: string;
  vendorName?: string;
  customerName?: string;
  discountType?: 'percentage' | 'rupees';
  discountValue?: number;
  branchId?: string;
  imageUrl?: string;
}

// --- Invoice Specific Types ---

export interface InvoiceLineItem {
  id: string; // Corresponds to variantId
  name: string;
  color: string;
  size: string;
  quantity: number;
  price: number;
  total: number;
  discountType?: 'rupees' | 'percentage';
  discountValue?: number;
  taxRate?: number;
  taxAmount?: number;
  imageUrl?: string;
}

export interface CustomerDetails {
    name: string;
    mobile?: string;
    address?: string;
}

export interface Invoice {
    id: string;
    invoiceNumber: string;
    date: Date;
    dueDate?: Date;
    status: 'Paid' | 'Pending';
    customer: CustomerDetails;
    items: InvoiceLineItem[];
    subtotal: number;
    discountType: 'rupees' | 'percentage';
    discountValue: number;
    discountAmount: number;
    taxRate?: number;
    taxAmount?: number;
    total: number;
    notes?: string;
    branchId?: string;
    paymentMethod?: 'Cash' | 'UPI' | 'Card' | 'Credit' | 'Other';
    amountReceived?: number;
    changeAmount?: number;
}


// --- Settings ---
export interface Settings {
    mobileNumber?: string;
    ownerName?: string;
    shopName?: string;
    shopAddress?: string;
    shopEmail?: string;
    shopWebsite?: string;
    invoicePrefix?: string;
    invoiceNextNumber?: number;
    defaultGreeting?: string;
    paymentQrCode?: string;
    instagramUrl?: string;
    instagramQrCode?: string;
    googleReviewUrl?: string;
    googleReviewQrCode?: string;
    catalogWebsiteUrl?: string;
    catalogQrCode?: string;
    securityPin?: string;
    branchTaxRate?: number;
    activeBranchId?: string;
    invoiceLogoSize?: number; // Logo height in px (e.g. 32 to 160, default 64)
}

// --- Reports ---
export type ReportType = 'sales' | 'purchases' | 'profit' | 'outstanding';

export interface GeneratedReport {
  title: string;
  headers: string[];
  data: Record<string, any>[];
}

// --- Bulk Actions ---
export interface BulkEditChanges {
    [key: string]: any;
}
