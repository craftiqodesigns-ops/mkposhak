import React, { useRef } from 'react';
import { UploadIcon } from './icons/UploadIcon';
import { TrashIcon } from './icons/TrashIcon';

interface LogoUploaderProps {
    logo: string | null;
    onLogoUpload: (file: File) => void;
    onLogoRemove: () => void;
    isProcessing: boolean;
}

const LogoUploader: React.FC<LogoUploaderProps> = ({ logo, onLogoUpload, onLogoRemove, isProcessing }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            onLogoUpload(file);
        }
    };

    const triggerFileInput = () => {
        if (isProcessing) return;
        fileInputRef.current?.click();
    };
    
    const removeLogo = (e: React.MouseEvent) => {
        e.stopPropagation();
        onLogoRemove();
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/png, image/jpeg, image/svg+xml"
            />
            {logo ? (
                <div className="group relative cursor-pointer" onClick={triggerFileInput}>
                    <img src={logo} alt="Business Logo" className="h-10 w-auto object-contain rounded" />
                    {!isProcessing && (
                         <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded">
                            <button onClick={removeLogo} className="text-white p-2 rounded-full bg-red-600/80 hover:bg-red-700/80" aria-label="Remove logo">
                                 <TrashIcon className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    {isProcessing && (
                        <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center rounded">
                            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white"></div>
                        </div>
                    )}
                </div>
            ) : (
                <button
                    onClick={triggerFileInput}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold rounded-lg shadow-sm hover:bg-slate-200 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors disabled:opacity-50"
                    aria-label="Upload business logo"
                >
                    {isProcessing ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-slate-500"></div>
                            <span>Processing...</span>
                        </>
                    ) : (
                        <>
                            <UploadIcon className="w-4 h-4" />
                            <span>Upload Logo</span>
                        </>
                    )}
                </button>
            )}
        </div>
    );
};

export default LogoUploader;