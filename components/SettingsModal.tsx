import React, { useState, useEffect, useRef } from 'react';
import type { Settings } from '../types';
import { XIcon } from './icons/XIcon';
import { TrashIcon } from './icons/TrashIcon';
import { UploadIcon } from './icons/UploadIcon';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: Settings;
    onSave: (settings: Settings) => Promise<void>;
    onChangeEmail?: (newEmail: string, currentPassword?: string) => Promise<void>;
    isProcessing: boolean;
    userEmail: string | null;
    businessLogo?: string | null;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave, isProcessing, businessLogo }) => {
    const [localSettings, setLocalSettings] = useState<Settings>(settings);
    const [currentPinInput, setCurrentPinInput] = useState('');
    const [newPinInput, setNewPinInput] = useState('');
    const [confirmPinInput, setConfirmPinInput] = useState('');
    const [pinSuccessMsg, setPinSuccessMsg] = useState('');
    const [pinErrorMsg, setPinErrorMsg] = useState('');
    const qrCodeFileInputRef = useRef<HTMLInputElement>(null);
    const instagramQrFileInputRef = useRef<HTMLInputElement>(null);
    const googleReviewQrFileInputRef = useRef<HTMLInputElement>(null);
    const catalogQrFileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setLocalSettings(settings);
            setCurrentPinInput('');
            setNewPinInput('');
            setConfirmPinInput('');
            setPinSuccessMsg('');
            setPinErrorMsg('');
        }
    }, [isOpen, settings]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const isNumeric = ['invoiceNextNumber'].includes(name);
        setLocalSettings(prev => ({ ...prev, [name]: isNumeric ? Number(value) : value }));
    };

    // Resize/compress an uploaded image before storing it as base64. Raw phone-camera
    // photos can be several MB, which can make saving slow or (in extreme cases) exceed
    // Firestore's 1MB-per-document limit, causing the save to silently fail/hang.
    const compressImageFile = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const MAX_DIMENSION = 500;
                    let { width, height } = img;
                    if (width > height && width > MAX_DIMENSION) {
                        height = Math.round((height * MAX_DIMENSION) / width);
                        width = MAX_DIMENSION;
                    } else if (height > MAX_DIMENSION) {
                        width = Math.round((width * MAX_DIMENSION) / height);
                        height = MAX_DIMENSION;
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        resolve(reader.result as string); // Fallback: use original
                        return;
                    }
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = reader.result as string;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    };

    const handleQrCodeFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            compressImageFile(file)
                .then(dataUrl => setLocalSettings(prev => ({ ...prev, paymentQrCode: dataUrl })))
                .catch(err => console.error('QR image compression failed:', err));
        }
    };
    
    const removeQrCode = () => {
        setLocalSettings(prev => ({...prev, paymentQrCode: ''}));
        if(qrCodeFileInputRef.current) {
            qrCodeFileInputRef.current.value = '';
        }
    };

    const handleInstagramQrFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            compressImageFile(file)
                .then(dataUrl => setLocalSettings(prev => ({ ...prev, instagramQrCode: dataUrl })))
                .catch(err => console.error('QR image compression failed:', err));
        }
    };

    const removeInstagramQr = () => {
        setLocalSettings(prev => ({ ...prev, instagramQrCode: '' }));
        if (instagramQrFileInputRef.current) {
            instagramQrFileInputRef.current.value = '';
        }
    };

    const handleGoogleReviewQrFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            compressImageFile(file)
                .then(dataUrl => setLocalSettings(prev => ({ ...prev, googleReviewQrCode: dataUrl })))
                .catch(err => console.error('QR image compression failed:', err));
        }
    };

    const removeGoogleReviewQr = () => {
        setLocalSettings(prev => ({ ...prev, googleReviewQrCode: '' }));
        if (googleReviewQrFileInputRef.current) {
            googleReviewQrFileInputRef.current.value = '';
        }
    };

    const handleCatalogQrFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            compressImageFile(file)
                .then(dataUrl => setLocalSettings(prev => ({ ...prev, catalogQrCode: dataUrl })))
                .catch(err => console.error('QR image compression failed:', err));
        }
    };

    const removeCatalogQr = () => {
        setLocalSettings(prev => ({ ...prev, catalogQrCode: '' }));
        if (catalogQrFileInputRef.current) {
            catalogQrFileInputRef.current.value = '';
        }
    };

    const handlePinChangeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setPinErrorMsg('');
        setPinSuccessMsg('');

        const activePin = settings.securityPin || localStorage.getItem('app_security_pin') || '1234';

        if (currentPinInput !== activePin) {
            setPinErrorMsg('Current PIN is incorrect.');
            return;
        }

        if (!newPinInput || newPinInput.length < 4 || newPinInput.length > 6) {
            setPinErrorMsg('New PIN must be 4 to 6 digits.');
            return;
        }

        if (newPinInput !== confirmPinInput) {
            setPinErrorMsg('New PIN and Confirm PIN do not match.');
            return;
        }

        try {
            const updatedSettings = { ...localSettings, securityPin: newPinInput };
            setLocalSettings(updatedSettings);
            localStorage.setItem('app_security_pin', newPinInput);
            await onSave(updatedSettings);

            setPinSuccessMsg('Security PIN changed successfully!');
            setCurrentPinInput('');
            setNewPinInput('');
            setConfirmPinInput('');
        } catch (err: any) {
            setPinErrorMsg('Failed to update PIN. Please try again.');
        }
    };

    const handleSaveSettings = async () => {
        try {
            if (localSettings.securityPin) {
                localStorage.setItem('app_security_pin', localSettings.securityPin);
            }
            await onSave(localSettings);
        } catch (error) {
            console.error("Failed to save settings:", error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl p-6 sm:p-8 w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200" aria-label="Close modal">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto pr-2 space-y-8">
                    {/* Shop Profile & Address Settings */}
                    <section>
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-2 mb-4">
                            Shop Profile & Address (દુકાનની વિગતો અને સરનામું)
                        </h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="shopName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Shop Name (દુકાનનું નામ)
                                    </label>
                                    <input 
                                        type="text" 
                                        id="shopName" 
                                        name="shopName" 
                                        value={localSettings.shopName || ''} 
                                        onChange={handleChange} 
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-[#169375] focus:border-[#169375] text-slate-900 dark:text-slate-100" 
                                        placeholder="e.g. M.K. POSHAK HOUSE" 
                                    />
                                </div>
                                <div>
                                    <label htmlFor="ownerName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Owner / Signatory Name
                                    </label>
                                    <input 
                                        type="text" 
                                        id="ownerName" 
                                        name="ownerName" 
                                        value={localSettings.ownerName || ''} 
                                        onChange={handleChange} 
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-[#169375] focus:border-[#169375] text-slate-900 dark:text-slate-100" 
                                        placeholder="e.g. M.K. Poshak House" 
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="shopAddress" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Shop Full Address (ઇન્વોઇસ પર દેખાતું દુકાનનું સરનામું)
                                </label>
                                <textarea 
                                    id="shopAddress" 
                                    name="shopAddress" 
                                    value={localSettings.shopAddress || ''} 
                                    onChange={handleChange} 
                                    rows={2} 
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-[#169375] focus:border-[#169375] text-slate-900 dark:text-slate-100 font-medium" 
                                    placeholder="e.g. Shop 1, Main Market, Surat, Gujarat - 395002"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="shopEmail" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Shop Email
                                    </label>
                                    <input 
                                        type="email" 
                                        id="shopEmail" 
                                        name="shopEmail" 
                                        value={localSettings.shopEmail || ''} 
                                        onChange={handleChange} 
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-[#169375] focus:border-[#169375] text-slate-900 dark:text-slate-100" 
                                        placeholder="e.g. mkposhakhouse@gmail.com" 
                                    />
                                </div>
                                <div>
                                    <label htmlFor="shopWebsite" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Website / Store Link
                                    </label>
                                    <input 
                                        type="text" 
                                        id="shopWebsite" 
                                        name="shopWebsite" 
                                        value={localSettings.shopWebsite || ''} 
                                        onChange={handleChange} 
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-[#169375] focus:border-[#169375] text-slate-900 dark:text-slate-100" 
                                        placeholder="e.g. www.mkposhakhouse.com" 
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Security & Profile Settings */}
                    <section>
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-2 mb-4">
                            Security & Login PIN
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="mobileNumber" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Shop Mobile Number (સંપર્ક નંબર)
                                </label>
                                <input 
                                    type="tel" 
                                    id="mobileNumber" 
                                    name="mobileNumber" 
                                    value={localSettings.mobileNumber || ''} 
                                    onChange={handleChange} 
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-slate-100" 
                                    placeholder="e.g. +91 9876543210" 
                                />
                            </div>

                            {/* Change PIN Form */}
                            <form onSubmit={handlePinChangeSubmit} className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                        Change Security PIN / Password
                                    </h4>
                                    <span className="text-xs px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-mono">
                                        PIN: {localSettings.securityPin || '••••'}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Change the security PIN used to unlock the shop dashboard.
                                </p>

                                {pinErrorMsg && (
                                    <div className="text-xs text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-900/30 p-2 rounded-lg">
                                        {pinErrorMsg}
                                    </div>
                                )}
                                {pinSuccessMsg && (
                                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-900/30 p-2 rounded-lg">
                                        {pinSuccessMsg}
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Current PIN
                                        </label>
                                        <input
                                            type="password"
                                            inputMode="numeric"
                                            maxLength={6}
                                            value={currentPinInput}
                                            onChange={e => setCurrentPinInput(e.target.value.replace(/\D/g, ''))}
                                            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md font-mono tracking-widest text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="••••"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            New PIN
                                        </label>
                                        <input
                                            type="password"
                                            inputMode="numeric"
                                            maxLength={6}
                                            value={newPinInput}
                                            onChange={e => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                                            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md font-mono tracking-widest text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="New 4-6 digits"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Confirm New PIN
                                        </label>
                                        <input
                                            type="password"
                                            inputMode="numeric"
                                            maxLength={6}
                                            value={confirmPinInput}
                                            onChange={e => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                                            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md font-mono tracking-widest text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="Confirm PIN"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="text-right pt-2">
                                    <button
                                        type="submit"
                                        disabled={isProcessing}
                                        className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                                    >
                                        Update PIN
                                    </button>
                                </div>
                            </form>
                        </div>
                    </section>
                    
                    {/* Invoice Settings */}
                    <section>
                         <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-2 mb-4">Invoice Settings</h3>
                         <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="invoicePrefix" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Invoice Prefix</label>
                                    <input type="text" id="invoicePrefix" name="invoicePrefix" value={localSettings.invoicePrefix || ''} onChange={handleChange} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-slate-100" placeholder="e.g., INV-" />
                                </div>
                                <div>
                                    <label htmlFor="invoiceNextNumber" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Next Invoice Number</label>
                                    <input type="number" id="invoiceNextNumber" name="invoiceNextNumber" value={localSettings.invoiceNextNumber || 1} onChange={handleChange} min="1" className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-slate-100" />
                                </div>
                            </div>
                             <div>
                                <label htmlFor="defaultGreeting" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Default Greeting/Notes for Invoice</label>
                                <textarea id="defaultGreeting" name="defaultGreeting" value={localSettings.defaultGreeting || ''} onChange={handleChange} rows={4} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-slate-100" placeholder="e.g., Thank you for your purchase!"></textarea>
                            </div>

                            {/* Invoice Logo Size Settings */}
                            <div className="bg-slate-50 dark:bg-slate-750 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                                            Invoice Logo Size (ઇન્વોઇસ લોગો સાઇઝ)
                                        </label>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Adjust the default size of the business logo on printed invoices & PDFs
                                        </p>
                                    </div>

                                    {/* Plus / Minus Buttons */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const current = localSettings.invoiceLogoSize || 64;
                                                const next = Math.max(24, current - 6);
                                                setLocalSettings(prev => ({ ...prev, invoiceLogoSize: next }));
                                                try { localStorage.setItem('invoice_logo_size', String(next)); } catch (e) {}
                                            }}
                                            disabled={(localSettings.invoiceLogoSize || 64) <= 24}
                                            className="w-8 h-8 flex items-center justify-center font-black text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded-lg shadow-xs hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-600 active:scale-95 disabled:opacity-40 transition-all"
                                            title="Minus / Decrease Logo Size"
                                        >
                                            -
                                        </button>
                                        <span className="font-mono font-bold text-sm px-3 py-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-indigo-600 dark:text-indigo-400 min-w-[58px] text-center shadow-2xs">
                                            {localSettings.invoiceLogoSize || 64}px
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const current = localSettings.invoiceLogoSize || 64;
                                                const next = Math.min(200, current + 6);
                                                setLocalSettings(prev => ({ ...prev, invoiceLogoSize: next }));
                                                try { localStorage.setItem('invoice_logo_size', String(next)); } catch (e) {}
                                            }}
                                            disabled={(localSettings.invoiceLogoSize || 64) >= 200}
                                            className="w-8 h-8 flex items-center justify-center font-black text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded-lg shadow-xs hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-600 active:scale-95 disabled:opacity-40 transition-all"
                                            title="Plus / Increase Logo Size"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-slate-500 dark:text-slate-400">24px</span>
                                        <input
                                            type="range"
                                            min="24"
                                            max="200"
                                            step="4"
                                            value={localSettings.invoiceLogoSize || 64}
                                            onChange={e => {
                                                const next = Number(e.target.value);
                                                setLocalSettings(prev => ({ ...prev, invoiceLogoSize: next }));
                                                try { localStorage.setItem('invoice_logo_size', String(next)); } catch (err) {}
                                            }}
                                            className="w-full accent-indigo-600 cursor-pointer"
                                        />
                                        <span className="text-xs text-slate-500 dark:text-slate-400">200px</span>
                                    </div>

                                    {/* Presets */}
                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                        <span className="text-xs text-slate-500 dark:text-slate-400">Presets:</span>
                                        {[
                                            { label: 'Small (40px)', val: 40 },
                                            { label: 'Standard (64px)', val: 64 },
                                            { label: 'Large (96px)', val: 96 },
                                            { label: 'XL (128px)', val: 128 },
                                        ].map(preset => (
                                            <button
                                                key={preset.val}
                                                type="button"
                                                onClick={() => {
                                                    setLocalSettings(prev => ({ ...prev, invoiceLogoSize: preset.val }));
                                                    try { localStorage.setItem('invoice_logo_size', String(preset.val)); } catch (err) {}
                                                }}
                                                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                                                    (localSettings.invoiceLogoSize || 64) === preset.val
                                                        ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs'
                                                        : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                                                }`}
                                            >
                                                {preset.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Live Logo Preview Box */}
                                    {businessLogo && (
                                        <div className="mt-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center">
                                            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-2">
                                                Live Preview
                                            </span>
                                            <img
                                                src={businessLogo}
                                                alt="Logo preview"
                                                style={{ height: `${localSettings.invoiceLogoSize || 64}px`, maxHeight: `${localSettings.invoiceLogoSize || 64}px` }}
                                                className="w-auto object-contain transition-all duration-150"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                         </div>
                    </section>
                    
                    {/* Payment Settings */}
                    <section>
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-2 mb-4">Payment Settings</h3>
                        <div>
                             <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Payment QR Code</label>
                             <input
                                type="file"
                                ref={qrCodeFileInputRef}
                                onChange={handleQrCodeFileChange}
                                className="hidden"
                                accept="image/png, image/jpeg"
                            />
                            <div className="flex items-center gap-4">
                                {localSettings.paymentQrCode ? (
                                    <div className="relative">
                                        <img src={localSettings.paymentQrCode} alt="Payment QR Code" className="w-24 h-24 object-contain rounded-lg border p-1 bg-white" />
                                        <button onClick={removeQrCode} className="absolute -top-2 -right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700" aria-label="Remove QR Code">
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                     <div className="w-24 h-24 flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600">
                                        <span className="text-xs text-slate-500">No QR</span>
                                     </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => qrCodeFileInputRef.current?.click()}
                                    className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold rounded-lg shadow-sm hover:bg-slate-200 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                                >
                                    <UploadIcon className="w-4 h-4" />
                                    <span>{localSettings.paymentQrCode ? 'Change QR' : 'Upload QR'}</span>
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Social Media, Google Review & Website Catalog QR Codes */}
                    <section>
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-2 mb-4">
                            Instagram, Google Review & Website Catalog QR Codes (ઇન્સ્ટાગ્રામ, ગૂગલ રિવ્યુ અને કેટલોગ QR)
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                            આ ૩ QR કોડ્સ ઇન્વોઇસના નીચે ડાબી બાજુ ૧ જ લાઈનમાં સુંદર રીતે દેખાશે. તમે લિંક આપી શકો છો (ઓટોમેટિક QR બનશે) અથવા તમારો કસ્ટમ QR ફોટો અપલોડ કરી શકો છો.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
                            {/* Instagram Box */}
                            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 space-y-2.5">
                                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-xs">
                                    <span className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white text-[10px]">
                                        📷
                                    </span>
                                    <span>Instagram Profile</span>
                                </div>

                                <div>
                                    <label htmlFor="instagramUrl" className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Instagram URL / Handle
                                    </label>
                                    <input 
                                        type="text" 
                                        id="instagramUrl" 
                                        name="instagramUrl" 
                                        value={localSettings.instagramUrl || ''} 
                                        onChange={handleChange} 
                                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-[#169375] focus:border-[#169375] text-slate-900 dark:text-slate-100" 
                                        placeholder="https://instagram.com/mkposhakhouse" 
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Custom QR Code (Optional)
                                    </label>
                                    <input
                                        type="file"
                                        ref={instagramQrFileInputRef}
                                        onChange={handleInstagramQrFileChange}
                                        className="hidden"
                                        accept="image/png, image/jpeg"
                                    />
                                    <div className="flex items-center gap-2.5">
                                        {localSettings.instagramQrCode ? (
                                            <div className="relative">
                                                <img src={localSettings.instagramQrCode} alt="Instagram QR" className="w-12 h-12 object-contain rounded-lg border p-1 bg-white" />
                                                <button onClick={removeInstagramQr} className="absolute -top-2 -right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700" aria-label="Remove Instagram QR">
                                                    <TrashIcon className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="w-12 h-12 flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-[9px] text-slate-400 text-center px-0.5 leading-tight">
                                                Auto QR
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => instagramQrFileInputRef.current?.click()}
                                            className="px-2.5 py-1 text-[11px] bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-medium rounded-md shadow-xs hover:bg-slate-100 dark:hover:bg-slate-600"
                                        >
                                            {localSettings.instagramQrCode ? 'Change' : 'Upload'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Google Review Box */}
                            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 space-y-2.5">
                                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-xs">
                                    <span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-serif font-black">
                                        G
                                    </span>
                                    <span>Google Review Page</span>
                                </div>

                                <div>
                                    <label htmlFor="googleReviewUrl" className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Google Review Link (URL)
                                    </label>
                                    <input 
                                        type="text" 
                                        id="googleReviewUrl" 
                                        name="googleReviewUrl" 
                                        value={localSettings.googleReviewUrl || ''} 
                                        onChange={handleChange} 
                                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-[#169375] focus:border-[#169375] text-slate-900 dark:text-slate-100" 
                                        placeholder="https://g.page/r/your-shop/review" 
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Custom QR Code (Optional)
                                    </label>
                                    <input
                                        type="file"
                                        ref={googleReviewQrFileInputRef}
                                        onChange={handleGoogleReviewQrFileChange}
                                        className="hidden"
                                        accept="image/png, image/jpeg"
                                    />
                                    <div className="flex items-center gap-2.5">
                                        {localSettings.googleReviewQrCode ? (
                                            <div className="relative">
                                                <img src={localSettings.googleReviewQrCode} alt="Google Review QR" className="w-12 h-12 object-contain rounded-lg border p-1 bg-white" />
                                                <button onClick={removeGoogleReviewQr} className="absolute -top-2 -right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700" aria-label="Remove Google Review QR">
                                                    <TrashIcon className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="w-12 h-12 flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-[9px] text-slate-400 text-center px-0.5 leading-tight">
                                                Auto QR
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => googleReviewQrFileInputRef.current?.click()}
                                            className="px-2.5 py-1 text-[11px] bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-medium rounded-md shadow-xs hover:bg-slate-100 dark:hover:bg-slate-600"
                                        >
                                            {localSettings.googleReviewQrCode ? 'Change' : 'Upload'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Website Catalog Box */}
                            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 space-y-2.5">
                                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-xs">
                                    <span className="w-5 h-5 rounded-full bg-[#169375] flex items-center justify-center text-white text-[10px]">
                                        🛍️
                                    </span>
                                    <span>Website Catalog (ઓનલાઇન કેટલોગ)</span>
                                </div>

                                <div>
                                    <label htmlFor="catalogWebsiteUrl" className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Catalog Website Link (URL)
                                    </label>
                                    <input 
                                        type="text" 
                                        id="catalogWebsiteUrl" 
                                        name="catalogWebsiteUrl" 
                                        value={localSettings.catalogWebsiteUrl || localSettings.shopWebsite || ''} 
                                        onChange={handleChange} 
                                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-[#169375] focus:border-[#169375] text-slate-900 dark:text-slate-100" 
                                        placeholder="https://mkposhakhouse.com" 
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Custom QR Code (Optional)
                                    </label>
                                    <input
                                        type="file"
                                        ref={catalogQrFileInputRef}
                                        onChange={handleCatalogQrFileChange}
                                        className="hidden"
                                        accept="image/png, image/jpeg"
                                    />
                                    <div className="flex items-center gap-2.5">
                                        {localSettings.catalogQrCode ? (
                                            <div className="relative">
                                                <img src={localSettings.catalogQrCode} alt="Catalog QR" className="w-12 h-12 object-contain rounded-lg border p-1 bg-white" />
                                                <button onClick={removeCatalogQr} className="absolute -top-2 -right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700" aria-label="Remove Catalog QR">
                                                    <TrashIcon className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="w-12 h-12 flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-[9px] text-slate-400 text-center px-0.5 leading-tight">
                                                Auto QR
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => catalogQrFileInputRef.current?.click()}
                                            className="px-2.5 py-1 text-[11px] bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-medium rounded-md shadow-xs hover:bg-slate-100 dark:hover:bg-slate-600"
                                        >
                                            {localSettings.catalogQrCode ? 'Change' : 'Upload'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                </div>
                
                <div className="border-t border-slate-200 dark:border-slate-700 pt-6 mt-6 flex justify-end gap-4">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">Cancel</button>
                    <button onClick={handleSaveSettings} disabled={isProcessing} className="px-6 py-2 bg-emerald-600 text-white font-semibold rounded-lg shadow-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50">
                        {isProcessing ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
