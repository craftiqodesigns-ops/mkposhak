import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { DashboardData } from '../types';
import { XIcon } from './icons/XIcon';
import { DownloadIcon } from './icons/DownloadIcon';

interface BulkQrCodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    itemsData: DashboardData[];
    businessLogo: string | null;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
    }).format(amount);
};

const SETTINGS_KEY = 'qr_settings_bulk';

const NumberInput = ({ label, value, onChange, min = 0, step = 1 }: { label: string, value: number, onChange: (val: number) => void, min?: number, step?: number }) => (
    <div>
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
        <div className="flex rounded-md shadow-sm h-8">
            <button
                type="button"
                onClick={() => onChange(Math.max(min, Number((value - step).toFixed(2))))}
                className="px-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-l-md hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 font-bold"
            >
                -
            </button>
            <input
                type="number"
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="flex-1 min-w-0 block w-full px-2 bg-white dark:bg-slate-700 border-t border-b border-slate-300 dark:border-slate-600 text-center text-xs focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
            />
            <button
                type="button"
                onClick={() => onChange(Number((value + step).toFixed(2)))}
                className="px-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-r-md hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 font-bold"
            >
                +
            </button>
        </div>
    </div>
);

interface LabelProps {
    item: DashboardData;
    businessLogo: string | null;
    settings: {
        width: number;
        height: number;
        codeSize: number;
        format: 'qr' | 'barcode';
        fontSize: number;
        logoSize: number;
    };
}

