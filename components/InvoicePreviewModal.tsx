
import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import { generateBrandedCatalogQr } from '../utils/qrUtils';
import type { Invoice, Settings, Branch } from '../types';
import { XIcon } from './icons/XIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { WhatsAppIcon } from './icons/WhatsAppIcon';
import { SmsIcon } from './icons/SmsIcon';


interface InvoicePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoiceData: Invoice | null;
    businessLogo: string | null;
    settings: Settings;
    activeBranch?: Branch;
    onUpdateLogoSize?: (newSize: number) => void;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
    }).format(amount);
};

const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(date);
};

const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({ isOpen, onClose, invoiceData, businessLogo, settings, activeBranch, onUpdateLogoSize }) => {
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [instagramQrSrc, setInstagramQrSrc] = useState<string>('');
    const [googleReviewQrSrc, setGoogleReviewQrSrc] = useState<string>('');
    const [catalogQrSrc, setCatalogQrSrc] = useState<string>('');
    
    // Layout size mode: 'compact' (Small/A5 Single Page) vs 'standard' (A4 Classic) vs 'mini' (Receipt Slip)
    const [layoutMode, setLayoutMode] = useState<'compact' | 'standard' | 'mini'>(() => {
        const stored = localStorage.getItem('invoice_layout_mode');
        return (stored === 'standard' || stored === 'mini') ? stored : 'compact';
    });

    // Content Scale / Zoom (75% to 120%, default 90%)
    const [zoomScale, setZoomScale] = useState<number>(() => {
        const stored = localStorage.getItem('invoice_zoom_scale');
        if (stored && !isNaN(Number(stored))) return Number(stored);
        return 90;
    });

    // Logo size state (default 48px in compact mode, range 20px to 160px)
    const [logoSize, setLogoSize] = useState<number>(() => {
        const stored = localStorage.getItem('invoice_logo_size');
        if (stored && !isNaN(Number(stored))) return Number(stored);
        return settings.invoiceLogoSize || (layoutMode === 'compact' ? 48 : 64);
    });

    // Generate Instagram, Google Review, and Catalog Website QR codes
    useEffect(() => {
        if (!isOpen) return;

        // Instagram QR Code
        if (settings.instagramQrCode) {
            setInstagramQrSrc(settings.instagramQrCode);
        } else {
            const igUrl = settings.instagramUrl || 'https://instagram.com/mkposhakhouse';
            QRCode.toDataURL(igUrl, {
                margin: 1,
                width: 140,
                color: {
                    dark: '#169375',
                    light: '#ffffff'
                }
            }).then(url => setInstagramQrSrc(url)).catch(() => {});
        }

        // Google Review QR Code
        if (settings.googleReviewQrCode) {
            setGoogleReviewQrSrc(settings.googleReviewQrCode);
        } else {
            const gUrl = settings.googleReviewUrl || 'https://g.page/r/mkposhakhouse/review';
            QRCode.toDataURL(gUrl, {
                margin: 1,
                width: 140,
                color: {
                    dark: '#169375',
                    light: '#ffffff'
                }
            }).then(url => setGoogleReviewQrSrc(url)).catch(() => {});
        }

        // Website Catalog QR Code
        if (settings.catalogQrCode) {
            setCatalogQrSrc(settings.catalogQrCode);
        } else {
            const catUrl = settings.catalogWebsiteUrl || settings.shopWebsite || 'https://mkposhakhouse.com';
            generateBrandedCatalogQr(catUrl)
                .then(url => setCatalogQrSrc(url))
                .catch(() => {
                    QRCode.toDataURL(catUrl, {
                        margin: 1,
                        width: 140,
                        color: {
                            dark: '#008060',
                            light: '#ffffff'
                        }
                    }).then(url => setCatalogQrSrc(url)).catch(() => {});
                });
        }
    }, [
        isOpen, 
        settings.instagramQrCode, 
        settings.instagramUrl, 
        settings.googleReviewQrCode, 
        settings.googleReviewUrl,
        settings.catalogQrCode,
        settings.catalogWebsiteUrl,
        settings.shopWebsite
    ]);

    // Update if settings prop changes
    useEffect(() => {
        if (settings.invoiceLogoSize) {
            setLogoSize(settings.invoiceLogoSize);
        }
    }, [settings.invoiceLogoSize]);

    const handleLayoutModeChange = (mode: 'compact' | 'standard' | 'mini') => {
        setLayoutMode(mode);
        try {
            localStorage.setItem('invoice_layout_mode', mode);
        } catch (e) {}
    };

    const handleZoomChange = (delta: number) => {
        const next = Math.max(70, Math.min(125, zoomScale + delta));
        setZoomScale(next);
        try {
            localStorage.setItem('invoice_zoom_scale', String(next));
        } catch (e) {}
    };

    const handleUpdateLogoSize = (newSize: number) => {
        const clampedSize = Math.max(20, Math.min(160, newSize));
        setLogoSize(clampedSize);
        try {
            localStorage.setItem('invoice_logo_size', String(clampedSize));
        } catch (e) {
            console.warn("Could not persist logo size:", e);
        }
        if (onUpdateLogoSize) {
            onUpdateLogoSize(clampedSize);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const addPdfLinks = (
        pdf: jsPDF, 
        input: HTMLElement, 
        pdfOffsetX: number, 
        pdfOffsetY: number, 
        renderW: number, 
        renderH: number
    ) => {
        const inputRect = input.getBoundingClientRect();
        if (inputRect.width === 0 || inputRect.height === 0) return;

        const addLinkForElement = (selector: string, url: string) => {
            if (!url) return;
            const el = input.querySelector(selector) as HTMLElement;
            if (el) {
                const elRect = el.getBoundingClientRect();
                const relX = (elRect.left - inputRect.left) / inputRect.width;
                const relY = (elRect.top - inputRect.top) / inputRect.height;
                const relW = elRect.width / inputRect.width;
                const relH = elRect.height / inputRect.height;

                const linkX = pdfOffsetX + (relX * renderW);
                const linkY = pdfOffsetY + (relY * renderH);
                const linkW = relW * renderW;
                const linkH = relH * renderH;

                try {
                    pdf.link(linkX, linkY, linkW, linkH, { url });
                } catch (e) {
                    console.warn("Could not add PDF link annotation:", e);
                }
            }
        };

        const igUrl = settings.instagramUrl || 'https://instagram.com/mkposhakhouse';
        const gUrl = settings.googleReviewUrl || 'https://g.page/r/mkposhakhouse/review';
        const catUrl = settings.catalogWebsiteUrl || settings.shopWebsite || 'https://mkposhakhouse.com';
        
        addLinkForElement('#invoice-instagram-link', igUrl);
        addLinkForElement('#invoice-google-review-link', gUrl);
        addLinkForElement('#invoice-catalog-link', catUrl);
        
        if (settings.shopEmail) {
            addLinkForElement('#invoice-shop-email', `mailto:${settings.shopEmail}`);
        }
        if (settings.mobileNumber) {
            const cleanPhone = settings.mobileNumber.replace(/\D/g, '');
            if (cleanPhone) {
                addLinkForElement('#invoice-shop-phone', `tel:${cleanPhone}`);
            }
        }
    };

    const handleDownloadPdf = () => {
        if (!invoiceData) return;
        const input = document.querySelector('.printable-invoice') as HTMLElement;
        if (!input) return;

        setIsGeneratingPdf(true);
        html2canvas(input, {
            scale: 2, // High resolution capture
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false
        }).then(canvas => {
            // Use JPEG format with 0.88 quality for small file size (drops PDF from 8MB to ~150KB)
            const imgData = canvas.toDataURL('image/jpeg', 0.90);
            
            // Determine PDF dimensions based on layoutMode
            let pdf: jsPDF;
            let pdfWidth: number;
            let pdfHeight: number;

            if (layoutMode === 'mini') {
                // 80mm Receipt Slip format
                const slipWidthMm = 80;
                const slipHeightMm = Math.max(120, (canvas.height * slipWidthMm) / canvas.width);
                pdf = new jsPDF({
                    orientation: 'p',
                    unit: 'mm',
                    format: [slipWidthMm, slipHeightMm],
                    compress: true
                });
                pdfWidth = slipWidthMm;
                pdfHeight = slipHeightMm;
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
                addPdfLinks(pdf, input, 0, 0, pdfWidth, pdfHeight);
            } else if (layoutMode === 'compact') {
                // Compact Single-Page A5 or Fit-to-1-Page format
                const pageFormat = 'a5';
                pdf = new jsPDF({
                    orientation: 'p',
                    unit: 'mm',
                    format: pageFormat,
                    compress: true
                });
                pdfWidth = pdf.internal.pageSize.getWidth();
                pdfHeight = pdf.internal.pageSize.getHeight();

                const ratio = canvas.width / canvas.height;
                const margin = 4;
                const availableWidth = pdfWidth - (margin * 2);
                const availableHeight = pdfHeight - (margin * 2);

                let renderWidth = availableWidth;
                let renderHeight = renderWidth / ratio;

                if (renderHeight > availableHeight) {
                    renderHeight = availableHeight;
                    renderWidth = renderHeight * ratio;
                }

                const x = (pdfWidth - renderWidth) / 2;
                const y = margin;

                pdf.addImage(imgData, 'JPEG', x, y, renderWidth, renderHeight, undefined, 'FAST');
                addPdfLinks(pdf, input, x, y, renderWidth, renderHeight);
            } else {
                // Standard A4 format
                pdf = new jsPDF({
                    orientation: 'p',
                    unit: 'mm',
                    format: 'a4',
                    compress: true
                });
                pdfWidth = pdf.internal.pageSize.getWidth();
                pdfHeight = pdf.internal.pageSize.getHeight();

                const ratio = canvas.width / canvas.height;
                const margin = 8;
                const availableWidth = pdfWidth - (margin * 2);
                const availableHeight = pdfHeight - (margin * 2);

                let renderWidth = availableWidth;
                let renderHeight = renderWidth / ratio;

                if (renderHeight > availableHeight) {
                    renderHeight = availableHeight;
                    renderWidth = renderHeight * ratio;
                }

                const x = (pdfWidth - renderWidth) / 2;
                const y = margin;

                pdf.addImage(imgData, 'JPEG', x, y, renderWidth, renderHeight, undefined, 'FAST');
                addPdfLinks(pdf, input, x, y, renderWidth, renderHeight);
            }

            pdf.save(`Invoice-${invoiceData.invoiceNumber}.pdf`);
            setIsGeneratingPdf(false);
        }).catch(err => {
            console.error("PDF creation error:", err);
            setIsGeneratingPdf(false);
            alert("Failed to generate PDF. Please try again.");
        });
    };

     const generateInvoiceSummary = (invoice: Invoice): string => {
        const itemsSummary = invoice.items
            .map(item => `${item.quantity} x ${item.name} (${item.color}/${item.size})`)
            .join(', ');
        
        const igLink = settings.instagramUrl || 'https://instagram.com/mkposhakhouse';
        const reviewLink = settings.googleReviewUrl || 'https://g.page/r/mkposhakhouse/review';
        
        return `Hello ${invoice.customer.name},\n\nHere is a summary of your invoice ${invoice.invoiceNumber} from ${settings.shopName || 'M.K. Poshak House'}:\n\nItems: ${itemsSummary}\nTotal Amount: ${formatCurrency(invoice.total)}\n\n✨ Follow us on Instagram:\n${igLink}\n\n⭐ Give us a Google Review:\n${reviewLink}\n\nThank you for your business!`;
    };

    const handleSendWhatsApp = () => {
        if (!invoiceData || !invoiceData.customer.mobile) {
            alert("Customer mobile number not available.");
            return;
        };
        const phoneNumber = invoiceData.customer.mobile.replace(/\D/g, ''); // Sanitize phone number
        const message = generateInvoiceSummary(invoiceData);
        const encodedMessage = encodeURIComponent(message + "\n\nPlease download and attach the PDF for full invoice details.");
        const url = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
        window.open(url, '_blank');
    };

    const handleSendSms = () => {
        if (!invoiceData || !invoiceData.customer.mobile) {
            alert("Customer mobile number not available.");
            return;
        }
        const phoneNumber = invoiceData.customer.mobile.replace(/\D/g, '');
        const message = `Hi ${invoiceData.customer.name}, your invoice ${invoiceData.invoiceNumber} for ${formatCurrency(invoiceData.total)} is ready. Thank you!`;
        const encodedMessage = encodeURIComponent(message);
        const url = `sms:${phoneNumber}?body=${encodedMessage}`;
        window.location.href = url;
    };

    if (!isOpen || !invoiceData) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isOverdue = invoiceData.status === 'Pending' && invoiceData.dueDate && new Date(invoiceData.dueDate) < today;

    let statusText = invoiceData.status.toUpperCase();
    let statusColor = '#f59e0b'; // Tailwind yellow-500

    if (invoiceData.status === 'Paid') {
        statusColor = '#22c55e'; // Tailwind green-500
    } else if (isOverdue) {
        statusText = 'OVERDUE';
        statusColor = '#ef4444'; // Tailwind red-500
    }


    return (
        <>
            <style>
                {`
                @media print {
                  body * {
                    visibility: hidden !important;
                  }
                  .printable-invoice, .printable-invoice * {
                    visibility: visible !important;
                  }
                  .printable-invoice {
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    margin: 0 !important;
                    padding: 12mm !important;
                    color: black !important;
                    background: white !important;
                    box-shadow: none !important;
                  }
                  .no-print {
                    display: none !important;
                  }
                  @page {
                    size: ${layoutMode === 'compact' ? 'A5' : layoutMode === 'mini' ? '80mm auto' : 'A4'};
                    margin: 4mm;
                  }
                }
              `}
            </style>
            <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-start p-2 sm:p-4 no-print overflow-y-auto" onClick={onClose}>
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-4xl my-4 sm:my-6" onClick={e => e.stopPropagation()}>
                    {/* Header Action Bar */}
                    <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 flex flex-wrap justify-between items-center gap-3">
                         <div>
                            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span>Invoice Preview</span>
                                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                                    layoutMode === 'compact' 
                                        ? 'bg-[#169375]/10 text-[#169375] border-[#169375]/30 dark:bg-[#169375]/20 dark:text-[#38d4ad] dark:border-[#169375]/40' 
                                        : layoutMode === 'mini'
                                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                                        : 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800'
                                }`}>
                                    {layoutMode === 'compact' ? '⚡ Compact (Fit 1 Page)' : layoutMode === 'mini' ? '🧾 Mini Slip (80mm)' : '📄 Standard A4'}
                                </span>
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Professional Template (#169375 & #FFFFFF) • Lightweight & Fast PDF
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={handleDownloadPdf}
                                disabled={isGeneratingPdf}
                                className="flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm text-white font-semibold rounded-lg shadow-sm hover:opacity-90 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-[#169375] disabled:opacity-50 disabled:cursor-wait"
                                style={{ backgroundColor: '#169375' }}
                                title="Download Small Size PDF"
                            >
                                <DownloadIcon className="w-4 h-4" />
                                <span>{isGeneratingPdf ? 'Generating...' : 'Download PDF'}</span>
                            </button>
                            <button
                                onClick={handleSendWhatsApp}
                                className="flex items-center gap-1.5 px-2.5 py-2 text-xs sm:text-sm bg-green-600 text-white font-semibold rounded-lg shadow-sm hover:bg-green-700 active:scale-95 transition-all"
                                title="Send via WhatsApp"
                            >
                                <WhatsAppIcon className="w-4 h-4" />
                                <span className="hidden sm:inline">WhatsApp</span>
                            </button>
                            <button
                                onClick={handleSendSms}
                                className="flex items-center gap-1.5 px-2.5 py-2 text-xs sm:text-sm bg-sky-600 text-white font-semibold rounded-lg shadow-sm hover:bg-sky-700 active:scale-95 transition-all"
                                title="Send via SMS"
                            >
                                <SmsIcon className="w-4 h-4" />
                                <span className="hidden sm:inline">SMS</span>
                            </button>
                            <button
                                onClick={handlePrint}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm bg-slate-700 dark:bg-slate-600 text-white font-semibold rounded-lg shadow-sm hover:bg-slate-800 active:scale-95 transition-all"
                                title="Print Invoice"
                            >
                                Print
                            </button>
                            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Close modal">
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Secondary Customization Bar: Size Mode, Text Zoom Scale & Logo Size */}
                    <div className="no-print bg-slate-50 dark:bg-slate-750/80 px-4 sm:px-6 py-2.5 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
                        
                        {/* Size / Layout Format Selector */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-slate-600 dark:text-slate-300 mr-1">📐 Layout Size:</span>
                            <button
                                type="button"
                                onClick={() => handleLayoutModeChange('compact')}
                                className={`px-2.5 py-1 rounded-md font-medium text-xs border transition-all ${
                                    layoutMode === 'compact'
                                        ? 'text-white font-bold shadow-xs'
                                        : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                                }`}
                                style={{
                                    backgroundColor: layoutMode === 'compact' ? '#169375' : undefined,
                                    borderColor: layoutMode === 'compact' ? '#169375' : undefined
                                }}
                                title="Small size compact layout, fits neatly on single page"
                            >
                                ⚡ Small / Compact (Fit 1 Page)
                            </button>
                            <button
                                type="button"
                                onClick={() => handleLayoutModeChange('standard')}
                                className={`px-2.5 py-1 rounded-md font-medium text-xs border transition-all ${
                                    layoutMode === 'standard'
                                        ? 'text-white font-bold shadow-xs'
                                        : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                                }`}
                                style={{
                                    backgroundColor: layoutMode === 'standard' ? '#169375' : undefined,
                                    borderColor: layoutMode === 'standard' ? '#169375' : undefined
                                }}
                                title="Classic Standard A4 Layout"
                            >
                                📄 Standard A4
                            </button>
                            <button
                                type="button"
                                onClick={() => handleLayoutModeChange('mini')}
                                className={`px-2.5 py-1 rounded-md font-medium text-xs border transition-all ${
                                    layoutMode === 'mini'
                                        ? 'text-white font-bold shadow-xs'
                                        : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                                }`}
                                style={{
                                    backgroundColor: layoutMode === 'mini' ? '#169375' : undefined,
                                    borderColor: layoutMode === 'mini' ? '#169375' : undefined
                                }}
                                title="80mm Thermal Pocket Receipt"
                            >
                                🧾 80mm Slip
                            </button>
                        </div>

                        {/* Overall Zoom / Scale Plus-Minus */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-600 dark:text-slate-300">🔍 Text Scale:</span>
                            <button
                                type="button"
                                onClick={() => handleZoomChange(-5)}
                                disabled={zoomScale <= 70}
                                className="w-6 h-6 flex items-center justify-center font-black text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded shadow-xs hover:bg-[#169375]/10 hover:text-[#169375] disabled:opacity-35 transition-all"
                                title="Make invoice smaller (-5%)"
                            >
                                -
                            </button>
                            <span className="font-mono font-bold text-xs px-2 py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-[#169375] dark:text-[#38d4ad] min-w-[46px] text-center">
                                {zoomScale}%
                            </span>
                            <button
                                type="button"
                                onClick={() => handleZoomChange(5)}
                                disabled={zoomScale >= 120}
                                className="w-6 h-6 flex items-center justify-center font-black text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded shadow-xs hover:bg-[#169375]/10 hover:text-[#169375] disabled:opacity-35 transition-all"
                                title="Make invoice bigger (+5%)"
                            >
                                +
                            </button>
                            {zoomScale !== 90 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setZoomScale(90);
                                        try { localStorage.setItem('invoice_zoom_scale', '90'); } catch(e) {}
                                    }}
                                    className="text-[11px] text-slate-400 hover:text-slate-700 underline"
                                >
                                    Reset
                                </button>
                            )}
                        </div>

                        {/* Logo Plus / Minus */}
                        {businessLogo && (
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-600 dark:text-slate-300">🖼️ Logo:</span>
                                <button
                                    type="button"
                                    onClick={() => handleUpdateLogoSize(logoSize - 6)}
                                    disabled={logoSize <= 20}
                                    className="w-6 h-6 flex items-center justify-center font-black text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded shadow-xs hover:bg-[#169375]/10 hover:text-[#169375] disabled:opacity-35 transition-all"
                                    title="Decrease Logo Size"
                                >
                                    -
                                </button>
                                <span className="font-mono text-xs px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded font-semibold text-slate-700 dark:text-slate-300">
                                    {logoSize}px
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleUpdateLogoSize(logoSize + 6)}
                                    disabled={logoSize >= 160}
                                    className="w-6 h-6 flex items-center justify-center font-black text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded shadow-xs hover:bg-[#169375]/10 hover:text-[#169375] disabled:opacity-35 transition-all"
                                    title="Increase Logo Size"
                                >
                                    +
                                </button>
                            </div>
                        )}
                    </div>
                    
                    {/* Rendered Invoice Canvas / Printable Area */}
                    <div className="p-2 sm:p-5 bg-slate-100 dark:bg-slate-900/50 flex justify-center">
                        <div 
                            className={`printable-invoice relative bg-white text-slate-800 shadow-xl border border-slate-200 overflow-hidden transition-all ${
                                layoutMode === 'compact' 
                                    ? 'p-0 max-w-2xl w-full text-xs rounded-xl' 
                                    : layoutMode === 'mini'
                                    ? 'p-0 max-w-[360px] w-full text-xs rounded-xl font-mono'
                                    : 'p-0 max-w-3xl w-full text-sm rounded-xl'
                            }`}
                            style={{
                                fontSize: `${(zoomScale / 100) * (layoutMode === 'compact' ? 12 : layoutMode === 'mini' ? 11 : 13.5)}px`,
                                minHeight: layoutMode === 'compact' ? '680px' : '820px'
                            }}
                        >
                            {/* TOP HEADER SECTION */}
                            <div className="flex justify-between items-start">
                                {/* Top-Left Teal Banner with Curved Bottom-Right Corner */}
                                <div 
                                    className="text-white pt-6 pb-6 px-6 sm:px-8 w-[58%] sm:w-[52%] shadow-sm"
                                    style={{
                                        backgroundColor: '#169375',
                                        borderBottomRightRadius: '68px'
                                    }}
                                >
                                    <h1 className="text-2xl sm:text-3xl font-black tracking-wider text-white font-sans">
                                        INVOICE
                                    </h1>
                                    <div className="mt-2 space-y-0.5 text-white/95 font-medium text-[11px] sm:text-xs">
                                        <p><span className="font-bold opacity-90">No.</span> {invoiceData.invoiceNumber}</p>
                                        <p><span className="font-bold opacity-90">Date.</span> {formatDate(invoiceData.date)}</p>
                                        {invoiceData.dueDate && (
                                            <p><span className="font-bold opacity-90">Due.</span> {formatDate(invoiceData.dueDate)}</p>
                                        )}
                                    </div>
                                    <div className="w-16 h-0.5 bg-white/70 mt-2.5 rounded-full" />
                                </div>

                                {/* Top-Right Company Logo & Branding */}
                                <div className="p-5 sm:p-6 text-right w-[42%] sm:w-[48%] flex flex-col items-end justify-center">
                                    {businessLogo ? (
                                        <div className="relative inline-block group">
                                            <img 
                                                src={businessLogo} 
                                                alt="Company Logo" 
                                                style={{ height: `${logoSize}px`, maxHeight: `${logoSize}px` }} 
                                                className="w-auto object-contain transition-all duration-150 ml-auto" 
                                            />
                                            {/* Inline Quick Resizer on Hover */}
                                            <div className="no-print absolute -bottom-3 right-0 flex items-center gap-1 bg-slate-900/90 text-white px-2 py-0.5 rounded-full shadow-lg border border-slate-750 opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">
                                                <span className="text-slate-300">Logo:</span>
                                                <button 
                                                    type="button"
                                                    onClick={() => handleUpdateLogoSize(logoSize - 6)}
                                                    disabled={logoSize <= 20}
                                                    className="w-3.5 h-3.5 flex items-center justify-center font-bold bg-slate-700 hover:bg-[#169375] disabled:opacity-30 rounded text-white"
                                                    title="Decrease Logo Size (-)"
                                                >
                                                    -
                                                </button>
                                                <span className="font-mono px-0.5">{logoSize}px</span>
                                                <button 
                                                    type="button"
                                                    onClick={() => handleUpdateLogoSize(logoSize + 6)}
                                                    disabled={logoSize >= 160}
                                                    className="w-3.5 h-3.5 flex items-center justify-center font-bold bg-slate-700 hover:bg-[#169375] disabled:opacity-30 rounded text-white"
                                                    title="Increase Logo Size (+)"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-right">
                                            <h2 className="text-lg sm:text-xl font-extrabold text-[#169375] tracking-tight">
                                                M.K. POSHAK HOUSE
                                            </h2>
                                            <p className="text-[10px] text-slate-400 font-medium">Exclusive Ethnic & Bridal Wear</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* BILL TO & PAYMENT METHOD SECTION */}
                            <div className="px-6 sm:px-8 pt-4 pb-2 grid grid-cols-2 gap-4 sm:gap-8 text-xs">
                                {/* Bill to Column */}
                                <div>
                                    <h3 className="font-bold text-slate-800 text-[12px] sm:text-sm mb-1.5 flex items-center gap-1.5">
                                        <span>Bill to.</span>
                                    </h3>
                                    <div className="space-y-1 text-slate-600">
                                        <div className="grid grid-cols-[56px_8px_1fr] items-start">
                                            <span className="font-medium text-slate-500">Name</span>
                                            <span className="text-slate-400">:</span>
                                            <span className="font-bold text-slate-900">{invoiceData.customer.name}</span>
                                        </div>
                                        {invoiceData.customer.mobile && (
                                            <div className="grid grid-cols-[56px_8px_1fr] items-start">
                                                <span className="font-medium text-slate-500">Phone</span>
                                                <span className="text-slate-400">:</span>
                                                <span className="font-mono text-slate-800">{invoiceData.customer.mobile}</span>
                                            </div>
                                        )}
                                        {invoiceData.customer.address && (
                                            <div className="grid grid-cols-[56px_8px_1fr] items-start">
                                                <span className="font-medium text-slate-500">Address</span>
                                                <span className="text-slate-400">:</span>
                                                <span className="text-slate-700 whitespace-pre-line text-[11px] leading-tight">
                                                    {invoiceData.customer.address}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Payment Method Column */}
                                <div className="text-right">
                                    <h3 className="font-bold text-slate-800 text-[12px] sm:text-sm mb-1.5">
                                        Payment Method.
                                    </h3>
                                    <div className="space-y-1 text-slate-600 inline-block text-left">
                                        <div className="grid grid-cols-[80px_8px_1fr] items-start">
                                            <span className="font-medium text-slate-500">Mode</span>
                                            <span className="text-slate-400">:</span>
                                            <span className="font-semibold text-slate-800">{invoiceData.paymentMethod || 'Cash / UPI'}</span>
                                        </div>
                                        <div className="grid grid-cols-[80px_8px_1fr] items-start">
                                            <span className="font-medium text-slate-500">Status</span>
                                            <span className="text-slate-400">:</span>
                                            <span 
                                                className="font-bold uppercase text-[10px] px-1.5 py-0.2 rounded"
                                                style={{ color: statusColor, backgroundColor: `${statusColor}15` }}
                                            >
                                                {statusText}
                                            </span>
                                        </div>
                                        {settings.paymentQrCode && (
                                            <div className="pt-1 flex justify-end">
                                                <img 
                                                    src={settings.paymentQrCode} 
                                                    alt="Scan to pay" 
                                                    className="w-14 h-14 object-contain border border-slate-200 rounded p-0.5 bg-white shadow-2xs" 
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* ITEM DESCRIPTION TABLE */}
                            <div className="px-6 sm:px-8 my-4">
                                <table className="w-full text-left border-collapse">
                                    {/* Teal Rounded Header Capsule */}
                                    <thead>
                                        <tr 
                                            className="text-white font-bold text-[11px] uppercase tracking-wider shadow-xs"
                                            style={{ backgroundColor: '#169375' }}
                                        >
                                            <th className="py-2.5 px-3 rounded-l-full text-center w-10">No.</th>
                                            <th className="py-2.5 px-3">ITEM DESCRIPTION</th>
                                            <th className="py-2.5 px-2 text-center w-14">QTY</th>
                                            <th className="py-2.5 px-3 text-right w-24">PRICE</th>
                                            <th className="py-2.5 px-4 rounded-r-full text-right w-28">TOTAL</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-transparent">
                                        {invoiceData.items.map((item, idx) => {
                                            const isEven = idx % 2 === 1;
                                            return (
                                                <tr 
                                                    key={item.id || idx}
                                                    className={`transition-colors ${
                                                        isEven 
                                                            ? 'bg-[#e4f5f0] text-slate-800 rounded-full' 
                                                            : 'bg-white text-slate-800'
                                                    }`}
                                                    style={{
                                                        borderRadius: isEven ? '9999px' : '0px'
                                                    }}
                                                >
                                                    <td className={`py-2 px-3 text-center font-bold text-slate-500 ${isEven ? 'rounded-l-full' : ''}`}>
                                                        {idx + 1}
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <span className="font-bold text-slate-900">{item.name}</span>
                                                        {(item.color || item.size) && (
                                                            <span className="text-[10px] text-slate-500 ml-2 font-normal">
                                                                ({[item.color, item.size].filter(Boolean).join(' • ')})
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-2 text-center font-semibold">{item.quantity}</td>
                                                    <td className="py-2 px-3 text-right font-mono text-slate-700">{formatCurrency(item.price)}</td>
                                                    <td className={`py-2 px-4 text-right font-bold text-slate-900 font-mono ${isEven ? 'rounded-r-full' : ''}`}>
                                                        {formatCurrency(item.total)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                {/* Table Underline and Totals Summary */}
                                <div className="border-b-2 mt-2 pt-2 pb-3" style={{ borderColor: '#169375' }}>
                                    <div className="flex flex-col items-end space-y-1 text-right">
                                        {invoiceData.discountAmount > 0 && (
                                            <>
                                                <div className="flex justify-between w-48 text-xs text-slate-600">
                                                    <span>Subtotal:</span>
                                                    <span className="font-mono">{formatCurrency(invoiceData.subtotal)}</span>
                                                </div>
                                                <div className="flex justify-between w-48 text-xs text-[#169375] font-semibold">
                                                    <span>Discount:</span>
                                                    <span className="font-mono">- {formatCurrency(invoiceData.discountAmount)}</span>
                                                </div>
                                            </>
                                        )}
                                        <div className="flex justify-between w-56 pt-1 text-sm font-black items-baseline">
                                            <span style={{ color: '#169375' }}>Grand Total</span>
                                            <span className="font-mono text-base sm:text-lg" style={{ color: '#169375' }}>
                                                {formatCurrency(invoiceData.total)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* FOOTER & TERMS & CONTACT SECTION */}
                            <div className="px-6 sm:px-8 pt-2 pb-8 grid grid-cols-2 gap-4 sm:gap-8 items-start text-xs">
                                {/* Left Side: Signatory, Contact Details & Social / Review QR Codes */}
                                <div>
                                    <p className="text-slate-500 font-medium">Best Regards,</p>
                                    <p className="font-bold text-slate-900 mt-0.5">
                                        {settings.ownerName || settings.shopName || 'M.K. Poshak House'}
                                    </p>
                                    <div className="w-40 border-b border-slate-300 my-2" />

                                    <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mt-2.5 mb-1">
                                        Contact.
                                    </h4>
                                    <div className="space-y-1 text-slate-600 text-[11px]">
                                        <div className="grid grid-cols-[48px_8px_1fr] items-start">
                                            <span className="text-slate-500 font-medium">Phone</span>
                                            <span>:</span>
                                            <a 
                                                id="invoice-shop-phone"
                                                href={`tel:${(settings.mobileNumber || activeBranch?.phone || '').replace(/\D/g, '')}`}
                                                className="font-mono text-slate-800 hover:text-[#169375] hover:underline"
                                            >
                                                {settings.mobileNumber || activeBranch?.phone || '+91 98765 43210'}
                                            </a>
                                        </div>
                                        <div className="grid grid-cols-[48px_8px_1fr] items-start">
                                            <span className="text-slate-500 font-medium">Mail</span>
                                            <span>:</span>
                                            <a 
                                                id="invoice-shop-email"
                                                href={`mailto:${settings.shopEmail || 'mkposhakhouse@gmail.com'}`}
                                                className="text-slate-700 hover:text-[#169375] hover:underline truncate"
                                            >
                                                {settings.shopEmail || 'mkposhakhouse@gmail.com'}
                                            </a>
                                        </div>
                                        <div className="grid grid-cols-[48px_8px_1fr] items-start">
                                            <span className="text-slate-500 font-medium">Store</span>
                                            <span>:</span>
                                            <span className="text-slate-800 font-medium whitespace-pre-line leading-tight">
                                                {settings.shopAddress || activeBranch?.address || 'Shop 1, Main Market, Surat, Gujarat - 395002'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Social, Google Review & Website Catalog 3 QR Codes in 1 Row (No Box, Vertical Alignment with Heading) */}
                                    <div className="mt-3 pt-2.5 border-t border-slate-200/90 w-full">
                                        {/* Heading for QR Codes */}
                                        <div className="mb-2 text-[9.5px] sm:text-[10.5px] font-semibold text-slate-700 tracking-tight flex items-center gap-1">
                                            <span className="text-[#169375] font-bold">✦</span>
                                            <span>Click on QR code to <strong className="text-slate-900 font-bold">Follow, Rate Us &amp; View Catalog</strong></span>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 sm:gap-3 items-center text-center w-full">
                                            {/* 1. Instagram QR */}
                                            {instagramQrSrc && (
                                                <a 
                                                    id="invoice-instagram-link"
                                                    href={settings.instagramUrl || 'https://instagram.com/mkposhakhouse'}
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    title="Click or scan to open Instagram"
                                                    className="group flex flex-col items-center text-center cursor-pointer no-underline text-inherit transition-all"
                                                >
                                                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-800 tracking-tight leading-tight mb-1 group-hover:text-[#169375] transition-colors truncate w-full">
                                                        Instagram
                                                    </span>
                                                    <img 
                                                        src={instagramQrSrc} 
                                                        alt="Instagram QR" 
                                                        className="w-13 h-13 sm:w-15 sm:h-15 md:w-16 md:h-16 object-contain rounded bg-white p-0.5 border border-slate-200 group-hover:scale-105 group-hover:border-[#169375] transition-all" 
                                                    />
                                                    <span className="text-[9px] sm:text-[10px] font-extrabold text-[#169375] tracking-tight leading-tight mt-1 group-hover:underline truncate w-full">
                                                        Follow Us
                                                    </span>
                                                </a>
                                            )}

                                            {/* 2. Google Review QR */}
                                            {googleReviewQrSrc && (
                                                <a 
                                                    id="invoice-google-review-link"
                                                    href={settings.googleReviewUrl || 'https://g.page/r/mkposhakhouse/review'}
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    title="Click or scan to open Google Review"
                                                    className="group flex flex-col items-center text-center cursor-pointer no-underline text-inherit transition-all"
                                                >
                                                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-800 tracking-tight leading-tight mb-1 group-hover:text-[#169375] transition-colors truncate w-full">
                                                        Google Review
                                                    </span>
                                                    <img 
                                                        src={googleReviewQrSrc} 
                                                        alt="Google Review QR" 
                                                        className="w-13 h-13 sm:w-15 sm:h-15 md:w-16 md:h-16 object-contain rounded bg-white p-0.5 border border-slate-200 group-hover:scale-105 group-hover:border-[#169375] transition-all" 
                                                    />
                                                    <span className="text-[9px] sm:text-[10px] font-extrabold text-[#169375] tracking-tight leading-tight mt-1 group-hover:underline truncate w-full">
                                                        Rate Us
                                                    </span>
                                                </a>
                                            )}

                                            {/* 3. Website Catalog QR */}
                                            {catalogQrSrc && (
                                                <a 
                                                    id="invoice-catalog-link"
                                                    href={settings.catalogWebsiteUrl || settings.shopWebsite || 'https://mkposhakhouse.com'}
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    title="Click or scan to open Online Catalog Website"
                                                    className="group flex flex-col items-center text-center cursor-pointer no-underline text-inherit transition-all"
                                                >
                                                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-800 tracking-tight leading-tight mb-1 group-hover:text-[#169375] transition-colors truncate w-full">
                                                        Catalog
                                                    </span>
                                                    <img 
                                                        src={catalogQrSrc} 
                                                        alt="Catalog Website QR" 
                                                        className="w-13 h-13 sm:w-15 sm:h-15 md:w-16 md:h-16 object-contain rounded bg-white p-0.5 border border-slate-200 group-hover:scale-105 group-hover:border-[#169375] transition-all" 
                                                    />
                                                    <span className="text-[9px] sm:text-[10px] font-extrabold text-[#169375] tracking-tight leading-tight mt-1 group-hover:underline truncate w-full">
                                                        View Catalog
                                                    </span>
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: Thank You & Terms */}
                                <div>
                                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-sans">
                                        THANK YOU
                                    </h2>
                                    <div className="mt-2 text-slate-600 text-[11px] leading-relaxed">
                                        <p className="font-bold text-slate-700 mb-0.5">Terms and Condition.</p>
                                        <p className="text-slate-500">
                                            {invoiceData.notes || 'Goods once sold will not be returned. Exchange permitted within 7 days with original invoice. Thank you for your business!'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Bottom-Right Teal Decorative Curved Block */}
                            <div 
                                className="absolute bottom-0 right-0 w-28 sm:w-36 h-6 sm:h-7"
                                style={{
                                    backgroundColor: '#169375',
                                    borderTopLeftRadius: '32px'
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default InvoicePreviewModal;
