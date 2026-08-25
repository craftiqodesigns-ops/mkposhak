import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { DashboardData, InvoiceLineItem, CustomerDetails, Invoice, Settings } from '../types';
import { XIcon } from './icons/XIcon';
import { ScanIcon } from './icons/ScanIcon';
import QrScanner from './QrScanner';
import { TrashIcon } from './icons/TrashIcon';

interface InvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    inventoryItems: DashboardData[];
    onCreateInvoice: (invoice: Omit<Invoice, 'id' | 'date'>) => Promise<void>;
    onUpdateInvoice: (invoiceId: string, invoice: Omit<Invoice, 'id' | 'date'>) => Promise<void>;
    invoiceToEdit: Invoice | null;
    settings: Settings;
    isProcessing: boolean;
    initialItems?: DashboardData[];
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
    }).format(amount);
};

const toInputDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// --- Utility Functions ---
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    
    const debounced = (...args: Parameters<F>) => {
        if (timeout !== null) {
            clearTimeout(timeout);
            timeout = null;
        }
        timeout = setTimeout(() => func(...args), waitFor);
    };
    
    return debounced;
}


const InvoiceModal: React.FC<InvoiceModalProps> = ({ isOpen, onClose, inventoryItems, onCreateInvoice, onUpdateInvoice, invoiceToEdit, settings, isProcessing, initialItems }) => {
    const isEditing = !!invoiceToEdit;
    const DRAFT_KEY = 'invoiceDraft';

    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [customer, setCustomer] = useState<CustomerDetails>({ name: '', mobile: '', address: '' });
    const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
    const [discountType, setDiscountType] = useState<'rupees' | 'percentage'>('rupees');
    const [discountValue, setDiscountValue] = useState<string>('0');
    const [notes, setNotes] = useState('');
    const [status, setStatus] = useState<'Paid' | 'Pending'>('Pending');
    const [dueDate, setDueDate] = useState<string>('');
    const [isScanning, setIsScanning] = useState(false);
    const [draftAvailable, setDraftAvailable] = useState(false);
    
    const inventoryMap = useMemo(() => new Map(inventoryItems.map(item => [item.variantId, item])), [inventoryItems]);

    const groupedInventoryItems = useMemo(() => {
        const grouped = new Map<string, { name: string; variants: DashboardData[] }>();
        inventoryItems.forEach(item => {
            if (!grouped.has(item.id)) {
                grouped.set(item.id, { name: item.name, variants: [] });
            }
            grouped.get(item.id)!.variants.push(item);
        });
        // Sort variants within each group for consistency
        grouped.forEach(group => {
            group.variants.sort((a, b) => a.color.localeCompare(b.color) || a.size.localeCompare(b.size));
        });
        return Array.from(grouped.values()).sort((a,b) => a.name.localeCompare(b.name));
    }, [inventoryItems]);

    const resetForm = (clearDraft = false) => {
         const nextNumber = `${settings.invoicePrefix || 'INV-'}${settings.invoiceNextNumber || 1}`;
        const defaultDueDate = new Date();
        defaultDueDate.setDate(defaultDueDate.getDate() + 30);

        setInvoiceNumber(nextNumber);
        setCustomer({ name: '', mobile: '', address: '' });
        setLineItems([]);
        setDiscountType('rupees');
        setDiscountValue('0');
        setNotes(settings.defaultGreeting || '');
        setStatus('Pending');
        setDueDate(toInputDateString(defaultDueDate));
        if (clearDraft) {
            localStorage.removeItem(DRAFT_KEY);
        }
    }

    // --- Draft Management ---
    const debouncedSaveDraft = useRef(
        debounce((data: any) => {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
        }, 500)
    ).current;
    
    // Check for draft when modal opens
    useEffect(() => {
        if (isOpen && !isEditing && (!initialItems || initialItems.length === 0)) {
            const savedDraft = localStorage.getItem(DRAFT_KEY);
            if (savedDraft) {
                const draftData = JSON.parse(savedDraft);
                if (draftData.lineItems.length > 0 || draftData.customer.name) {
                    setDraftAvailable(true);
                }
            }
        } else if (!isOpen) {
            setDraftAvailable(false);
        }
    }, [isOpen, isEditing, initialItems]);

    // Auto-save draft on changes
    useEffect(() => {
        if (isOpen && !isEditing) {
            const hasData = lineItems.length > 0 || customer.name.trim() || customer.mobile?.trim() || customer.address?.trim();
            if(hasData) {
                const draftData = { customer, lineItems, discountType, discountValue, notes, status, dueDate };
                debouncedSaveDraft(draftData);
            } else {
                 localStorage.removeItem(DRAFT_KEY);
            }
        }
    }, [customer, lineItems, discountType, discountValue, notes, status, dueDate, isOpen, isEditing, debouncedSaveDraft]);

    const handleRestoreDraft = () => {
        const savedDraft = localStorage.getItem(DRAFT_KEY);
        if (savedDraft) {
            const draftData = JSON.parse(savedDraft);
            setCustomer(draftData.customer);
            setLineItems(draftData.lineItems);
            setDiscountType(draftData.discountType);
            setDiscountValue(draftData.discountValue);
            setNotes(draftData.notes);
            setStatus(draftData.status);
            setDueDate(draftData.dueDate);
        }
        setDraftAvailable(false);
    };

    const handleDismissDraft = () => {
        localStorage.removeItem(DRAFT_KEY);
        setDraftAvailable(false);
        resetForm();
    };

    useEffect(() => {
        if (isOpen) {
            if (isEditing && invoiceToEdit) {
                setInvoiceNumber(invoiceToEdit.invoiceNumber);
                setCustomer(invoiceToEdit.customer);
                setLineItems(invoiceToEdit.items);
                setDiscountType(invoiceToEdit.discountType);
                setDiscountValue(String(invoiceToEdit.discountValue));
                setNotes(invoiceToEdit.notes || '');
                setStatus(invoiceToEdit.status);
                setDueDate(invoiceToEdit.dueDate ? toInputDateString(invoiceToEdit.dueDate) : '');
            } else if (initialItems && initialItems.length > 0) {
                // Populate from catalog selection
                const nextNumber = `${settings.invoicePrefix || 'INV-'}${settings.invoiceNextNumber || 1}`;
                const defaultDueDate = new Date();
                defaultDueDate.setDate(defaultDueDate.getDate() + 30);
                setInvoiceNumber(nextNumber);
                setCustomer({ name: '', mobile: '', address: '' });
                setDiscountType('rupees');
                setDiscountValue('0');
                setNotes(settings.defaultGreeting || '');
                setStatus('Pending');
                setDueDate(toInputDateString(defaultDueDate));

                const preloadedItems: InvoiceLineItem[] = initialItems.map(item => {
                    const salePrice = item.sellingPrice ?? item.avgSalePrice;
                    return {
                        id: item.variantId,
                        name: item.name,
                        color: item.color,
                        size: item.size,
                        quantity: 1,
                        price: salePrice,
                        total: salePrice,
                        discountType: 'rupees',
                        discountValue: 0,
                        imageUrl: item.imageUrl
                    };
                });
                setLineItems(preloadedItems);
                setDraftAvailable(false);
            } else if (!draftAvailable) {
                resetForm();
            }
        }
    }, [isOpen, isEditing, invoiceToEdit, settings, draftAvailable, initialItems]);

    const handleCustomerChange = (field: keyof CustomerDetails, value: string) => {
        setCustomer(prev => ({ ...prev, [field]: value }));
    };

    const handleAddItem = (variantId: string) => {
        const item = inventoryMap.get(variantId);
        if (!item) {
            alert("Item not found in inventory.");
            return;
        }

        const existingItem = lineItems.find(li => li.id === variantId);
        if (existingItem) {
            updateLineItem(variantId, 'quantity', existingItem.quantity + 1);
        } else {
            const salePrice = item.sellingPrice ?? item.avgSalePrice;
            const newLineItem: InvoiceLineItem = {
                id: item.variantId,
                name: item.name,
                color: item.color,
                size: item.size,
                quantity: 1,
                price: salePrice,
                total: salePrice,
                discountType: 'rupees',
                discountValue: 0,
                imageUrl: item.imageUrl
            };
            setLineItems(prev => [...prev, newLineItem]);
        }
    };
    
    const updateLineItem = (variantId: string, field: 'quantity' | 'price' | 'discountType' | 'discountValue', value: number | string) => {
        setLineItems(prev => prev.map(item => {
            if (item.id === variantId) {
                const updatedItem = { ...item, [field]: value };
                
                const grossTotal = updatedItem.quantity * updatedItem.price;
                let itemDiscountAmount = 0;
                const discountVal = Number(updatedItem.discountValue) || 0;

                if (updatedItem.discountType === 'percentage' && discountVal > 0) {
                    itemDiscountAmount = grossTotal * (Math.min(100, discountVal) / 100);
                } else if (updatedItem.discountType === 'rupees' && discountVal > 0) {
                    itemDiscountAmount = Math.min(grossTotal, discountVal * updatedItem.quantity); // Discount per item
                }
                
                updatedItem.total = grossTotal - itemDiscountAmount;
                return updatedItem;
            }
            return item;
        }));
    };
    
    const removeLineItem = (variantId: string) => {
        setLineItems(prev => prev.filter(item => item.id !== variantId));
    };

    const handleScanSuccess = (decodedText: string) => {
        try {
            const scannedData = JSON.parse(decodedText);
            if (scannedData && scannedData.variantId) {
                handleAddItem(scannedData.variantId);
            } else {
                alert('Invalid QR code format.');
            }
        } catch (e) {
            alert('Could not parse QR code data.');
        }
        setIsScanning(false);
    };

    const { subtotal, discountAmount, total } = useMemo(() => {
        const sub = lineItems.reduce((acc, item) => acc + item.total, 0);
        const discVal = parseFloat(discountValue) || 0;
        let discAmt = 0;
        if (discountType === 'rupees') {
            discAmt = Math.min(sub, discVal);
        } else {
            discAmt = sub * (Math.min(100, discVal) / 100);
        }
        const tot = sub - discAmt;
        return { subtotal: sub, discountAmount: discAmt, total: tot };
    }, [lineItems, discountType, discountValue]);

    const handleSubmit = async () => {
        if (!customer.name.trim()) {
            alert('Customer name is required.');
            return;
        }
        if (lineItems.length === 0) {
            alert('Invoice must have at least one item.');
            return;
        }

        const invoicePayload: Omit<Invoice, 'id' | 'date'> = {
            invoiceNumber,
            customer,
            items: lineItems,
            subtotal,
            discountType,
            discountValue: parseFloat(discountValue) || 0,
            discountAmount,
            total,
            notes,
            status,
            dueDate: dueDate ? new Date(dueDate) : undefined,
        };
        
        try {
            if (isEditing && invoiceToEdit) {
                await onUpdateInvoice(invoiceToEdit.id, invoicePayload);
            } else {
                await onCreateInvoice(invoicePayload);
                // Only remove draft on successful submission
                localStorage.removeItem(DRAFT_KEY);
            }
        } catch (error) {
            // The error is already alerted by the App component.
            // This catch block is crucial to prevent the modal from closing
            // and to stop the draft from being deleted on failure.
            console.error("Failed to submit invoice:", error);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {isScanning && <QrScanner onScanSuccess={handleScanSuccess} onClose={() => setIsScanning(false)} />}
            <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl p-6 sm:p-8 w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{isEditing ? 'Edit Invoice' : 'Create Invoice'}</h2>
                        <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200" aria-label="Close modal">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex-grow overflow-y-auto pr-2 space-y-6">
                         {draftAvailable && (
                            <div className="bg-yellow-100 dark:bg-yellow-900/50 border border-yellow-400 dark:border-yellow-600 text-yellow-800 dark:text-yellow-200 px-4 py-3 rounded-lg mb-4 flex justify-between items-center text-sm">
                                <p>
                                    <span className="font-bold">Unsaved Draft Found!</span> Do you want to restore it?
                                </p>
                                <div className="flex gap-4">
                                    <button onClick={handleRestoreDraft} className="font-semibold underline hover:text-yellow-900 dark:hover:text-yellow-100">Restore</button>
                                    <button onClick={handleDismissDraft} className="font-semibold underline hover:text-yellow-900 dark:hover:text-yellow-100">Dismiss</button>
                                </div>
                            </div>
                        )}
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label htmlFor="invoiceNumber" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Invoice Number</label>
                                <input type="text" id="invoiceNumber" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                            </div>
                             <div>
                                <label htmlFor="dueDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Due Date</label>
                                <input type="date" id="dueDate" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                            </div>
                             <div>
                                <label htmlFor="status" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
                                <select id="status" value={status} onChange={e => setStatus(e.target.value as 'Paid' | 'Pending')} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                                    <option value="Pending">Pending</option>
                                    <option value="Paid">Paid</option>
                                </select>
                            </div>
                        </div>

                        {/* Customer Details */}
                        <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                             <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Customer Details</h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="customerName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name *</label>
                                    <input type="text" id="customerName" value={customer.name} onChange={e => handleCustomerChange('name', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                                </div>
                                 <div>
                                    <label htmlFor="customerMobile" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mobile Number</label>
                                    <input type="tel" id="customerMobile" value={customer.mobile} onChange={e => handleCustomerChange('mobile', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                                </div>
                                <div className="md:col-span-2">
                                    <label htmlFor="customerAddress" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Address</label>
                                    <textarea id="customerAddress" value={customer.address} onChange={e => handleCustomerChange('address', e.target.value)} rows={2} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"></textarea>
                                </div>
                             </div>
                        </div>

                        {/* Invoice Items */}
                        <div>
                            <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                                 <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Invoice Items</h3>
                                 <div className="flex items-center gap-4">
                                     <select 
                                        onChange={e => { handleAddItem(e.target.value); e.target.value = ''; }}
                                        value=""
                                        className="px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                     >
                                         <option value="" disabled>-- Add item manually --</option>
                                         {groupedInventoryItems.map(group => (
                                            <optgroup key={group.variants[0].id} label={group.name}>
                                                {group.variants.map(variant => (
                                                    <option key={variant.variantId} value={variant.variantId}>
                                                        {`${variant.color} / ${variant.size} (Stock: ${variant.stock})`}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        ))}
                                     </select>
                                    <button onClick={() => setIsScanning(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                         <ScanIcon className="w-5 h-5" /> Scan Product
                                     </button>
                                 </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                     <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300">
                                        <tr>
                                            <th className="px-4 py-2">Item</th>
                                            <th className="px-4 py-2 w-24 text-center">Qty</th>
                                            <th className="px-4 py-2 w-32 text-right">Price</th>
                                            <th className="px-4 py-2 w-48 text-right">Discount (per item)</th>
                                            <th className="px-4 py-2 w-32 text-right">Total</th>
                                            <th className="px-4 py-2 w-16 text-center"></th>
                                        </tr>
                                     </thead>
                                     <tbody className="text-slate-700 dark:text-slate-300">
                                         {lineItems.length === 0 ? (
                                             <tr><td colSpan={6} className="text-center py-8 text-slate-500">No items added.</td></tr>
                                         ) : lineItems.map(item => (
                                             <tr key={item.id} className="border-b dark:border-slate-700">
                                                <td className="px-4 py-2">
                                                    <div className="flex items-center gap-2.5">
                                                        {item.imageUrl ? (
                                                            <img src={item.imageUrl} alt={item.name} className="w-9 h-9 rounded-md object-cover border border-slate-200 dark:border-slate-600 shrink-0 aspect-square" referrerPolicy="no-referrer" />
                                                        ) : (
                                                            <div className="w-9 h-9 rounded-md bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0 aspect-square">
                                                                {item.name.charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                        <div>
                                                            <div className="font-medium text-slate-900 dark:text-white leading-snug">{item.name}</div>
                                                            <div className="text-xs text-slate-500">{item.color} / {item.size}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2"><input type="number" min="1" value={item.quantity} onChange={e => updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 1)} className="w-20 text-center px-2 py-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md"/></td>
                                                <td className="px-4 py-2 text-right"><input type="number" min="0" step="0.01" value={item.price} onChange={e => updateLineItem(item.id, 'price', parseFloat(e.target.value) || 0)} className="w-28 text-right px-2 py-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md"/></td>
                                                <td className="px-4 py-2">
                                                    <div className="flex justify-end items-center gap-1">
                                                        <input 
                                                            type="number" 
                                                            min="0"
                                                            value={item.discountValue || ''} 
                                                            onChange={e => updateLineItem(item.id, 'discountValue', parseFloat(e.target.value) || 0)}
                                                            className="w-24 text-right px-2 py-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md"
                                                        />
                                                        <select 
                                                            value={item.discountType || 'rupees'}
                                                            onChange={e => updateLineItem(item.id, 'discountType', e.target.value as 'rupees' | 'percentage')}
                                                            className="px-2 py-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm"
                                                        >
                                                            <option value="rupees">₹</option>
                                                            <option value="percentage">%</option>
                                                        </select>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 text-right font-medium text-slate-900 dark:text-white">{formatCurrency(item.total)}</td>
                                                <td className="px-4 py-2 text-center">
                                                    <button onClick={() => removeLineItem(item.id)} className="text-slate-500 hover:text-red-600 dark:hover:text-red-400"><TrashIcon className="w-5 h-5"/></button>
                                                </td>
                                             </tr>
                                         ))}
                                     </tbody>
                                </table>
                            </div>
                        </div>
                         {/* Notes Section */}
                         <div>
                            <label htmlFor="notes" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes / Greeting</label>
                            <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g., Terms and conditions, or a thank you message..."></textarea>
                        </div>
                    </div>

                    {/* Footer with totals */}
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-6 mt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {/* Discount input */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Overall Invoice Discount</label>
                                <div className="flex">
                                    <div className="flex border border-slate-300 dark:border-slate-600 rounded-l-lg p-1">
                                         <button type="button" onClick={() => setDiscountType('rupees')} className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${discountType === 'rupees' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}>₹</button>
                                         <button type="button" onClick={() => setDiscountType('percentage')} className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${discountType === 'percentage' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}>%</button>
                                    </div>
                                    <input type="number" min="0" value={discountValue} onChange={e => setDiscountValue(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border-t border-b border-r border-slate-300 dark:border-slate-600 rounded-r-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
                                </div>
                            </div>
                             {/* Totals display */}
                            <div className="space-y-2 text-right">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-slate-600 dark:text-slate-300">Subtotal:</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(subtotal)}</span>
                                </div>
                                <div className="flex justify-between items-baseline">
                                    <span className="text-slate-600 dark:text-slate-300">Overall Discount:</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">- {formatCurrency(discountAmount)}</span>
                                </div>
                                <div className="border-t border-slate-300 dark:border-slate-600 pt-3 flex justify-between items-baseline text-xl">
                                    <span className="font-bold text-slate-900 dark:text-white">Total:</span>
                                    <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(total)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-4 mt-6">
                            <button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors">Cancel</button>
                            <button onClick={handleSubmit} disabled={isProcessing} className="px-6 py-2 bg-emerald-600 text-white font-semibold rounded-lg shadow-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-wait">
                                {isProcessing ? 'Saving...' : (isEditing ? 'Update Invoice' : 'Generate Invoice')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default InvoiceModal;