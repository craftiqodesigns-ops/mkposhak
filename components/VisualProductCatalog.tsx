import React, { useState, useMemo } from 'react';
import type { DashboardData, Item } from '../types';
import { SearchIcon } from './icons/SearchIcon';
import { QrCodeIcon } from './icons/QrCodeIcon';
import { PencilIcon } from './icons/PencilIcon';
import Pagination from './Pagination';

interface VisualProductCatalogProps {
  items: DashboardData[];
  rawItems?: Item[];
  onOpenInvoiceWithItem: (item: DashboardData) => void;
  onOpenPosWithItem?: (item: DashboardData) => void;
  onEditItemPhoto: (item: DashboardData) => void;
  onPrintQr: (item: DashboardData) => void;
  selectedVariantIds: Set<string>;
  onSelectionChange: (variantId: string, isSelected: boolean) => void;
  onSelectAll: (isSelected: boolean) => void;
  onBulkAddToInvoice: (selectedItems: DashboardData[]) => void;
  onAddNewProduct?: () => void;
  onPrintSelected?: () => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const VisualProductCatalog: React.FC<VisualProductCatalogProps> = ({
  items,
  rawItems = [],
  onOpenInvoiceWithItem,
  onOpenPosWithItem,
  onEditItemPhoto,
  onPrintQr,
  selectedVariantIds,
  onSelectionChange,
  onSelectAll,
  onBulkAddToInvoice,
  onAddNewProduct,
  onPrintSelected,
}) => {
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductCategory, setSelectedProductCategory] = useState<string>('All');
  const [selectedSize, setSelectedSize] = useState<string>('All');
  const [selectedStockStatus, setSelectedStockStatus] = useState<'All' | 'inStock' | 'lowStock' | 'outOfStock'>('All');
  const [selectedColor, setSelectedColor] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'name' | 'priceLow' | 'priceHigh' | 'stockHigh' | 'mostSold'>('stockHigh');
  const [currentPage, setCurrentPage] = useState(1);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  const ITEMS_PER_PAGE = 12;

  // Map raw items for fallback image lookup
  const rawItemMap = useMemo(() => new Map(rawItems.map(i => [i.id, i])), [rawItems]);

