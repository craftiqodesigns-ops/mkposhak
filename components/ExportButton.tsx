import React, { useState, useEffect, useRef } from 'react';
import { ArrowDownTrayIcon } from './icons/ArrowDownTrayIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';

interface ExportButtonProps {
    onExportCsv: () => void;
    onExportPdf: () => void;
    isDisabled?: boolean;
}

const ExportButton: React.FC<ExportButtonProps> = ({ onExportCsv, onExportPdf, isDisabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleExport = (handler: () => void) => {
        handler();
        setIsOpen(false);
    };

    return (
        <div className="relative inline-block text-left" ref={wrapperRef}>
            <div>
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    disabled={isDisabled}
                    className="inline-flex items-center justify-center w-full rounded-md border border-slate-300 dark:border-slate-600 shadow-sm px-4 py-2 bg-white dark:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                    <ArrowDownTrayIcon className="-ml-1 mr-2 h-5 w-5" />
                    Export
                    <ChevronDownIcon className="-mr-1 ml-2 h-5 w-5" />
                </button>
            </div>

            {isOpen && (
                <div
                    className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-slate-800 ring-1 ring-black dark:ring-slate-600 ring-opacity-5 focus:outline-none z-10"
                >
                    <div className="py-1">
                        <a
                            href="#"
                            onClick={(e) => { e.preventDefault(); handleExport(onExportCsv); }}
                            className="text-slate-700 dark:text-slate-200 block px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                            Export as CSV
                        </a>
                        <a
                            href="#"
                            onClick={(e) => { e.preventDefault(); handleExport(onExportPdf); }}
                            className="text-slate-700 dark:text-slate-200 block px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                            Export as PDF
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExportButton;
