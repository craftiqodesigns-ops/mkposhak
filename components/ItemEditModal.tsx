import React, { useState, useEffect } from 'react';
import type { Item } from '../types';
import { XIcon } from './icons/XIcon';
import { TrashIcon } from './icons/TrashIcon';
import { ProductImageUploader } from './ProductImageUploader';

interface ItemEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: Item | null;
    onSave: (itemId: string, itemData: Omit<Item, 'id'>) => Promise<void>;
    onDelete: (item: Item) => void;
    isProcessing: boolean;
}

const ItemEditModal: React.FC<ItemEditModalProps> = ({ isOpen, onClose, item, onSave, onDelete, isProcessing }) => {
    const [name, setName] = useState('');
    const [category, setCategory] = useState('');
    const [subCategory, setSubCategory] = useState('');
    const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);

    useEffect(() => {
        if (item) {
            setName(item.name);
            setCategory(item.category);
            setSubCategory(item.subCategory || '');
            setImageUrl(item.imageUrl);
        } else {
            // Reset form when there's no item (e.g., modal is closing)
            setName('');
            setCategory('');
            setSubCategory('');
            setImageUrl(undefined);
        }
    }, [item]);

    if (!isOpen || !item) return null;
    
    const handleSave = async () => {
        if (!name.trim() || !category.trim()) {
            alert('Item name and category are required.');
            return;
        }
        try {
            await onSave(item.id, {
                name: name.trim(),
                category: category.trim(),
                subCategory: subCategory.trim() || undefined,
                imageUrl: imageUrl || undefined,
            });
        } catch (error) {
             // The error is already alerted by the App component.
             // This catch block prevents the modal from closing on failure.
             console.error("Failed to save item:", error);
        }
    };

    const handleDelete = () => {
        onDelete(item);
    };

    return (
         <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl p-6 sm:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Edit Item & 1:1 Photo</h2>
                     <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200" aria-label="Close modal">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
                    Updates will sync across your catalog, 1:1 visual grid, POS terminal, and invoices for <span className="font-semibold text-slate-700 dark:text-slate-200">{item.name}</span>.
                </p>

                {/* 1:1 Product Image Upload Section */}
                <div className="mb-5 p-3.5 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
                    <ProductImageUploader
                        imageUrl={imageUrl}
                        onChange={(url) => setImageUrl(url)}
                        label="Product Garment Image (1:1 Ratio)"
                        size="md"
                    />
                </div>

                <div className="space-y-4">
                    <div>
                        <label htmlFor="itemName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Item Name</label>
                        <input id="itemName" type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-white" />
                    </div>
                    <div>
                        <label htmlFor="itemCategory" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
                        <input id="itemCategory" type="text" value={category} onChange={e => setCategory(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-white" />
                    </div>
                    <div>
                        <label htmlFor="itemSubCategory" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sub-Category (Optional)</label>
                        <input id="itemSubCategory" type="text" value={subCategory} onChange={e => setSubCategory(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-white" />
                    </div>
                </div>
                <div className="flex justify-between items-center pt-6 mt-6 border-t border-slate-200 dark:border-slate-700">
                    <button onClick={handleDelete} className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 font-semibold rounded-lg hover:bg-red-50 dark:hover:bg-red-900/50">
                        <TrashIcon className="w-4 h-4"/> Delete Item
                    </button>
                    <div className="flex gap-4">
                         <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors">
                            Cancel
                        </button>
                        <button 
                            type="button" 
                            onClick={handleSave}
                            disabled={isProcessing}
                            className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-wait"
                        >
                           {isProcessing ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
         </div>
    );
};

export default ItemEditModal;