const QrCodeLabel: React.FC<LabelProps> = React.memo(({ item, businessLogo, settings }) => {
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const barcodeRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (settings.format === 'qr') {
            const qrData = JSON.stringify({
                variantId: item.variantId,
                name: item.name,
                color: item.color,
                size: item.size,
            });
            QRCode.toDataURL(qrData, { width: 300, margin: 1 }, (err, url) => {
                if (err) console.error('QR Code generation failed:', err);
                else setQrCodeUrl(url);
            });
        } else {
             if (barcodeRef.current) {
                try {
                    JsBarcode(barcodeRef.current, item.variantId, {
                        format: "CODE128",
                        width: 1.5, // Thinner bars for small labels
                        height: 40,
                        displayValue: true,
                        fontSize: 10,
                        margin: 0,
                        background: "transparent"
                    });
                } catch (e) {
                    console.error("Barcode generation failed", e);
                }
            }
        }
    }, [item, settings.format]);
    
    const hasDiscount = item.discountPercentage && item.discountPercentage > 0 && item.saleRealPrice;

    return (
        <div 
            className="qr-label-container bg-white text-black"
            style={{
                width: `${settings.width}mm`,
                height: `${settings.height}mm`,
                border: 'none',
                padding: '2mm',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxSizing: 'border-box',
                overflow: 'hidden',
                pageBreakInside: 'avoid',
                color: 'black', // Force black text for print
                position: 'relative'
            }}
        >
            {/* Header: Logo and Item Name (flex-shrink-0 to prevent clipping/overlap) */}
            <div className="flex flex-col items-center w-full flex-shrink-0 text-center">
                {businessLogo && (
                    <img 
                        src={businessLogo} 
                        alt="Logo" 
                        style={{ 
                            height: `${settings.logoSize}px`, 
                            maxHeight: '26px',
                            maxWidth: '100%',
                            objectFit: 'contain', 
                            marginBottom: '1px' 
                        }} 
                    />
                )}
                <h4 
                    style={{ 
                        fontSize: `${settings.fontSize}px`, 
                        fontWeight: 'bold', 
                        lineHeight: 1.15, 
                        textAlign: 'center', 
                        margin: 0, 
                        width: '100%', 
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        overflow: 'hidden', 
                        color: 'black' 
                    }}
                >
                    {item.name}
                </h4>
            </div>
            
            {/* Middle: QR Code / Barcode (dynamically scales to remaining space) */}
            <div 
                style={{ 
                    flex: '1 1 0%', 
                    minHeight: 0, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    width: '100%', 
                    overflow: 'hidden', 
                    margin: '1px 0' 
                }}
            >
                {settings.format === 'qr' ? (
                    qrCodeUrl ? (
                        <img 
                            src={qrCodeUrl} 
                            alt="QR" 
                            style={{ 
                                width: `${settings.codeSize}mm`, 
                                height: `${settings.codeSize}mm`, 
                                maxWidth: '100%', 
                                maxHeight: '100%', 
                                objectFit: 'contain',
                                display: 'block'
                            }} 
                        />
                    ) : (
                        <div style={{ width: `${settings.codeSize}mm`, height: `${settings.codeSize}mm`, maxWidth: '100%', maxHeight: '100%', background: '#eee' }}></div>
                    )
                ) : (
                     <svg 
                        ref={barcodeRef} 
                        style={{ 
                            width: '100%', 
                            height: `${settings.codeSize}mm`, 
                            maxWidth: '100%', 
                            maxHeight: '100%', 
                            objectFit: 'contain',
                            display: 'block'
                        }}
                    ></svg>
                )}
            </div>

            {/* Footer: Color / Size & Price (flex-shrink-0) */}
            <div className="text-center w-full flex-shrink-0">
                <p style={{ fontSize: `${Math.max(8, settings.fontSize - 3)}px`, color: 'black', margin: 0, lineHeight: 1.15 }}>
                    {item.color} / {item.size}
                </p>
                <div style={{ lineHeight: 1, marginTop: '1px' }}>
                     {hasDiscount ? (
                        <div className="flex items-center justify-center gap-1">
                            <span style={{ fontSize: `${Math.max(8, settings.fontSize - 3)}px`, textDecoration: 'line-through', color: '#555' }}>
                                {formatCurrency(item.saleRealPrice ?? 0)}
                            </span>
                            <span style={{ fontSize: `${settings.fontSize + 1}px`, fontWeight: 'bold', color: 'black' }}>
                                {formatCurrency(item.sellingPrice ?? 0)}
                            </span>
                        </div>
                    ) : (
                        <p style={{ fontSize: `${settings.fontSize + 1}px`, fontWeight: 'bold', margin: 0, color: 'black' }}>
                            {formatCurrency(item.sellingPrice ?? item.avgSalePrice ?? 0)}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
});

const BulkQrCodeModal: React.FC<BulkQrCodeModalProps> = ({ isOpen, onClose, itemsData, businessLogo }) => {
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number } | null>(null);
    
    // Load settings from localStorage or default
    const getInitialSettings = () => {
        const saved = localStorage.getItem(SETTINGS_KEY);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error("Failed to parse saved settings", e);
            }
        }
        return {
            labelWidth: 50,
            labelHeight: 50,
            codeSize: 30,
            format: 'qr' as 'qr' | 'barcode',
            fontSize: 12,
            logoSize: 12,
            gap: 2
        };
    };

    const [settings, setSettings] = useState(getInitialSettings());

    // Destructure for easier usage
    const { labelWidth, labelHeight, codeSize, format, fontSize, logoSize, gap } = settings;

    // Helper to update specific setting
    const updateSetting = (key: string, value: any) => {
        setSettings((prev: any) => {
            const newSettings = { ...prev, [key]: value };
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
            return newSettings;
        });
    };

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPdf = async () => {
        if (!itemsData || itemsData.length === 0) return;
        
        const gridEl = document.querySelector('.printable-qr-grid') as HTMLElement;
        if (!gridEl) return;
        
        const labelEls = Array.from(gridEl.querySelectorAll('.qr-label-container')) as HTMLElement[];
        if (labelEls.length === 0) return;

        setIsGeneratingPdf(true);
        setPdfProgress({ current: 0, total: labelEls.length });

        try {
            // Standard A4 page dimensions in mm
            const pageWidth = 210;
            const pageHeight = 297;
            const margin = 8; // 8mm margin around A4 page
            
            const usableWidth = pageWidth - (2 * margin);
            const usableHeight = pageHeight - (2 * margin);
            
            // Calculate grid columns and rows per A4 page
            const colCount = Math.max(1, Math.floor((usableWidth + gap) / (labelWidth + gap)));
            const rowCount = Math.max(1, Math.floor((usableHeight + gap) / (labelHeight + gap)));
            const labelsPerPage = colCount * rowCount;
            
            // Calculate centered offsets on the A4 page
            const totalGridWidth = colCount * labelWidth + (colCount - 1) * gap;
            const totalGridHeight = rowCount * labelHeight + (rowCount - 1) * gap;
            const offsetX = Math.max(margin, (pageWidth - totalGridWidth) / 2);
            const offsetY = Math.max(margin, (pageHeight - totalGridHeight) / 2);

            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
                compress: true,
            });

            for (let i = 0; i < labelEls.length; i++) {
                const labelEl = labelEls[i];
                setPdfProgress({ current: i + 1, total: labelEls.length });

                // Render each label with html2canvas at 3x scale for crisp QR/barcode scanning
                const canvas = await html2canvas(labelEl, {
                    scale: 3,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    logging: false,
                });

                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                const indexOnPage = i % labelsPerPage;

                // Add a new A4 page if current page is full
                if (i > 0 && indexOnPage === 0) {
                    pdf.addPage('a4', 'portrait');
                }

                const col = indexOnPage % colCount;
                const row = Math.floor(indexOnPage / colCount);
                const x = offsetX + col * (labelWidth + gap);
                const y = offsetY + row * (labelHeight + gap);

                pdf.addImage(imgData, 'JPEG', x, y, labelWidth, labelHeight);
            }

            const today = new Date().toISOString().slice(0, 10);
            pdf.save(`MK_Bulk_Tags_${today}.pdf`);
        } catch (error) {
            console.error('Error generating bulk PDF:', error);
            alert('Failed to generate PDF. Please try again or use the Print button.');
        } finally {
            setIsGeneratingPdf(false);
            setPdfProgress(null);
        }
    };
    
    const handleSwapDimensions = () => {
        setSettings((prev: any) => {
            const newSettings = { ...prev, labelWidth: prev.labelHeight, labelHeight: prev.labelWidth };
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
            return newSettings;
        });
    };

    if (!isOpen || !itemsData) return null;

    return (
        <>
            <style>
                {`
                @media print {
                  html, body {
                    height: auto !important;
                    overflow: visible !important;
                    background-color: white !important;
                    margin: 0 !important;
                    padding: 0 !important;
                  }

                  /* Hide all UI elements including the modal wrapper */
                  #root > *, .fixed, .hide-on-print {
                    display: none !important;
                  }
                  
                  /* Ensure the settings sidebar is hidden */
                  .space-y-4 {
                     display: none !important;
                  }

                  /* Reset the modal container that holds the grid so it doesn't clip content */
                  .bg-white.rounded-lg.shadow-2xl {
                    position: static !important;
                    box-shadow: none !important;
                    width: 100% !important;
                    max-width: none !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: visible !important;
                    display: block !important;
                  }

                  /* Target the printable grid specifically */
                  .printable-qr-grid {
                    visibility: visible !important;
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    background: white !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    z-index: 9999 !important;
                    display: flex !important;
                    flex-wrap: wrap !important;
                    gap: ${gap}mm !important;
                  }

                  /* Ensure all children of the grid are visible */
                  .printable-qr-grid * {
                    visibility: visible !important;
                    color: black !important; /* Force black text */
                  }
                  
                  .qr-label-container {
                    border: none !important;
                    break-inside: avoid;
                    page-break-inside: avoid;
                    background-color: white !important;
                    color: black !important;
                  }

                  @page {
                    size: A4; 
                    margin: 10mm; 
                  }
                }
              `}
            </style>
            <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-start p-4 overflow-y-auto" onClick={onClose}>
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-7xl my-8 flex flex-col md:flex-row gap-6 p-6" onClick={e => e.stopPropagation()}>
                    
                    {/* Settings Sidebar */}
                    <div className="w-full md:w-1/4 min-w-[250px] space-y-4 hide-on-print">
                        <div className="flex justify-between items-center mb-2">
                             <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                Print Settings
                            </h2>
                            <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200" aria-label="Close modal">
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Code Format</label>
                            <div className="flex rounded-md shadow-sm" role="group">
                                <button
                                    type="button"
                                    onClick={() => updateSetting('format', 'qr')}
                                    className={`px-4 py-2 text-sm font-medium border border-slate-300 dark:border-slate-600 rounded-l-lg flex-1 ${format === 'qr' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600'}`}
                                >
                                    QR
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateSetting('format', 'barcode')}
                                    className={`px-4 py-2 text-sm font-medium border border-l-0 border-slate-300 dark:border-slate-600 rounded-r-lg flex-1 ${format === 'barcode' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600'}`}
                                >
                                    Barcode
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <NumberInput label="Width (mm)" value={labelWidth} onChange={v => updateSetting('labelWidth', v)} />
                            <NumberInput label="Height (mm)" value={labelHeight} onChange={v => updateSetting('labelHeight', v)} />
                        </div>
                        <button onClick={handleSwapDimensions} className="w-full py-1 text-xs bg-slate-200 dark:bg-slate-600 rounded hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-300">
                            Swap Dimensions
                        </button>

                        <div className="grid grid-cols-2 gap-3">
                            <NumberInput label="Code Size (mm)" value={codeSize} onChange={v => updateSetting('codeSize', v)} />
                            <NumberInput label="Font Size (px)" value={fontSize} onChange={v => updateSetting('fontSize', v)} />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                             <NumberInput label="Logo Size (px)" value={logoSize} onChange={v => updateSetting('logoSize', v)} />
                             <NumberInput label="Gap (mm)" value={gap} onChange={v => updateSetting('gap', v)} />
                        </div>

                        <div className="pt-4 flex flex-col gap-2">
                            <button
                                onClick={handleDownloadPdf}
                                disabled={isGeneratingPdf}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all cursor-pointer disabled:cursor-not-allowed"
                            >
                                {isGeneratingPdf ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4 text-white mr-1" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                                        </svg>
                                        Generating PDF {pdfProgress ? `(${pdfProgress.current}/${pdfProgress.total})` : '...'}
                                    </>
                                ) : (
                                    <>
                                        <DownloadIcon className="w-4 h-4" />
                                        Download PDF (A4 Sheet)
                                    </>
                                )}
                            </button>
                            <button
                                onClick={handlePrint}
                                disabled={isGeneratingPdf}
                                className="w-full px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
                            >
                                Print Labels ({itemsData.length})
                            </button>
                            <button
                                onClick={onClose}
                                disabled={isGeneratingPdf}
                                className="w-full px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors disabled:opacity-50"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                   
                    {/* Preview Grid */}
                    <div className="flex-grow bg-slate-100 dark:bg-slate-900 p-4 rounded-lg overflow-y-auto">
                        <div 
                            className="printable-qr-grid"
                            style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: `${gap}mm`,
                                justifyContent: 'flex-start',
                                alignContent: 'flex-start'
                            }}
                        >
                            {itemsData.map((item, index) => (
                                <QrCodeLabel 
                                    key={`${item.variantId}-${index}`} 
                                    item={item} 
                                    businessLogo={businessLogo} 
                                    settings={{ width: labelWidth, height: labelHeight, codeSize, format, fontSize, logoSize }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default BulkQrCodeModal;