import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { DashboardData, InvoiceLineItem, CustomerDetails, Invoice, Branch, Settings } from '../types';
import { ScanIcon } from './icons/ScanIcon';
import { TrashIcon } from './icons/TrashIcon';
import { SearchIcon } from './icons/SearchIcon';
import { XIcon } from './icons/XIcon';
import QrScanner from './QrScanner';
import PosReceiptSlipModal from './PosReceiptSlipModal';

interface CompactPosBillingProps {
    isOpen: boolean;
    onClose: () => void;
    inventoryItems: DashboardData[];
    activeBranch: Branch | null;
    settings: Settings;
    businessLogo: string | null;
    onCompletePosSale: (invoiceData: Omit<Invoice, 'id' | 'date'>) => Promise<Invoice>;
    isProcessing: boolean;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
    }).format(amount);
};

export const CompactPosBilling: React.FC<CompactPosBillingProps> = ({
    isOpen,
    onClose,
    inventoryItems,
    activeBranch,
    settings,
    businessLogo,
    onCompletePosSale,
    isProcessing,
}) => {
    const searchInputRef = useRef<HTMLInputElement>(null);
    const cashInputRef = useRef<HTMLInputElement>(null);

    // State for Search and Filter
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [isScanning, setIsScanning] = useState(false);

    // Customer state (Default to Walk-in Customer)
    const [customerName, setCustomerName] = useState('Walk-in Customer');
    const [customerMobile, setCustomerMobile] = useState('');
    const [isCustomCustomer, setIsCustomCustomer] = useState(false);

    // Cart Line Items
    const [cart, setCart] = useState<InvoiceLineItem[]>([]);

    // Discount and Tax
    const [discountType, setDiscountType] = useState<'rupees' | 'percentage'>('percentage');
    const [discountValue, setDiscountValue] = useState<number>(0);
    const [taxRate, setTaxRate] = useState<number>(activeBranch?.taxRate ?? 5);

    // Payment state
    const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card' | 'Credit'>('Cash');
    const [cashTendered, setCashTendered] = useState<string>('');

    // Receipt Modal state
    const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null);
    const [showReceiptModal, setShowReceiptModal] = useState(false);

    // Sync default branch tax rate when activeBranch changes
    useEffect(() => {
        if (activeBranch?.taxRate !== undefined) {
            setTaxRate(activeBranch.taxRate);
        }
    }, [activeBranch]);

    // Categories list for fast filter
    const categories = useMemo(() => {
        const set = new Set<string>();
        inventoryItems.forEach(item => {
            if (item.category) set.add(item.category);
        });
        return ['All', ...Array.from(set)];
    }, [inventoryItems]);

    // Filtered inventory catalog
    const filteredItems = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        return inventoryItems.filter(item => {
            const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
            if (!matchesCat) return false;
            if (!q) return true;

            const nameMatch = item.name.toLowerCase().includes(q);
            const variantMatch = item.color.toLowerCase().includes(q) || item.size.toLowerCase().includes(q);
            const catMatch = item.category?.toLowerCase().includes(q);
            const subCatMatch = item.subCategory?.toLowerCase().includes(q);
            const variantIdMatch = item.variantId?.toLowerCase().includes(q);

            return nameMatch || variantMatch || catMatch || subCatMatch || variantIdMatch;
        });
    }, [inventoryItems, searchTerm, selectedCategory]);

    // Cart calculations
    const subtotal = useMemo(() => {
        return cart.reduce((sum, item) => sum + item.total, 0);
    }, [cart]);

    const discountAmount = useMemo(() => {
        if (discountType === 'percentage') {
            return (subtotal * (discountValue || 0)) / 100;
        }
        return Math.min(subtotal, discountValue || 0);
    }, [subtotal, discountType, discountValue]);

    const taxableAmount = Math.max(0, subtotal - discountAmount);

    const taxAmount = useMemo(() => {
        return (taxableAmount * (taxRate || 0)) / 100;
    }, [taxableAmount, taxRate]);

    const finalTotal = useMemo(() => {
        return Math.max(0, Math.round(taxableAmount + taxAmount));
    }, [taxableAmount, taxAmount]);

    const changeAmount = useMemo(() => {
        const tendered = parseFloat(cashTendered) || 0;
        return Math.max(0, tendered - finalTotal);
    }, [cashTendered, finalTotal]);

    // Focus search on open
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        }
    }, [isOpen]);

    // Global keyboard shortcuts for POS
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if in input except specific triggers
            if (e.key === 'F2') {
                e.preventDefault();
                searchInputRef.current?.focus();
            } else if (e.key === 'Escape' && !isScanning && !showReceiptModal) {
                // If cart is empty, close POS, else ask/clear cart
                if (cart.length === 0) {
                    onClose();
                } else if (confirm("Clear current POS cart?")) {
                    resetPos();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, cart, isScanning, showReceiptModal, onClose]);

    if (!isOpen) return null;

    // Add item to cart
    const handleAddToCart = (item: DashboardData) => {
        const effectivePrice = item.sellingPrice || item.saleRealPrice || item.avgSalePrice || 0;
        
        setCart(prev => {
            const existingIndex = prev.findIndex(ci => ci.id === item.variantId);
            if (existingIndex > -1) {
                const updated = [...prev];
                const existing = updated[existingIndex];
                const newQty = existing.quantity + 1;
                updated[existingIndex] = {
                    ...existing,
                    quantity: newQty,
                    total: newQty * existing.price,
                };
                return updated;
            } else {
                const newLine: InvoiceLineItem = {
                    id: item.variantId,
                    name: item.name,
                    color: item.color,
                    size: item.size,
                    quantity: 1,
                    price: effectivePrice,
                    total: effectivePrice,
                };
                return [...prev, newLine];
            }
        });
    };

    // Update quantity in cart
    const handleUpdateQuantity = (variantId: string, delta: number) => {
        setCart(prev => {
            return prev.map(item => {
                if (item.id === variantId) {
                    const newQty = Math.max(1, item.quantity + delta);
                    return {
                        ...item,
                        quantity: newQty,
                        total: newQty * item.price,
                    };
                }
                return item;
            });
        });
    };

    const handleSetQuantity = (variantId: string, quantity: number) => {
        const qty = Math.max(1, quantity || 1);
        setCart(prev => {
            return prev.map(item => {
                if (item.id === variantId) {
                    return {
                        ...item,
                        quantity: qty,
                        total: qty * item.price,
                    };
                }
                return item;
            });
        });
    };

    const handleSetPrice = (variantId: string, price: number) => {
        const p = Math.max(0, price || 0);
        setCart(prev => {
            return prev.map(item => {
                if (item.id === variantId) {
                    return {
                        ...item,
                        price: p,
                        total: item.quantity * p,
                    };
                }
                return item;
            });
        });
    };

    const handleRemoveLine = (variantId: string) => {
        setCart(prev => prev.filter(item => item.id !== variantId));
    };

    const resetPos = () => {
        setCart([]);
        setDiscountValue(0);
        setPaymentMethod('Cash');
        setCashTendered('');
        setCustomerName('Walk-in Customer');
        setCustomerMobile('');
        setIsCustomCustomer(false);
        setSearchTerm('');
        searchInputRef.current?.focus();
    };

    // Barcode / QR Scan handler
    const handleQrScanSuccess = (decodedText: string) => {
        setIsScanning(false);
        try {
            const parsed = JSON.parse(decodedText);
            const found = inventoryItems.find(i => 
                i.variantId === parsed.variantId || 
                (i.name === parsed.name && i.color === parsed.color && i.size === parsed.size)
            );
            if (found) {
                handleAddToCart(found);
            } else {
                alert(`Scanned item "${parsed.name || decodedText}" not found in current branch catalog.`);
            }
        } catch {
            const found = inventoryItems.find(i => 
                i.variantId.toLowerCase() === decodedText.toLowerCase() ||
                i.name.toLowerCase().includes(decodedText.toLowerCase())
            );
            if (found) {
                handleAddToCart(found);
            } else {
                setSearchTerm(decodedText);
            }
        }
    };

    // Complete POS Sale
    const handlePayAndComplete = async () => {
        if (cart.length === 0) {
            alert("Cart is empty! Add at least one item to proceed.");
            return;
        }

        const invoicePrefix = activeBranch?.invoicePrefix || settings.invoicePrefix || 'INV-';
        const nextNum = settings.invoiceNextNumber || 1;
        const invoiceNumber = `${invoicePrefix}${nextNum}`;

        const customer: CustomerDetails = {
            name: isCustomCustomer ? (customerName.trim() || 'Walk-in Customer') : 'Walk-in Customer',
            mobile: customerMobile.trim() || undefined,
        };

        const tenderedNum = parseFloat(cashTendered) || finalTotal;

        const payload: Omit<Invoice, 'id' | 'date'> = {
            invoiceNumber,
            status: 'Paid',
            customer,
            items: cart,
            subtotal,
            discountType,
            discountValue,
            discountAmount,
            taxRate,
            taxAmount,
            total: finalTotal,
            branchId: activeBranch?.id || 'main',
            paymentMethod,
            amountReceived: paymentMethod === 'Cash' ? tenderedNum : finalTotal,
            changeAmount: paymentMethod === 'Cash' ? Math.max(0, tenderedNum - finalTotal) : 0,
            notes: `POS Instant Sale • [${activeBranch?.code || 'MAIN'}]`,
        };

        try {
            const created = await onCompletePosSale(payload);
            setCompletedInvoice(created);
            setShowReceiptModal(true);
            resetPos();
        } catch (error: any) {
            console.error("POS Sale error:", error);
            alert("Failed to complete sale: " + (error?.message || 'Unknown error'));
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-7xl h-[94vh] max-h-[94vh] border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-100">
                {/* 1:1 POS Top Header */}
                <header className="px-4 py-2.5 bg-white dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-2">
                    <div className="flex items-center gap-3">
                        <div className="px-2.5 py-1 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg flex items-center gap-1.5 shadow-sm">
                            <span className="text-xs font-black tracking-wider">⚡ POS TERMINAL 1:1</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                            <span className="font-semibold text-slate-500 dark:text-slate-400">Branch:</span>
                            <span className="font-mono font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                                {activeBranch?.code || 'MB-01'} • {activeBranch?.name || 'Main Branch'}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsScanning(true)}
                            className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-indigo-200 dark:border-indigo-800"
                            title="Scan Barcode / QR Code"
                        >
                            <ScanIcon className="w-4 h-4" />
                            <span className="hidden sm:inline">Scan QR</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            title="Close POS (Esc)"
                        >
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                {/* 1:1 Layout Body (Catalog on Left, Compact Single-Customer Billing Ticket on Right) */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
                    {/* LEFT: Fast Item Catalog & Quick Search (7 cols) */}
                    <div className="lg:col-span-7 flex flex-col h-full border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 overflow-hidden">
                        {/* Search & Category Pills */}
                        <div className="p-3 border-b border-slate-100 dark:border-slate-800 space-y-2">
                            <div className="relative">
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="Search item, color, size, category or press F2..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            {/* Category filter pills */}
                            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                                            selectedCategory === cat
                                                ? 'bg-indigo-600 text-white shadow-sm'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Items Grid */}
                        <div className="flex-1 p-3 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 content-start">
                            {filteredItems.length === 0 ? (
                                <div className="col-span-full py-16 text-center text-slate-400 dark:text-slate-500">
                                    <p className="text-sm font-semibold">No items match "{searchTerm}"</p>
                                    <p className="text-xs mt-1">Try a different search or clear category filters.</p>
                                </div>
                            ) : (
                                filteredItems.map(item => {
                                    const price = item.sellingPrice || item.saleRealPrice || item.avgSalePrice || 0;
                                    const inCart = cart.find(ci => ci.id === item.variantId);
                                    const isOutOfStock = item.stock <= 0;

                                    return (
                                        <button
                                            key={item.variantId}
                                            type="button"
                                            onClick={() => handleAddToCart(item)}
                                            className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all relative group ${
                                                inCart
                                                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-sm ring-1 ring-indigo-500/30'
                                                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:border-indigo-400 hover:shadow-md'
                                            } ${isOutOfStock ? 'opacity-70 bg-slate-50 dark:bg-slate-850' : ''}`}
                                        >
                                            {inCart && (
                                                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-md">
                                                    {inCart.quantity}
                                                </span>
                                            )}

                                            <div>
                                                <div className="flex justify-between items-start gap-1">
                                                    <span className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                                        {item.name}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium">
                                                        {item.color}
                                                    </span>
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium">
                                                        {item.size}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-750 flex items-center justify-between">
                                                <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
                                                    ₹{price}
                                                </span>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                                    isOutOfStock 
                                                        ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40' 
                                                        : item.stock < 5 
                                                            ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40' 
                                                            : 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
                                                }`}>
                                                    {item.stock} left
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* RIGHT: Compact 1:1 POS Billing Ticket (5 cols) */}
                    <div className="lg:col-span-5 flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
                        {/* Customer Bar */}
                        <div className="p-3 bg-white dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Customer
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setIsCustomCustomer(!isCustomCustomer)}
                                    className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                                >
                                    {isCustomCustomer ? 'Switch to Walk-in' : '+ Add Customer Details'}
                                </button>
                            </div>

                            {isCustomCustomer ? (
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="text"
                                        placeholder="Customer Name"
                                        value={customerName}
                                        onChange={e => setCustomerName(e.target.value)}
                                        className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                    <input
                                        type="tel"
                                        placeholder="Mobile (for WhatsApp)"
                                        value={customerMobile}
                                        onChange={e => setCustomerMobile(e.target.value)}
                                        className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                            ) : (
                                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                                    <span>👤 Walk-in Customer</span>
                                    <span className="text-[10px] text-slate-400 font-normal">Quick Checkout</span>
                                </div>
                            )}
                        </div>

                        {/* Cart Items List */}
                        <div className="flex-1 p-3 overflow-y-auto space-y-2">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 py-10">
                                    <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xl mb-2">
                                        🛒
                                    </div>
                                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Cart is empty</p>
                                    <p className="text-xs text-center mt-0.5">Click or scan catalog items to build 1:1 ticket.</p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div
                                        key={item.id}
                                        className="p-2.5 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-2"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                                {item.name}
                                            </p>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                                {item.color} • {item.size} • ₹{item.price}/ea
                                            </p>
                                        </div>

                                        {/* Qty Buttons */}
                                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateQuantity(item.id, -1)}
                                                className="w-6 h-6 rounded flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs transition-colors"
                                            >
                                                -
                                            </button>
                                            <input
                                                type="number"
                                                min="1"
                                                value={item.quantity}
                                                onChange={e => handleSetQuantity(item.id, parseInt(e.target.value) || 1)}
                                                className="w-8 text-center text-xs font-bold bg-transparent outline-none text-slate-900 dark:text-white"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateQuantity(item.id, 1)}
                                                className="w-6 h-6 rounded flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs transition-colors"
                                            >
                                                +
                                            </button>
                                        </div>

                                        {/* Item Total */}
                                        <div className="text-right min-w-[60px]">
                                            <span className="text-xs font-black text-slate-900 dark:text-white font-mono">
                                                ₹{item.total}
                                            </span>
                                        </div>

                                        {/* Remove line */}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveLine(item.id)}
                                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                                            title="Remove Item"
                                        >
                                            <TrashIcon className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Real-time Calculation Panel & Payment */}
                        <div className="p-3.5 bg-white dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 space-y-2.5 shadow-lg">
                            {/* Live Subtotal, Discount & Tax */}
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                    <span>Subtotal ({cart.reduce((s, i) => s + i.quantity, 0)} items):</span>
                                    <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(subtotal)}</span>
                                </div>

                                {/* Discount input row */}
                                <div className="flex items-center justify-between gap-2 py-0.5">
                                    <div className="flex items-center gap-1">
                                        <span className="text-slate-600 dark:text-slate-400">Discount:</span>
                                        <div className="flex rounded-md bg-slate-100 dark:bg-slate-800 p-0.5 text-[10px]">
                                            <button
                                                type="button"
                                                onClick={() => setDiscountType('percentage')}
                                                className={`px-1.5 py-0.5 rounded font-bold ${discountType === 'percentage' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400'}`}
                                            >
                                                %
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDiscountType('rupees')}
                                                className={`px-1.5 py-0.5 rounded font-bold ${discountType === 'rupees' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400'}`}
                                            >
                                                ₹
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        {[0, 5, 10, 15].map(p => (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => {
                                                    setDiscountType('percentage');
                                                    setDiscountValue(p);
                                                }}
                                                className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                                    discountType === 'percentage' && discountValue === p
                                                        ? 'bg-emerald-100 dark:bg-emerald-900/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold'
                                                        : 'border-slate-200 dark:border-slate-700 text-slate-500'
                                                }`}
                                            >
                                                {p}%
                                            </button>
                                        ))}
                                        <input
                                            type="number"
                                            min="0"
                                            value={discountValue || ''}
                                            placeholder="0"
                                            onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
                                            className="w-12 px-1.5 py-0.5 text-right font-bold text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                                        />
                                        {discountAmount > 0 && (
                                            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs ml-1">
                                                -{formatCurrency(discountAmount)}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Tax / GST row */}
                                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 py-0.5">
                                    <div className="flex items-center gap-1">
                                        <span>GST / Tax:</span>
                                        <div className="flex gap-1 text-[10px]">
                                            {[0, 5, 12, 18].map(rate => (
                                                <button
                                                    key={rate}
                                                    type="button"
                                                    onClick={() => setTaxRate(rate)}
                                                    className={`px-1.5 py-0.5 rounded border ${
                                                        taxRate === rate
                                                            ? 'bg-indigo-100 dark:bg-indigo-900/60 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-bold'
                                                            : 'border-slate-200 dark:border-slate-700 text-slate-500'
                                                    }`}
                                                >
                                                    {rate}%
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <span className="font-semibold text-slate-900 dark:text-white">
                                        {taxAmount > 0 ? `+${formatCurrency(taxAmount)}` : '₹0.00'}
                                    </span>
                                </div>
                            </div>

                            {/* Payment Method Pills */}
                            <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                                <div className="grid grid-cols-4 gap-1.5 mb-2">
                                    {(['Cash', 'UPI', 'Card', 'Credit'] as const).map(mode => (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => setPaymentMethod(mode)}
                                            className={`py-1 text-xs font-bold rounded-lg border transition-all ${
                                                paymentMethod === mode
                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                                            }`}
                                        >
                                            {mode === 'Cash' && '💵 '}
                                            {mode === 'UPI' && '📱 '}
                                            {mode === 'Card' && '💳 '}
                                            {mode === 'Credit' && '📝 '}
                                            {mode}
                                        </button>
                                    ))}
                                </div>

                                {paymentMethod === 'Cash' && (
                                    <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 mb-2">
                                        <div className="flex items-center gap-1.5 text-xs">
                                            <span className="text-slate-600 dark:text-slate-400 font-semibold">Tendered:</span>
                                            <input
                                                ref={cashInputRef}
                                                type="number"
                                                placeholder={String(finalTotal)}
                                                value={cashTendered}
                                                onChange={e => setCashTendered(e.target.value)}
                                                className="w-20 px-2 py-0.5 text-xs font-bold rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                            />
                                        </div>
                                        <div className="text-xs">
                                            <span className="text-slate-500 dark:text-slate-400 mr-1">Change:</span>
                                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                                {formatCurrency(changeAmount)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Grand Total Bar & Pay Button */}
                            <div className="flex items-center justify-between pt-1">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        Total Payable
                                    </p>
                                    <p className="text-2xl font-black text-slate-950 dark:text-white tracking-tight font-mono">
                                        {formatCurrency(finalTotal)}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={resetPos}
                                        className="px-3 py-2.5 text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors"
                                        title="Clear Cart (Esc)"
                                    >
                                        Clear
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handlePayAndComplete}
                                        disabled={isProcessing || cart.length === 0}
                                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all transform active:scale-95"
                                    >
                                        {isProcessing ? (
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <>
                                                <span>⚡ Pay & Print Slip</span>
                                                <span className="text-[11px] opacity-80 font-normal">(Enter)</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* QR Scanner Modal */}
            {isScanning && (
                <QrScanner
                    onScanSuccess={handleQrScanSuccess}
                    onClose={() => setIsScanning(false)}
                />
            )}

            {/* Receipt Preview Slip Modal */}
            <PosReceiptSlipModal
                isOpen={showReceiptModal}
                onClose={() => setShowReceiptModal(false)}
                onStartNewSale={resetPos}
                invoice={completedInvoice}
                branch={activeBranch}
                settings={settings}
                businessLogo={businessLogo}
            />
        </div>
    );
};

export default CompactPosBilling;
