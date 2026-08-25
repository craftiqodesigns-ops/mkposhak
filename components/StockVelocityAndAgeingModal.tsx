import React, { useState, useMemo } from 'react';
import type { DashboardData, Purchase, Sale, Item, Branch } from '../types';
import { XIcon } from './icons/XIcon';
import { ClockIcon } from './icons/ClockIcon';
import { PackageIcon } from './icons/PackageIcon';
import { TrendingUpIcon } from './icons/TrendingUpIcon';
import { ShoppingCartIcon } from './icons/ShoppingCartIcon';
import { WhatsAppIcon } from './icons/WhatsAppIcon';
import { DownloadIcon } from './icons/DownloadIcon';

interface StockVelocityAndAgeingModalProps {
    isOpen: boolean;
    onClose: () => void;
    dashboardData: DashboardData[];
    purchases: Purchase[];
    sales: Sale[];
    items: Item[];
    activeBranch?: Branch;
}

export interface BatchTurnaroundRecord {
    id: string;
    variantId: string;
    itemId: string;
    name: string;
    category: string;
    color: string;
    size: string;
    imageUrl?: string;
    purchaseDate: Date;
    purchaseQty: number;
    purchasePrice: number;
    sellingPrice: number;
    vendorName: string;
    soldQty: number;
    remainingQty: number;
    firstSaleDate: Date | null;
    lastSaleDate: Date | null;
    daysToFirstSale: number | null;
    daysToFullSellout: number | null;
    daysActive: number;
    status: 'fully_sold' | 'selling_active' | 'in_stock_unsold';
    profitGenerated: number;
}

export interface ItemAgeingRecord {
    variantId: string;
    itemId: string;
    name: string;
    category: string;
    color: string;
    size: string;
    imageUrl?: string;
    currentStock: number;
    avgCost: number;
    sellingPrice: number;
    capitalBlocked: number;
    firstPurchaseDate: Date;
    latestPurchaseDate: Date;
    daysInStock: number;
    totalSold: number;
    ageCategory: 'fresh' | 'regular' | 'moderate' | 'old';
    suggestionGujarati: string;
}

export interface FastSellingRecord {
    variantId: string;
    itemId: string;
    name: string;
    category: string;
    color: string;
    size: string;
    imageUrl?: string;
    totalSold: number;
    currentStock: number;
    avgCost: number;
    sellingPrice: number;
    totalRevenue: number;
    totalProfit: number;
    dailySalesVelocity: number;
    avgDaysToSell: number;
    speedRankCategory: 'super_fast' | 'fast' | 'normal' | 'slow';
    speedBadgeText: string;
    firstPurchaseDate: Date;
    firstSaleDate: Date | null;
    latestSaleDate: Date | null;
    daysFromPurchaseToFirstSale: number | null;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(new Date(date));
};

