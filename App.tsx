import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { auth, db } from './firebaseConfig';
import { onAuthStateChanged, User, updateEmail, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { collection, doc, onSnapshot, getDocs, setDoc, addDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import type { Item, Purchase, Sale, DashboardData, SummaryMetrics, Transaction, Invoice, Settings, BulkEditChanges, ReportType, Branch } from './types';
import SummaryCards from './components/SummaryCards';
import DataTable from './components/DataTable';
import ProfitChart from './components/ProfitChart';
import EntryModal from './components/EntryModal';
import TransactionHistoryTable from './components/TransactionHistoryTable';
import ConfirmationModal from './components/ConfirmationModal';
import { PlusIcon } from './components/icons/PlusIcon';
import Auth from './components/Login';
import QrCodeModal from './components/QrCodeModal';
import BulkQrCodeModal from './components/BulkQrCodeModal';
import LogoUploader from './components/LogoUploader';
import { InvoiceIcon } from './components/icons/InvoiceIcon';
import InvoiceModal from './components/InvoiceModal';
import InvoicePreviewModal from './components/InvoicePreviewModal';
import InvoiceHistoryTable from './components/InvoiceHistoryTable';
import SettingsModal from './components/SettingsModal';
import { SettingsIcon } from './components/icons/SettingsIcon';
import { LogOutIcon } from './components/icons/LogOutIcon';
import { DocumentTextIcon } from './components/icons/DocumentTextIcon';
import ReportModal from './components/ReportModal';
import BulkEditModal from './components/BulkEditModal';
import ItemEditModal from './components/ItemEditModal';
import VisualProductCatalog from './components/VisualProductCatalog';
import BranchSwitcher from './components/BranchSwitcher';
import BranchManagerModal from './components/BranchManagerModal';
import CompactPosBilling from './components/CompactPosBilling';
import { StockVelocityAndAgeingModal } from './components/StockVelocityAndAgeingModal';
import { GoogleGenAI, Modality } from '@google/genai';

// Helper utility to prevent asynchronous operations or Firestore sync from hanging
function withTimeout<T>(promise: Promise<T>, timeoutMs = 6000): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
        )
    ]);
}

// Initialize the Gemini AI Client lazily so a missing/misconfigured API key
// only affects the AI logo background-removal feature, instead of crashing the
// entire app on load (which would show a blank white screen with no visible error).
let aiClient: GoogleGenAI | null = null;
const getAiClient = (): GoogleGenAI | null => {
    if (aiClient) return aiClient;
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.warn('GEMINI_API_KEY is not set - AI logo background removal will be unavailable.');
        return null;
    }
    try {
        aiClient = new GoogleGenAI({ apiKey });
        return aiClient;
    } catch (err) {
        console.warn('Failed to initialize GoogleGenAI client:', err);
        return null;
    }
};

// --- Initial Mock Data for new users ---
const initialItems: Omit<Item, 'id'>[] = [
    { name: 'Classic T-Shirt', category: 'Tops', subCategory: 'Round Neck' },
    { name: 'Polo T-Shirt', category: 'Tops', subCategory: 'Collar' },
    { name: 'Slim-Fit Jeans', category: 'Pants', subCategory: 'Slim Fit' },
    { name: 'Leather Jacket', category: 'Outerwear', subCategory: 'Full Sleeve' },
    { name: 'Running Sneakers', category: 'Shoes' },
    { name: 'Wool Scarf', category: 'Accessories' },
];

const defaultBranches: Branch[] = [
    {
        id: 'main',
        name: 'Main Branch (City Center)',
        code: 'MB-01',
        address: 'Shop 1, Main Market, Surat',
        phone: '9876543210',
        taxRate: 5,
        invoicePrefix: 'INV-MB-',
        isDefault: true,
    },
    {
        id: 'branch-2',
        name: 'Branch 2 (Station Road)',
        code: 'BR-02',
        address: 'Shop 12, Station Road Mall, Surat',
        phone: '9876543211',
        taxRate: 5,
        invoicePrefix: 'INV-B2-',
    },
];

const defaultSettings: Settings = {
    mobileNumber: '+91 98765 43210',
    ownerName: 'M.K. Poshak House',
    shopName: 'M.K. POSHAK HOUSE',
    shopAddress: 'Shop 1, Main Market, Surat, Gujarat - 395002',
    shopEmail: 'mkposhakhouse@gmail.com',
    shopWebsite: 'www.mkposhakhouse.com',
    invoicePrefix: 'INV-',
    invoiceNextNumber: 1,
    defaultGreeting: 'Goods once sold will not be returned. Exchange permitted within 7 days with original invoice. Thank you for your business!',
    paymentQrCode: '',
    instagramUrl: 'https://instagram.com/mkposhakhouse',
    instagramQrCode: '',
    googleReviewUrl: 'https://g.page/r/mkposhakhouse/review',
    googleReviewQrCode: '',
    catalogWebsiteUrl: 'https://mkposhakhouse.com',
    catalogQrCode: '',
};