  // Extract unique categories, sizes, and colors
  const { categories, sizes, colors } = useMemo(() => {
    const catSet = new Set<string>();
    const sizeSet = new Set<string>();
    const colorSet = new Set<string>();

    items.forEach((item) => {
      if (item.category) catSet.add(item.category);
      if (item.size) sizeSet.add(item.size.trim());
      if (item.color) colorSet.add(item.color.trim());
    });

    // Standard cloth size ordering
    const standardSizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '26', '28', '30', '32', '34', '36', '38', '40', '42', 'Free Size'];
    const sortedSizes = Array.from(sizeSet).sort((a, b) => {
      const idxA = standardSizeOrder.indexOf(a);
      const idxB = standardSizeOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    return {
      categories: ['All', ...Array.from(catSet).sort()],
      sizes: ['All', ...sortedSizes],
      colors: ['All', ...Array.from(colorSet).sort()],
    };
  }, [items]);

  // Filtered and sorted items
  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return items
      .filter((item) => {
        // Search filter
        if (q) {
          const matchName = item.name.toLowerCase().includes(q);
          const matchCat = item.category.toLowerCase().includes(q);
          const matchSub = item.subCategory?.toLowerCase().includes(q);
          const matchColor = item.color.toLowerCase().includes(q);
          const matchSize = item.size.toLowerCase().includes(q);
          if (!matchName && !matchCat && !matchSub && !matchColor && !matchSize) {
            return false;
          }
        }

        // Product Category Filter
        if (selectedProductCategory !== 'All' && item.category !== selectedProductCategory) {
          return false;
        }

        // Size Filter (Product Size-wise)
        if (selectedSize !== 'All' && item.size.trim().toLowerCase() !== selectedSize.trim().toLowerCase()) {
          return false;
        }

        // Color Filter
        if (selectedColor !== 'All' && item.color.trim().toLowerCase() !== selectedColor.trim().toLowerCase()) {
          return false;
        }

        // Stock Status Filter
        if (selectedStockStatus === 'inStock' && item.stock <= 0) return false;
        if (selectedStockStatus === 'lowStock' && (item.stock <= 0 || item.stock > 3)) return false;
        if (selectedStockStatus === 'outOfStock' && item.stock > 0) return false;

        return true;
      })
      .sort((a, b) => {
        const priceA = a.sellingPrice || a.avgSalePrice || 0;
        const priceB = b.sellingPrice || b.avgSalePrice || 0;

        if (sortBy === 'priceLow') return priceA - priceB;
        if (sortBy === 'priceHigh') return priceB - priceA;
        if (sortBy === 'stockHigh') return b.stock - a.stock;
        if (sortBy === 'mostSold') return b.totalSold - a.totalSold;
        return a.name.localeCompare(b.name);
      });
  }, [items, searchTerm, selectedProductCategory, selectedSize, selectedColor, selectedStockStatus, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  const handleSelectAllFiltered = (checked: boolean) => {
    onSelectAll(checked);
  };

  const selectedInFiltered = useMemo(() => {
    return filteredItems.filter((i) => selectedVariantIds.has(i.variantId));
  }, [filteredItems, selectedVariantIds]);

  return (
    <div className="space-y-4">
      {/* Top Filter & Control Panel */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
        {/* Search & Main Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <SearchIcon className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search product, style, color..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Product Category Filter */}
          <div>
            <select
              value={selectedProductCategory}
              onChange={(e) => {
                setSelectedProductCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-medium"
            >
              <option value="All">👕 All Product Categories ({categories.length - 1})</option>
              {categories.filter((c) => c !== 'All').map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Product Size Filter */}
          <div>
            <select
              value={selectedSize}
              onChange={(e) => {
                setSelectedSize(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-medium"
            >
              <option value="All">📏 All Sizes ({sizes.length - 1})</option>
              {sizes.filter((s) => s !== 'All').map((size) => (
                <option key={size} value={size}>
                  Size: {size}
                </option>
              ))}
            </select>
          </div>

          {/* Stock & Sort Dropdown */}
          <div className="flex gap-2">
            <select
              value={selectedStockStatus}
              onChange={(e) => {
                setSelectedStockStatus(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-1/2 px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-medium"
            >
              <option value="All">📦 All Stock</option>
              <option value="inStock">✅ In Stock</option>
              <option value="lowStock">⚠️ Low (≤3)</option>
              <option value="outOfStock">❌ Out of Stock</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-1/2 px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-medium"
            >
              <option value="stockHigh">Stock ↓</option>
              <option value="mostSold">Popular ↓</option>
              <option value="priceLow">Price Low-High</option>
              <option value="priceHigh">Price High-Low</option>
              <option value="name">Name A-Z</option>
            </select>
          </div>
        </div>

        {/* Quick Size Filter Pills (Size-wise Filter requested by user) */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap flex items-center gap-1">
            <span>📐 Size Filter:</span>
          </span>
          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
            {sizes.map((s) => {
              const isSelected = selectedSize === s;
              return (
                <button
                  key={s}
                  onClick={() => {
                    setSelectedSize(s);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300 dark:ring-indigo-800'
                      : 'bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {s === 'All' ? 'All Sizes' : s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              Showing <strong className="text-slate-800 dark:text-white">{filteredItems.length}</strong> products
            </span>
            {selectedInFiltered.length > 0 && (
              <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded font-medium">
                {selectedInFiltered.length} items selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {selectedInFiltered.length > 0 && (
              <button
                onClick={() => onBulkAddToInvoice(selectedInFiltered)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <span>🧾 Create Invoice with ({selectedInFiltered.length}) Items</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 1:1 Aspect Ratio Products Grid */}
      {filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-12 text-center border border-slate-200 dark:border-slate-700">
          <span className="text-4xl mb-3 block">👗</span>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
            No products match the selected filters
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-4">
            Try resetting your size, product category, or search filters to see all available garments.
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedProductCategory('All');
              setSelectedSize('All');
              setSelectedStockStatus('All');
              setSelectedColor('All');
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
          {paginatedItems.map((item) => {
            const rawItem = rawItemMap.get(item.id);
            const displayImage = item.imageUrl || rawItem?.imageUrl;
            const price = item.sellingPrice || item.avgSalePrice || 0;
            const isSelected = selectedVariantIds.has(item.variantId);
            const inStock = item.stock > 0;
            const isLowStock = item.stock > 0 && item.stock <= 3;

            return (
              <div
                key={item.variantId}
                className={`bg-white dark:bg-slate-800 rounded-xl border transition-all flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md group ${
                  isSelected
                    ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                    : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                }`}
              >
                {/* 1:1 Aspect Ratio Image Frame */}
                <div className="relative aspect-square w-full bg-slate-100 dark:bg-slate-900 overflow-hidden">
                  {displayImage ? (
                    <img
                      src={displayImage}
                      alt={item.name}
                      onClick={() => setPreviewImage({ url: displayImage, title: `${item.name} (${item.size})` })}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-zoom-in"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div
                      onClick={() => onEditItemPhoto(item)}
                      className="w-full h-full flex flex-col items-center justify-center p-3 text-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800/80 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-lg font-bold mb-1 shadow-xs">
                        {item.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 line-clamp-1">
                        {item.name}
                      </span>
                      <span className="text-[9px] text-indigo-600 dark:text-indigo-400 mt-1 font-medium bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full">
                        + Upload 1:1 Photo
                      </span>
                    </div>
                  )}

                  {/* Top Left Selection Checkbox */}
                  <div className="absolute top-2 left-2 z-10">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => onSelectionChange(item.variantId, e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-white/90 dark:bg-slate-800/90 border-slate-400 shadow-sm cursor-pointer"
                    />
                  </div>

                  {/* Top Right Size Badge (Prominent Size Badge) */}
                  <div className="absolute top-2 right-2 z-10">
                    <span className="px-2 py-0.5 text-[11px] font-extrabold bg-slate-900/85 text-white backdrop-blur-xs rounded-md shadow-sm border border-white/20">
                      {item.size}
                    </span>
                  </div>

                  {/* Bottom Stock Indicator Badge */}
                  <div className="absolute bottom-2 left-2 z-10 flex flex-col gap-1 items-start">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md shadow-xs backdrop-blur-xs ${
                        !inStock
                          ? 'bg-red-600/90 text-white'
                          : isLowStock
                          ? 'bg-amber-500/90 text-white'
                          : 'bg-emerald-600/90 text-white'
                      }`}
                    >
                      {!inStock ? 'Out of Stock' : `${item.stock} in stock`}
                    </span>
                  </div>

                  {/* Quick Photo Upload Trigger on Hover */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditItemPhoto(item);
                    }}
                    title="Change or upload product image"
                    className="absolute bottom-2 right-2 z-10 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-xs shadow-sm text-xs"
                  >
                    📷
                  </button>
                </div>

                {/* Card Body - Details */}
                <div className="p-3 flex flex-col flex-1 justify-between gap-2">
                  <div>
                    {/* Category & Color */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
                      <span className="truncate max-w-[65%] font-medium">{item.category}</span>
                      <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[10px] text-slate-700 dark:text-slate-300 font-semibold truncate max-w-[35%]">
                        {item.color}
                      </span>
                    </div>

                    {/* Product Name */}
                    <h4
                      className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-tight"
                      title={item.name}
                    >
                      {item.name}
                    </h4>
                    {item.subCategory && (
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                        {item.subCategory}
                      </p>
                    )}

                    {/* Pricing */}
                    <div className="mt-1.5 flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-sm sm:text-base font-extrabold text-indigo-600 dark:text-indigo-400">
                        {formatCurrency(price)}
                      </span>
                      {item.saleRealPrice && item.saleRealPrice > price && (
                        <span className="text-[11px] text-slate-400 line-through">
                          {formatCurrency(item.saleRealPrice)}
                        </span>
                      )}
                      {item.discountPercentage ? (
                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-1 rounded">
                          {item.discountPercentage}% OFF
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Direct Action Buttons: Create Invoice / POS / QR */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700/80 space-y-1.5">
                    {/* Primary Button: Create Invoice */}
                    <button
                      type="button"
                      onClick={() => onOpenInvoiceWithItem(item)}
                      className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span>🧾 Add to Invoice</span>
                    </button>

                    {/* Secondary Actions: Quick POS & QR */}
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        onClick={() => onOpenPosWithItem(item)}
                        title="Fast POS Checkout"
                        className="py-1 px-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] rounded-md transition-colors text-center truncate"
                      >
                        ⚡ POS
                      </button>

                      <button
                        type="button"
                        onClick={() => onEditItemPhoto(item)}
                        title="Edit Item / Change Photo"
                        className="py-1 px-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-semibold text-[11px] rounded-md transition-colors flex items-center justify-center"
                      >
                        <PencilIcon className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onPrintQr(item)}
                        title="Print Barcode / QR Label"
                        className="py-1 px-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-semibold text-[11px] rounded-md transition-colors flex items-center justify-center"
                      >
                        <QrCodeIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(page) => setCurrentPage(page)}
          itemsPerPage={ITEMS_PER_PAGE}
          totalItems={filteredItems.length}
        />
      )}

      {/* 1:1 Full Zoom Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative bg-white dark:bg-slate-900 p-3 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate pr-4">
                {previewImage.title}
              </h3>
              <button
                onClick={() => setPreviewImage(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>
            <div className="aspect-square w-full rounded-xl overflow-hidden bg-slate-950">
              <img
                src={previewImage.url}
                alt={previewImage.title}
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

export default VisualProductCatalog;
