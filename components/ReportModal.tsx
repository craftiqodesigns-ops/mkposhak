import React, { useState, useEffect } from 'react';
import { XIcon } from './icons/XIcon';
import type { ReportType, GeneratedReport, Sale, Purchase, Item, DashboardData, Invoice } from '../types';
import { exportToCsv, exportToPdf } from '../utils/exportUtils';
import ExportButton from './ExportButton';

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    sales: Sale[];
    purchases: Purchase[];
    items: Item[];
    invoices: Invoice[];
    dashboardData: DashboardData[];
    initialReportType?: ReportType;
}

const formatDate = (date: Date) => new Intl.DateTimeFormat('en-GB').format(date);
const formatCurrency = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

const toInputDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, sales, purchases, items, invoices, dashboardData, initialReportType = 'sales' }) => {
    const [reportType, setReportType] = useState<ReportType>(initialReportType);
    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        date.setMonth(date.getMonth() - 1);
        return toInputDateString(date);
    });
    const [endDate, setEndDate] = useState(toInputDateString(new Date()));
    const [generatedReport, setGeneratedReport] = useState<GeneratedReport | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setReportType(initialReportType);
            setGeneratedReport(null);
            // Optional: If outstanding is selected, maybe we want to show a wider range by default?
            // For now, keeping default 1 month logic.
        }
    }, [isOpen, initialReportType]);

    const handleGenerateReport = () => {
        setIsGenerating(true);
        setGeneratedReport(null);

        // Allow a brief moment for UI to update to loading state
        setTimeout(() => {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            const itemMap = new Map<string, Item>(items.map(i => [i.id, i]));
            let report: GeneratedReport = { title: '', headers: [], data: [] };

            switch (reportType) {
                case 'sales':
                    report.title = `Sales Report (${formatDate(start)} to ${formatDate(end)})`;
                    report.data = sales
                        .filter(s => s.date >= start && s.date <= end)
                        .map(s => {
                            const item = itemMap.get(s.itemId);
                            const total = s.quantity * s.salePrice;
                            const discount = s.discountType === 'rupees' ? (s.discountValue ?? 0) : total * ((s.discountValue ?? 0) / 100);
                            return {
                                Date: formatDate(s.date),
                                Item: item?.name ?? 'Unknown',
                                Category: item?.category ?? 'N/A',
                                Variant: `${s.color} / ${s.size}`,
                                Quantity: s.quantity,
                                Price: formatCurrency(s.salePrice),
                                Discount: formatCurrency(discount),
                                Total: formatCurrency(total - discount),
                                Customer: s.customerName,
                            };
                        });
                    break;
                
                case 'purchases':
                    report.title = `Purchases Report (${formatDate(start)} to ${formatDate(end)})`;
                    report.data = purchases
                        .filter(p => p.date >= start && p.date <= end)
                        .map(p => {
                            const item = itemMap.get(p.itemId);
                            return {
                                Date: formatDate(p.date),
                                Item: item?.name ?? 'Unknown',
                                Category: item?.category ?? 'N/A',
                                Variant: `${p.color} / ${p.size}`,
                                Quantity: p.quantity,
                                'Purchase Price': formatCurrency(p.purchasePrice),
                                Total: formatCurrency(p.quantity * p.purchasePrice),
                                Vendor: p.vendorName,
                            };
                        });
                    break;

                case 'profit':
                    report.title = `Profit & Loss Summary (${formatDate(start)} to ${formatDate(end)})`;
                     const filteredSales = sales.filter(s => s.date >= start && s.date <= end);
                     const pnlData: { [variantId: string]: { name: string; variant: string, category: string, totalSold: number, totalRevenue: number, totalCost: number, totalProfit: number } } = {};

                     filteredSales.forEach(sale => {
                        const variantId = `${sale.itemId}-${sale.color}-${sale.size}`;
                        const variantInfo = dashboardData.find(d => d.variantId === variantId);
                        if (!variantInfo) return;

                        if (!pnlData[variantId]) {
                            pnlData[variantId] = {
                                name: variantInfo.name,
                                variant: `${variantInfo.color} / ${variantInfo.size}`,
                                category: variantInfo.category,
                                totalSold: 0,
                                totalRevenue: 0,
                                totalCost: 0,
                                totalProfit: 0
                            };
                        }

                        const revenue = sale.quantity * sale.salePrice;
                        const cost = sale.quantity * variantInfo.avgCost;
                        pnlData[variantId].totalSold += sale.quantity;
                        pnlData[variantId].totalRevenue += revenue;
                        pnlData[variantId].totalCost += cost;
                        pnlData[variantId].totalProfit += (revenue - cost);
                     });

                     report.data = Object.values(pnlData).map(d => ({
                        Item: d.name,
                        Variant: d.variant,
                        Category: d.category,
                        'Units Sold': d.totalSold,
                        'Total Revenue': formatCurrency(d.totalRevenue),
                        'Total Cost': formatCurrency(d.totalCost),
                        'Total Profit': formatCurrency(d.totalProfit),
                     }));
                    break;
                
                case 'outstanding':
                    report.title = `Outstanding Revenue (Unpaid Invoices) (${formatDate(start)} to ${formatDate(end)})`;
                    report.data = invoices
                        .filter(inv => inv.date >= start && inv.date <= end && inv.status === 'Pending')
                        .map(inv => ({
                            'Invoice #': inv.invoiceNumber,
                            Date: formatDate(inv.date),
                            'Due Date': inv.dueDate ? formatDate(inv.dueDate) : 'N/A',
                            Customer: inv.customer.name,
                            Mobile: inv.customer.mobile || '',
                            Total: formatCurrency(inv.total),
                        }));
                    break;
            }
            if (report.data.length > 0) {
                report.headers = Object.keys(report.data[0]);
            }
            setGeneratedReport(report);
            setIsGenerating(false);
        }, 100);
    };
    
    const handleExport = (format: 'csv' | 'pdf') => {
        if (!generatedReport || generatedReport.data.length === 0) return;

        const filename = `${reportType}_report_${startDate}_to_${endDate}`;
        
        if (format === 'csv') {
            exportToCsv(generatedReport.headers, generatedReport.data, filename);
        } else {
            const pdfData = generatedReport.data.map(row => 
                generatedReport.headers.map(header => row[header])
            );
            exportToPdf(generatedReport.title, generatedReport.headers, pdfData, filename);
        }
    };

    const handleClose = () => {
        setGeneratedReport(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
         <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={handleClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl p-6 sm:p-8 w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                 <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Generate Custom Report</h2>
                    <button onClick={handleClose} className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200" aria-label="Close modal">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>
                
                {!generatedReport && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label htmlFor="reportType" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Report Type</label>
                                <select id="reportType" value={reportType} onChange={e => setReportType(e.target.value as ReportType)} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                                    <option value="sales">Sales Report</option>
                                    <option value="purchases">Purchase Report</option>
                                    <option value="profit">Profit & Loss Summary</option>
                                    <option value="outstanding">Outstanding Revenue</option>
                                </select>
                            </div>
                             <div>
                                <label htmlFor="startDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
                                <input type="date" id="startDate" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
                            </div>
                             <div>
                                <label htmlFor="endDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">End Date</label>
                                <input type="date" id="endDate" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button onClick={handleGenerateReport} disabled={isGenerating} className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50">
                                {isGenerating ? 'Generating...' : 'Generate Report'}
                            </button>
                        </div>
                    </div>
                )}
                
                {isGenerating && (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
                    </div>
                )}
                
                {generatedReport && (
                    <div className="flex flex-col flex-grow min-h-0">
                        <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                             <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200">{generatedReport.title}</h3>
                             <div className="flex gap-4">
                                <button onClick={() => setGeneratedReport(null)} className="px-4 py-2 text-sm bg-slate-200 dark:bg-slate-600 font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">Back</button>
                                <ExportButton 
                                    onExportCsv={() => handleExport('csv')} 
                                    onExportPdf={() => handleExport('pdf')} 
                                    isDisabled={generatedReport.data.length === 0}
                                />
                             </div>
                        </div>
                        <div className="flex-grow overflow-y-auto border-t border-b dark:border-slate-700">
                             {generatedReport.data.length === 0 ? (
                                <p className="text-center py-16 text-slate-500">No data found for the selected criteria.</p>
                             ) : (
                                <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                                    <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300 sticky top-0">
                                        <tr>
                                            {generatedReport.headers.map(header => <th key={header} scope="col" className="px-6 py-3">{header}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-slate-800">
                                        {generatedReport.data.map((row, index) => (
                                            <tr key={index} className="border-b dark:border-slate-700">
                                                {generatedReport.headers.map(header => (
                                                    <td key={header} className="px-6 py-4 whitespace-nowrap">{row[header]}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReportModal;