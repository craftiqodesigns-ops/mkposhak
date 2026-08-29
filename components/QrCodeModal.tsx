import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { DashboardData } from '../types';
import { XIcon } from './icons/XIcon';
import { DownloadIcon } from './icons/DownloadIcon';

interface QrCodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    itemData: DashboardData | null;
    businessLogo: string | null;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
    }).format(amount);
};

const SETTINGS_KEY = 'qr_settings_single';

const NumberInput = ({ label, value, onChange, min = 0, step = 1 }: { label: string, value: number, onChange: (val: number) => void, min?: number, step?: number }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
        <div className="flex rounded-md shadow-sm">
            <button
                type="button"
                onClick={() => onChange(Math.max(min, Number((value - step).toFixed(2))))}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-l-md hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 font-bold"
            >
                -
            </button>
            <input
                type="number"
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="flex-1 min-w-0 block w-full px-3 py-2 bg-white dark:bg-slate-700 border-t border-b border-slate-300 dark:border-slate-600 text-center text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
            />
            <button
                type="button"
                onClick={() => onChange(Number((value + step).toFixed(2)))}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-r-md hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 font-bold"
            >
                +
            </button>
        </div>
    </div>
);

const QrCodeModal: React.FC<QrCodeModalProps> = ({ isOpen, onClose, itemData, businessLogo }) => {
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const barcodeRef = useRef<SVGSVGElement>(null);
    
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
            logoSize: 15
        };
    };

    const [settings, setSettings] = useState(getInitialSettings());

    // Destructure for easier usage
    const { labelWidth, labelHeight, codeSize, format, fontSize, logoSize } = settings;

    // Helper to update specific setting
    const updateSetting = (key: string, value: any) => {
        setSettings((prev: any) => {
            const newSettings = { ...prev, [key]: value };
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
            return newSettings;
        });
    };

    useEffect(() => {
        if (isOpen && itemData) {
            if (format === 'qr') {
                const qrData = JSON.stringify({
                    variantId: itemData.variantId,
                    name: itemData.name,
                    color: itemData.color,
                    size: itemData.size,
                });
                QRCode.toDataURL(qrData, { width: 400, margin: 1 }, (err, url) => {
                    if (err) console.error('QR Code generation failed:', err);
                    else setQrCodeUrl(url);
                });
            } else {
                if (barcodeRef.current) {
                    try {
                        JsBarcode(barcodeRef.current, itemData.variantId, {
                            format: "CODE128",
                            width: 2,
                            height: 50,
                            displayValue: true,
                            fontSize: 12,
                            margin: 0,
                            background: "transparent"
                        });
                    } catch (e) {
                        console.error("Barcode generation failed", e);
                    }
                }
            }
        }
    }, [isOpen, itemData, format]);

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPdf = async () => {
        if (!itemData) return;
        const input = document.getElementById('printable-qr-area');
        if (!input) return;

        setIsGeneratingPdf(true);
        try {
            const canvas = await html2canvas(input, {
                scale: 3,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const pdf = new jsPDF({
                orientation: labelWidth > labelHeight ? 'landscape' : 'portrait',
                unit: 'mm',
                format: [labelWidth, labelHeight],
                compress: true
            });

            pdf.addImage(imgData, 'JPEG', 0, 0, labelWidth, labelHeight);
            pdf.save(`MK_Tag_${itemData.variantId || itemData.name}.pdf`);
        } catch (e) {
            console.error('Error generating tag PDF:', e);
            alert('Failed to generate PDF. Please try again.');
        } finally {
            setIsGeneratingPdf(false);
        }
    };
    
    const handleSwapDimensions = () => {
        setSettings((prev: any) => {
            const newSettings = { ...prev, labelWidth: prev.labelHeight, labelHeight: prev.labelWidth };
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
            return newSettings;
        });
    };

    if (!isOpen || !itemData) return null;

    const hasDiscount = itemData.discountPercentage && itemData.discountPercentage > 0 && itemData.saleRealPrice;

    return (
        <>
            <style>
                {`
                @media print {
                  @page {
                    size: ${labelWidth}mm ${labelHeight}mm;
                    margin: 0;
                  }
                  
                  body * {
                    visibility: hidden;
                  }
                  
                  #printable-qr-area, #printable-qr-area * {
                    visibility: visible;
                  }

                  #printable-qr-area {
                    position: fixed;
                    left: 50%;
                    top: 50%;
                    transform: translate(-50%, -50%);
                    width: ${labelWidth}mm !important;
                    height: ${labelHeight}mm !important;
                    margin: 0 !important;
                    padding: 2mm !important;
                    box-sizing: border-box !important;
                    border: none !important;
                    background: white !important;
                    z-index: 99999 !important;
                    display: flex !important;
                    flex-direction: column !important;
                    justify-content: space-between !important;
                    align-items: center !important;
                    overflow: hidden !important;
                  }
                  
                  /* Ensure text color is black for print */
                  #printable-qr-area * {
                    color: black !important;
                  }
                }
              `}
            </style>
            <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col md:flex-row gap-6 overflow-y-auto" onClick={e => e.stopPropagation()}>
                    
                    {/* Settings Panel - Hidden on Print */}
                    <div className="w-full md:w-1/3 space-y-4 border-r border-slate-200 dark:border-slate-700 pr-0 md:pr-6 hide-on-print">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Label Settings</h3>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Code Format</label>
                            <div className="flex rounded-md shadow-sm" role="group">
                                <button
                                    type="button"
                                    onClick={() => updateSetting('format', 'qr')}
                                    className={`px-4 py-2 text-sm font-medium border border-slate-300 dark:border-slate-600 rounded-l-lg ${format === 'qr' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600'}`}
                                >
                                    QR Code
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateSetting('format', 'barcode')}
                                    className={`px-4 py-2 text-sm font-medium border border-l-0 border-slate-300 dark:border-slate-600 rounded-r-lg ${format === 'barcode' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600'}`}
                                >
                                    Barcode
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <NumberInput label="Width (mm)" value={labelWidth} onChange={v => updateSetting('labelWidth', v)} />
                            <NumberInput label="Height (mm)" value={labelHeight} onChange={v => updateSetting('labelHeight', v)} />
                        </div>
                        
                        <button onClick={handleSwapDimensions} className="w-full py-1.5 text-xs bg-slate-200 dark:bg-slate-600 rounded hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-300">
                            Swap Dimensions (Vertical/Horizontal)
                        </button>

                        <NumberInput label="Code Size (mm)" value={codeSize} onChange={v => updateSetting('codeSize', v)} />
                        
                        <div className="grid grid-cols-2 gap-4">
                             <NumberInput label="Font Size (px)" value={fontSize} onChange={v => updateSetting('fontSize', v)} />
                             <NumberInput label="Logo Size (px)" value={logoSize} onChange={v => updateSetting('logoSize', v)} />
                        </div>

                        <div className="pt-4 flex flex-col gap-2">
                            <button
                                onClick={handleDownloadPdf}
                                disabled={isGeneratingPdf}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all cursor-pointer disabled:cursor-not-allowed text-sm"
                            >
                                {isGeneratingPdf ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4 text-white mr-1" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                                        </svg>
                                        Generating PDF...
                                    </>
                                ) : (
                                    <>
                                        <DownloadIcon className="w-4 h-4" />
                                        Download PDF
                                    </>
                                )}
                            </button>
                            <div className="flex gap-2">
                                <button
                                    onClick={onClose}
                                    className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors text-sm"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={handlePrint}
                                    className="flex-1 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors text-sm"
                                >
                                    Print
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Preview Area */}
                    <div className="flex-grow flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 rounded-lg p-8 relative overflow-hidden">
                        <p className="absolute top-2 left-4 text-xs text-slate-500 uppercase tracking-wide hide-on-print">Preview</p>
                        <div 
                            id="printable-qr-area" 
                            style={{ 
                                width: `${labelWidth}mm`, 
                                height: `${labelHeight}mm`,
                                border: 'none',
                                backgroundColor: 'white',
                                color: 'black',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '2mm',
                                boxSizing: 'border-box',
                                overflow: 'hidden',
                                position: 'relative'
                            }}
                        >
                            {/* Header Section: Logo & Item Name (flex-shrink-0) */}
                            <div className="w-full flex-shrink-0 flex flex-col items-center text-center">
                                {businessLogo && (
                                    <img 
                                        src={businessLogo} 
                                        alt="Logo" 
                                        style={{ 
                                            height: `${logoSize}px`, 
                                            maxHeight: '28px',
                                            maxWidth: '100%',
                                            objectFit: 'contain', 
                                            marginBottom: '1px' 
                                        }} 
                                    />
                                )}
                                <h3 
                                    style={{ 
                                        fontSize: `${fontSize}px`, 
                                        fontWeight: 'bold', 
                                        lineHeight: 1.15, 
                                        margin: 0, 
                                        wordBreak: 'break-word',
                                        width: '100%',
                                        color: 'black'
                                    }}
                                >
                                    {itemData.name}
                                </h3>
                            </div>
                            
                            {/* Code Section: QR or Barcode (auto scales in remaining space) */}
                            <div style={{ flex: '1 1 0%', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', overflow: 'hidden', margin: '1px 0' }}>
                                {format === 'qr' ? (
                                    qrCodeUrl ? (
                                        <img 
                                            src={qrCodeUrl} 
                                            alt="QR Code" 
                                            style={{ 
                                                width: `${codeSize}mm`, 
                                                height: `${codeSize}mm`, 
                                                maxWidth: '100%', 
                                                maxHeight: '100%', 
                                                objectFit: 'contain',
                                                display: 'block'
                                            }} 
                                        />
                                    ) : (
                                        <div style={{ width: `${codeSize}mm`, height: `${codeSize}mm`, maxWidth: '100%', maxHeight: '100%', background: '#eee' }}></div>
                                    )
                                ) : (
                                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                                        <svg 
                                            ref={barcodeRef} 
                                            style={{ 
                                                width: '100%', 
                                                height: `${codeSize}mm`, 
                                                maxWidth: '100%', 
                                                maxHeight: '100%',
                                                objectFit: 'contain',
                                                display: 'block'
                                            }}
                                        ></svg>
                                    </div>
                                )}
                            </div>

                            {/* Footer Section: Details & Price (flex-shrink-0) */}
                            <div className="w-full flex-shrink-0 text-center">
                                <p style={{ fontSize: `${Math.max(8, fontSize - 2)}px`, margin: 0, color: '#000', lineHeight: 1.15 }}>
                                    {itemData.color} / {itemData.size}
                                </p>
                                <div style={{ lineHeight: 1, marginTop: '2px' }}>
                                    {hasDiscount ? (
                                        <div className="flex items-center justify-center gap-1">
                                            <span style={{ fontSize: `${Math.max(8, fontSize - 2)}px`, textDecoration: 'line-through', color: '#555' }}>
                                                {formatCurrency(itemData.saleRealPrice ?? 0)}
                                            </span>
                                            <span style={{ fontSize: `${fontSize + 2}px`, fontWeight: 'bold', color: 'black' }}>
                                                {formatCurrency(itemData.sellingPrice ?? 0)}
                                            </span>
                                        </div>
                                    ) : (
                                        <span style={{ fontSize: `${fontSize + 2}px`, fontWeight: 'bold', color: 'black' }}>
                                            {formatCurrency(itemData.sellingPrice ?? itemData.avgSalePrice ?? 0)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default QrCodeModal;