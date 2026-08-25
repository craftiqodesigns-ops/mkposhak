
import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeError, Html5QrcodeResult } from 'html5-qrcode';

interface QrScannerProps {
    onScanSuccess: (decodedText: string, result: Html5QrcodeResult) => void;
    onClose: () => void;
}

const QrScanner: React.FC<QrScannerProps> = ({ onScanSuccess, onClose }) => {
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

    useEffect(() => {
        const scanner = new Html5QrcodeScanner(
            'qr-reader',
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                rememberLastUsedCamera: true,
            },
            false // verbose
        );
        scannerRef.current = scanner;

        const handleScanSuccess = (decodedText: string, result: Html5QrcodeResult) => {
            scanner.clear();
            onScanSuccess(decodedText, result);
        };

        const handleScanError = (errorMessage: string, error: Html5QrcodeError) => {
           // a-studio-
        };

        scanner.render(handleScanSuccess, handleScanError);

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(err => {
                    console.error("Failed to clear scanner on unmount", err);
                });
            }
        };
    }, [onScanSuccess]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-[100] flex justify-center items-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl p-6 w-full max-w-md relative">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Scan Product QR Code</h3>
                <div id="qr-reader" className="w-full"></div>
                <button
                    onClick={onClose}
                    className="mt-4 w-full px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default QrScanner;
