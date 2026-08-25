import React, { useState } from 'react';
import type { Branch } from '../types';
import { XIcon } from './icons/XIcon';
import { PlusIcon } from './icons/PlusIcon';

interface BranchManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    branches: Branch[];
    activeBranchId: string;
    onSaveBranch: (branch: Omit<Branch, 'id' | 'createdAt'>, branchIdToEdit?: string) => Promise<void>;
    onDeleteBranch?: (branchId: string) => Promise<void>;
    onSelectBranch: (branchId: string) => void;
    isProcessing: boolean;
}

export const BranchManagerModal: React.FC<BranchManagerModalProps> = ({
    isOpen,
    onClose,
    branches,
    activeBranchId,
    onSaveBranch,
    onDeleteBranch,
    onSelectBranch,
    isProcessing,
}) => {
    const [isCreating, setIsCreating] = useState(false);
    const [editingBranchId, setEditingBranchId] = useState<string | null>(null);

    // Form fields
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [taxRate, setTaxRate] = useState<number>(5);
    const [invoicePrefix, setInvoicePrefix] = useState('INV-');
    const [formError, setFormError] = useState('');

    if (!isOpen) return null;

    const startCreate = () => {
        setIsCreating(true);
        setEditingBranchId(null);
        setName('');
        setCode(`BR-0${branches.length + 1}`);
        setAddress('');
        setPhone('');
        setTaxRate(5);
        setInvoicePrefix(`INV-B${branches.length + 1}-`);
        setFormError('');
    };

    const startEdit = (branch: Branch) => {
        setIsCreating(false);
        setEditingBranchId(branch.id);
        setName(branch.name);
        setCode(branch.code);
        setAddress(branch.address || '');
        setPhone(branch.phone || '');
        setTaxRate(branch.taxRate ?? 5);
        setInvoicePrefix(branch.invoicePrefix || 'INV-');
        setFormError('');
    };

    const cancelForm = () => {
        setIsCreating(false);
        setEditingBranchId(null);
        setFormError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setFormError('Branch name is required');
            return;
        }
        if (!code.trim()) {
            setFormError('Branch code is required');
            return;
        }

        try {
            await onSaveBranch({
                name: name.trim(),
                code: code.trim().toUpperCase(),
                address: address.trim(),
                phone: phone.trim(),
                taxRate: Number(taxRate) || 0,
                invoicePrefix: invoicePrefix.trim() || 'INV-',
            }, editingBranchId || undefined);
            cancelForm();
        } catch (err: any) {
            setFormError(err?.message || 'Failed to save branch');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-850 rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>🏢</span> Multi-Branch Management
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Create, configure, and isolate inventory, POS, and sales per branch.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    {!isCreating && !editingBranchId ? (
                        <>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    All Active Branches ({branches.length})
                                </span>
                                <button
                                    onClick={startCreate}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition-all"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                    Add New Branch
                                </button>
                            </div>

                            <div className="space-y-3">
                                {branches.map(branch => {
                                    const isCurrent = branch.id === activeBranchId;
                                    return (
                                        <div
                                            key={branch.id}
                                            className={`p-4 rounded-xl border transition-all ${
                                                isCurrent
                                                    ? 'border-indigo-500/60 bg-indigo-50/40 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300">
                                                            {branch.code}
                                                        </span>
                                                        <h3 className="font-bold text-slate-900 dark:text-white">
                                                            {branch.name}
                                                        </h3>
                                                        {isCurrent && (
                                                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                                                                Active Session
                                                            </span>
                                                        )}
                                                    </div>
                                                    {branch.address && (
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                                            📍 {branch.address}
                                                        </p>
                                                    )}
                                                    {branch.phone && (
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                                            📞 {branch.phone}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400 pt-1">
                                                        <span>Tax / GST: <strong className="text-slate-800 dark:text-slate-200">{branch.taxRate ?? 5}%</strong></span>
                                                        <span>Invoice Prefix: <strong className="text-slate-800 dark:text-slate-200">{branch.invoicePrefix || 'INV-'}</strong></span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {!isCurrent && (
                                                        <button
                                                            onClick={() => {
                                                                onSelectBranch(branch.id);
                                                                onClose();
                                                            }}
                                                            className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm"
                                                        >
                                                            Switch Here
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => startEdit(branch)}
                                                        className="px-2.5 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors"
                                                    >
                                                        Edit
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                                <h3 className="font-bold text-slate-900 dark:text-white">
                                    {isCreating ? 'Add New Store Branch' : 'Edit Branch Details'}
                                </h3>
                                <button
                                    type="button"
                                    onClick={cancelForm}
                                    className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                >
                                    Cancel
                                </button>
                            </div>

                            {formError && (
                                <div className="p-3 text-xs bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800">
                                    {formError}
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Branch Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Branch 2 (Station Road)"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Branch Code / Tag *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. BR-02"
                                        value={code}
                                        onChange={e => setCode(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none uppercase font-mono"
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Branch Address
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Shop 12, Station Road Mall, Surat"
                                        value={address}
                                        onChange={e => setAddress(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Branch Phone / Contact
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 9876543211"
                                        value={phone}
                                        onChange={e => setPhone(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Default Tax / GST (%)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        value={taxRate}
                                        onChange={e => setTaxRate(Number(e.target.value))}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Invoice Number Prefix
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. INV-B2-"
                                        value={invoicePrefix}
                                        onChange={e => setInvoicePrefix(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                                    />
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        Invoices generated in this branch will automatically start with this prefix (e.g. {invoicePrefix}101).
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                                <button
                                    type="button"
                                    onClick={cancelForm}
                                    className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isProcessing}
                                    className="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md disabled:opacity-50 transition-colors flex items-center gap-2"
                                >
                                    {isProcessing && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                    Save Branch
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BranchManagerModal;