const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Initialize offline state as false to always attempt real-time synchronization across devices
    const [isOffline, setIsOffline] = useState(false);

    // Multi-branch state
    const [branches, setBranches] = useState<Branch[]>(defaultBranches);
    const [activeBranchId, setActiveBranchId] = useState<string>(() => {
        return localStorage.getItem('active_branch_id') || 'main';
    });
    const [isBranchManagerOpen, setIsBranchManagerOpen] = useState(false);

    // 1:1 POS state
    const [isPosOpen, setIsPosOpen] = useState(false);
    
    // Data state
    const [items, setItems] = useState<Item[]>([]);
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [sales, setSales] = useState<Sale[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [settings, setSettings] = useState<Settings>(defaultSettings);

    // Active branch object
    const activeBranch = useMemo(() => {
        return branches.find(b => b.id === activeBranchId) || branches[0] || defaultBranches[0];
    }, [branches, activeBranchId]);

    // Modal & selection state
    const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
    const [entryToEdit, setEntryToEdit] = useState<Transaction | null>(null);
    const [itemForQr, setItemForQr] = useState<DashboardData | null>(null);
    const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set());
    const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
    const [isBulkQrModalOpen, setIsBulkQrModalOpen] = useState(false);
    const [businessLogo, setBusinessLogo] = useState<string | null>(() => localStorage.getItem('businessLogo'));
    const [isLogoProcessing, setIsLogoProcessing] = useState(false);
    
    // Invoice state
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [invoiceToPreview, setInvoiceToPreview] = useState<Invoice | null>(null);
    const [invoiceToEdit, setInvoiceToEdit] = useState<Invoice | null>(null);
    const [invoiceInitialItems, setInvoiceInitialItems] = useState<DashboardData[] | undefined>(undefined);
    
    // Inventory View Mode (1:1 Visual Catalog vs Table)
    const [inventoryViewMode, setInventoryViewMode] = useState<'visual' | 'table'>('visual');
    
    // Purchase to Sale Turnaround, Stock Ageing & Fast Selling Tracker state
    const [isVelocityTrackerOpen, setIsVelocityTrackerOpen] = useState(false);
    
    // Settings state
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    
    // Report state
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportModalType, setReportModalType] = useState<ReportType>('sales');
    
    // Bulk edit state
    const [bulkEditInfo, setBulkEditInfo] = useState<{ type: 'purchase' | 'sale' } | null>(null);
    
    // Item edit state
    const [itemToEdit, setItemToEdit] = useState<Item | null>(null);
    const [isItemEditModalOpen, setIsItemEditModalOpen] = useState(false);
    
    // Search state
    const [inventorySearchTerm, setInventorySearchTerm] = useState('');

    // PIN Authentication state
    const [isPinAuthenticated, setIsPinAuthenticated] = useState<boolean>(() => {
        return sessionStorage.getItem('is_pin_authenticated') === 'true';
    });

    // Unified confirmation state
    const [deleteConfirmation, setDeleteConfirmation] = useState<{
        type: 'transaction' | 'invoice' | 'bulk-transaction' | 'item';
        target?: any;
        message: string;
        title: string;
    } | null>(null);

    useEffect(() => {
        // Connect to Firestore as soon as the app loads - NOT after the PIN is entered.
        // Firestore rules for this app allow open read/write, so there's no auth needed;
        // connecting early just means settings (and the security PIN itself) are already
        // synced by the time the person sees the PIN screen, so an updated PIN works on
        // every device right away instead of only the device it was changed on.
        setUser({ uid: 'pin_user', email: 'owner@mkposhak.local' } as User);
        setLoading(false);
    }, []);

    // Helper to get offline storage key per branch
    const offlineStorageKey = `clothing_shop_offline_data_${activeBranchId}`;
    
    // Helper to save offline data
    const saveToLocalStorage = useCallback(() => {
        const data = {
            items,
            purchases,
            sales,
            invoices,
            settings,
            activeBranchId,
        };
        localStorage.setItem(offlineStorageKey, JSON.stringify(data));
    }, [items, purchases, sales, invoices, settings, activeBranchId, offlineStorageKey]);

    // Save on change
    useEffect(() => {
        if (items.length > 0 || purchases.length > 0) {
            saveToLocalStorage();
        }
    }, [items, purchases, sales, invoices, settings, saveToLocalStorage]);

    // Real-time synchronization of Branches
    useEffect(() => {
        if (!user) return;
        const branchesColRef = collection(db, 'shops', 'mk_poshak_house', 'branches');

        const unsub = onSnapshot(branchesColRef, (snapshot) => {
            if (!snapshot.empty) {
                const loadedBranches = snapshot.docs.map(d => ({
                    id: d.id,
                    ...d.data(),
                } as Branch));
                setBranches(loadedBranches);
            } else {
                // Seed initial default branches in Firestore
                const batch = writeBatch(db);
                defaultBranches.forEach(b => {
                    const docRef = doc(branchesColRef, b.id);
                    batch.set(docRef, b);
                });
                batch.commit().catch(console.warn);
                setBranches(defaultBranches);
            }
        }, (err) => {
            console.warn("Branches sync error (using local default):", err);
            setBranches(defaultBranches);
        });

        return () => unsub();
    }, [user]);

    // Effect for real-time branch-isolated data synchronization across devices with Firestore
    useEffect(() => {
        if (!user) {
            setItems([]);
            setPurchases([]);
            setSales([]);
            setInvoices([]);
            setSettings(defaultSettings);
            return;
        }

        // Determine Firestore collection paths based on active branch
        const isMain = activeBranchId === 'main';
        const itemsColRef = isMain
            ? collection(db, 'shops', 'mk_poshak_house', 'items')
            : collection(db, 'shops', 'mk_poshak_house', 'branches', activeBranchId, 'items');

        const purchasesColRef = isMain
            ? collection(db, 'shops', 'mk_poshak_house', 'purchases')
            : collection(db, 'shops', 'mk_poshak_house', 'branches', activeBranchId, 'purchases');

        const salesColRef = isMain
            ? collection(db, 'shops', 'mk_poshak_house', 'sales')
            : collection(db, 'shops', 'mk_poshak_house', 'branches', activeBranchId, 'sales');

        const invoicesColRef = isMain
            ? collection(db, 'shops', 'mk_poshak_house', 'invoices')
            : collection(db, 'shops', 'mk_poshak_house', 'branches', activeBranchId, 'invoices');

        const settingsDocRef = isMain
            ? doc(db, 'shops', 'mk_poshak_house', 'settings', 'config')
            : doc(db, 'shops', 'mk_poshak_house', 'branches', activeBranchId, 'settings', 'config');

        // Seed initial items for main branch if Firestore collection is completely empty
        const seedInitialData = async () => {
            try {
                const itemsSnapshot = await getDocs(itemsColRef);
                if (itemsSnapshot.empty && isMain) {
                    const batch = writeBatch(db);
                    initialItems.forEach(item => {
                        const newDocRef = doc(itemsColRef);
                        batch.set(newDocRef, { ...item, branchId: activeBranchId });
                    });
                    await batch.commit();
                }
            } catch (err: any) {
                console.warn("Seeding initial data skipped/failed:", err);
            }
        };
        seedInitialData();

        const loadLocalStorageBackup = () => {
            const savedData = localStorage.getItem(offlineStorageKey);
            if (savedData) {
                try {
                    const parsed = JSON.parse(savedData);
                    setItems(parsed.items || []);
                    setPurchases(parsed.purchases?.map((p: any) => ({ ...p, date: new Date(p.date) })) || []);
                    setSales(parsed.sales?.map((s: any) => ({ ...s, date: new Date(s.date) })) || []);
                    setInvoices(parsed.invoices?.map((i: any) => ({ 
                        ...i, 
                        date: new Date(i.date), 
                        dueDate: i.dueDate ? new Date(i.dueDate) : undefined 
                    })) || []);
                    setSettings(parsed.settings || defaultSettings);
                } catch (e) {
                    console.warn("Failed to parse offline storage backup", e);
                }
            } else {
                setItems([]);
                setPurchases([]);
                setSales([]);
                setInvoices([]);
                setSettings(defaultSettings);
            }
        };

        const errorHandler = (err: any) => {
            console.error("Firestore real-time sync error:", err);
            setIsOffline(true);
            loadLocalStorageBackup();
        };

        const unsubscribers = [
            onSnapshot(itemsColRef, (snapshot) => {
                setIsOffline(false);
                setItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Item)));
            }, errorHandler),

            onSnapshot(purchasesColRef, (snapshot) => {
                setIsOffline(false);
                setPurchases(snapshot.docs.map(d => {
                    const data = d.data();
                    const dateObj = data.date?.toDate ? data.date.toDate() : new Date(data.date);
                    return { id: d.id, ...data, date: dateObj } as Purchase;
                }));
            }, errorHandler),

            onSnapshot(salesColRef, (snapshot) => {
                setIsOffline(false);
                setSales(snapshot.docs.map(d => {
                    const data = d.data();
                    const dateObj = data.date?.toDate ? data.date.toDate() : new Date(data.date);
                    return { id: d.id, ...data, date: dateObj } as Sale;
                }));
            }, errorHandler),

            onSnapshot(invoicesColRef, (snapshot) => {
                setIsOffline(false);
                setInvoices(snapshot.docs.map(d => {
                    const data = d.data();
                    const dateObj = data.date?.toDate ? data.date.toDate() : new Date(data.date);
                    const dueDateObj = data.dueDate ? (data.dueDate.toDate ? data.dueDate.toDate() : new Date(data.dueDate)) : undefined;
                    return { 
                        ...data,
                        id: d.id,
                        date: dateObj,
                        dueDate: dueDateObj,
                    } as Invoice;
                }));
            }, errorHandler),

            onSnapshot(settingsDocRef, (snapshot) => {
                setIsOffline(false);
                if (snapshot.exists()) {
                    const remoteSettings = snapshot.data() as Settings;
                    setSettings({ ...defaultSettings, ...remoteSettings });
                    if (remoteSettings.securityPin) {
                        localStorage.setItem('app_security_pin', remoteSettings.securityPin);
                    }
                } else {
                    const branchDefaultSettings = {
                        ...defaultSettings,
                        invoicePrefix: activeBranch?.invoicePrefix || 'INV-',
                    };
                    setDoc(settingsDocRef, branchDefaultSettings).catch(console.error);
                    setSettings(branchDefaultSettings);
                }
            }, errorHandler),
        ];

        return () => unsubscribers.forEach(unsub => unsub());
    }, [user, activeBranchId, offlineStorageKey]);

    const getRevenueForSale = (sale: Sale) => {
        const total = sale.quantity * sale.salePrice;
        if(sale.discountType === 'rupees' && sale.discountValue) {
            return total - sale.discountValue;
        }
        if(sale.discountType === 'percentage' && sale.discountValue) {
            return total * (1 - sale.discountValue / 100);
        }
        return total;
    };

    // --- Memos for derived data ---
    const dashboardData = useMemo<DashboardData[]>(() => {
        const variants = new Map<string, { itemId: string; color: string; size: string }>();

        [...purchases, ...sales].forEach(t => {
            const variantId = `${t.itemId}-${t.color}-${t.size}`;
            if (!variants.has(variantId)) {
                variants.set(variantId, { itemId: t.itemId, color: t.color, size: t.size });
            }
        });

        const itemMap = new Map<string, Item>(items.map(i => [i.id, i]));
        const itemsWithVariants = new Set<string>();

        const transactionVariantList = Array.from(variants.values()).map<DashboardData | null>(variant => {
            const { itemId, color, size } = variant;
            const variantId = `${itemId}-${color}-${size}`;
            const item = itemMap.get(itemId);
            if (!item) return null;
            itemsWithVariants.add(itemId);

            const variantPurchases = purchases.filter(p => p.itemId === itemId && p.color === color && p.size === size);
            const variantSales = sales.filter(s => s.itemId === itemId && s.color === color && s.size === size);
            
            variantPurchases.sort((a, b) => b.date.getTime() - a.date.getTime());
            const mostRecentPurchase = variantPurchases[0];

            // Resolve color-specific photo
            const purchaseWithImage = purchases.find(p => p.itemId === itemId && p.color === color && p.imageUrl);
            const saleWithImage = sales.find(s => s.itemId === itemId && s.color === color && s.imageUrl);
            const variantImageUrl = purchaseWithImage?.imageUrl || saleWithImage?.imageUrl || (item.colorImages && item.colorImages[color]) || item.imageUrl;

            const totalPurchased = variantPurchases.reduce((sum, p) => sum + p.quantity, 0);
            const totalCost = variantPurchases.reduce((sum, p) => sum + (p.quantity * p.purchasePrice), 0);
            const avgCost = totalPurchased > 0 ? totalCost / totalPurchased : 0;

            const totalSold = variantSales.reduce((sum, s) => sum + s.quantity, 0);
            const totalRevenue = variantSales.reduce((sum, s) => sum + getRevenueForSale(s), 0);
            const avgSalePrice = totalSold > 0 ? totalRevenue / totalSold : 0;
            
            const stock = totalPurchased - totalSold;
            const costOfGoodsSold = totalSold * avgCost;
            const profit = totalRevenue - costOfGoodsSold;

            return {
                id: item.id,
                name: item.name,
                category: item.category,
                subCategory: item.subCategory,
                imageUrl: variantImageUrl,
                description: item.description,
                variantId,
                color,
                size,
                totalSold,
                totalRevenue,
                avgSalePrice,
                avgCost,
                stock,
                profit,
                sellingPrice: mostRecentPurchase?.sellingPrice,
                saleRealPrice: mostRecentPurchase?.saleRealPrice,
                discountPercentage: mostRecentPurchase?.discountPercentage,
            };
        }).filter((d): d is DashboardData => d !== null);

        // Also include items from catalog that don't have transaction variants yet
        const standaloneCatalogItems: DashboardData[] = items
            .filter(item => !itemsWithVariants.has(item.id))
            .map(item => ({
                id: item.id,
                name: item.name,
                category: item.category,
                subCategory: item.subCategory,
                imageUrl: item.imageUrl,
                description: item.description,
                variantId: `${item.id}-Default-Free`,
                color: 'Default',
                size: 'Free Size',
                totalSold: 0,
                totalRevenue: 0,
                avgSalePrice: 0,
                avgCost: 0,
                stock: 0,
                profit: 0,
            }));

        return [...transactionVariantList, ...standaloneCatalogItems];
    }, [items, purchases, sales]);
    
    const filteredDashboardData = useMemo(() => {
        if (!inventorySearchTerm) {
            return dashboardData;
        }
        const lowercasedTerm = inventorySearchTerm.toLowerCase();
        return dashboardData.filter(item => 
            item.name.toLowerCase().includes(lowercasedTerm) ||
            item.category.toLowerCase().includes(lowercasedTerm) ||
            item.subCategory?.toLowerCase().includes(lowercasedTerm) ||
            item.color.toLowerCase().includes(lowercasedTerm) ||
            item.size.toLowerCase().includes(lowercasedTerm)
        );
    }, [dashboardData, inventorySearchTerm]);
    
    const itemProfitData = useMemo(() => {
        const itemProfitMap = new Map<string, { name: string; category: string; profit: number; totalRevenue: number }>();
        dashboardData.forEach(variant => {
            const item = itemProfitMap.get(variant.id);
            if(item) {
                item.profit += variant.profit;
                item.totalRevenue += variant.totalRevenue;
            } else {
                itemProfitMap.set(variant.id, {
                    name: variant.name,
                    category: variant.category,
                    profit: variant.profit,
                    totalRevenue: variant.totalRevenue,
                });
            }
        });
        return Array.from(itemProfitMap.values());
    }, [dashboardData]);

    const categoryProfitData = useMemo(() => {
        const profitByCategory = new Map<string, { category: string; profit: number; totalRevenue: number }>();
        dashboardData.forEach(variant => {
            const category = profitByCategory.get(variant.category);
            if (category) {
                category.profit += variant.profit;
                category.totalRevenue += variant.totalRevenue;
            } else {
                profitByCategory.set(variant.category, {
                    category: variant.category,
                    profit: variant.profit,
                    totalRevenue: variant.totalRevenue,
                });
            }
        });
        return Array.from(profitByCategory.values());
    }, [dashboardData]);

    const monthlyPnlData = useMemo(() => {
        const pnlByMonth: { [key: string]: { month: string; revenue: number; profit: number } } = {};
        const variantMap = new Map<string, DashboardData>(dashboardData.map(d => [d.variantId, d]));

        sales.forEach(sale => {
            const month = sale.date.toISOString().slice(0, 7); // "YYYY-MM"
            if (!pnlByMonth[month]) {
                pnlByMonth[month] = { month, revenue: 0, profit: 0 };
            }
            
            const variantId = `${sale.itemId}-${sale.color}-${sale.size}`;
            const variant = variantMap.get(variantId);
            
            const revenue = getRevenueForSale(sale);
            const costOfGoods = sale.quantity * (variant?.avgCost ?? 0);
            const profit = revenue - costOfGoods;

            pnlByMonth[month].revenue += revenue;
            pnlByMonth[month].profit += profit;
        });

        return Object.values(pnlByMonth).sort((a, b) => a.month.localeCompare(b.month));
    }, [sales, dashboardData]);

    const summaryMetrics = useMemo<SummaryMetrics>(() => {
        const baseMetrics = dashboardData.reduce((acc, d) => {
            acc.totalRevenue += d.totalRevenue;
            acc.totalProfit += d.profit;
            acc.totalItemsSold += d.totalSold;
            acc.totalStockValue += d.stock * d.avgCost;
            return acc;
        }, { totalRevenue: 0, totalProfit: 0, totalItemsSold: 0, totalStockValue: 0 });

        const outstandingRevenue = invoices
            .filter(inv => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isOverdue = inv.status === 'Pending' && inv.dueDate && new Date(inv.dueDate) < today;
                return inv.status === 'Pending' || isOverdue;
            })
            .reduce((sum, inv) => sum + inv.total, 0);

        return { ...baseMetrics, outstandingRevenue };
    }, [dashboardData, invoices]);

    const selectedItemsForQr = useMemo(() => {
        return filteredDashboardData.filter(item => selectedVariantIds.has(item.variantId));
    }, [filteredDashboardData, selectedVariantIds]);

    // Helper to get collection reference scoped to active branch
    const getColRef = (collectionName: string) => {
        if (activeBranchId === 'main') {
            return collection(db, 'shops', 'mk_poshak_house', collectionName);
        }
        return collection(db, 'shops', 'mk_poshak_house', 'branches', activeBranchId, collectionName);
    };

    const getDocRef = (collectionName: string, docId: string) => {
        if (activeBranchId === 'main') {
            return doc(db, 'shops', 'mk_poshak_house', collectionName, docId);
        }
        return doc(db, 'shops', 'mk_poshak_house', 'branches', activeBranchId, collectionName, docId);
    };

    // --- Branch Handlers ---
    const handleSelectBranch = (branchId: string) => {
        setActiveBranchId(branchId);
        localStorage.setItem('active_branch_id', branchId);
    };

    const handleSaveBranch = async (branchData: Omit<Branch, 'id' | 'createdAt'>, branchIdToEdit?: string) => {
        if (!user) return;
        setIsProcessing(true);
        try {
            const branchId = branchIdToEdit || `branch-${Date.now()}`;
            const finalBranch: Branch = {
                ...branchData,
                id: branchId,
                createdAt: new Date(),
            };

            // Optimistic update
            setBranches(prev => {
                const existingIndex = prev.findIndex(b => b.id === branchId);
                if (existingIndex > -1) {
                    const updated = [...prev];
                    updated[existingIndex] = { ...updated[existingIndex], ...finalBranch };
                    return updated;
                }
                return [...prev, finalBranch];
            });

            // Save to Firestore
            const branchDocRef = doc(db, 'shops', 'mk_poshak_house', 'branches', branchId);
            await withTimeout(setDoc(branchDocRef, finalBranch, { merge: true }), 5000);
            
            // Switch to newly created branch
            if (!branchIdToEdit) {
                handleSelectBranch(branchId);
            }
        } catch (error) {
            console.error("Error saving branch:", error);
            throw error;
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteBranch = async (branchId: string) => {
        if (branchId === 'main') {
            alert("Main branch cannot be deleted.");
            return;
        }
        setIsProcessing(true);
        try {
            setBranches(prev => prev.filter(b => b.id !== branchId));
            if (activeBranchId === branchId) {
                handleSelectBranch('main');
            }
            const branchDocRef = doc(db, 'shops', 'mk_poshak_house', 'branches', branchId);
            await withTimeout(deleteDoc(branchDocRef), 5000);
        } catch (error) {
            console.error("Error deleting branch:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    // --- Handlers for Data Manipulation (Scoped to Active Branch) ---

    const handleAddTransactions = async (transactions: (Omit<Purchase, 'id'> | Omit<Sale, 'id'>)[], type: 'purchase' | 'sale') => {
        if (!user) return;
        setIsProcessing(true);

        const addLocal = () => {
             const newTransactions = transactions.map(t => ({
                ...t,
                branchId: activeBranchId,
                id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            }));
            if (type === 'purchase') {
                setPurchases(prev => [...prev, ...newTransactions as Purchase[]]);
            } else {
                setSales(prev => [...prev, ...newTransactions as Sale[]]);
            }

            // Also update master item's colorImages mapping
            const itemColorUpdates: Record<string, Record<string, string>> = {};
            transactions.forEach(t => {
                if (t.itemId && t.color && t.imageUrl) {
                    if (!itemColorUpdates[t.itemId]) itemColorUpdates[t.itemId] = {};
                    itemColorUpdates[t.itemId][t.color] = t.imageUrl;
                }
            });

            if (Object.keys(itemColorUpdates).length > 0) {
                setItems(prev => prev.map(item => {
                    if (itemColorUpdates[item.id]) {
                        return {
                            ...item,
                            colorImages: {
                                ...(item.colorImages || {}),
                                ...itemColorUpdates[item.id]
                            }
                        };
                    }
                    return item;
                }));
            }
        };

        // 1. Instantly apply optimistic update so UI is immediately responsive
        addLocal();

        // 2. Sync to Firestore in background with timeout safety
        try {
            const batch = writeBatch(db);
            const colName = type === 'purchase' ? 'purchases' : 'sales';
            const colRef = getColRef(colName);
            
            transactions.forEach(t => {
                const newDocRef = doc(colRef);
                batch.set(newDocRef, { ...t, branchId: activeBranchId });
            });

            await withTimeout(batch.commit(), 5000).catch(err => {
                console.warn("Firestore write background sync warning:", err);
            });
        } catch (error) {
            console.error("Error syncing transactions to Firestore:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAddItem = async (newItemData: Omit<Item, 'id'>): Promise<string> => {
        if (!user) throw new Error("User not authenticated");
        
        const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newItem = { ...newItemData, branchId: activeBranchId, id: localId };
        setItems(prev => [...prev, newItem]);

        try {
            const itemsColRef = getColRef('items');
            const docRef = await withTimeout(addDoc(itemsColRef, { ...newItemData, branchId: activeBranchId }), 5000);
            return docRef.id;
        } catch (error: any) {
            console.warn("Firestore add item warning:", error);
        }
        return localId;
    };

    const handleUpdateItem = async (itemId: string, itemData: Omit<Item, 'id'>) => {
        if (!user) throw new Error("User not authenticated");
    
        setItems(prev => prev.map(item => item.id === itemId ? { ...item, ...itemData } : item));

        try {
            const itemDocRef = getDocRef('items', itemId);
            await withTimeout(updateDoc(itemDocRef, { ...itemData, branchId: activeBranchId } as { [x: string]: any }), 5000).catch(err => {
                console.warn("Firestore update item warning:", err);
            });
        } catch (error: any) {
            console.warn("Firestore update item error:", error);
        }
    };

    const handleUpdateItemAndCloseModal = async (itemId: string, itemData: Omit<Item, 'id'>) => {
        setIsProcessing(true);
        try {
            await handleUpdateItem(itemId, itemData);
            setIsItemEditModalOpen(false);
            setItemToEdit(null);
        } catch (error) {
            console.error("Error updating item:", error);
            alert("Failed to update item.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleStartEdit = (entry: Transaction) => {
        setEntryToEdit(entry);
        setIsEntryModalOpen(true);
    };
    
    const handleStartEditItem = (item: Item) => {
        setItemToEdit(item);
        setIsItemEditModalOpen(true);
    };

    const handleUpdateEntry = async (updatedEntry: Omit<Transaction, 'id' | 'date' | 'type' | 'itemName' | 'category' | 'subCategory' | 'totalValue'>) => {
        if (!entryToEdit || !user) return;
        setIsProcessing(true);
        
        const isPurchase = entryToEdit.type === 'purchase';
        const payload = {
            itemId: updatedEntry.itemId,
            quantity: updatedEntry.quantity,
            color: updatedEntry.color,
            size: updatedEntry.size,
            imageUrl: updatedEntry.imageUrl || undefined,
            branchId: activeBranchId,
            ...(isPurchase 
                ? { 
                    purchasePrice: updatedEntry.price, 
                    saleRealPrice: updatedEntry.saleRealPrice, 
                    discountPercentage: updatedEntry.discountPercentage,
                    sellingPrice: updatedEntry.sellingPrice,
                    vendorName: updatedEntry.vendorName 
                  }
                : { 
                    salePrice: updatedEntry.price, 
                    customerName: updatedEntry.customerName, 
                    discountType: updatedEntry.discountType, 
                    discountValue: updatedEntry.discountValue 
                  }
            )
        };

        if (isPurchase) {
            setPurchases(prev => prev.map(p => p.id === entryToEdit.id ? { ...p, ...payload } as Purchase : p));
        } else {
            setSales(prev => prev.map(s => s.id === entryToEdit.id ? { ...s, ...payload } as Sale : s));
        }

        try {
            const collectionName = isPurchase ? 'purchases' : 'sales';
            const docRef = getDocRef(collectionName, entryToEdit.id);
            await withTimeout(updateDoc(docRef, payload), 5000).catch(err => {
                console.warn("Firestore update entry warning:", err);
            });
        } catch (error) {
            console.error("Error updating entry:", error);
        } finally {
            setIsProcessing(false);
        }
    };
    
    // --- Bulk Edit Handlers ---
    const handleStartBulkEdit = (type: 'purchase' | 'sale') => {
        setBulkEditInfo({ type });
    };

    const handleConfirmBulkEdit = async (changes: BulkEditChanges) => {
        if (!bulkEditInfo || !user || selectedTransactionIds.size === 0) return;
        setIsProcessing(true);
        
        if (bulkEditInfo.type === 'purchase') {
            setPurchases(prev => prev.map(p => {
                if (selectedTransactionIds.has(`purchase-${p.id}`)) {
                    return { ...p, ...changes };
                }
                return p;
            }));
        } else {
            setSales(prev => prev.map(s => {
                 if (selectedTransactionIds.has(`sale-${s.id}`)) {
                    return { ...s, ...changes };
                }
                return s;
            }));
        }

        try {
            const batch = writeBatch(db);
            const collectionName = bulkEditInfo.type === 'purchase' ? 'purchases' : 'sales';

            for (const id of selectedTransactionIds) {
                const [type, docId] = id.split('-');
                if (type === bulkEditInfo.type) {
                    const targetDocRef = getDocRef(collectionName, docId);
                    batch.update(targetDocRef, changes as { [x: string]: any });
                }
            }
            await withTimeout(batch.commit(), 5000).catch(err => {
                console.warn("Firestore bulk edit warning:", err);
            });
        } catch (error) {
            console.error("Error performing bulk edit:", error);
        } finally {
            setIsProcessing(false);
            setBulkEditInfo(null);
            setSelectedTransactionIds(new Set());
        }
    };
    
    // --- Unified Deletion Logic ---
    const handleStartDelete = (entry: Transaction) => {
        setDeleteConfirmation({
            type: 'transaction',
            target: entry,
            title: "Delete Transaction",
            message: "Are you sure you want to delete this entry? This action cannot be undone."
        });
    };

    const handleStartDeleteInvoice = (invoice: Invoice) => {
        setDeleteConfirmation({
            type: 'invoice',
            target: invoice,
            title: "Delete Invoice",
            message: "Are you sure you want to delete this invoice? This action cannot be undone."
        });
    };
    
    const handleStartDeleteItem = (itemToDelete: Item) => {
        if (!user) return;
        const isItemUsed = purchases.some(p => p.itemId === itemToDelete.id) || sales.some(s => s.itemId === itemToDelete.id);

        if (isItemUsed) {
            alert(`Cannot delete "${itemToDelete.name}". It is associated with existing purchase or sale records. Please delete those records first.`);
            return;
        }

        setDeleteConfirmation({
            type: 'item',
            target: itemToDelete,
            title: "Delete Item",
            message: `Are you sure you want to delete the item "${itemToDelete.name}"? This action cannot be undone.`
        });
    };
    
    const handleDeleteItemAndCloseModal = (itemToDelete: Item) => {
        setIsItemEditModalOpen(false);
        setItemToEdit(null);
        handleStartDeleteItem(itemToDelete);
    };

    const handleStartBulkDeleteTransactions = () => {
        setDeleteConfirmation({
            type: 'bulk-transaction',
            title: `Delete ${selectedTransactionIds.size} Transactions`,
            message: `Are you sure you want to delete the ${selectedTransactionIds.size} selected transactions? This action cannot be undone.`
        });
    };

    const handleConfirmDelete = async () => {
        if (!deleteConfirmation || !user) return;
        setIsProcessing(true);

        const deleteLocal = () => {
             switch (deleteConfirmation.type) {
                case 'transaction': {
                    const entry = deleteConfirmation.target as Transaction;
                    if (entry.type === 'purchase') {
                        setPurchases(prev => prev.filter(p => p.id !== entry.id));
                    } else {
                        setSales(prev => prev.filter(s => s.id !== entry.id));
                    }
                    break;
                }
                case 'invoice': {
                    const invoice = deleteConfirmation.target as Invoice;
                    setInvoices(prev => prev.filter(i => i.id !== invoice.id));
                    break;
                }
                case 'item': {
                    const item = deleteConfirmation.target as Item;
                    setItems(prev => prev.filter(i => i.id !== item.id));
                    break;
                }
                case 'bulk-transaction': {
                    setPurchases(prev => prev.filter(p => !selectedTransactionIds.has(`purchase-${p.id}`)));
                    setSales(prev => prev.filter(s => !selectedTransactionIds.has(`sale-${s.id}`)));
                    setSelectedTransactionIds(new Set());
                    break;
                }
            }
        };

        // Instantly delete locally
        deleteLocal();
        setDeleteConfirmation(null);

        // Sync deletion to Firestore in background
        try {
            switch (deleteConfirmation.type) {
                case 'transaction': {
                    const entry = deleteConfirmation.target as Transaction;
                    const collectionName = entry.type === 'purchase' ? 'purchases' : 'sales';
                    const targetDocRef = getDocRef(collectionName, entry.id);
                    await withTimeout(deleteDoc(targetDocRef), 5000).catch(err => {
                        console.warn("Firestore delete entry warning:", err);
                    });
                    break;
                }
                case 'invoice': {
                    const invoice = deleteConfirmation.target as Invoice;
                    const targetDocRef = getDocRef('invoices', invoice.id);
                    await withTimeout(deleteDoc(targetDocRef), 5000).catch(err => {
                        console.warn("Firestore delete invoice warning:", err);
                    });
                    break;
                }
                case 'item': {
                    const item = deleteConfirmation.target as Item;
                    const targetDocRef = getDocRef('items', item.id);
                    await withTimeout(deleteDoc(targetDocRef), 5000).catch(err => {
                        console.warn("Firestore delete item warning:", err);
                    });
                    break;
                }
                case 'bulk-transaction': {
                    if (selectedTransactionIds.size > 0) {
                        const batch = writeBatch(db);
                        selectedTransactionIds.forEach(id => {
                            const [type, docId] = id.split('-');
                            const collectionName = type === 'purchase' ? 'purchases' : 'sales';
                            const targetDocRef = getDocRef(collectionName, docId);
                            batch.delete(targetDocRef);
                        });
                        await withTimeout(batch.commit(), 5000).catch(err => {
                            console.warn("Firestore bulk delete warning:", err);
                        });
                        setSelectedTransactionIds(new Set());
                    }
                    break;
                }
            }
        } catch (error) {
            console.error("Error during Firestore deletion:", error);
        }
        setIsProcessing(false);
    };

    // --- Invoice Handlers ---
    const handleCreateInvoice = async (invoice: Omit<Invoice, 'id' | 'date'>) => {
        if (!user) return;
        setIsProcessing(true);

        const newInvoiceId = `local_inv_${Date.now()}`;
        const finalInvoice: Invoice = { 
            ...invoice, 
            branchId: activeBranchId,
            id: newInvoiceId, 
            date: new Date() 
        };
        setInvoices(prev => [...prev, finalInvoice]);
        
        const newSales: Sale[] = invoice.items.map(item => {
            const [itemId] = item.id.split(`-${item.color}-${item.size}`);
            return {
                id: `local_sale_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                itemId,
                quantity: item.quantity,
                salePrice: item.price,
                date: new Date(),
                color: item.color,
                size: item.size,
                branchId: activeBranchId,
                customerName: invoice.customer.name,
                discountType: item.discountType,
                discountValue: item.discountType === 'rupees' 
                    ? (item.discountValue || 0) * item.quantity 
                    : item.discountValue,
            };
        });
        setSales(prev => [...prev, ...newSales]);
        setSettings(prev => ({ ...prev, invoiceNextNumber: (prev.invoiceNextNumber || 1) + 1 }));

        setInvoiceToPreview(finalInvoice);
        setIsInvoiceModalOpen(false);

        try {
            const batch = writeBatch(db);
            const invoicesColRef = getColRef('invoices');
            const invoiceRef = doc(invoicesColRef);
            const firestoreInvoice: Invoice = { 
                ...invoice, 
                branchId: activeBranchId,
                id: invoiceRef.id, 
                date: new Date() 
            };
            batch.set(invoiceRef, firestoreInvoice);

            const salesColRef = getColRef('sales');
            invoice.items.forEach(item => {
                const [itemId] = item.id.split(`-${item.color}-${item.size}`);
                const saleDocRef = doc(salesColRef);
                const saleData: Omit<Sale, 'id'> = {
                    itemId,
                    quantity: item.quantity,
                    salePrice: item.price,
                    date: new Date(),
                    color: item.color,
                    size: item.size,
                    branchId: activeBranchId,
                    customerName: invoice.customer.name,
                    discountType: item.discountType,
                    discountValue: item.discountType === 'rupees' 
                        ? (item.discountValue || 0) * item.quantity 
                        : item.discountValue,
                };
                batch.set(saleDocRef, saleData);
            });
            
            const settingsRef = activeBranchId === 'main'
                ? doc(db, 'shops', 'mk_poshak_house', 'settings', 'config')
                : doc(db, 'shops', 'mk_poshak_house', 'branches', activeBranchId, 'settings', 'config');

            batch.update(settingsRef, { invoiceNextNumber: (settings.invoiceNextNumber || 1) + 1 });
            
            await withTimeout(batch.commit(), 5000).catch(err => {
                console.warn("Firestore create invoice warning:", err);
            });
        } catch (error) {
            console.error("Error syncing invoice to Firestore:", error);
        }
        setIsProcessing(false);
    };

    // --- 1:1 POS Fast Sale Completion ---
    const handleCompletePosSale = async (invoiceData: Omit<Invoice, 'id' | 'date'>): Promise<Invoice> => {
        if (!user) throw new Error("User not authenticated");
        setIsProcessing(true);

        const newInvoiceId = `local_pos_inv_${Date.now()}`;
        const finalInvoice: Invoice = {
            ...invoiceData,
            id: newInvoiceId,
            branchId: activeBranchId,
            date: new Date(),
        };

        // 1. Optimistic Local State Update
        setInvoices(prev => [...prev, finalInvoice]);

        const newSales: Sale[] = invoiceData.items.map(item => {
            const [itemId] = item.id.split(`-${item.color}-${item.size}`);
            return {
                id: `local_pos_sale_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                itemId,
                quantity: item.quantity,
                salePrice: item.price,
                date: new Date(),
                color: item.color,
                size: item.size,
                branchId: activeBranchId,
                customerName: invoiceData.customer.name,
                discountType: invoiceData.discountType,
                discountValue: invoiceData.discountType === 'rupees'
                    ? (invoiceData.discountValue || 0) / Math.max(1, invoiceData.items.length)
                    : invoiceData.discountValue,
            };
        });
        setSales(prev => [...prev, ...newSales]);
        setSettings(prev => ({ ...prev, invoiceNextNumber: (prev.invoiceNextNumber || 1) + 1 }));

        // 2. Background Firestore Sync
        try {
            const batch = writeBatch(db);
            const invoicesColRef = getColRef('invoices');
            const invoiceRef = doc(invoicesColRef);
            
            const firestoreInvoice: Invoice = {
                ...invoiceData,
                id: invoiceRef.id,
                branchId: activeBranchId,
                date: new Date(),
            };
            batch.set(invoiceRef, firestoreInvoice);

            const salesColRef = getColRef('sales');
            newSales.forEach(s => {
                const sRef = doc(salesColRef);
                batch.set(sRef, {
                    itemId: s.itemId,
                    quantity: s.quantity,
                    salePrice: s.salePrice,
                    date: s.date,
                    color: s.color,
                    size: s.size,
                    branchId: activeBranchId,
                    customerName: s.customerName,
                    discountType: s.discountType,
                    discountValue: s.discountValue,
                });
            });

            const settingsRef = activeBranchId === 'main'
                ? doc(db, 'shops', 'mk_poshak_house', 'settings', 'config')
                : doc(db, 'shops', 'mk_poshak_house', 'branches', activeBranchId, 'settings', 'config');

            batch.update(settingsRef, { invoiceNextNumber: (settings.invoiceNextNumber || 1) + 1 });

            await withTimeout(batch.commit(), 5000).catch(err => {
                console.warn("Firestore POS sale warning:", err);
            });
            return firestoreInvoice;
        } catch (error) {
            console.error("Error completing POS sale:", error);
            return finalInvoice;
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUpdateInvoice = async (invoiceId: string, updatedInvoice: Omit<Invoice, 'id' | 'date'>) => {
        if (!user) return;
        setIsProcessing(true);
        
        setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, ...updatedInvoice } : inv));
        setIsInvoiceModalOpen(false);
        setInvoiceToEdit(null);

        try {
            const docRef = getDocRef('invoices', invoiceId);
            await withTimeout(updateDoc(docRef, { ...updatedInvoice, branchId: activeBranchId }), 5000).catch(err => {
                console.warn("Firestore update invoice warning:", err);
            });
        } catch (error) {
            console.error("Error updating invoice:", error);
        }
        setIsProcessing(false);
    };

    const handleUpdateInvoiceStatus = async (invoiceId: string, status: 'Paid' | 'Pending') => {
        if (!user) return;

        setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status } : inv));

        try {
            const docRef = getDocRef('invoices', invoiceId);
            await withTimeout(updateDoc(docRef, { status }), 5000).catch(err => {
                console.warn("Firestore update status warning:", err);
            });
        } catch (error) {
            console.error("Error updating invoice status:", error);
        }
    };

    // --- Settings Handlers ---
    const handleUpdateSettings = async (newSettings: Settings) => {
        if (!user) return;
        setIsProcessing(true);
        
        setSettings(prev => ({ ...prev, ...newSettings }));
        if (newSettings.securityPin) {
            localStorage.setItem('app_security_pin', newSettings.securityPin);
        }
        setIsSettingsModalOpen(false);

        try {
            const docRef = activeBranchId === 'main'
                ? doc(db, 'shops', 'mk_poshak_house', 'settings', 'config')
                : doc(db, 'shops', 'mk_poshak_house', 'branches', activeBranchId, 'settings', 'config');

            await withTimeout(setDoc(docRef, newSettings, { merge: true }), 5000).catch(err => {
                console.warn("Firestore update settings warning:", err);
            });
        } catch (error) {
            console.error("Error updating settings:", error);
        }
        setIsProcessing(false);
    };

    const handleChangeEmail = async (newEmail: string, currentPassword?: string): Promise<void> => {
        if (isOffline) {
            throw new Error("Cannot change email in offline mode.");
        }
        if (!user || !currentPassword) {
            throw new Error("User or password not provided.");
        }
        setIsProcessing(true);
        try {
            const credential = EmailAuthProvider.credential(user.email!, currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updateEmail(user, newEmail);
            alert("Email updated successfully! Please check your new email for a verification link.");
            setIsSettingsModalOpen(false);
        } catch (error: any) {
            console.error("Email update failed:", error);
            if (error.code === 'auth/wrong-password') {
                throw new Error("The password you entered is incorrect. Please try again.");
            }
            throw new Error("Failed to update email. Please try again later.");
        } finally {
            setIsProcessing(false);
        }
    };
    
    // --- Logo Handlers ---
    const handleSetLogo = (logoDataUrl: string | null) => {
        if (logoDataUrl) {
            localStorage.setItem('businessLogo', logoDataUrl);
        } else {
            localStorage.removeItem('businessLogo');
        }
        setBusinessLogo(logoDataUrl);
    };

    const handleLogoUpload = async (file: File) => {
        setIsLogoProcessing(true);
        const originalLogoReader = new FileReader();
    
        originalLogoReader.onloadend = async () => {
            const originalBase64Url = originalLogoReader.result as string;
            try {
                const client = getAiClient();
                if (!client) {
                    alert("AI background removal isn't configured (missing API key). Using the original image.");
                    handleSetLogo(originalBase64Url);
                    return;
                }

                const base64Data = originalBase64Url.split(',')[1];
                
                const imagePart = {
                    inlineData: { mimeType: file.type, data: base64Data },
                };
                const textPart = { text: "Remove the background from this image. Make the background transparent. The output must be a PNG with a transparent background." };
    
                const response = await client.models.generateContent({
                    model: 'gemini-2.5-flash-image',
                    contents: { parts: [imagePart, textPart] },
                    config: {
                        responseModalities: [Modality.IMAGE, Modality.TEXT],
                    },
                });
    
                let newLogoDataUrl: string | null = null;
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData) {
                        const base64ImageBytes: string = part.inlineData.data;
                        newLogoDataUrl = `data:image/png;base64,${base64ImageBytes}`;
                        break;
                    }
                }
    
                if (newLogoDataUrl) {
                    handleSetLogo(newLogoDataUrl);
                } else {
                    alert("Could not remove background from the logo. Using the original image.");
                    handleSetLogo(originalBase64Url);
                }
            } catch (error) {
                console.error("Error removing logo background:", error);
                alert("Failed to process the logo. Using the original image. Please try a different image if the issue persists.");
                handleSetLogo(originalBase64Url);
            } finally {
                setIsLogoProcessing(false);
            }
        };
    
        originalLogoReader.readAsDataURL(file);
    };

    // --- UI & Selection Handlers ---
    const openAddModal = () => {
        setEntryToEdit(null);
        setIsEntryModalOpen(true);
    };

    const openAddInvoiceModal = (initialItemsList?: DashboardData[]) => {
        setInvoiceToEdit(null);
        setInvoiceInitialItems(initialItemsList && initialItemsList.length > 0 ? initialItemsList : undefined);
        setIsInvoiceModalOpen(true);
    };

    const openEditInvoiceModal = (invoice: Invoice) => {
        setInvoiceToEdit(invoice);
        setInvoiceInitialItems(undefined);
        setIsInvoiceModalOpen(true);
    };

    const handleEditItemFromCatalog = (data: DashboardData) => {
        const existingItem = items.find(i => i.id === data.id);
        if (existingItem) {
            setItemToEdit(existingItem);
            setIsItemEditModalOpen(true);
        } else {
            // If it's a generated item, construct Item model
            setItemToEdit({
                id: data.id,
                name: data.name,
                category: data.category,
                subCategory: data.subCategory,
                imageUrl: data.imageUrl,
                description: data.description,
            });
            setIsItemEditModalOpen(true);
        }
    };
    
    const handlePrintQr = (item: DashboardData) => setItemForQr(item);

    const handleSelectionChange = (variantId: string, isSelected: boolean) => {
        setSelectedVariantIds(prev => {
            const newSet = new Set(prev);
            isSelected ? newSet.add(variantId) : newSet.delete(variantId);
            return newSet;
        });
    };
    const handleTransactionSelectionChange = (transactionId: string, isSelected: boolean) => {
        setSelectedTransactionIds(prev => {
            const newSet = new Set(prev);
            isSelected ? newSet.add(transactionId) : newSet.delete(transactionId);
            return newSet;
        });
    };

    const handleSelectAll = (isSelected: boolean) => {
        setSelectedVariantIds(isSelected ? new Set(filteredDashboardData.map(item => item.variantId)) : new Set());
    };

    const handleSelectAllTransactions = (isSelected: boolean, allTransactionIds: string[]) => {
        setSelectedTransactionIds(isSelected ? new Set(allTransactionIds) : new Set());
    };

    const handleOpenReport = (type: ReportType = 'sales') => {
        setReportModalType(type);
        setIsReportModalOpen(true);
    };

    // Global keyboard listener for F1 POS trigger
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F1') {
                e.preventDefault();
                setIsPosOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, []);

    // --- Render Logic ---

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    if (!isPinAuthenticated) {
        return (
            <Auth
                currentPin={settings.securityPin}
                onLoginSuccess={() => {
                    sessionStorage.setItem('is_pin_authenticated', 'true');
                    setIsPinAuthenticated(true);
                }}
            />
        );
    }

    return (
        <div className="min-h-screen text-slate-800 dark:text-slate-200 p-4 sm:p-6 lg:p-8">
            <main className="max-w-7xl mx-auto space-y-8">
                <header className="flex flex-wrap justify-between items-center gap-4 bg-white dark:bg-slate-850 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-4">
                        <LogoUploader
                            logo={businessLogo}
                            onLogoUpload={handleLogoUpload}
                            onLogoRemove={() => handleSetLogo(null)}
                            isProcessing={isLogoProcessing}
                        />
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                    MK POSHAK HOUSE
                                </h1>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Retail POS & Multi-Branch Inventory Dashboard
                            </p>
                        </div>
                    </div>

                    {/* Branch Switcher & Action Controls */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <BranchSwitcher
                            branches={branches}
                            activeBranch={activeBranch}
                            onSelectBranch={handleSelectBranch}
                            onOpenBranchManager={() => setIsBranchManagerOpen(true)}
                        />

                        {/* 1:1 POS Billing Shortcut Button */}
                        <button
                            id="open-pos-btn"
                            onClick={() => setIsPosOpen(true)}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all transform active:scale-95"
                            title="Open 1:1 POS Billing Terminal (F1)"
                        >
                            <span>⚡</span>
                            <span>1:1 POS Billing</span>
                            <span className="text-[10px] bg-white/20 px-1 py-0.2 rounded font-mono hidden sm:inline">F1</span>
                        </button>


                        {/* Purchase-to-Sale Turnaround, Stock Ageing & Fastest Selling Tracker Button */}
                        <button
                            id="open-velocity-tracker-btn"
                            onClick={() => setIsVelocityTrackerOpen(true)}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-700 via-indigo-750 to-purple-800 hover:from-blue-800 hover:to-purple-900 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all transform active:scale-95"
                            title="ખરીદી-વેચાણ સમય, સ્ટોક કેટલા દિવસથી પડ્યો છે અને ફાસ્ટ સેલિંગ ટ્રેકર"
                        >
                            <span>⚡</span>
                            <span>દિવસો & ફાસ્ટ સેલિંગ</span>
                            <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full font-mono hidden sm:inline">Tracker</span>
                        </button>

                         <button
                            onClick={openAddInvoiceModal}
                            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                        >
                            <InvoiceIcon className="w-4 h-4" />
                            <span className="hidden md:inline">Invoice</span>
                        </button>

                        <button
                            onClick={openAddModal}
                            className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 dark:bg-slate-700 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-md hover:bg-slate-800 transition-colors"
                        >
                            <PlusIcon className="w-4 h-4" />
                            <span className="hidden md:inline">Add Entry</span>
                        </button>

                        <button
                            onClick={() => handleOpenReport('sales')}
                            className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl shadow-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            title="Generate Financial Report"
                        >
                            <DocumentTextIcon className="w-5 h-5" />
                        </button>

                         <button
                            onClick={() => setIsSettingsModalOpen(true)}
                            className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl shadow-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            aria-label="Settings"
                            title="Settings"
                        >
                            <SettingsIcon className="w-5 h-5" />
                        </button>

                        <button
                            onClick={() => {
                                sessionStorage.removeItem('is_pin_authenticated');
                                setIsPinAuthenticated(false);
                                setUser(null);
                            }}
                            className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl shadow-sm hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors"
                            aria-label="Lock Dashboard"
                            title="Lock Dashboard"
                        >
                            <LogOutIcon className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                <SummaryCards 
                    metrics={summaryMetrics} 
                    onRevenueClick={() => handleOpenReport('sales')}
                    onOutstandingClick={() => handleOpenReport('outstanding')}
                    onProfitClick={() => handleOpenReport('profit')}
                    onItemsSoldClick={() => setIsVelocityTrackerOpen(true)}
                    onStockValueClick={() => setIsVelocityTrackerOpen(true)}
                />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-3 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
                        <div className="flex flex-wrap justify-between items-center gap-3 mb-6 pb-4 border-b border-slate-200 dark:border-slate-700">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <span>🛍️</span> Product Catalog & Inventory
                                    </h2>
                                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                                        {activeBranch.code}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    1:1 Square Photo Catalog with Product & Size Filtering & Instant Invoice Generation
                                </p>
                            </div>

                            {/* View Switcher Controls */}
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    id="quick-velocity-tracker-btn"
                                    onClick={() => setIsVelocityTrackerOpen(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 transition-all shadow-xs"
                                    title="ખરીદી-વેચાણ દિવસો અને ફાસ્ટ સેલિંગ ટ્રેકર"
                                >
                                    <span>⚡</span>
                                    <span>દિવસો & ફાસ્ટ સેલિંગ</span>
                                </button>

                                <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <button
                                        id="visual-catalog-view-btn"
                                        onClick={() => setInventoryViewMode('visual')}
                                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                                            inventoryViewMode === 'visual'
                                                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                    >
                                        <span>🖼️</span>
                                        <span>1:1 Visual Catalog</span>
                                    </button>
                                    <button
                                        id="table-catalog-view-btn"
                                        onClick={() => setInventoryViewMode('table')}
                                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                                            inventoryViewMode === 'table'
                                                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                    >
                                        <span>📋</span>
                                        <span>Data Table</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {inventoryViewMode === 'visual' ? (
                            <VisualProductCatalog
                                items={dashboardData}
                                rawItems={items}
                                onOpenInvoiceWithItem={(item) => openAddInvoiceModal([item])}
                                onBulkAddToInvoice={(selectedItems) => openAddInvoiceModal(selectedItems)}
                                onOpenPosWithItem={(item) => setIsPosOpen(true)}
                                onEditItemPhoto={handleEditItemFromCatalog}
                                onPrintQr={handlePrintQr}
                                onPrintSelected={() => setIsBulkQrModalOpen(true)}
                                selectedVariantIds={selectedVariantIds}
                                onSelectionChange={handleSelectionChange}
                                onSelectAll={handleSelectAll}
                                onAddNewProduct={openAddModal}
                            />
                        ) : (
                            <DataTable 
                                data={filteredDashboardData} 
                                onPrintQr={handlePrintQr} 
                                selectedVariantIds={selectedVariantIds}
                                onSelectionChange={handleSelectionChange}
                                onSelectAll={handleSelectAll}
                                onPrintSelected={() => setIsBulkQrModalOpen(true)}
                                searchTerm={inventorySearchTerm}
                                onSearchChange={setInventorySearchTerm}
                            />
                        )}
                    </div>
                    
                    <div className="lg:col-span-3 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white flex items-center gap-2">
                            <span>🧾</span> Invoice History
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                                {activeBranch.code}
                            </span>
                        </h2>
                        <InvoiceHistoryTable
                            invoices={invoices}
                            onPreview={setInvoiceToPreview}
                            onEdit={openEditInvoiceModal}
                            onDelete={handleStartDeleteInvoice}
                            onStatusChange={handleUpdateInvoiceStatus}
                        />
                    </div>

                    <div className="lg:col-span-3 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
                        <ProfitChart 
                            itemData={itemProfitData}
                            categoryData={categoryProfitData}
                            monthlyData={monthlyPnlData}
                        />
                    </div>

                    <div className="lg:col-span-3 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white flex items-center gap-2">
                            <span>📊</span> Transaction History
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                                {activeBranch.code}
                            </span>
                        </h2>
                        <TransactionHistoryTable 
                            purchases={purchases}
                            sales={sales}
                            items={items}
                            onEdit={handleStartEdit}
                            onDelete={handleStartDelete}
                            selectedTransactionIds={selectedTransactionIds}
                            onSelectionChange={handleTransactionSelectionChange}
                            onSelectAll={handleSelectAllTransactions}
                            onDeleteSelected={handleStartBulkDeleteTransactions}
                            onStartBulkEdit={handleStartBulkEdit}
                            onStartEditItem={handleStartEditItem}
                        />
                    </div>
                </div>
            </main>
            
            {/* --- Modals --- */}
            <CompactPosBilling
                isOpen={isPosOpen}
                onClose={() => setIsPosOpen(false)}
                inventoryItems={dashboardData}
                activeBranch={activeBranch}
                settings={settings}
                businessLogo={businessLogo}
                onCompletePosSale={handleCompletePosSale}
                isProcessing={isProcessing}
            />

            <BranchManagerModal
                isOpen={isBranchManagerOpen}
                onClose={() => setIsBranchManagerOpen(false)}
                branches={branches}
                activeBranchId={activeBranchId}
                onSaveBranch={handleSaveBranch}
                onDeleteBranch={handleDeleteBranch}
                onSelectBranch={handleSelectBranch}
                isProcessing={isProcessing}
            />

            <EntryModal
                isOpen={isEntryModalOpen}
                onClose={() => setIsEntryModalOpen(false)}
                items={items}
                onAddTransactions={handleAddTransactions}
                onAddItem={handleAddItem}
                onUpdateItem={handleUpdateItem}
                onDeleteItem={handleStartDeleteItem}
                entryToEdit={entryToEdit}
                onSaveEdit={handleUpdateEntry}
                isProcessing={isProcessing}
            />
             <InvoiceModal
                isOpen={isInvoiceModalOpen}
                onClose={() => { 
                    setIsInvoiceModalOpen(false); 
                    setInvoiceToEdit(null); 
                    setInvoiceInitialItems(undefined);
                }}
                inventoryItems={dashboardData}
                onCreateInvoice={handleCreateInvoice}
                onUpdateInvoice={handleUpdateInvoice}
                invoiceToEdit={invoiceToEdit}
                settings={settings}
                isProcessing={isProcessing}
                initialItems={invoiceInitialItems}
            />
            <InvoicePreviewModal
                isOpen={!!invoiceToPreview}
                onClose={() => setInvoiceToPreview(null)}
                invoiceData={invoiceToPreview}
                businessLogo={businessLogo}
                settings={settings}
                activeBranch={activeBranch}
                onUpdateLogoSize={(newSize) => {
                    handleUpdateSettings({ ...settings, invoiceLogoSize: newSize });
                }}
            />
            <ConfirmationModal
                isOpen={!!deleteConfirmation}
                onClose={() => setDeleteConfirmation(null)}
                onConfirm={handleConfirmDelete}
                title={deleteConfirmation?.title || "Confirm Deletion"}
                message={deleteConfirmation?.message || "Are you sure? This action cannot be undone."}
                isProcessing={isProcessing}
            />
            <QrCodeModal
                isOpen={!!itemForQr}
                onClose={() => setItemForQr(null)}
                itemData={itemForQr}
                businessLogo={businessLogo}
            />
            <BulkQrCodeModal
                isOpen={isBulkQrModalOpen}
                onClose={() => setIsBulkQrModalOpen(false)}
                itemsData={selectedItemsForQr}
                businessLogo={businessLogo}
            />
            <SettingsModal
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
                settings={settings}
                onSave={handleUpdateSettings}
                isProcessing={isProcessing}
                userEmail={user?.email || 'owner@mkposhak.local'}
                businessLogo={businessLogo}
            />
            <ReportModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                sales={sales}
                purchases={purchases}
                items={items}
                invoices={invoices}
                dashboardData={dashboardData}
                initialReportType={reportModalType}
            />
            <BulkEditModal
                isOpen={!!bulkEditInfo}
                onClose={() => setBulkEditInfo(null)}
                onSave={handleConfirmBulkEdit}
                count={selectedTransactionIds.size}
                type={bulkEditInfo?.type}
                isProcessing={isProcessing}
            />
            <ItemEditModal
                isOpen={isItemEditModalOpen}
                onClose={() => {
                    setIsItemEditModalOpen(false);
                    setItemToEdit(null);
                }}
                item={itemToEdit}
                onSave={handleUpdateItemAndCloseModal}
                onDelete={handleDeleteItemAndCloseModal}
                isProcessing={isProcessing}
            />
            <StockVelocityAndAgeingModal
                isOpen={isVelocityTrackerOpen}
                onClose={() => setIsVelocityTrackerOpen(false)}
                dashboardData={dashboardData}
                purchases={purchases}
                sales={sales}
                items={items}
                activeBranch={activeBranch}
            />
        </div>
    );
};

export default App;
