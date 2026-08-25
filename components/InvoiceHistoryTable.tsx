import React, { useState, useEffect, useRef } from 'react';
import type { Invoice } from '../types';
import { PencilIcon } from './icons/PencilIcon';
import { TrashIcon } from './icons/TrashIcon';
import { EyeIcon } from './icons/EyeIcon';

interface InvoiceHistoryTableProps {
    invoices: Invoice[];
    onPreview: (invoice: Invoice) => void;
    onEdit: (invoice: Invoice) => void;
    onDelete: (invoice: Invoice) => void;
    onStatusChange: (invoiceId: string, status: 'Paid' | 'Pending') => void;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
    }).format(amount);
};

const formatDate = (date: Date | undefined) => {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }).format(date);
};

const StatusBadge: React.FC<{ invoice: Invoice; onStatusChange: (invoiceId: string, status: 'Paid' | 'Pending') => void }> = ({ invoice, onStatusChange }) => {
    const [isEditing, setIsEditing] = useState(false);
    const selectRef = useRef<HTMLSelectElement>(null);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isOverdue = invoice.status === 'Pending' && invoice.dueDate && new Date(invoice.dueDate) < today;

    useEffect(() => {
        if (isEditing && selectRef.current) {
            selectRef.current.focus();
        }
    }, [isEditing]);

    const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onStatusChange(invoice.id, e.target.value as 'Paid' | 'Pending');
        setIsEditing(false);
    };

    const handleBlur = () => {
        setIsEditing(false);
    };
    
    if (isEditing) {
        const selectColorClasses = invoice.status === 'Paid'
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';

        return (
            <select
                ref={selectRef}
                value={invoice.status}
                onChange={handleStatusChange}
                onBlur={handleBlur}
                onClick={(e) => e.stopPropagation()}
                className={`text-xs font-medium px-2.5 py-0.5 rounded-full border border-transparent focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-800 ${selectColorClasses}`}
                aria-label={`Change status for invoice.`}
            >
                <option value="Pending">Pending</option>
                <option value="Paid">Paid</option>
            </select>
        );
    }
    
    let statusText: string = invoice.status;
    let displayClasses = 'px-2.5 py-0.5 text-xs font-medium rounded-full cursor-pointer';
    if (invoice.status === 'Paid') {
        displayClasses += ' bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    } else if (isOverdue) {
        statusText = 'Overdue';
        displayClasses += ' bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    } else { // Pending
        displayClasses += ' bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    }

    return (
         <div
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            className={displayClasses}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsEditing(true); } }}
            aria-label={`Current status: ${statusText}. Click to change.`}
        >
            {statusText}
        </div>
    );
};


const InvoiceHistoryTable: React.FC<InvoiceHistoryTableProps> = ({ invoices, onPreview, onEdit, onDelete, onStatusChange }) => {
    const sortedInvoices = [...invoices].sort((a, b) => b.date.getTime() - a.date.getTime());

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300">
                    <tr>
                        <th scope="col" className="px-6 py-3">Invoice #</th>
                        <th scope="col" className="px-6 py-3">Date</th>
                        <th scope="col" className="px-6 py-3">Due Date</th>
                        <th scope="col" className="px-6 py-3">Customer</th>
                        <th scope="col" className="px-6 py-3 text-right">Amount</th>
                        <th scope="col" className="px-6 py-3 text-center">Status</th>
                        <th scope="col" className="px-6 py-3 text-center">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedInvoices.map(invoice => (
                        <tr key={invoice.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                            <th scope="row" className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap dark:text-white">
                                {invoice.invoiceNumber}
                            </th>
                            <td className="px-6 py-4 whitespace-nowrap">{formatDate(invoice.date)}</td>
                             <td className="px-6 py-4 whitespace-nowrap">{formatDate(invoice.dueDate)}</td>
                            <td className="px-6 py-4">{invoice.customer.name}</td>
                            <td className="px-6 py-4 text-right font-medium">{formatCurrency(invoice.total)}</td>
                            <td className="px-6 py-4 text-center">
                                <StatusBadge invoice={invoice} onStatusChange={onStatusChange} />
                            </td>
                            <td className="px-6 py-4 text-center">
                                <div className="flex items-center justify-center gap-4">
                                     <button onClick={() => onPreview(invoice)} className="text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" aria-label="Preview invoice">
                                        <EyeIcon className="w-5 h-5" />
                                    </button>
                                    <button onClick={() => onEdit(invoice)} className="text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" aria-label="Edit invoice">
                                        <PencilIcon className="w-5 h-5" />
                                    </button>
                                    <button onClick={() => onDelete(invoice)} className="text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors" aria-label="Delete invoice">
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default InvoiceHistoryTable;