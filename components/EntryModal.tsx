import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Item, Purchase, Sale, Transaction } from '../types';
import { TrashIcon } from './icons/TrashIcon';
import { PencilIcon } from './icons/PencilIcon';
import { ProductImageUploader } from './ProductImageUploader';

type EntryType = 'purchase' | 'sale';
type DiscountType = 'none' | 'rupees' | 'percentage';

interface SizeEntry {
    id: number;
    size: string;
    quantity: string;
}

interface ColorEntry {
    id: number;
    color: string;
    imageUrl?: string;
}

interface EntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: Item[];
    onAddTransactions: (transactions: (Omit<Purchase, 'id'> | Omit<Sale, 'id'>)[], type: EntryType) => Promise<void>;
    onAddItem: (item: Omit<Item, 'id'>) => Promise<string>;
    onUpdateItem: (itemId: string, item: Omit<Item, 'id'>) => Promise<void>;
    onDeleteItem: (item: Item) => void;
    entryToEdit?: Transaction | null;
    onSaveEdit: (updatedEntry: Omit<Transaction, 'id' | 'date' | 'type' | 'itemName' | 'category' | 'subCategory' | 'totalValue'>) => Promise<void>;
    isProcessing?: boolean;
}

const EntryModal: React.FC<EntryModalProps> = ({ isOpen, onClose, items, onAddTransactions, onAddItem, onUpdateItem, onDeleteItem, entryToEdit, onSaveEdit, isProcessing = false }) => {
    const isEditing = !!entryToEdit;

    // Transaction state
    const [entryType, setEntryType] = useState<EntryType>('purchase');
    const [price, setPrice] = useState(''); // Purchase price for purchase, Sale price for sale
    const [saleRealPrice, setSaleRealPrice] = useState(''); // Only for purchase type
    const [discountPercentage, setDiscountPercentage] = useState(''); // Only for purchase type
    const [sellingPrice, setSellingPrice] = useState(''); // Calculated, only for purchase type
    const [vendorName, setVendorName] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [discountType, setDiscountType] = useState<DiscountType>('none');
    const [discountValue, setDiscountValue] = useState('');
    
    // Item selection state
    const [itemId, setItemId] = useState<string>('');
    const [selectedItemName, setSelectedItemName] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // State for adding/editing an item
    const [isItemFormVisible, setIsItemFormVisible] = useState(false);
    const [itemToEdit, setItemToEdit] = useState<Item | null>(null);
    const [itemName, setItemName] = useState('');
    const [itemCategory, setItemCategory] = useState('');
    const [itemSubCategory, setItemSubCategory] = useState('');
    const [itemImageUrl, setItemImageUrl] = useState<string | undefined>(undefined);

    // State for single entry (editing transaction)
    const [singleQuantity, setSingleQuantity] = useState('');
    const [singleSize, setSingleSize] = useState('');
    const [singleColor, setSingleColor] = useState('');
    const [singleImageUrl, setSingleImageUrl] = useState<string | undefined>(undefined);

    // State for multiple entries (creating transaction)
    const [sizeEntries, setSizeEntries] = useState<SizeEntry[]>([{ id: Date.now(), size: '', quantity: '' }]);
    const [colorEntries, setColorEntries] = useState<ColorEntry[]>([{ id: Date.now(), color: '' }]);

    // Effect to auto-calculate final selling price
    useEffect(() => {
        const realPrice = parseFloat(saleRealPrice);
        const discount = parseFloat(discountPercentage);

        if (!isNaN(realPrice) && realPrice > 0) {
            if (!isNaN(discount) && discount >= 0 && discount <= 100) {
                const finalPrice = realPrice * (1 - discount / 100);
                setSellingPrice(finalPrice.toFixed(2));
            } else {
                setSellingPrice(realPrice.toFixed(2));
            }
        } else {
            setSellingPrice('');
        }
    }, [saleRealPrice, discountPercentage]);

    // Effect to handle clicks outside the custom item dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Effect to update the displayed item name when itemId changes
    useEffect(() => {
        if (itemId) {
            const selected = items.find(i => i.id === itemId);
            if (selected) {
                setSelectedItemName(`${selected.name} ${selected.subCategory ? `(${selected.subCategory})` : ''}`);
            }
        } else {
            setSelectedItemName('');
        }
    }, [itemId, items]);

    // Effect to populate form when editing a transaction or opening the modal
    useEffect(() => {
        if (isOpen) {
            if (isEditing && entryToEdit) {
                setEntryType(entryToEdit.type);
                setItemId(entryToEdit.itemId);
                setPrice(String(entryToEdit.price));
                setSaleRealPrice(String(entryToEdit.saleRealPrice || ''));
                setDiscountPercentage(String(entryToEdit.discountPercentage || ''));
                setSellingPrice(String(entryToEdit.sellingPrice || ''));
                setSingleColor(entryToEdit.color);
                setSingleSize(entryToEdit.size);
                setSingleQuantity(String(entryToEdit.quantity));
                setSingleImageUrl(entryToEdit.imageUrl);
                setVendorName(entryToEdit.vendorName || '');
                setCustomerName(entryToEdit.customerName || '');
                if (entryToEdit.discountType && entryToEdit.discountValue) {
                    setDiscountType(entryToEdit.discountType);
                    setDiscountValue(String(entryToEdit.discountValue));
                } else {
                    setDiscountType('none');
                    setDiscountValue('');
                }
            } else {
                resetForm();
            }
        }
    }, [entryToEdit, isEditing, isOpen, items]);

    const resetItemForm = () => {
        setIsItemFormVisible(false);
        setItemToEdit(null);
        setItemName('');
        setItemCategory('');
        setItemSubCategory('');
        setItemImageUrl(undefined);
    };
    
    const resetForm = () => {
        setEntryType('purchase');
        setItemId('');
        setPrice('');
        setSaleRealPrice('');
        setDiscountPercentage('');
        setSellingPrice('');
        setVendorName('');
        setCustomerName('');
        setSingleQuantity('');
        setSingleSize('');
        setSingleColor('');
        setSingleImageUrl(undefined);
        setSizeEntries([{ id: Date.now(), size: '', quantity: '' }]);
        setColorEntries([{ id: Date.now(), color: '', imageUrl: undefined }]);
        setDiscountType('none');
        setDiscountValue('');
        resetItemForm();
    };
    
    // --- Item Management Handlers ---
    const handleStartAddNewItem = () => {
        resetItemForm();
        setIsItemFormVisible(true);
    };

    const handleStartEditItem = (item: Item) => {
        setItemToEdit(item);
        setItemName(item.name);
        setItemCategory(item.category);
        setItemSubCategory(item.subCategory || '');
        setItemImageUrl(item.imageUrl);
        setIsItemFormVisible(true);
        setIsDropdownOpen(false);
    };

    const handleSaveItem = async () => {
        if (!itemName.trim() || !itemCategory.trim()) {
            alert('Please provide both an item name and a category.');
            return;
        }
        const itemData = {
            name: itemName.trim(),
            category: itemCategory.trim(),
            subCategory: itemSubCategory.trim() || undefined,
            imageUrl: itemImageUrl || undefined,
        };

        try {
            if (itemToEdit) {
                await onUpdateItem(itemToEdit.id, itemData);
            } else {
                const newItemId = await onAddItem(itemData);
                setItemId(newItemId);
            }
            resetItemForm();
        } catch (error) {
            console.error("Failed to save item:", error);
            alert("Failed to save item.");
        }
    };
    
    // --- Transaction Entry Handlers ---
    const handleAddSizeEntry = () => setSizeEntries([...sizeEntries, { id: Date.now(), size: '', quantity: '' }]);
    const handleAddColorEntry = () => setColorEntries([...colorEntries, { id: Date.now(), color: '', imageUrl: undefined }]);
    const handleRemoveSizeEntry = (id: number) => sizeEntries.length > 1 && setSizeEntries(sizeEntries.filter(e => e.id !== id));
    const handleRemoveColorEntry = (id: number) => colorEntries.length > 1 && setColorEntries(colorEntries.filter(e => e.id !== id));
    const handleSizeEntryChange = (id: number, field: 'size' | 'quantity', value: string) => setSizeEntries(sizeEntries.map(e => e.id === id ? { ...e, [field]: value } : e));
    const handleColorEntryChange = (id: number, field: 'color' | 'imageUrl', value: any) => setColorEntries(colorEntries.map(e => e.id === id ? { ...e, [field]: value } : e));
    
    const filteredItems = useMemo(() => {
        if (!searchTerm) return items;
        const lowercasedTerm = searchTerm.toLowerCase();
        return items.filter(item =>
            item.name.toLowerCase().includes(lowercasedTerm) ||
            item.category.toLowerCase().includes(lowercasedTerm) ||
            item.subCategory?.toLowerCase().includes(lowercasedTerm)
        );
    }, [items, searchTerm]);

    const handleSelectItem = (selectedItem: Item) => {
        setItemId(selectedItem.id);
        setSearchTerm('');
        setIsDropdownOpen(false);
    };
    
    // --- Form Submission ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numPrice = parseFloat(price);
        const numSaleRealPrice = parseFloat(saleRealPrice);
        const numDiscountPercentage = parseFloat(discountPercentage);
        const numSellingPrice = parseFloat(sellingPrice);
        const numDiscount = parseFloat(discountValue);

        if (!itemId) {
            alert('Please select an item.');
            return;
        }

        if (isNaN(numPrice) || numPrice <= 0) {
            alert('Please enter a valid price.');
            return;
        }
        
        if (entryType === 'purchase' && (!saleRealPrice || isNaN(numSaleRealPrice) || numSaleRealPrice <= 0)) {
            alert('Please enter a valid Sale Real Price for purchases.');
            return;
        }

        const saleDiscount = entryType === 'sale' && discountType !== 'none' ? {
            discountType: discountType as 'rupees' | 'percentage',
            discountValue: numDiscount > 0 ? numDiscount : undefined,
        } : {};

        try {
            if (isEditing) {
                const numQuantity = parseInt(singleQuantity, 10);
                if (!singleColor.trim() || !singleSize.trim() || isNaN(numQuantity) || numQuantity <= 0) {
                    alert('Please fill in Color, Size and a valid Quantity for the entry.');
                    return;
                }
                await onSaveEdit({ 
                    itemId,
                    price: numPrice, 
                    saleRealPrice: numSaleRealPrice > 0 ? numSaleRealPrice : undefined,
                    discountPercentage: numDiscountPercentage >= 0 ? numDiscountPercentage : undefined,
                    sellingPrice: numSellingPrice > 0 ? numSellingPrice : undefined,
                    color: singleColor.trim(),
                    size: singleSize.trim(),
                    quantity: numQuantity,
                    vendorName: vendorName.trim(), 
                    customerName: customerName.trim(),
                    imageUrl: singleImageUrl || undefined,
                    ...saleDiscount
                });

            } else {
                const validColors = colorEntries.filter(entry => entry.color.trim() !== '');
                if (validColors.length === 0) {
                    alert('Please enter at least one valid color.');
                    return;
                }

                let hasSizeErrors = false;
                const validSizeEntries = sizeEntries.filter(entry => {
                    const numQuantity = parseInt(entry.quantity, 10);
                    const isValid = entry.size.trim() && !isNaN(numQuantity) && numQuantity > 0;
                    if (!entry.size.trim() && !entry.quantity.trim()) return false;
                    if (!isValid) hasSizeErrors = true;
                    return isValid;
                });

                if (hasSizeErrors || validSizeEntries.length === 0) {
                    alert('Please ensure every size entry has a valid size and quantity.');
                    return;
                }
                
                const transactions: (Omit<Purchase, 'id'> | Omit<Sale, 'id'>)[] = validColors.flatMap(colorEntry =>
                    validSizeEntries.map(sizeEntry => {
                        const numQuantity = parseInt(sizeEntry.quantity, 10);
                        const commonData = { 
                            itemId, 
                            quantity: numQuantity, 
                            color: colorEntry.color.trim(), 
                            size: sizeEntry.size.trim(), 
                            date: new Date(),
                            imageUrl: colorEntry.imageUrl || undefined,
                        };
                        return entryType === 'purchase'
                            ? { 
                                ...commonData, 
                                purchasePrice: numPrice, 
                                saleRealPrice: numSaleRealPrice > 0 ? numSaleRealPrice : undefined,
                                discountPercentage: numDiscountPercentage >= 0 ? numDiscountPercentage : undefined,
                                sellingPrice: numSellingPrice > 0 ? numSellingPrice : undefined,
                                vendorName: vendorName.trim() 
                              }
                            : { ...commonData, salePrice: numPrice, customerName: customerName.trim(), ...saleDiscount };
                    })
                );
                
                if (transactions.length === 0) {
                    alert("No valid entries to add.");
                    return;
                }
                await onAddTransactions(transactions, entryType);
            }
            onClose();
        } catch (error) {
            console.error("Submission failed:", error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl p-6 sm:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">
                    {isEditing ? 'Edit Entry' : 'Add New Entry'}
                </h2>
                
                {!isEditing && (
                    <div className="mb-6">
                        <div className="flex border border-slate-300 dark:border-slate-600 rounded-lg p-1">
                            <button onClick={() => setEntryType('purchase')} className={`w-1/2 py-2 rounded-md text-sm font-medium transition-colors ${entryType === 'purchase' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>Purchase</button>
                            <button onClick={() => setEntryType('sale')} className={`w-1/2 py-2 rounded-md text-sm font-medium transition-colors ${entryType === 'sale' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>Sale</button>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                           <div className="flex justify-between items-center mb-1">
                                <label htmlFor="item-search" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Item</label>
                                {!isItemFormVisible && !isEditing && (
                                    <button type="button" onClick={handleStartAddNewItem} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300">
                                        + New Item
                                    </button>
                                )}
                           </div>
                            <div className="relative" ref={dropdownRef}>
                                <input
                                    id="item-search"
                                    type="text"
                                    readOnly={!isDropdownOpen}
                                    onFocus={() => setIsDropdownOpen(true)}
                                    value={isDropdownOpen ? searchTerm : selectedItemName}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Select an item"
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                />
                                {isDropdownOpen && (
                                    <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                        <ul>
                                            {filteredItems.length > 0 ? filteredItems.map(item => (
                                                <li key={item.id} className="group flex justify-between items-center p-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer">
                                                    <div onClick={() => handleSelectItem(item)} className="flex items-center gap-2.5 flex-grow">
                                                        {item.imageUrl ? (
                                                            <img src={item.imageUrl} alt={item.name} className="w-8 h-8 rounded-md object-cover border border-slate-200 dark:border-slate-600 shrink-0" referrerPolicy="no-referrer" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0">
                                                                {item.name.charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                        <div>
                                                            <p className="font-medium text-slate-800 dark:text-slate-200">{item.name}</p>
                                                            <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
                                                                <span>{item.category}</span>
                                                                {item.subCategory && (
                                                                    <>
                                                                        <span className="mx-1.5" aria-hidden="true">&middot;</span>
                                                                        <span>{item.subCategory}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {!isEditing && (
                                                        <div className="flex items-center gap-2 pl-2">
                                                            <button type="button" onClick={() => handleStartEditItem(item)} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400" aria-label={`Edit ${item.name}`}>
                                                                <PencilIcon className="w-4 h-4" />
                                                            </button>
                                                            <button type="button" onClick={() => onDeleteItem(item)} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-600 dark:hover:text-red-400" aria-label={`Delete ${item.name}`}>
                                                                <TrashIcon className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </li>
                                            )) : (
                                                <li className="p-2 text-sm text-slate-500">No items found.</li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </div>
                            {isItemFormVisible && (
                                <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg space-y-3 border border-slate-200 dark:border-slate-600">
                                    <h4 className="text-md font-semibold text-slate-800 dark:text-slate-200">{itemToEdit ? 'Edit Item' : 'Add New Item'}</h4>
                                    
                                    <input type="text" value={itemName} onChange={e => setItemName(e.target.value)} placeholder="Item Name" className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-white" />
                                    <input type="text" value={itemCategory} onChange={e => setItemCategory(e.target.value)} placeholder="Category (e.g., Tops, Sarees, Kurtis)" className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-white" />
                                    <input type="text" value={itemSubCategory} onChange={e => setItemSubCategory(e.target.value)} placeholder="Sub-category (optional)" className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-white" />
                                    <div className="flex gap-2 justify-end">
                                        <button type="button" onClick={resetItemForm} className="px-3 py-1 text-sm bg-slate-200 dark:bg-slate-600 rounded-md hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-300">Cancel</button>
                                        <button type="button" onClick={handleSaveItem} className="px-3 py-1 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700">{itemToEdit ? 'Save Changes' : 'Save Item'}</button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div>
                             <label htmlFor="price" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{entryType === 'purchase' ? 'Purchase Price' : 'Sale Price'} (per item)</label>
                            <input type="number" id="price" value={price} onChange={(e) => setPrice(e.target.value)} min="0.01" step="0.01" className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g., 25.50" />
                        </div>
                    </div>

                    {entryType === 'purchase' && (
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="saleRealPrice" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sale Real Price (before discount)</label>
                                    <input type="number" id="saleRealPrice" value={saleRealPrice} onChange={(e) => setSaleRealPrice(e.target.value)} min="0" step="0.01" className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g. 1000.00" />
                                </div>
                                <div>
                                    <label htmlFor="discountPercentage" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Discount Percentage (%)</label>
                                    <input type="number" id="discountPercentage" value={discountPercentage} onChange={(e) => setDiscountPercentage(e.target.value)} min="0" max="100" step="0.01" className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g. 10" />
                                </div>
                            </div>
                             <div>
                                <label htmlFor="sellingPrice" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Final Selling Price</label>
                                <input type="text" id="sellingPrice" value={sellingPrice ? `₹ ${sellingPrice}`: ''} readOnly className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none font-bold text-slate-700 dark:text-slate-200" placeholder="Auto-calculated" />
                            </div>
                        </div>
                    )}
                    
                    {isEditing ? (
                         <div className="p-3 bg-slate-50 dark:bg-slate-700/40 rounded-xl border border-slate-200 dark:border-slate-600 space-y-2">
                            <label htmlFor="color" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                Color & 1:1 Color Product Photo
                            </label>
                            <div className="flex items-center gap-3">
                                <div className="flex-1">
                                    <input 
                                        id="color" 
                                        type="text" 
                                        value={singleColor} 
                                        onChange={e => setSingleColor(e.target.value)} 
                                        placeholder="Color (e.g., Blue, Maroon)" 
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-xs focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-white text-sm" 
                                    />
                                </div>
                                <div className="shrink-0">
                                    <ProductImageUploader
                                        imageUrl={singleImageUrl}
                                        onChange={(url) => setSingleImageUrl(url)}
                                        size="xs"
                                        compact={true}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                         <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-200 dark:border-slate-600">
                            <div className="flex justify-between items-center mb-2">
                                <div>
                                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                                        🎨 Colors & 1:1 Product Photos
                                    </label>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                        Upload the exact 1:1 photo for each product color
                                    </p>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={handleAddColorEntry} 
                                    className="text-xs font-bold px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/80 transition-colors border border-indigo-200 dark:border-indigo-800"
                                >
                                    + Add Color
                                </button>
                            </div>
                            
                            <div className="space-y-2.5 mt-2">
                                {colorEntries.map((entry, index) => (
                                    <div key={entry.id} className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs">
                                        <div className="flex-1">
                                            <input 
                                                type="text" 
                                                value={entry.color} 
                                                onChange={e => handleColorEntryChange(entry.id, 'color', e.target.value)} 
                                                placeholder={`Color ${index + 1} (e.g., Red, Royal Blue, Green)`} 
                                                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-white" 
                                            />
                                        </div>
                                        
                                        {/* Color-specific 1:1 Photo Uploader */}
                                        <div className="shrink-0">
                                            <ProductImageUploader
                                                imageUrl={entry.imageUrl}
                                                onChange={(url) => handleColorEntryChange(entry.id, 'imageUrl', url)}
                                                size="xs"
                                                compact={true}
                                            />
                                        </div>

                                        <button 
                                            type="button" 
                                            onClick={() => handleRemoveColorEntry(entry.id)} 
                                            className={`p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-md transition-colors ${colorEntries.length <= 1 ? 'opacity-30 cursor-not-allowed' : ''}`} 
                                            disabled={colorEntries.length <= 1} 
                                            aria-label="Remove color entry"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <hr className="border-slate-200 dark:border-slate-600" />
                    
                    {isEditing ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="size" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Size</label>
                                <input id="size" type="text" value={singleSize} onChange={e => setSingleSize(e.target.value)} placeholder="e.g., M or 32" className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                            </div>
                            <div>
                                <label htmlFor="quantity" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Quantity</label>
                                <input type="number" id="quantity" value={singleQuantity} onChange={(e) => setSingleQuantity(e.target.value)} min="1" className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g., 50" />
                            </div>
                        </div>
                    ) : (
                        <div>
                             <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Sizes & Quantities</label>
                             <div className="space-y-3">
                                {sizeEntries.map((entry, index) => (
                                    <div key={entry.id} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-center">
                                        <input type="text" value={entry.size} onChange={e => handleSizeEntryChange(entry.id, 'size', e.target.value)} placeholder="Size (e.g., M)" className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                                        <input type="number" value={entry.quantity} onChange={e => handleSizeEntryChange(entry.id, 'quantity', e.target.value)} placeholder="Quantity" min="1" className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                                        <button type="button" onClick={() => handleRemoveSizeEntry(entry.id)} className={`text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors ${sizeEntries.length <= 1 ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={sizeEntries.length <= 1} aria-label="Remove size entry">
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))}
                             </div>
                             <button type="button" onClick={handleAddSizeEntry} className="mt-3 text-sm font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors">
                                + Add Size
                             </button>
                        </div>
                    )}
                    
                    <hr className="border-slate-200 dark:border-slate-600" />

                    {entryType === 'purchase' && (
                         <div>
                            <label htmlFor="vendorName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Vendor Name (Optional)</label>
                            <input id="vendorName" type="text" value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="e.g., Apparel Co" className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                    )}
                    {entryType === 'sale' && (
                        <div className="space-y-4">
                             <div>
                                <label htmlFor="customerName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Customer Name (Optional)</label>
                                <input id="customerName" type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="e.g., John Doe" className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Discount (Optional)</label>
                                <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4">
                                    <div className="flex border border-slate-300 dark:border-slate-600 rounded-lg p-1 w-full sm:w-auto">
                                        <button type="button" onClick={() => setDiscountType('none')} className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${discountType === 'none' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>None</button>
                                        <button type="button" onClick={() => setDiscountType('rupees')} className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${discountType === 'rupees' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>₹</button>
                                        <button type="button" onClick={() => setDiscountType('percentage')} className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${discountType === 'percentage' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>%</button>
                                    </div>
                                    <input 
                                        type="number" 
                                        value={discountValue}
                                        onChange={e => setDiscountValue(e.target.value)} 
                                        min="0" 
                                        step="0.01" 
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed" 
                                        placeholder="Discount value"
                                        disabled={discountType === 'none'}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-4 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors">
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={isProcessing}
                            className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-wait"
                        >
                           {isProcessing ? 'Saving...' : (isEditing ? 'Save Changes' : 'Add Entries')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EntryModal;