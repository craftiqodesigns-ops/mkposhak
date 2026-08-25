import React, { useRef, useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import type { Invoice, Branch, Settings } from '../types';
import { XIcon } from './icons/XIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { WhatsAppIcon } from './icons/WhatsAppIcon';

interface PosReceiptSlipModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStartNewSale: () => void;
    invoice: Invoice | null;
    branch: Branch | null;
    settings: Settings;
    businessLogo: string | null;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
    }).format(amount);
};

export const PosReceiptSlipModal: React.FC<PosReceiptSlipModalProps> = ({
    isOpen,
    onClose,
    onStartNewSale,
    invoice,
    branch,
    settings,
    businessLogo,
}) => {
    const receiptRef = useRef<HTMLDivElement>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

    React.useEffect(() => {
        if (!invoice) return;
        const upiId = settings.paymentQrCode || 'mkposhakhouse@upi';
        const upiString = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent('MK Poshak House')}&am=${invoice.total.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Bill ${invoice.invoiceNumber}`)}`;
        
        QRCode.toDataURL(upiString, { width: 140, margin: 1 })
            .then(url => setQrCodeUrl(url))
            .catch(() => setQrCodeUrl(''));
    }, [invoice, settings.paymentQrCode]);

    if (!isOpen || !invoice) return null;

    const handlePrintReceipt = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow || !receiptRef.current) {
            window.print();
            return;
        }

        printWindow.document.write(`
            <html>
                <head>
                    <title>Receipt - ${invoice.invoiceNumber}</title>
                    <style>
                        @page { size: 80mm auto; margin: 3mm; }
                        body {
                            font-family: 'Courier New', Courier, monospace;
                            width: 74mm;
                            margin: 0 auto;
                            padding: 4px;
                            color: #000;
                            background: #fff;
                            font-size: 11px;
                            line-height: 1.3;
                        }
                        .text-center { text-align: center; }
                        .text-right { text-align: right; }
                        .font-bold { font-weight: bold; }
                        .divider { border-top: 1px dashed #000; margin: 4px 0; }
                        .table { width: 100%; border-collapse: collapse; margin: 4px 0; }
                        .table th, .table td { padding: 2px 0; font-size: 10px; }
                        .row { display: flex; justify-content: space-between; }
                        .qr-box { text-align: center; margin: 6px 0; }
                        .qr-box img { width: 100px; height: 100px; }
                    </style>
                </head>
                <body onload="window.print();window.close();">
                    ${receiptRef.current.innerHTML}
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handleDownloadPdf = () => {
        if (!receiptRef.current) return;
        setIsGeneratingPdf(true);

        html2canvas(receiptRef.current, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false,
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/jpeg', 0.90);
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: [80, Math.max(120, canvas.height * 0.264583)],
                compress: true,
            });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
            pdf.save(`POS-Receipt-${invoice.invoiceNumber}.pdf`);
            setIsGeneratingPdf(false);
        }).catch(err => {
            console.error("PDF generation failed:", err);
            setIsGeneratingPdf(false);
            alert("Could not generate PDF slip.");
        });
    };

    const handleWhatsApp = () => {
        if (!invoice.customer.mobile) {
            alert("Please enter customer mobile number to send WhatsApp receipt.");
            return;
        }
        const cleanPhone = invoice.customer.mobile.replace(/\D/g, '');
        const itemsList = invoice.items
            .map(i => `• ${i.name} (${i.color}/${i.size}) x${i.quantity} = ₹${i.total}`)
            .join('\n');

        const message = `🛍️ *MK POSHAK HOUSE* [${branch?.code || 'MAIN'}]\n` +
            `📄 *Receipt #:* ${invoice.invoiceNumber}\n` +
            `📅 *Date:* ${new Date(invoice.date).toLocaleDateString()} ${new Date(invoice.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n` +
            `👤 *Customer:* ${invoice.customer.name}\n` +
            `---------------------------\n` +
            `${itemsList}\n` +
            `---------------------------\n` +
            `*Subtotal:* ${formatCurrency(invoice.subtotal)}\n` +
            (invoice.discountAmount > 0 ? `*Discount:* -${formatCurrency(invoice.discountAmount)}\n` : '') +
            (invoice.taxAmount && invoice.taxAmount > 0 ? `*Tax (${invoice.taxRate ?? 5}%):* ${formatCurrency(invoice.taxAmount)}\n` : '') +
            `💰 *Grand Total:* ${formatCurrency(invoice.total)}\n` +
            `💳 *Paid via:* ${invoice.paymentMethod || 'Cash'}\n\n` +
            `Thank you for shopping with MK Poshak House!`;

        const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank');
    };

    const formattedDate = new Date(invoice.date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
    const formattedTime = new Date(invoice.date).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-850 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-150">
                {/* Header Actions */}
                <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">
                            Transaction Successful • Receipt Preview
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Printable Slip Container */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-100 dark:bg-slate-900 flex justify-center">
                    <div
                        ref={receiptRef}
                        className="w-full max-w-[340px] bg-white text-slate-900 p-5 rounded-lg shadow-md border border-slate-300 font-mono text-xs leading-relaxed printable-receipt"
                    >
                        {/* Store Header */}
                        <div className="text-center space-y-1">
                            {businessLogo && (
                                <img
                                    src={businessLogo}
                                    alt="Shop Logo"
                                    className="h-10 mx-auto object-contain mb-1"
                                />
                            )}
                            <h1 className="text-base font-black tracking-tight text-slate-950">
                                MK POSHAK HOUSE
                            </h1>
                            <p className="text-[11px] font-semibold text-slate-700">
                                {branch?.name || 'Main Branch'}
                            </p>
                            {branch?.address && (
                                <p className="text-[10px] text-slate-500 leading-tight">
                                    {branch.address}
                                </p>
                            )}
                            {branch?.phone && (
                                <p className="text-[10px] text-slate-500">
                                    Ph: {branch.phone}
                                </p>
                            )}
                        </div>

                        {/* Divider */}
                        <div className="border-t border-dashed border-slate-400 my-3"></div>

                        {/* Receipt Info */}
                        <div className="space-y-1 text-[11px]">
                            <div className="flex justify-between">
                                <span className="text-slate-600">Receipt No:</span>
                                <span className="font-bold">{invoice.invoiceNumber}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">Date & Time:</span>
                                <span>{formattedDate} {formattedTime}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">Customer:</span>
                                <span className="font-semibold">{invoice.customer.name || 'Walk-in Customer'}</span>
                            </div>
                            {invoice.customer.mobile && (
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Mobile:</span>
                                    <span>{invoice.customer.mobile}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-slate-600">Branch Code:</span>
                                <span className="font-mono">{branch?.code || 'MB-01'}</span>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-dashed border-slate-400 my-3"></div>

                        {/* Item Table */}
                        <table className="w-full text-left text-[11px]">
                            <thead>
                                <tr className="border-b border-slate-300 text-slate-600">
                                    <th className="pb-1">Item / Var</th>
                                    <th className="pb-1 text-center">Qty</th>
                                    <th className="pb-1 text-right">Price</th>
                                    <th className="pb-1 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {invoice.items.map((item, idx) => (
                                    <tr key={idx} className="align-top">
                                        <td className="py-1.5 pr-1">
                                            <div className="font-bold text-slate-900 leading-tight">{item.name}</div>
                                            <div className="text-[10px] text-slate-500">
                                                {item.color} / {item.size}
                                            </div>
                                        </td>
                                        <td className="py-1.5 text-center font-bold">{item.quantity}</td>
                                        <td className="py-1.5 text-right text-slate-600">₹{item.price}</td>
                                        <td className="py-1.5 text-right font-bold">₹{item.total}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Divider */}
                        <div className="border-t border-dashed border-slate-400 my-3"></div>

                        {/* Totals */}
                        <div className="space-y-1 text-[11px]">
                            <div className="flex justify-between">
                                <span className="text-slate-600">Subtotal:</span>
                                <span className="font-semibold">{formatCurrency(invoice.subtotal)}</span>
                            </div>
                            {invoice.discountAmount > 0 && (
                                <div className="flex justify-between text-emerald-700">
                                    <span>Discount ({invoice.discountType === 'percentage' ? `${invoice.discountValue}%` : 'Flat'}):</span>
                                    <span>-{formatCurrency(invoice.discountAmount)}</span>
                                </div>
                            )}
                            {invoice.taxAmount && invoice.taxAmount > 0 ? (
                                <div className="flex justify-between text-slate-600">
                                    <span>GST / Tax ({invoice.taxRate ?? 5}%):</span>
                                    <span>{formatCurrency(invoice.taxAmount)}</span>
                                </div>
                            ) : null}
                            <div className="border-t border-slate-300 pt-1.5 flex justify-between text-sm font-black">
                                <span>NET TOTAL:</span>
                                <span className="text-base text-slate-950">{formatCurrency(invoice.total)}</span>
                            </div>
                            <div className="flex justify-between text-[11px] pt-1">
                                <span className="text-slate-600">Payment Mode:</span>
                                <span className="font-bold px-1.5 py-0.2 bg-slate-100 rounded">
                                    {invoice.paymentMethod || 'Cash'}
                                </span>
                            </div>
                            {invoice.amountReceived ? (
                                <>
                                    <div className="flex justify-between text-[10px] text-slate-500">
                                        <span>Cash Received:</span>
                                        <span>{formatCurrency(invoice.amountReceived)}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-slate-500">
                                        <span>Change Returned:</span>
                                        <span>{formatCurrency(invoice.changeAmount || 0)}</span>
                                    </div>
                                </>
                            ) : null}
                        </div>

                        {/* QR Code for Instant UPI Payment Verification */}
                        {qrCodeUrl && (
                            <div className="text-center pt-3 mt-3 border-t border-dashed border-slate-400">
                                <img
                                    src={qrCodeUrl}
                                    alt="UPI QR Code"
                                    className="w-24 h-24 mx-auto border border-slate-200 p-1 bg-white rounded"
                                />
                                <p className="text-[9px] text-slate-500 mt-1">Scan & Pay with any UPI App</p>
                            </div>
                        )}

                        {/* Footer Message */}
                        <div className="text-center pt-3 text-[10px] text-slate-500 leading-tight">
                            <p>{settings.defaultGreeting || 'Thank you for your visit!'}</p>
                            <p className="mt-0.5">Goods once sold can be exchanged within 7 days.</p>
                        </div>
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-wrap gap-2 justify-between items-center">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handlePrintReceipt}
                            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            Print Thermal Slip
                        </button>
                        <button
                            type="button"
                            onClick={handleDownloadPdf}
                            disabled={isGeneratingPdf}
                            className="px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                            <DownloadIcon className="w-4 h-4" />
                            PDF
                        </button>
                        <button
                            type="button"
                            onClick={handleWhatsApp}
                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                        >
                            <WhatsAppIcon className="w-4 h-4" />
                            WhatsApp
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            onClose();
                            onStartNewSale();
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                    >
                        ⚡ Start Next Sale (Esc)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PosReceiptSlipModal;
