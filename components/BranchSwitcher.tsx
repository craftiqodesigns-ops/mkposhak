import React, { useState, useRef, useEffect } from 'react';
import type { Branch } from '../types';

interface BranchSwitcherProps {
    branches: Branch[];
    activeBranch: Branch | null;
    onSelectBranch: (branchId: string) => void;
    onOpenBranchManager: () => void;
}

export const BranchSwitcher: React.FC<BranchSwitcherProps> = ({
    branches,
    activeBranch,
    onSelectBranch,
    onOpenBranchManager,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                id="branch-switcher-btn"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-750 transition-all text-left group"
                title="Switch Store Branch"
            >
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-400">
                        Current Branch
                    </span>
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-mono">
                            {activeBranch?.code || 'MAIN'}
                        </span>
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 max-w-[140px] sm:max-w-[200px] truncate">
                            {activeBranch?.name || 'Main Branch'}
                        </span>
                    </div>
                </div>
                <svg
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Select Branch ({branches.length})
                        </span>
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                            Isolated Data
                        </span>
                    </div>

                    <div className="max-h-60 overflow-y-auto py-1">
                        {branches.map(branch => {
                            const isSelected = branch.id === activeBranch?.id;
                            return (
                                <button
                                    key={branch.id}
                                    type="button"
                                    onClick={() => {
                                        onSelectBranch(branch.id);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors ${
                                        isSelected
                                            ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 font-medium'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200'
                                    }`}
                                >
                                    <div className="mt-0.5">
                                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                                            isSelected 
                                                ? 'bg-indigo-600 text-white' 
                                                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                        }`}>
                                            {branch.code}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-semibold truncate">{branch.name}</p>
                                            {isSelected && (
                                                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold ml-2">✓</span>
                                            )}
                                        </div>
                                        {branch.address && (
                                            <p className="text-xs text-slate-400 dark:text-slate-400 truncate">{branch.address}</p>
                                        )}
                                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                                            <span>Tax: {branch.taxRate ?? 5}%</span>
                                            <span>•</span>
                                            <span>Prefix: {branch.invoicePrefix || 'INV-'}</span>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-700 pt-1 px-2 mt-1">
                        <button
                            type="button"
                            onClick={() => {
                                setIsOpen(false);
                                onOpenBranchManager();
                            }}
                            className="w-full text-center py-2 px-3 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Manage / Add New Branch
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BranchSwitcher;