export const StockVelocityAndAgeingModal: React.FC<StockVelocityAndAgeingModalProps> = ({
    isOpen,
    onClose,
    dashboardData,
    purchases,
    sales,
    items,
    activeBranch,
}) => {
    const [activeTab, setActiveTab] = useState<'fast_selling' | 'stock_ageing' | 'turnaround_batches'>('fast_selling');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    
    // Sort states
    const [fastSortBy, setFastSortBy] = useState<'turnaround' | 'sold_qty' | 'velocity' | 'profit'>('turnaround');
    const [ageingSortBy, setAgeingSortBy] = useState<'oldest_first' | 'newest_first' | 'highest_qty' | 'highest_capital'>('oldest_first');
    const [ageFilter, setAgeFilter] = useState<'all' | 'fresh' | 'regular' | 'moderate' | 'old'>('all');
    const [batchStatusFilter, setBatchStatusFilter] = useState<'all' | 'fully_sold' | 'selling_active' | 'in_stock_unsold'>('all');

    const now = new Date();

    // Unique Categories
    const categories = useMemo(() => {
        const set = new Set<string>();
        dashboardData.forEach(d => {
            if (d.category) set.add(d.category);
        });
        return ['All', ...Array.from(set)];
    }, [dashboardData]);

    // 1. Calculate Batch Turnaround Records (FIFO matching between Purchases and Sales)
    const batchTurnarounds = useMemo<BatchTurnaroundRecord[]>(() => {
        const itemMap = new Map<string, Item>(items.map(i => [i.id, i]));
        const records: BatchTurnaroundRecord[] = [];

        // Group purchases by variant
        const purchasesByVariant = new Map<string, Purchase[]>();
        purchases.forEach(p => {
            const key = `${p.itemId}_${p.color}_${p.size}`;
            if (!purchasesByVariant.has(key)) purchasesByVariant.set(key, []);
            purchasesByVariant.get(key)!.push(p);
        });

        // Group sales by variant
        const salesByVariant = new Map<string, Sale[]>();
        sales.forEach(s => {
            const key = `${s.itemId}_${s.color}_${s.size}`;
            if (!salesByVariant.has(key)) salesByVariant.set(key, []);
            salesByVariant.get(key)!.push(s);
        });

        purchasesByVariant.forEach((varPurchases, variantKey) => {
            // Sort purchases chronologically
            varPurchases.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            // Get all sales for this variant sorted chronologically
            const varSales = salesByVariant.get(variantKey) || [];
            const salesQueue = [...varSales].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            // FIFO simulation
            let salesPointer = 0;
            let currentSaleRemainingQty = salesQueue[0] ? salesQueue[0].quantity : 0;

            varPurchases.forEach(p => {
                const item = itemMap.get(p.itemId);
                const pDate = new Date(p.date);
                const purchaseQty = p.quantity;
                let neededQty = purchaseQty;
                let soldFromThisBatch = 0;
                let firstSaleDate: Date | null = null;
                let lastSaleDate: Date | null = null;
                let revenueFromThisBatch = 0;

                while (neededQty > 0 && salesPointer < salesQueue.length) {
                    const currentSale = salesQueue[salesPointer];
                    const sDate = new Date(currentSale.date);

                    if (sDate.getTime() >= pDate.getTime() - 86400000) { // Same day or after purchase
                        if (!firstSaleDate) firstSaleDate = sDate;
                        lastSaleDate = sDate;

                        const qtyToTake = Math.min(neededQty, currentSaleRemainingQty);
                        soldFromThisBatch += qtyToTake;
                        neededQty -= qtyToTake;
                        currentSaleRemainingQty -= qtyToTake;
                        revenueFromThisBatch += qtyToTake * (currentSale.salePrice || p.sellingPrice || (p.purchasePrice * 1.3));

                        if (currentSaleRemainingQty <= 0) {
                            salesPointer++;
                            if (salesPointer < salesQueue.length) {
                                currentSaleRemainingQty = salesQueue[salesPointer].quantity;
                            }
                        }
                    } else {
                        // This sale was before this purchase batch, skip
                        salesPointer++;
                        if (salesPointer < salesQueue.length) {
                            currentSaleRemainingQty = salesQueue[salesPointer].quantity;
                        }
                    }
                }

                const remainingQty = purchaseQty - soldFromThisBatch;
                const daysActive = Math.max(0, Math.floor((now.getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24)));
                
                let daysToFirstSale: number | null = null;
                if (firstSaleDate) {
                    daysToFirstSale = Math.max(0, Math.floor((firstSaleDate.getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24)));
                }

                let daysToFullSellout: number | null = null;
                if (remainingQty === 0 && lastSaleDate) {
                    daysToFullSellout = Math.max(0, Math.floor((lastSaleDate.getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24)));
                }

                let status: BatchTurnaroundRecord['status'] = 'in_stock_unsold';
                if (remainingQty === 0 && soldFromThisBatch > 0) {
                    status = 'fully_sold';
                } else if (soldFromThisBatch > 0 && remainingQty > 0) {
                    status = 'selling_active';
                }

                const costOfBatch = purchaseQty * p.purchasePrice;
                const profitGenerated = revenueFromThisBatch - (soldFromThisBatch * p.purchasePrice);

                records.push({
                    id: p.id,
                    variantId: `${p.itemId}_${p.color}_${p.size}`,
                    itemId: p.itemId,
                    name: item?.name || 'Item',
                    category: item?.category || 'General',
                    color: p.color,
                    size: p.size,
                    imageUrl: p.imageUrl || item?.imageUrl,
                    purchaseDate: pDate,
                    purchaseQty,
                    purchasePrice: p.purchasePrice,
                    sellingPrice: p.sellingPrice || (p.purchasePrice * 1.4),
                    vendorName: p.vendorName || 'General Supplier',
                    soldQty: soldFromThisBatch,
                    remainingQty,
                    firstSaleDate,
                    lastSaleDate,
                    daysToFirstSale,
                    daysToFullSellout,
                    daysActive,
                    status,
                    profitGenerated,
                });
            });
        });

        // Default sort: latest purchase date first
        return records.sort((a, b) => b.purchaseDate.getTime() - a.purchaseDate.getTime());
    }, [purchases, sales, items]);

    // 2. Calculate Available Stock Ageing Records (How many days has each material been sitting in the shop)
    const stockAgeingList = useMemo<ItemAgeingRecord[]>(() => {
        const itemMap = new Map<string, Item>(items.map(i => [i.id, i]));
        
        return dashboardData
            .filter(d => d.stock > 0) // Only currently available materials
            .map(d => {
                const item = itemMap.get(d.id);
                const variantPurchases = purchases.filter(p => p.itemId === d.id && p.color === d.color && p.size === d.size);
                
                let firstPurchaseDate = new Date();
                let latestPurchaseDate = new Date();
                
                if (variantPurchases.length > 0) {
                    variantPurchases.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    firstPurchaseDate = new Date(variantPurchases[0].date);
                    latestPurchaseDate = new Date(variantPurchases[variantPurchases.length - 1].date);
                }

                const daysInStock = Math.max(0, Math.floor((now.getTime() - firstPurchaseDate.getTime()) / (1000 * 60 * 60 * 24)));
                const currentStock = d.stock;
                const avgCost = d.avgCost > 0 ? d.avgCost : 250;
                const sellingPrice = d.sellingPrice || d.avgSalePrice || (avgCost * 1.4);
                const capitalBlocked = currentStock * avgCost;

                let ageCategory: ItemAgeingRecord['ageCategory'] = 'fresh';
                let suggestionGujarati = '🟢 નવો માલ: તાજેતરમાં જ ખરીદેલો છે. ડિસ્પ્લે પર રાખો.';

                if (daysInStock > 60) {
                    ageCategory = 'old';
                    suggestionGujarati = '🔴 જૂનો સ્ટોક (60+ દિવસ): મૂડી છૂટી કરવા ડિસ્કાઉન્ટ કે ઓફર આપી ક્લિયર કરો.';
                } else if (daysInStock > 30) {
                    ageCategory = 'moderate';
                    suggestionGujarati = '🟡 1 મહિનાથી વધુ જૂનો માલ: ગ્રાહકોને સજેસ્ટ કરો જેથી ઝડપથી વેચાય.';
                } else if (daysInStock > 15) {
                    ageCategory = 'regular';
                    suggestionGujarati = '🔵 સામાન્ય સ્ટોક (2-4 અઠવાડિયા): વેચાણ ગતિ સરેરાશ છે.';
                }

                return {
                    variantId: d.variantId,
                    itemId: d.id,
                    name: d.name,
                    category: d.category,
                    color: d.color,
                    size: d.size,
                    imageUrl: d.imageUrl,
                    currentStock,
                    avgCost,
                    sellingPrice,
                    capitalBlocked,
                    firstPurchaseDate,
                    latestPurchaseDate,
                    daysInStock,
                    totalSold: d.totalSold,
                    ageCategory,
                    suggestionGujarati,
                };
            });
    }, [dashboardData, purchases, items]);

    // 3. Calculate Fastest Selling Items Leaderboard
    const fastSellingList = useMemo<FastSellingRecord[]>(() => {
        const itemMap = new Map<string, Item>(items.map(i => [i.id, i]));

        // Calculate time span for velocity
        const allSaleDates = sales.map(s => new Date(s.date).getTime());
        const minSaleDate = allSaleDates.length > 0 ? Math.min(...allSaleDates) : now.getTime() - (30 * 86400000);
        const daysWindow = Math.max(1, Math.ceil((now.getTime() - minSaleDate) / (1000 * 60 * 60 * 24)));

        return dashboardData.map(d => {
            const item = itemMap.get(d.id);
            const variantPurchases = purchases.filter(p => p.itemId === d.id && p.color === d.color && p.size === d.size);
            const variantSales = sales.filter(s => s.itemId === d.id && s.color === d.color && s.size === d.size);

            variantPurchases.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            variantSales.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            const firstPurchaseDate = variantPurchases.length > 0 ? new Date(variantPurchases[0].date) : new Date();
            const firstSaleDate = variantSales.length > 0 ? new Date(variantSales[0].date) : null;
            const latestSaleDate = variantSales.length > 0 ? new Date(variantSales[variantSales.length - 1].date) : null;

            let daysFromPurchaseToFirstSale: number | null = null;
            if (firstSaleDate) {
                daysFromPurchaseToFirstSale = Math.max(0, Math.floor((firstSaleDate.getTime() - firstPurchaseDate.getTime()) / (1000 * 60 * 60 * 24)));
            }

            const totalSold = d.totalSold;
            const currentStock = Math.max(0, d.stock);
            const avgCost = d.avgCost > 0 ? d.avgCost : 250;
            const sellingPrice = d.sellingPrice || d.avgSalePrice || (avgCost * 1.4);
            const totalRevenue = d.totalRevenue;
            const totalProfit = d.totalProfit;

            const dailySalesVelocity = totalSold > 0 ? totalSold / Math.min(daysWindow, 60) : 0;
            
            // Average days to sell 1 batch or sell per item
            let avgDaysToSell = 999;
            if (daysFromPurchaseToFirstSale !== null && totalSold > 0) {
                avgDaysToSell = daysFromPurchaseToFirstSale;
            } else if (totalSold > 0 && dailySalesVelocity > 0) {
                avgDaysToSell = Math.max(1, Math.round(1 / dailySalesVelocity));
            }

            let speedRankCategory: FastSellingRecord['speedRankCategory'] = 'slow';
            let speedBadgeText = '🐢 ધીમું વેચાણ (Slow Moving)';

            if (totalSold > 0) {
                if (avgDaysToSell <= 3 || dailySalesVelocity >= 1.5) {
                    speedRankCategory = 'super_fast';
                    speedBadgeText = '⚡ અતિ ઝડપી (Super Fast - < 3 Days)';
                } else if (avgDaysToSell <= 7 || dailySalesVelocity >= 0.8) {
                    speedRankCategory = 'fast';
                    speedBadgeText = '🚀 ઝડપી વેચાણ (Fast - 3-7 Days)';
                } else if (avgDaysToSell <= 20) {
                    speedRankCategory = 'normal';
                    speedBadgeText = '📦 સામાન્ય ગતિ (Normal)';
                }
            } else {
                speedBadgeText = '⏳ હજુ વેચાણ બાકી (Unsold)';
            }

            return {
                variantId: d.variantId,
                itemId: d.id,
                name: d.name,
                category: d.category,
                color: d.color,
                size: d.size,
                imageUrl: d.imageUrl,
                totalSold,
                currentStock,
                avgCost,
                sellingPrice,
                totalRevenue,
                totalProfit,
                dailySalesVelocity,
                avgDaysToSell,
                speedRankCategory,
                speedBadgeText,
                firstPurchaseDate,
                firstSaleDate,
                latestSaleDate,
                daysFromPurchaseToFirstSale,
            };
        });
    }, [dashboardData, purchases, sales, items]);

    // High Level Summary Metrics
    const summaryStats = useMemo(() => {
        // Fastest item
        const sortedFast = [...fastSellingList]
            .filter(f => f.totalSold > 0)
            .sort((a, b) => a.avgDaysToSell - b.avgDaysToSell || b.totalSold - a.totalSold);
        
        const fastestItem = sortedFast[0] || null;

        // Oldest stock item
        const sortedOld = [...stockAgeingList].sort((a, b) => b.daysInStock - a.daysInStock);
        const oldestStockItem = sortedOld[0] || null;

        // Average days in stock across all current inventory
        const totalStockUnits = stockAgeingList.reduce((sum, i) => sum + i.currentStock, 0);
        const weightedDays = stockAgeingList.reduce((sum, i) => sum + (i.daysInStock * i.currentStock), 0);
        const avgDaysInStock = totalStockUnits > 0 ? Math.round(weightedDays / totalStockUnits) : 0;

        // Old items count (> 45 days)
        const oldItemsCount = stockAgeingList.filter(i => i.daysInStock > 45).length;
        const totalBlockedCapitalInOld = stockAgeingList.filter(i => i.daysInStock > 45).reduce((sum, i) => sum + i.capitalBlocked, 0);

        // Fully sold out batches count
        const fullySoldBatchesCount = batchTurnarounds.filter(b => b.status === 'fully_sold').length;

        return {
            fastestItem,
            oldestStockItem,
            avgDaysInStock,
            oldItemsCount,
            totalBlockedCapitalInOld,
            fullySoldBatchesCount,
            totalActiveVariants: stockAgeingList.length,
        };
    }, [fastSellingList, stockAgeingList, batchTurnarounds]);

    // Filtered & Sorted: Fast Selling List
    const filteredFastSelling = useMemo(() => {
        return fastSellingList
            .filter(item => {
                const matchesSearch = !searchTerm ||
                    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.color.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.size.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
                return matchesSearch && matchesCategory;
            })
            .sort((a, b) => {
                if (fastSortBy === 'turnaround') {
                    // Items with sales come first, sorted by fewest days to sell
                    if (a.totalSold === 0 && b.totalSold > 0) return 1;
                    if (a.totalSold > 0 && b.totalSold === 0) return -1;
                    return a.avgDaysToSell - b.avgDaysToSell;
                }
                if (fastSortBy === 'sold_qty') return b.totalSold - a.totalSold;
                if (fastSortBy === 'velocity') return b.dailySalesVelocity - a.dailySalesVelocity;
                if (fastSortBy === 'profit') return b.totalProfit - a.totalProfit;
                return 0;
            });
    }, [fastSellingList, searchTerm, selectedCategory, fastSortBy]);

    // Filtered & Sorted: Stock Ageing List
    const filteredStockAgeing = useMemo(() => {
        return stockAgeingList
            .filter(item => {
                const matchesSearch = !searchTerm ||
                    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.color.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.size.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
                const matchesAge = ageFilter === 'all' || item.ageCategory === ageFilter;
                return matchesSearch && matchesCategory && matchesAge;
            })
            .sort((a, b) => {
                if (ageingSortBy === 'oldest_first') return b.daysInStock - a.daysInStock;
                if (ageingSortBy === 'newest_first') return a.daysInStock - b.daysInStock;
                if (ageingSortBy === 'highest_qty') return b.currentStock - a.currentStock;
                if (ageingSortBy === 'highest_capital') return b.capitalBlocked - a.capitalBlocked;
                return 0;
            });
    }, [stockAgeingList, searchTerm, selectedCategory, ageFilter, ageingSortBy]);

    // Filtered & Sorted: Batch Turnaround List
    const filteredBatches = useMemo(() => {
        return batchTurnarounds
            .filter(batch => {
                const matchesSearch = !searchTerm ||
                    batch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    batch.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    batch.color.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    batch.size.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    batch.vendorName.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesCategory = selectedCategory === 'All' || batch.category === selectedCategory;
                const matchesStatus = batchStatusFilter === 'all' || batch.status === batchStatusFilter;
                return matchesSearch && matchesCategory && matchesStatus;
            });
    }, [batchTurnarounds, searchTerm, selectedCategory, batchStatusFilter]);

    // Generate WhatsApp Summary Message
    const generateWhatsAppSummary = () => {
        const branchTitle = activeBranch ? `[${activeBranch.name}]` : '[MK Poshak House]';
        const lines = [
            `📊 *STOCK VELOCITY & AGEING REPORT* ${branchTitle}`,
            `📅 Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
            `──────────────────────`,
            `⚡ *FASTEST SELLING ITEMS (સૌથી ઝડપી વેચાયેલ માલ):*`,
        ];

        filteredFastSelling.slice(0, 5).forEach((item, idx) => {
            const daysText = item.daysFromPurchaseToFirstSale !== null 
                ? `(ખરીદીથી પ્રથમ વેચાણ: ${item.daysFromPurchaseToFirstSale} દિવસ)` 
                : '';
            lines.push(
                `${idx + 1}. *${item.name}* (${item.color}/${item.size})` +
                `\n   • વેચાયેલા નંગ: ${item.totalSold} pcs | બાકી: ${item.currentStock} pcs` +
                `\n   • સ્પીડ: ${item.speedBadgeText} ${daysText}`
            );
        });

        lines.push(`──────────────────────`);
        lines.push(`⏳ *OLD STOCK ALERT (45+ દિવસથી પડેલો માલ):*`);
        
        const oldItems = stockAgeingList.filter(i => i.daysInStock > 45).slice(0, 5);
        if (oldItems.length === 0) {
            lines.push(`✅ બધો માલ ફ્રેશ છે! કોઈ 45+ દિવસ જૂનો સ્ટોક નથી.`);
        } else {
            oldItems.forEach((item, idx) => {
                lines.push(
                    `${idx + 1}. *${item.name}* (${item.color}/${item.size})` +
                    `\n   • સ્ટોકમાં સમય: *${item.daysInStock} દિવસથી પડ્યો છે*` +
                    `\n   • બાકી નંગ: ${item.currentStock} pcs (રોકાયેલી મૂડી: ${formatCurrency(item.capitalBlocked)})`
                );
            });
        }

        lines.push(`──────────────────────`);
        lines.push(`📈 *સરેરાશ સ્ટોક દિવસો:* ${summaryStats.avgDaysInStock} દિવસ`);
        lines.push(`💰 *જૂના સ્ટોકમાં રોકાયેલી મૂડી:* ${formatCurrency(summaryStats.totalBlockedCapitalInOld)}`);

        return lines.join('\n');
    };

    const handleShareWhatsApp = () => {
        const text = encodeURIComponent(generateWhatsAppSummary());
        window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    };

    const handlePrintOrDownload = () => {
        window.print();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white">
            <div className="bg-white dark:bg-slate-850 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-750 w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 print:shadow-none print:border-none print:max-h-full">
                
                {/* HEADER */}
                <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700 flex flex-wrap justify-between items-center gap-3 bg-gradient-to-r from-blue-900 via-indigo-800 to-slate-900 text-white print:bg-none print:text-black">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center text-xl shadow-inner">
                            ⚡
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg sm:text-xl font-black tracking-tight text-white print:text-slate-900">
                                    ખરીદી-વેચાણ દિવસો અને ફાસ્ટ સેલિંગ ટ્રેકર
                                </h2>
                                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/20 text-white tracking-wide uppercase">
                                    Turnaround & Ageing
                                </span>
                            </div>
                            <p className="text-xs text-blue-100 dark:text-blue-200 mt-0.5 print:text-slate-600">
                                ક્યારે ખરીદ્યું, કેટલા દિવસમાં વેચાયું, કેટલા દિવસથી માલ ઉપલબ્ધ છે અને કયો માલ સૌથી ફાસ્ટ છે
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 print:hidden">
                        {/* Quick Share Buttons */}
                        <button
                            onClick={handleShareWhatsApp}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                            title="WhatsApp Summary Share"
                        >
                            <WhatsAppIcon className="w-4 h-4" />
                            <span className="hidden sm:inline">WhatsApp Summary</span>
                        </button>
                        
                        <button
                            onClick={handlePrintOrDownload}
                            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                            title="Print / Save PDF"
                        >
                            <DownloadIcon className="w-4 h-4" />
                        </button>

                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                            aria-label="Close modal"
                        >
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* 3 CORE TABS NAVIGATION */}
                <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-2 gap-2 overflow-x-auto print:hidden">
                    <button
                        onClick={() => setActiveTab('fast_selling')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                            activeTab === 'fast_selling'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                        }`}
                    >
                        <span>⚡ 1. સૌથી ફાસ્ટ વેચાતો માલ</span>
                        <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full font-mono">
                            Fastest Selling
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveTab('stock_ageing')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                            activeTab === 'stock_ageing'
                                ? 'bg-amber-600 text-white shadow-md'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                        }`}
                    >
                        <span>⏳ 2. કેટલા દિવસથી માલ પડ્યો છે?</span>
                        <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full font-mono">
                            Stock Ageing ({stockAgeingList.length})
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveTab('turnaround_batches')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                            activeTab === 'turnaround_batches'
                                ? 'bg-emerald-700 text-white shadow-md'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                        }`}
                    >
                        <span>📦 3. ખરીદી થી વેચાણ ટાઈમલાઈન</span>
                        <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full font-mono">
                            Purchase to Sale ({batchTurnarounds.length})
                        </span>
                    </button>
                </div>

                {/* MODAL BODY */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

                    {/* TOP EXECUTIVE HIGHLIGHT STATS */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                        {/* Fastest Item */}
                        <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                                    ⚡ સૌથી ફાસ્ટ વેચાયેલી આઇટમ
                                </span>
                                <span className="text-xs">🏆</span>
                            </div>
                            <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1 truncate">
                                {summaryStats.fastestItem ? summaryStats.fastestItem.name : 'N/A'}
                            </p>
                            <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">
                                {summaryStats.fastestItem 
                                    ? `માત્ર ${summaryStats.fastestItem.daysFromPurchaseToFirstSale !== null ? summaryStats.fastestItem.daysFromPurchaseToFirstSale : 1} દિવસમાં વેચાણ! (${summaryStats.fastestItem.totalSold} pcs)`
                                    : 'હજુ વેચાણ ડેટા નથી'}
                            </p>
                        </div>

                        {/* Average Days in Shop */}
                        <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300">
                                    ⏳ સરેરાશ સ્ટોક સમય
                                </span>
                                <span className="text-xs">📅</span>
                            </div>
                            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                                {summaryStats.avgDaysInStock} <span className="text-xs font-normal text-slate-500">દિવસ</span>
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                ખરીદીથી સરેરાશ રહેતો સમય
                            </p>
                        </div>

                        {/* Old Stock 45+ Days */}
                        <div className="p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300">
                                    ⚠️ 45+ દિવસ જૂનો સ્ટોક
                                </span>
                                <span className="text-xs">🛑</span>
                            </div>
                            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                                {summaryStats.oldItemsCount} <span className="text-xs font-normal text-slate-500">વેરિઅન્ટ</span>
                            </p>
                            <p className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
                                રોકાયેલી મૂડી: {formatCurrency(summaryStats.totalBlockedCapitalInOld)}
                            </p>
                        </div>

                        {/* Fully Sold Batches */}
                        <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                                    ✅ સંપૂર્ણ વેચાયેલી બેચ
                                </span>
                                <span className="text-xs">🎉</span>
                            </div>
                            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                                {summaryStats.fullySoldBatchesCount} <span className="text-xs font-normal text-slate-500">ખરીદીઓ</span>
                            </p>
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                                100% સ્ટોક આઉટ થઈ ગયો
                            </p>
                        </div>
                    </div>

                    {/* SEARCH & FILTERS BAR */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 print:hidden">
                        <div className="flex flex-wrap items-center gap-2">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by name, color, size, category..."
                                className="px-3 py-1.5 text-xs bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white w-full sm:w-56 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />

                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white font-medium"
                            >
                                {categories.map(c => (
                                    <option key={c} value={c}>Category: {c}</option>
                                ))}
                            </select>
                        </div>

                        {/* Sub-Filters depending on tab */}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            {activeTab === 'fast_selling' && (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-slate-500 font-medium">Sort By:</span>
                                    <select
                                        value={fastSortBy}
                                        onChange={(e) => setFastSortBy(e.target.value as any)}
                                        className="px-2.5 py-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white font-bold"
                                    >
                                        <option value="turnaround">⚡ સૌથી ઝડપી વેચાણ સમય (Fastest Days)</option>
                                        <option value="sold_qty">📦 સૌથી વધુ નંગ વેચાયા (Quantity Sold)</option>
                                        <option value="velocity">🚀 દૈનિક સ્પીડ (Units/Day)</option>
                                        <option value="profit">💰 સૌથી વધુ નફો (Profit Earned)</option>
                                    </select>
                                </div>
                            )}

                            {activeTab === 'stock_ageing' && (
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setAgeFilter('all')}
                                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${ageFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                                        >
                                            All ({stockAgeingList.length})
                                        </button>
                                        <button
                                            onClick={() => setAgeFilter('old')}
                                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${ageFilter === 'old' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'}`}
                                        >
                                            🔴 45+ દિવસ ({stockAgeingList.filter(i => i.daysInStock > 60).length})
                                        </button>
                                        <button
                                            onClick={() => setAgeFilter('fresh')}
                                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${ageFilter === 'fresh' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'}`}
                                        >
                                            🟢 નવો માલ (&lt;15 દિવસ)
                                        </button>
                                    </div>

                                    <select
                                        value={ageingSortBy}
                                        onChange={(e) => setAgeingSortBy(e.target.value as any)}
                                        className="px-2 py-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white font-semibold"
                                    >
                                        <option value="oldest_first">⏳ સૌથી જૂનો માલ પહેલા (Oldest First)</option>
                                        <option value="newest_first">✨ સૌથી નવો માલ પહેલા (Newest First)</option>
                                        <option value="highest_qty">📦 વધુ સ્ટોક પહેલા (Highest Qty)</option>
                                        <option value="highest_capital">💰 વધુ રોકાયેલી મૂડી (Highest Capital)</option>
                                    </select>
                                </div>
                            )}

                            {activeTab === 'turnaround_batches' && (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-slate-500 font-medium">Status:</span>
                                    <select
                                        value={batchStatusFilter}
                                        onChange={(e) => setBatchStatusFilter(e.target.value as any)}
                                        className="px-2.5 py-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white font-bold"
                                    >
                                        <option value="all">બધી ખરીદી બેચ (All Batches)</option>
                                        <option value="fully_sold">✅ સંપૂર્ણ વેચાઈ ગયેલ (Fully Sold)</option>
                                        <option value="selling_active">🔥 અડધો વેચાયેલ (Active Selling)</option>
                                        <option value="in_stock_unsold">⏳ હજુ વેચાણ બાકી (In Stock Unsold)</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ======================================================== */}
                    {/* TAB 1: FASTEST SELLING LEADERBOARD                       */}
                    {/* ======================================================== */}
                    {activeTab === 'fast_selling' && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium px-1">
                                <span>સૌથી ઝડપથી વેચાયેલી પ્રોડક્ટ્સ રેન્કિંગ (ખરીદીથી વેચાણ સુધીનો સમય અને ગતિ)</span>
                                <span>કુલ: {filteredFastSelling.length} આઇટમ્સ</span>
                            </div>

                            {filteredFastSelling.length === 0 ? (
                                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500">
                                    <p className="text-sm">કોઈ આઇટમ મળી નથી.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3">
                                    {filteredFastSelling.map((item, index) => {
                                        const isTop3 = index < 3 && item.totalSold > 0;
                                        const trophyEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;

                                        return (
                                            <div
                                                key={item.variantId}
                                                className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                                                    item.speedRankCategory === 'super_fast'
                                                        ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700/60 shadow-xs'
                                                        : item.speedRankCategory === 'fast'
                                                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60'
                                                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
                                                }`}
                                            >
                                                {/* Left Info & Image */}
                                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                                    {/* Rank Badge */}
                                                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-black text-sm text-slate-800 dark:text-slate-200 flex-shrink-0">
                                                        {trophyEmoji}
                                                    </div>

                                                    {/* Image */}
                                                    {item.imageUrl ? (
                                                        <img
                                                            src={item.imageUrl}
                                                            alt={item.name}
                                                            className="w-14 h-14 rounded-lg object-cover border border-slate-200 dark:border-slate-700 flex-shrink-0"
                                                        />
                                                    ) : (
                                                        <div className="w-14 h-14 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 flex-shrink-0">
                                                            <PackageIcon className="w-6 h-6" />
                                                        </div>
                                                    )}

                                                    {/* Content */}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base truncate">
                                                                {item.name}
                                                            </h4>
                                                            <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded font-semibold">
                                                                {item.category}
                                                            </span>
                                                            <span className="text-[10px] font-mono px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded font-bold">
                                                                {item.color} / {item.size}
                                                            </span>
                                                        </div>

                                                        {/* Turnaround speed banner */}
                                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold shadow-2xs ${
                                                                item.speedRankCategory === 'super_fast'
                                                                    ? 'bg-amber-400 text-slate-950'
                                                                    : item.speedRankCategory === 'fast'
                                                                    ? 'bg-emerald-500 text-white'
                                                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                                            }`}>
                                                                {item.speedBadgeText}
                                                            </span>

                                                            {item.daysFromPurchaseToFirstSale !== null && (
                                                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                                    ⚡ ખરીદી પછી <strong className="text-indigo-600 dark:text-indigo-400">{item.daysFromPurchaseToFirstSale === 0 ? 'તે જ દિવસે' : `${item.daysFromPurchaseToFirstSale} દિવસમાં`}</strong> વેચાણ શરૂ થયું!
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Timeline info */}
                                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-mono">
                                                            <span>ખરીદી: <strong>{formatDate(item.firstPurchaseDate)}</strong></span>
                                                            {item.firstSaleDate && <span>પ્રથમ વેચાણ: <strong>{formatDate(item.firstSaleDate)}</strong></span>}
                                                            {item.latestSaleDate && <span>છેલ્લું વેચાણ: <strong>{formatDate(item.latestSaleDate)}</strong></span>}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right Side Stats */}
                                                <div className="flex items-center justify-between md:justify-end gap-5 w-full md:w-auto border-t md:border-t-0 pt-2 md:pt-0 border-slate-200 dark:border-slate-700">
                                                    <div className="text-left md:text-right">
                                                        <span className="text-[10px] text-slate-500 uppercase font-semibold">કુલ વેચાણ</span>
                                                        <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                                                            {item.totalSold} <span className="text-xs font-normal text-slate-500">pcs</span>
                                                        </p>
                                                        <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                                            {item.dailySalesVelocity.toFixed(1)} pcs/દિવસ
                                                        </p>
                                                    </div>

                                                    <div className="text-left md:text-right">
                                                        <span className="text-[10px] text-slate-500 uppercase font-semibold">બાકી સ્ટોક</span>
                                                        <p className={`text-base sm:text-lg font-black ${item.currentStock <= 2 ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
                                                            {item.currentStock} <span className="text-xs font-normal text-slate-500">pcs</span>
                                                        </p>
                                                        <p className="text-[10px] text-slate-400">
                                                            {item.currentStock === 0 ? 'Out of stock' : 'ઉપલબ્ધ છે'}
                                                        </p>
                                                    </div>

                                                    <div className="text-right pl-3 border-l border-slate-200 dark:border-slate-700">
                                                        <span className="text-[10px] text-slate-500 uppercase font-semibold">નફો / આવક</span>
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                                                            {formatCurrency(item.totalRevenue)}
                                                        </p>
                                                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                                            +{formatCurrency(item.totalProfit)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ======================================================== */}
                    {/* TAB 2: STOCK AGEING (DAYS MATERIAL SITTING IN SHOP)      */}
                    {/* ======================================================== */}
                    {activeTab === 'stock_ageing' && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium px-1">
                                <span>હાલમાં ઉપલબ્ધ સ્ટોક અને કેટલા દિવસથી દુકાનમાં પડ્યો છે તેની વિગત</span>
                                <span>કુલ: {filteredStockAgeing.length} વેરિઅન્ટ્સ ઉપલબ્ધ</span>
                            </div>

                            {filteredStockAgeing.length === 0 ? (
                                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500">
                                    <p className="text-sm">કોઈ સ્ટોક રેકોર્ડ મળ્યો નથી.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3">
                                    {filteredStockAgeing.map((item) => {
                                        return (
                                            <div
                                                key={item.variantId}
                                                className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                                                    item.ageCategory === 'old'
                                                        ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800'
                                                        : item.ageCategory === 'moderate'
                                                        ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                                                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
                                                }`}
                                            >
                                                {/* Left Info & Image */}
                                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                                    {/* Age Counter Pill */}
                                                    <div className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center p-1 border shadow-xs flex-shrink-0 ${
                                                        item.ageCategory === 'old'
                                                            ? 'bg-rose-100 dark:bg-rose-900/60 border-rose-300 text-rose-700 dark:text-rose-200'
                                                            : item.ageCategory === 'moderate'
                                                            ? 'bg-amber-100 dark:bg-amber-900/60 border-amber-300 text-amber-700 dark:text-amber-200'
                                                            : 'bg-emerald-100 dark:bg-emerald-900/60 border-emerald-300 text-emerald-700 dark:text-emerald-200'
                                                    }`}>
                                                        <span className="text-lg font-black leading-none">
                                                            {item.daysInStock}
                                                        </span>
                                                        <span className="text-[10px] font-bold uppercase mt-0.5">
                                                            દિવસ
                                                        </span>
                                                    </div>

                                                    {/* Image */}
                                                    {item.imageUrl ? (
                                                        <img
                                                            src={item.imageUrl}
                                                            alt={item.name}
                                                            className="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700 flex-shrink-0"
                                                        />
                                                    ) : (
                                                        <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 flex-shrink-0">
                                                            <PackageIcon className="w-6 h-6" />
                                                        </div>
                                                    )}

                                                    {/* Content */}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base truncate">
                                                                {item.name}
                                                            </h4>
                                                            <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded font-semibold">
                                                                {item.category}
                                                            </span>
                                                            <span className="text-[10px] font-mono px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded font-bold">
                                                                {item.color} / {item.size}
                                                            </span>
                                                        </div>

                                                        {/* Age Status Banner & Suggestion */}
                                                        <div className="mt-1.5 text-xs">
                                                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                                                                {item.suggestionGujarati}
                                                            </p>
                                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                                                                ખરીદી તારીખ: <strong>{formatDate(item.firstPurchaseDate)}</strong> | આજ સુધીના દિવસો: <strong className="text-slate-900 dark:text-white">{item.daysInStock} દિવસ</strong>
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right Side Numbers */}
                                                <div className="flex items-center justify-between md:justify-end gap-5 w-full md:w-auto border-t md:border-t-0 pt-2 md:pt-0 border-slate-200 dark:border-slate-700">
                                                    <div className="text-left md:text-right">
                                                        <span className="text-[10px] text-slate-500 uppercase font-semibold">હાજર સ્ટોક</span>
                                                        <p className="text-lg font-black text-slate-900 dark:text-white">
                                                            {item.currentStock} <span className="text-xs font-normal text-slate-500">pcs</span>
                                                        </p>
                                                        <p className="text-[10px] text-slate-400">
                                                            રેટ: {formatCurrency(item.avgCost)}/pc
                                                        </p>
                                                    </div>

                                                    <div className="text-right pl-3 border-l border-slate-200 dark:border-slate-700">
                                                        <span className="text-[10px] text-slate-500 uppercase font-semibold">રોકાયેલી મૂડી</span>
                                                        <p className="text-base font-black text-slate-900 dark:text-white">
                                                            {formatCurrency(item.capitalBlocked)}
                                                        </p>
                                                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                                            વેચાણ મૂલ્ય: {formatCurrency(item.currentStock * item.sellingPrice)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ======================================================== */}
                    {/* TAB 3: PURCHASE TO SALE TIMELINE BATCHES                 */}
                    {/* ======================================================== */}
                    {activeTab === 'turnaround_batches' && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium px-1">
                                <span>દરેક ખરીદી બેચની વિગત: ક્યારે ખરીદ્યું, ક્યારે વેચાયું અને કેટલા દિવસમાં વેચાઈ ગયું</span>
                                <span>કુલ: {filteredBatches.length} બેચ રેકોર્ડ્સ</span>
                            </div>

                            {filteredBatches.length === 0 ? (
                                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500">
                                    <p className="text-sm">કોઈ ખરીદી બેચ રેકોર્ડ મળ્યો નથી.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3">
                                    {filteredBatches.map((batch) => {
                                        return (
                                            <div
                                                key={batch.id}
                                                className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                                                    batch.status === 'fully_sold'
                                                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                                                        : batch.status === 'selling_active'
                                                        ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-300 dark:border-blue-800'
                                                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
                                                }`}
                                            >
                                                {/* Left Details */}
                                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                                    {batch.imageUrl ? (
                                                        <img
                                                            src={batch.imageUrl}
                                                            alt={batch.name}
                                                            className="w-14 h-14 rounded-lg object-cover border border-slate-200 dark:border-slate-700 flex-shrink-0"
                                                        />
                                                    ) : (
                                                        <div className="w-14 h-14 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 flex-shrink-0">
                                                            <PackageIcon className="w-6 h-6" />
                                                        </div>
                                                    )}

                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base truncate">
                                                                {batch.name}
                                                            </h4>
                                                            <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded font-semibold">
                                                                {batch.category}
                                                            </span>
                                                            <span className="text-[10px] font-mono px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded font-bold">
                                                                {batch.color} / {batch.size}
                                                            </span>
                                                            <span className="text-[10px] font-mono text-slate-500">
                                                                વેન્ડર: {batch.vendorName}
                                                            </span>
                                                        </div>

                                                        {/* Status & Exact Turnaround Days */}
                                                        <div className="mt-2 text-xs">
                                                            {batch.status === 'fully_sold' && (
                                                                <p className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                                                    <span>✅ સંપૂર્ણ વેચાઈ ગયું:</span>
                                                                    <span>
                                                                        {batch.daysToFullSellout !== null
                                                                            ? `માત્ર ${batch.daysToFullSellout === 0 ? 'તે જ દિવસે' : `${batch.daysToFullSellout} દિવસમાં`} આખી બેચ (${batch.purchaseQty} pcs) વેચાઈ ગઈ!`
                                                                            : `${batch.purchaseQty} pcs સંપૂર્ણ વેચાઈ ગયા.`}
                                                                    </span>
                                                                </p>
                                                            )}

                                                            {batch.status === 'selling_active' && (
                                                                <p className="font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1">
                                                                    <span>🔥 ચાલુ વેચાણ:</span>
                                                                    <span>
                                                                        {batch.purchaseQty} માંથી <strong>{batch.soldQty} pcs</strong> વેચાયા ({batch.daysToFirstSale !== null ? `${batch.daysToFirstSale} દિવસમાં શરૂ થયું` : ''}), હજુ <strong>{batch.remainingQty} pcs</strong> બાકી.
                                                                    </span>
                                                                </p>
                                                            )}

                                                            {batch.status === 'in_stock_unsold' && (
                                                                <p className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                                                                    <span>⏳ દુકાનમાં ઉપલબ્ધ:</span>
                                                                    <span>
                                                                        ખરીદીને <strong>{batch.daysActive} દિવસ</strong> થયા છે. આખી બેચ ({batch.purchaseQty} pcs) ઉપલબ્ધ છે.
                                                                    </span>
                                                                </p>
                                                            )}

                                                            {/* Date Timeline Badges */}
                                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-500 dark:text-slate-400 mt-1 font-mono text-[11px]">
                                                                <span>📅 ખરીદી: <strong>{formatDate(batch.purchaseDate)}</strong></span>
                                                                {batch.firstSaleDate && <span>🛒 1st Sale: <strong>{formatDate(batch.firstSaleDate)}</strong></span>}
                                                                {batch.lastSaleDate && <span>🏁 Last Sale: <strong>{formatDate(batch.lastSaleDate)}</strong></span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right Numbers */}
                                                <div className="flex items-center justify-between md:justify-end gap-5 w-full md:w-auto border-t md:border-t-0 pt-2 md:pt-0 border-slate-200 dark:border-slate-700">
                                                    <div className="text-left md:text-right">
                                                        <span className="text-[10px] text-slate-500 uppercase font-semibold">જથ્થો (Qty)</span>
                                                        <p className="text-base font-black text-slate-900 dark:text-white">
                                                            {batch.soldQty} / {batch.purchaseQty} <span className="text-xs font-normal text-slate-500">pcs</span>
                                                        </p>
                                                        <p className="text-[10px] text-slate-400">
                                                            બાકી: {batch.remainingQty} pcs
                                                        </p>
                                                    </div>

                                                    <div className="text-right pl-3 border-l border-slate-200 dark:border-slate-700">
                                                        <span className="text-[10px] text-slate-500 uppercase font-semibold">ભાવ / નફો</span>
                                                        <p className="text-xs font-mono text-slate-600 dark:text-slate-300">
                                                            Buy: {formatCurrency(batch.purchasePrice)} | Sell: {formatCurrency(batch.sellingPrice)}
                                                        </p>
                                                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                                            નફો: +{formatCurrency(batch.profitGenerated)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                </div>

                {/* MODAL FOOTER */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 flex flex-wrap justify-between items-center gap-3 print:hidden">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                        💡 આ ડેટાના આધારે તમે કયો માલ ઝડપથી ફરી ઓર્ડર કરવો અને કયા જૂના માલને ડિસ્કાઉન્ટ આપવું તે સહેલાઈથી નક્કી કરી શકો છો.
                    </div>

                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors"
                    >
                        Close Window
                    </button>
                </div>

            </div>
        </div>
    );
};
