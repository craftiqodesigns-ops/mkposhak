import React, { useMemo, useState, useEffect } from 'react';
import type { Purchase, Sale, Item, Transaction } from '../types';
import { PencilIcon } from './icons/PencilIcon';
import { TrashIcon } from './icons/TrashIcon';
import Pagination from './Pagination';
import { PencilSquareIcon } from './icons/PencilSquareIcon';
import ExportButton from './ExportButton';
import { exportToCsv, exportToPdf } from '../utils/exportUtils';
import { SearchIcon } from './icons/SearchIcon';

interface TransactionHistoryTableProps {
    purchases: Purchase[];
    sales: Sale[];
    items: Item[];
    onEdit: (transaction: Transaction) => void;
    onDelete: (transaction: Transaction) => void;
    selectedTransactionIds: Set<string>;
    onSelectionChange: (transactionId: string, isSelected: boolean) => void;
    onSelectAll: (isSelected: boolean, allTransactionIds: string[]) => void;
    onDeleteSelected: () => void;
    onStartBulkEdit: (type: 'purchase' | 'sale') => void;
    onStartEditItem: (item: Item) => void;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
    }).format(amount);
};

const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }).format(date);
};

const TransactionHistoryTable: React.FC<TransactionHistoryTableProps> = ({ 
    purchases, sales, items, onEdit, onDelete, 
    selectedTransactionIds, onSelectionChange, onSelectAll, onDeleteSelected,
    onStartBulkEdit, onStartEditItem
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [filterType, setFilterType] = useState<'purchase' | 'sale' | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const ITEMS_PER_PAGE = 10;
    
    const allTransactions = useMemo<Transaction[]>(() => {
        const itemMap = new Map<string, Item>(items.map(i => [i.id, i]));

        const allPurchases: Transaction[] = purchases.map(p => ({
            ...p,
            type: 'purchase',
            price: p.purchasePrice,
            itemName: itemMap.get(p.itemId)?.name ?? 'Unknown',
            category: itemMap.get(p.itemId)?.category ?? 'N/A',
            subCategory: itemMap.get(p.itemId)?.subCategory,
            totalValue: p.quantity * p.purchasePrice,
        }));

        const allSales: Transaction[] = sales.map(s => {
            const preDiscountTotal = s.quantity * s.salePrice;
            let totalValue = preDiscountTotal;
            if(s.discountType === 'rupees' && s.discountValue) {
                totalValue = preDiscountTotal - s.discountValue;
            } else if (s.discountType === 'percentage' && s.discountValue) {
                totalValue = preDiscountTotal * (1 - s.discountValue / 100);
            }

            return {
                ...s,
                type: 'sale',
                price: s.salePrice,
                itemName: itemMap.get(s.itemId)?.name ?? 'Unknown',
                category: itemMap.get(s.itemId)?.category ?? 'N/A',
                subCategory: itemMap.get(s.itemId)?.subCategory,
                totalValue: totalValue,
            };
        });

        return [...allPurchases, ...allSales].sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [purchases, sales, items]);

    const filteredTransactions = useMemo<Transaction[]>(() => {
        const lowercasedTerm = searchTerm.toLowerCase();

        return allTransactions.filter(t => {
            const matchesFilterType = filterType === 'all' || t.type === filterType;
            if (!matchesFilterType) return false;

            if (!searchTerm) return true;

            return (
                t.itemName.toLowerCase().includes(lowercasedTerm) ||
                t.category.toLowerCase().includes(lowercasedTerm) ||
                (t.subCategory && t.subCategory.toLowerCase().includes(lowercasedTerm)) ||
                t.color.toLowerCase().includes(lowercasedTerm) ||
                t.size.toLowerCase().includes(lowercasedTerm) ||
                (t.vendorName && t.vendorName.toLowerCase().includes(lowercasedTerm)) ||
                (t.customerName && t.customerName.toLowerCase().includes(lowercasedTerm))
            );
        });
    }, [allTransactions, filterType, searchTerm]);


    const { selectedTransactionType, selectedItemForEditing } = useMemo(() => {
        if (selectedTransactionIds.size === 0) {
            return { selectedTransactionType: null, selectedItemForEditing: null };
        }

        const firstId = [...selectedTransactionIds][0];
        const firstTransaction = allTransactions.find(t => `${t.type}-${t.id}` === firstId);
        
        if (!firstTransaction) {
            return { selectedTransactionType: null, selectedItemForEditing: null };
        }

        const firstItemId = firstTransaction.itemId;
        const firstType = firstTransaction.type;
        let isMixedType = false;
        let isMultipleItems = false;

        for (const selectedId of selectedTransactionIds) {
            const transaction = allTransactions.find(t => `${t.type}-${t.id}` === selectedId);
            if (!transaction) {
                continue;
            }
            if (transaction.type !== firstType) {
                isMixedType = true;
            }
            if (transaction.itemId !== firstItemId) {
                isMultipleItems = true;
            }
        }

        const finalType = isMixedType ? 'mixed' : firstType;
        let finalItem: Item | 'multiple' | null = null;
        if (isMultipleItems) {
            finalItem = 'multiple';
        } else {
            finalItem = items.find(i => i.id === firstItemId) || null;
        }

        return { selectedTransactionType: finalType, selectedItemForEditing: finalItem };
    }, [selectedTransactionIds, allTransactions, items]);

     useEffect(() => {
        setCurrentPage(1);
    }, [filteredTransactions.length, searchTerm]);

    const paginatedTransactions = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        return filteredTransactions.slice(startIndex, endIndex);
    }, [filteredTransactions, currentPage]);
    
    const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
    
    const numSelected = selectedTransactionIds.size;
    const isAllSelected = filteredTransactions.length > 0 && selectedTransactionIds.size === filteredTransactions.length;

    const handleSelectAllChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onSelectAll(e.target.checked, filteredTransactions.map(t => `${t.type}-${t.id}`));
    };

    const handlePageChange = (page: number) => {
        if (page > 0 && page <= totalPages) {
            setCurrentPage(page);
        }
    };
    
    const handleStartBulkEditClick = () => {
        if (selectedTransactionType === 'purchase' || selectedTransactionType === 'sale') {
            setFilterType(selectedTransactionType);
            onStartBulkEdit(selectedTransactionType);
        }
    };

    const handleClearFilter = () => {
        setFilterType('all');
        onSelectAll(false, []); // Deselect all when clearing filter
    };
    
    const handleExport = (format: 'csv' | 'pdf') => {
        const headers = ['Date', 'Item Name', 'Category', 'Variant', 'Type', 'Vendor/Customer', 'Qty', 'Price', 'Discount', 'Total'];
        const dataForPdf = filteredTransactions.map(t => [
            formatDate(t.date),
            t.itemName,
            t.category,
            `${t.color} / ${t.size}`,
            t.type,
            t.type === 'purchase' ? t.vendorName || '' : t.customerName || '',
            t.quantity,
            t.price,
            t.type === 'sale' && t.discountValue ? (t.discountType === 'rupees' ? t.discountValue : `${t.discountValue}%`) : 'N/A',
            t.totalValue
        ]);
        
        const dataForCsv = filteredTransactions.map(t => ({
            'Date': formatDate(t.date),
            'Item Name': t.itemName,
            'Category': t.category,
            'Variant': `${t.color} / ${t.size}`,
            'Type': t.type,
            'Vendor/Customer': t.type === 'purchase' ? t.vendorName || '' : t.customerName || '',
            'Qty': t.quantity,
            'Price': formatCurrency(t.price),
            'Discount': t.type === 'sale' && t.discountValue ? (t.discountType === 'rupees' ? formatCurrency(t.discountValue) : `${t.discountValue}%`) : 'N/A',
            'Total': formatCurrency(t.totalValue),
        }));

        if (format === 'csv') {
            exportToCsv(Object.keys(dataForCsv[0] || headers), dataForCsv, 'transaction_history');
        } else {
            exportToPdf('Transaction History', headers, dataForPdf, 'transaction_history');
        }
    };

    return (
        <div>
             <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex w-full sm:w-auto items-center gap-4">
                     <div className="w-full sm:max-w-xs">
                        <label htmlFor="transaction-search" className="sr-only">Search</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <SearchIcon className="h-5 w-5 text-slate-400" />
                            </div>
                            <input
                                type="text"
                                name="transaction-search"
                                id="transaction-search"
                                className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md leading-5 bg-white dark:bg-slate-700 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:placeholder-slate-500 dark:focus:placeholder-slate-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                placeholder="Search transactions..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <ExportButton onExportCsv={() => handleExport('csv')} onExportPdf={() => handleExport('pdf')} />
                </div>
                <div className="flex items-center gap-4 h-10">
                    {numSelected > 0 && (
                        <>
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                                {numSelected} {numSelected === 1 ? 'transaction' : 'transactions'} selected
                            </span>
                             {selectedItemForEditing && selectedItemForEditing !== 'multiple' && (
                                <button
                                    onClick={() => onStartEditItem(selectedItemForEditing)}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-sky-500 text-white font-semibold rounded-lg shadow-md hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
                                    title="Edit the item details for all selected transactions"
                                >
                                    <PencilIcon className="w-4 h-4" />
                                    Edit Item
                                </button>
                            )}
                            <button
                                onClick={handleStartBulkEditClick}
                                disabled={selectedTransactionType === 'mixed' || !selectedTransactionType}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-yellow-500 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                title={selectedTransactionType === 'mixed' ? "Cannot edit purchases and sales at the same time." : "Edit selected items"}
                            >
                                <PencilSquareIcon className="w-4 h-4" />
                                Bulk Edit
                            </button>
                            <button
                                onClick={onDeleteSelected}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                            >
                                <TrashIcon className="w-4 h-4" />
                                Delete Selected
                            </button>
                        </>
                    )}
                </div>
            </div>
            {filterType !== 'all' && (
                <div className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200 p-2 rounded-md mb-4 flex justify-between items-center text-sm">
                    <span>Showing only <strong>{filterType}</strong> transactions.</span>
                    <button onClick={handleClearFilter} className="font-semibold underline hover:text-indigo-600 dark:hover:text-indigo-100">Clear Filter</button>
                </div>
            )}
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                    <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300">
                        <tr>
                             <th scope="col" className="px-6 py-3">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 text-indigo-600 bg-slate-100 border-slate-300 rounded focus:ring-indigo-500 dark:focus:ring-indigo-600 dark:ring-offset-slate-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600"
                                    checked={isAllSelected}
                                    onChange={handleSelectAllChange}
                                    disabled={filteredTransactions.length === 0}
                                    aria-label="Select all transactions"
                                />
                            </th>
                            <th scope="col" className="px-6 py-3">Date</th>
                            <th scope="col" className="px-6 py-3">Item Name</th>
                            <th scope="col" className="px-6 py-3">Variant</th>
                            <th scope="col" className="px-6 py-3">Type</th>
                            <th scope="col" className="px-6 py-3">Vendor/Customer</th>
                            <th scope="col" className="px-6 py-3 text-right">Qty</th>
                            <th scope="col" className="px-6 py-3 text-right">Price</th>
                            <th scope="col" className="px-6 py-3 text-right">Discount</th>
                            <th scope="col" className="px-6 py-3 text-right">Total</th>
                            <th scope="col" className="px-6 py-3 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedTransactions.map(t => {
                            const uniqueId = `${t.type}-${t.id}`;
                            const associatedItem = items.find(i => i.id === t.itemId);
                            return (
                                <tr key={uniqueId} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                    <td className="px-6 py-4">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 text-indigo-600 bg-slate-100 border-slate-300 rounded focus:ring-indigo-500 dark:focus:ring-indigo-600 dark:ring-offset-slate-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600"
                                            checked={selectedTransactionIds.has(uniqueId)}
                                            onChange={(e) => onSelectionChange(uniqueId, e.target.checked)}
                                            aria-labelledby={`item-name-${uniqueId}`}
                                        />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">{formatDate(t.date)}</td>
                                    <th scope="row" id={`item-name-${uniqueId}`} className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap dark:text-white group">
                                        <div className="flex items-center gap-2">
                                            <span>{t.itemName}</span>
                                            {associatedItem && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onStartEditItem(associatedItem);
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400 transition-all rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                                                    title="Edit Item Details"
                                                    aria-label={`Edit details for ${t.itemName}`}
                                                >
                                                    <PencilIcon className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                        <div className="text-xs font-normal text-slate-500 dark:text-slate-400">
                                            {t.subCategory ? `${t.subCategory}, ${t.category}` : t.category}
                                        </div>
                                    </th>
                                    <td className="px-6 py-4 whitespace-nowrap">{t.color} / {t.size}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
                                            t.type === 'purchase' 
                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' 
                                            : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                        }`}>
                                            {t.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">{t.type === 'purchase' ? t.vendorName : t.customerName}</td>
                                    <td className="px-6 py-4 text-right">{t.quantity}</td>
                                    <td className="px-6 py-4 text-right">{formatCurrency(t.price)}</td>
                                    <td className="px-6 py-4 text-right">
                                        {t.type === 'sale' && t.discountValue && t.discountValue > 0 ? (
                                            <span>
                                                {t.discountType === 'rupees' ? formatCurrency(t.discountValue) : `${t.discountValue}%`}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 dark:text-slate-500">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium">{formatCurrency(t.totalValue)}</td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center gap-4">
                                            <button onClick={() => onEdit(t)} className="text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" aria-label="Edit transaction">
                                                <PencilIcon className="w-5 h-5" />
                                            </button>
                                            <button onClick={() => onDelete(t)} className="text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors" aria-label="Delete transaction">
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                 {filteredTransactions.length === 0 && (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                         <p>{searchTerm ? 'No transactions match your search.' : 'No transactions have been recorded yet.'}</p>
                    </div>
                )}
            </div>
            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                itemsPerPage={ITEMS_PER_PAGE}
                totalItems={filteredTransactions.length}
            />
        </div>
    );
};

export default TransactionHistoryTable;