import React, { useState, useMemo, useEffect } from 'react';
import type { DashboardData } from '../types';
import { QrCodeIcon } from './icons/QrCodeIcon';
import Pagination from './Pagination';
import { SearchIcon } from './icons/SearchIcon';
import ExportButton from './ExportButton';
import { exportToCsv, exportToPdf } from '../utils/exportUtils';

interface DataTableProps {
    data: DashboardData[];
    onPrintQr: (item: DashboardData) => void;
    selectedVariantIds: Set<string>;
    onSelectionChange: (variantId: string, isSelected: boolean) => void;
    onSelectAll: (isSelected: boolean) => void;
    onPrintSelected: () => void;
    searchTerm: string;
    onSearchChange: (value: string) => void;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
    }).format(amount);
};

const DataTable: React.FC<DataTableProps> = ({ 
    data, 
    onPrintQr, 
    selectedVariantIds, 
    onSelectionChange, 
    onSelectAll, 
    onPrintSelected,
    searchTerm,
    onSearchChange
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;
    
    const numSelected = selectedVariantIds.size;
    
    useEffect(() => {
        setCurrentPage(1);
    }, [data.length, searchTerm]);
    
    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        return data.slice(startIndex, endIndex);
    }, [data, currentPage]);

    const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);
    
    const isAllSelected = data.length > 0 && numSelected === data.length;

    const handleSelectAllChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onSelectAll(e.target.checked);
    };

    const handlePageChange = (page: number) => {
        if (page > 0 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const handleExport = (format: 'csv' | 'pdf') => {
        const headers = ['Name', 'Category', 'Sub-Category', 'Color', 'Size', 'Sold', 'Stock', 'Avg Cost', 'Avg Price', 'Revenue', 'Profit'];
        const tableData = data.map(item => [
            item.name,
            item.category,
            item.subCategory || 'N/A',
            item.color,
            item.size,
            item.totalSold,
            item.stock,
            item.avgCost,
            item.avgSalePrice,
            item.totalRevenue,
            item.profit
        ]);

        const formattedDataForCsv = data.map(item => ({
            'Name': item.name,
            'Category': item.category,
            'Sub-Category': item.subCategory || 'N/A',
            'Color': item.color,
            'Size': item.size,
            'Sold': item.totalSold,
            'Stock': item.stock,
            'Avg Cost': formatCurrency(item.avgCost),
            'Avg Price': formatCurrency(item.avgSalePrice),
            'Revenue': formatCurrency(item.totalRevenue),
            'Profit': formatCurrency(item.profit),
        }));

        if (format === 'csv') {
            exportToCsv(Object.keys(formattedDataForCsv[0] || headers), formattedDataForCsv, 'inventory_breakdown');
        } else {
            exportToPdf('Inventory Breakdown', headers, tableData, 'inventory_breakdown');
        }
    };


    return (
        <div>
            <div className="mb-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex w-full sm:w-auto items-center gap-4">
                    <div className="w-full sm:max-w-xs">
                        <label htmlFor="inventory-search" className="sr-only">Search</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <SearchIcon className="h-5 w-5 text-slate-400" />
                            </div>
                            <input
                                type="text"
                                name="inventory-search"
                                id="inventory-search"
                                className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md leading-5 bg-white dark:bg-slate-700 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:placeholder-slate-500 dark:focus:placeholder-slate-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                placeholder="Search by name, category, color..."
                                value={searchTerm}
                                onChange={(e) => onSearchChange(e.target.value)}
                            />
                        </div>
                    </div>
                     <ExportButton onExportCsv={() => handleExport('csv')} onExportPdf={() => handleExport('pdf')} />
                </div>
                 <div className="flex items-center justify-end gap-4 h-10 w-full sm:w-auto">
                    {numSelected > 0 && (
                        <>
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                                {numSelected} {numSelected === 1 ? 'item' : 'items'} selected
                            </span>
                            <button
                                onClick={onPrintSelected}
                                className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                            >
                                <QrCodeIcon className="w-4 h-4" />
                                Print Selected
                            </button>
                        </>
                    )}
                 </div>
            </div>
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
                                    disabled={data.length === 0}
                                    aria-label="Select all items"
                                />
                            </th>
                            <th scope="col" className="px-6 py-3">Item Name</th>
                            <th scope="col" className="px-6 py-3">Category</th>
                            <th scope="col" className="px-6 py-3">Color</th>
                            <th scope="col" className="px-6 py-3">Size</th>
                            <th scope="col" className="px-6 py-3 text-right">Sold</th>
                            <th scope="col" className="px-6 py-3 text-right">Stock</th>
                            <th scope="col" className="px-6 py-3 text-right">Avg Cost</th>
                            <th scope="col" className="px-6 py-3 text-right">Avg Price</th>
                            <th scope="col" className="px-6 py-3 text-right">Revenue</th>
                            <th scope="col" className="px-6 py-3 text-right">Profit</th>
                            <th scope="col" className="px-6 py-3 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedData.map(item => (
                            <tr key={item.variantId} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                                <td className="px-6 py-4">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 text-indigo-600 bg-slate-100 border-slate-300 rounded focus:ring-indigo-500 dark:focus:ring-indigo-600 dark:ring-offset-slate-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600"
                                        checked={selectedVariantIds.has(item.variantId)}
                                        onChange={(e) => onSelectionChange(item.variantId, e.target.checked)}
                                        aria-labelledby={`item-name-${item.variantId}`}
                                    />
                                </td>
                                <th scope="row" id={`item-name-${item.variantId}`} className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap dark:text-white">
                                    {item.name}
                                    {item.subCategory && <div className="text-xs font-normal text-slate-500 dark:text-slate-400">{item.subCategory}</div>}
                                </th>
                                <td className="px-6 py-4">
                                    <span className="px-2.5 py-0.5 text-xs font-medium text-indigo-800 bg-indigo-100 rounded-full dark:bg-indigo-900 dark:text-indigo-300">
                                        {item.category}
                                    </span>
                                </td>
                                <td className="px-6 py-4">{item.color}</td>
                                <td className="px-6 py-4">{item.size}</td>
                                <td className="px-6 py-4 text-right">{item.totalSold}</td>
                                <td className="px-6 py-4 text-right">{item.stock}</td>
                                <td className="px-6 py-4 text-right">{formatCurrency(item.avgCost)}</td>
                                <td className="px-6 py-4 text-right">{formatCurrency(item.avgSalePrice)}</td>
                                <td className="px-6 py-4 text-right">{formatCurrency(item.totalRevenue)}</td>
                                <td className={`px-6 py-4 text-right font-semibold ${item.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {formatCurrency(item.profit)}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <button onClick={() => onPrintQr(item)} className="text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" aria-label="Print QR Code">
                                        <QrCodeIcon className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {data.length === 0 && (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                        <p>{searchTerm ? 'No items match your search.' : 'No inventory data to display.'}</p>
                        {!searchTerm && <p className="text-sm mt-1">Add a new purchase to get started.</p>}
                    </div>
                )}
            </div>
             <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                itemsPerPage={ITEMS_PER_PAGE}
                totalItems={data.length}
            />
        </div>
    );
};

export default DataTable;