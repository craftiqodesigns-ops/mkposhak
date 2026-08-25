import React, { useState, useRef } from 'react';
import { processImageToSquare } from '../utils/imageUtils';
import { XIcon } from './icons/XIcon';

interface ProductImageUploaderProps {
  imageUrl?: string;
  onChange: (imageUrl: string | undefined) => void;
  label?: string;
  required?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  compact?: boolean;
}

export const ProductImageUploader: React.FC<ProductImageUploaderProps> = ({
  imageUrl,
  onChange,
  label,
  size = 'md',
  compact = false,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPG, PNG, WebP).');
      return;
    }
    try {
      setIsProcessing(true);
      const squareDataUrl = await processImageToSquare(file, 500, 0.85);
      onChange(squareDataUrl);
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Failed to process image. Please try another image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const sizeClasses = {
    xs: 'w-12 h-12 sm:w-14 sm:h-14',
    sm: 'w-24 h-24',
    md: 'w-36 h-36',
    lg: 'w-48 h-48',
  }[size];

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileInputChange}
          className="hidden"
        />

        <div
          onClick={() => {
            if (!isProcessing) {
              fileInputRef.current?.click();
            }
          }}
          className={`relative aspect-square ${sizeClasses} rounded-lg border overflow-hidden flex flex-col items-center justify-center cursor-pointer transition-all shrink-0 ${
            imageUrl
              ? 'border-indigo-400 dark:border-indigo-600 bg-slate-900 shadow-xs'
              : 'border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-500 bg-white dark:bg-slate-700/60 hover:bg-indigo-50/50'
          }`}
          title={imageUrl ? "Click to change color photo" : "Click to upload 1:1 photo for this color"}
        >
          {isProcessing ? (
            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          ) : imageUrl ? (
            <div className="relative w-full h-full group">
              <img
                src={imageUrl}
                alt="Color Preview"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewZoom(true);
                  }}
                  className="p-1 bg-white text-slate-900 rounded-full hover:scale-110 text-[10px]"
                  title="View zoom"
                >
                  🔍
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-0.5">
              <span className="text-base sm:text-lg leading-none">📸</span>
              <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                +Photo
              </span>
            </div>
          )}
        </div>

        {imageUrl && (
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => setPreviewZoom(true)}
              className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium text-left flex items-center gap-0.5"
            >
              <span>🔍 View</span>
            </button>
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="text-[10px] text-red-500 hover:underline font-medium text-left"
            >
              ✕ Remove
            </button>
          </div>
        )}

        {/* Full zoom modal */}
        {previewZoom && imageUrl && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setPreviewZoom(false)}
          >
            <div
              className="relative bg-white dark:bg-slate-900 p-2 rounded-2xl max-w-sm w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center p-2 mb-2 border-b border-slate-200 dark:border-slate-800">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  1:1 Color Product Photo
                </h4>
                <button
                  onClick={() => setPreviewZoom(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="aspect-square w-full rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                <img
                  src={imageUrl}
                  alt="Zoomed Color Product"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex justify-between items-center text-xs font-semibold text-slate-700 dark:text-slate-300">
          <span>{label}</span>
          <span className="text-[11px] font-normal text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded">
            1:1 Square Auto-Crop
          </span>
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* 1:1 Aspect Ratio Box */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => {
            if (!imageUrl && fileInputRef.current) {
              fileInputRef.current.click();
            }
          }}
          className={`relative aspect-square ${sizeClasses} rounded-xl border-2 overflow-hidden flex flex-col items-center justify-center cursor-pointer transition-all ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 scale-102'
              : imageUrl
              ? 'border-slate-300 dark:border-slate-600 bg-slate-900 shadow-sm'
              : 'border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-700/50 bg-slate-50 dark:bg-slate-800'
          }`}
        >
          {isProcessing ? (
            <div className="flex flex-col items-center justify-center p-2 text-center">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-1"></div>
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                Cropping 1:1...
              </span>
            </div>
          ) : imageUrl ? (
            <div className="relative w-full h-full group">
              <img
                src={imageUrl}
                alt="Product Preview"
                className="w-full h-full object-cover rounded-lg"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewZoom(true);
                  }}
                  className="p-1.5 bg-white/90 text-slate-800 rounded-full hover:bg-white text-xs shadow-md"
                  title="View full size"
                >
                  🔍
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (fileInputRef.current) fileInputRef.current.click();
                  }}
                  className="p-1.5 bg-white/90 text-slate-800 rounded-full hover:bg-white text-xs shadow-md"
                  title="Change image"
                >
                  🔄
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(undefined);
                  }}
                  className="p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 text-xs shadow-md"
                  title="Remove image"
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-2">
              <span className="text-2xl mb-1">📸</span>
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                Click or Drop
              </span>
              <span className="text-[9px] text-slate-400 dark:text-slate-500">
                1:1 Product Photo
              </span>
            </div>
          )}
        </div>

        {/* Action buttons on side */}
        <div className="flex flex-col gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 font-semibold rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors flex items-center gap-1.5 text-left"
          >
            <span>{imageUrl ? 'Change Photo' : '+ Upload Image'}</span>
          </button>
          {imageUrl && (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="px-3 py-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 font-medium rounded-lg text-left transition-colors"
            >
              Remove
            </button>
          )}
          <span className="text-[10px] text-slate-400 leading-tight max-w-[140px]">
            Auto-crops to 1:1 square for invoices & visual catalog
          </span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>

      {/* Full zoom modal */}
      {previewZoom && imageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewZoom(false)}
        >
          <div
            className="relative bg-white dark:bg-slate-900 p-2 rounded-2xl max-w-sm w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-2 mb-2 border-b border-slate-200 dark:border-slate-800">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                1:1 Product Image Preview
              </h4>
              <button
                onClick={() => setPreviewZoom(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="aspect-square w-full rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800">
              <img
                src={imageUrl}
                alt="Zoomed Product"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
