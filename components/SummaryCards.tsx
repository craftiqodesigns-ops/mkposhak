import React from 'react';
import type { SummaryMetrics } from '../types';
import { DollarSignIcon } from './icons/DollarSignIcon';
import { ShoppingCartIcon } from './icons/ShoppingCartIcon';
import { TrendingUpIcon } from './icons/TrendingUpIcon';
import { PackageIcon } from './icons/PackageIcon';
import { ClockIcon } from './icons/ClockIcon';

interface SummaryCardsProps {
    metrics: SummaryMetrics;
    onRevenueClick?: () => void;
    onOutstandingClick?: () => void;
    onProfitClick?: () => void;
    onItemsSoldClick?: () => void;
    onStockValueClick?: () => void;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

interface SummaryCardProps {
    title: string;
    value: string;
    icon: React.ReactNode;
    color: string;
    onClick?: () => void;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, icon, color, onClick }) => (
    <div 
        onClick={onClick}
        className={`bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg flex items-center space-x-4 ${onClick ? 'cursor-pointer hover:scale-105 transition-transform duration-200' : ''}`}
    >
        <div className={`p-3 rounded-full ${color}`}>
            {icon}
        </div>
        <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
        </div>
    </div>
);


const SummaryCards: React.FC<SummaryCardsProps> = ({ 
    metrics, 
    onRevenueClick, 
    onOutstandingClick, 
    onProfitClick,
    onItemsSoldClick,
    onStockValueClick,
}) => {
    const { totalRevenue, totalProfit, totalItemsSold, totalStockValue, outstandingRevenue } = metrics;
    
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            <SummaryCard 
                title="Total Revenue" 
                value={formatCurrency(totalRevenue)} 
                icon={<DollarSignIcon className="w-6 h-6 text-white" />}
                color="bg-blue-500"
                onClick={onRevenueClick}
            />
             <SummaryCard 
                title="Outstanding Revenue" 
                value={formatCurrency(outstandingRevenue)} 
                icon={<ClockIcon className="w-6 h-6 text-white" />}
                color="bg-orange-500"
                onClick={onOutstandingClick}
            />
            <SummaryCard 
                title="Total Profit" 
                value={formatCurrency(totalProfit)} 
                icon={<TrendingUpIcon className="w-6 h-6 text-white" />}
                color={totalProfit >= 0 ? "bg-green-500" : "bg-red-500"}
                onClick={onProfitClick}
            />
            <SummaryCard 
                title="Items Sold" 
                value={totalItemsSold.toLocaleString()} 
                icon={<ShoppingCartIcon className="w-6 h-6 text-white" />}
                color="bg-amber-500"
                onClick={onItemsSoldClick}
            />
             <SummaryCard 
                title="Stock Value (Cost)" 
                value={formatCurrency(totalStockValue)} 
                icon={<PackageIcon className="w-6 h-6 text-white" />}
                color="bg-purple-500"
                onClick={onStockValueClick}
            />
        </div>
    );
};

export default SummaryCards;