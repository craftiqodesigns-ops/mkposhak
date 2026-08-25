import React, { useState, useEffect } from 'react';
import type { BulkEditChanges } from '../types';

interface BulkEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (changes: BulkEditChanges) => Promise<void>;
    count: number;
    type?: 'purchase' | 'sale';
    isProcessing: boolean;
}

const BulkEditModal: React.FC<BulkEditModalProps> = ({ isOpen, onClose, onSave, count, type, isProcessing }) => {
    const [fieldsToUpdate, setFieldsToUpdate] = useState<Record<string, boolean>>({});
    const [changes, setChanges] = useState<Record<string, any>>({});
    
    // State for purchase pricing calculation
    const [saleRealPrice, setSaleRealPrice] = useState('');
    const [discountPercentage, setDiscountPercentage] = useState('');
    const [sellingPrice, setSellingPrice] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setFieldsToUpdate({});
            setChanges({});
            setSaleRealPrice('');
            setDiscountPercentage('');
            setSellingPrice('');
        }
    }, [isOpen]);
    
    // Auto-calculate final selling price
    useEffect(() => {
        const realPrice = parseFloat(saleRealPrice);
        const discount = parseFloat(discountPercentage);

        if (!isNaN(realPrice) && realPrice >= 0) {
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

    const handleFieldToggle = (field: string, checked: boolean) => {
        setFieldsToUpdate(prev => ({ ...prev, [field]: checked }));
        if (!checked) {
            const newChanges = { ...changes };
            delete newChanges[field];
            setChanges(newChanges);
            // Also reset pricing fields if that section is toggled off
            if(field === 'pricing'){
                setSaleRealPrice('');
                setDiscountPercentage('');
                setSellingPrice('');
            }
        }
    };

    const handleValueChange = (field: string, value: any) => {
        setChanges(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async () => {
        const finalChanges: BulkEditChanges = {};
        
        for (const field in fieldsToUpdate) {
            if (fieldsToUpdate[field]) {
                // Handle the composite pricing fields for purchases atomically to ensure data consistency
                if (field === 'pricing' && type === 'purchase') {
                    const realPriceNum = parseFloat(saleRealPrice);

                    // Validate that a saleRealPrice is provided for the pricing update
                    if (isNaN(realPriceNum) || saleRealPrice.trim() === '' || realPriceNum < 0) {
                        alert("To update pricing, a valid, non-negative 'Sale Real Price' must be provided.");
                        return; // Abort submission
                    }
    
                    const discountNum = parseFloat(discountPercentage);
                    
                    // Atomically update all three related pricing fields.
                    finalChanges.saleRealPrice = realPriceNum;
                    // If discount is not a valid number, default to 0.
                    finalChanges.discountPercentage = (!isNaN(discountNum) && discountNum >= 0 && discountNum <= 100) ? discountNum : 0;
                    // Recalculate sellingPrice from validated inputs to guarantee correctness.
                    finalChanges.sellingPrice = realPriceNum * (1 - (finalChanges.discountPercentage / 100));
                    
                    continue; // Skip to next field in loop
                }

                // Handle simple fields using original logic
                const value = changes[field];
                if (value !== undefined) {
                    const numValue = parseFloat(value);
                    finalChanges[field] = isNaN(numValue) || typeof value !== 'string' ? value : numValue;
                }
            }
        }

        if (Object.keys(finalChanges).length === 0) {
            alert("No changes selected. Please check a box to edit a field.");
            return;
        }

        try {
            await onSave(finalChanges);
        } catch (error) {
            // The error is already alerted by the App component.
            // This catch block is crucial to prevent the modal from closing on failure.
            console.error("Failed to save bulk changes:", error);
        }
    };

    if (!isOpen || !type) return null;

    const renderPurchaseFields = () => (
        <>
            <FormField label="Purchase Price" field="purchasePrice" type="number" step="0.01" />
            <FormField label="Vendor Name" field="vendorName" type="text" />
            <div className="p-4 bg-slate-100 dark:bg-slate-700/50 rounded-lg space-y-4 border border-slate-200 dark:border-slate-600">
                <div className="flex items-center">
                    <input
                        id="update-pricing"
                        type="checkbox"
                        checked={!!fieldsToUpdate.pricing}
                        onChange={(e) => handleFieldToggle('pricing', e.target.checked)}
                        className="h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                    />
                    <label htmlFor="update-pricing" className="ml-3 block text-sm font-medium text-slate-900 dark:text-slate-100">
                        Update Selling Price Information
                    </label>
                </div>
                <div className={`space-y-4 ${!fieldsToUpdate.pricing ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="saleRealPrice" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">New Sale Real Price</label>
                            <input disabled={!fieldsToUpdate.pricing} type="number" id="saleRealPrice" value={saleRealPrice} onChange={(e) => setSaleRealPrice(e.target.value)} min="0" step="0.01" className="w-full input-field" />
                        </div>
                        <div>
                            <label htmlFor="discountPercentage" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">New Discount %</label>
                            <input disabled={!fieldsToUpdate.pricing} type="number" id="discountPercentage" value={discountPercentage} onChange={(e) => setDiscountPercentage(e.target.value)} min="0" max="100" step="0.01" className="w-full input-field" />
                        </div>
                    </div>
                     <div>
                        <label htmlFor="sellingPrice" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Final Selling Price (Auto-calculated)</label>
                        <input type="text" id="sellingPrice" value={sellingPrice ? `₹ ${sellingPrice}`: ''} readOnly className="w-full input-field bg-slate-100 dark:bg-slate-800 font-bold" />
                    </div>
                </div>
            </div>
        </>
    );

    const renderSaleFields = () => (
        <>
            <FormField label="Sale Price" field="salePrice" type="number" step="0.01" />
            <FormField label="Customer Name" field="customerName" type="text" />
            <div className="p-4 bg-slate-100 dark:bg-slate-700/50 rounded-lg space-y-4 border border-slate-200 dark:border-slate-600">
                <div className="flex items-center">
                    <input
                        id="update-discount"
                        type="checkbox"
                        checked={!!fieldsToUpdate.discountType} // Link checkbox to one of the fields
                        onChange={(e) => {
                            const isChecked = e.target.checked;
                            handleFieldToggle('discountType', isChecked);
                            handleFieldToggle('discountValue', isChecked);
                        }}
                        className="h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                    />
                    <label htmlFor="update-discount" className="ml-3 block text-sm font-medium text-slate-900 dark:text-slate-100">
                       Update Discount
                    </label>
                </div>
                 <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${!fieldsToUpdate.discountType ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Discount Type</label>
                        <select
                            disabled={!fieldsToUpdate.discountType}
                            value={changes.discountType || 'rupees'}
                            onChange={e => handleValueChange('discountType', e.target.value)}
                            className="w-full input-field"
                        >
                            <option value="rupees">Rupees (₹)</option>
                            <option value="percentage">Percentage (%)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Discount Value</label>
                        <input
                            disabled={!fieldsToUpdate.discountType}
                            type="number"
                            step="0.01"
                            value={changes.discountValue || ''}
                            onChange={e => handleValueChange('discountValue', e.target.value)}
                            className="w-full input-field"
                        />
                    </div>
                </div>
            </div>
        </>
    );

    const FormField = ({ label, field, type, step }: { label: string, field: string, type: string, step?: string }) => (
         <div className="flex items-center gap-4">
            <input
                id={`update-${field}`}
                type="checkbox"
                checked={!!fieldsToUpdate[field]}
                onChange={(e) => handleFieldToggle(field, e.target.checked)}
                className="h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
            />
            <label htmlFor={`value-${field}`} className="w-32 shrink-0 text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
            <input
                id={`value-${field}`}
                type={type}
                step={step}
                value={changes[field] || ''}
                onChange={(e) => handleValueChange(field, e.target.value)}
                disabled={!fieldsToUpdate[field]}
                className="w-full input-field"
            />
        </div>
    );
    

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl p-6 sm:p-8 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">
                    Bulk Edit {count} {type ? (type + (count > 1 ? 's' : '')) : 'Items'}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                    Select a field to update its value for all selected transactions.
                </p>
                
                <div className="space-y-4">
                    {type === 'purchase' ? renderPurchaseFields() : renderSaleFields()}
                </div>

                <div className="flex justify-end gap-4 pt-6 mt-6 border-t border-slate-200 dark:border-slate-700">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isProcessing}
                        className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-wait"
                    >
                       {isProcessing ? 'Saving...' : `Save ${count} Changes`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkEditModal;