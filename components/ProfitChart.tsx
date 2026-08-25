import React, { useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ItemProfitData {
    name: string;
    category: string;
    profit: number;
    totalRevenue: number;
}
interface CategoryProfitData {
    category: string;
    profit: number;
    totalRevenue: number;
}
interface MonthlyPnlData {
    month: string;
    profit: number;
    revenue: number;
}

interface ProfitChartProps {
    itemData: ItemProfitData[];
    categoryData: CategoryProfitData[];
    monthlyData: MonthlyPnlData[];
}

type ChartType = 'item' | 'category' | 'monthly';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

const formatYAxis = (tick: number) => {
    if (Math.abs(tick) >= 100000) return `₹${(tick / 100000).toFixed(1)}L`;
    if (Math.abs(tick) >= 1000) return `₹${Math.round(tick / 1000)}k`;
    return `₹${tick}`;
};

const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(Number(year), Number(month) - 1);
    return date.toLocaleString('default', { month: 'short', year: '2-digit' });
};

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg">
                <p className="font-bold text-slate-900 dark:text-slate-100">{label}</p>
                {data.category && <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{data.category}</p>}
                <div className="space-y-1">
                   {payload.map((pld: any) => (
                       <div key={pld.dataKey} className="flex items-center justify-between text-sm">
                           <div className="flex items-center">
                               <span className="w-2 h-2 rounded-full mr-2" style={{backgroundColor: pld.stroke || pld.fill}}></span>
                               <span className="text-slate-600 dark:text-slate-300">{pld.name}:</span>
                           </div>
                           <span className="font-semibold text-slate-800 dark:text-slate-200 ml-4">{formatCurrency(pld.value)}</span>
                       </div>
                   ))}
                </div>
            </div>
        );
    }
    return null;
};

const TabButton: React.FC<{ title: string; isActive: boolean; onClick: () => void }> = ({ title, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            isActive
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
        }`}
    >
        {title}
    </button>
);


const ProfitChart: React.FC<ProfitChartProps> = ({ itemData, categoryData, monthlyData }) => {
    const [chartType, setChartType] = useState<ChartType>('item');

    const renderChart = () => {
        switch (chartType) {
            case 'monthly':
                return (
                    <ResponsiveContainer>
                        <LineChart data={monthlyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.3)" />
                            <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fill: 'rgb(100 116 139)', fontSize: 12 }} />
                            <YAxis tickFormatter={formatYAxis} tick={{ fill: 'rgb(100 116 139)', fontSize: 12 }} width={80} />
                            <Tooltip content={<CustomTooltip />} cursor={{stroke: 'rgba(100, 116, 139, 0.5)'}}/>
                            <Legend />
                            <Line type="monotone" dataKey="profit" name="Profit" stroke="#10b981" strokeWidth={2} />
                            <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                );
            case 'category':
                 return (
                    <ResponsiveContainer>
                        <BarChart data={categoryData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.3)" />
                            <XAxis dataKey="category" tick={{ fill: 'rgb(100 116 139)', fontSize: 12 }} />
                            <YAxis tickFormatter={formatYAxis} tick={{ fill: 'rgb(100 116 139)', fontSize: 12 }} width={80} />
                            <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(100, 116, 139, 0.1)'}}/>
                            <Legend />
                            <Bar dataKey="profit" name="Profit" fill="#4f46e5" />
                            <Bar dataKey="totalRevenue" name="Revenue" fill="#a5b4fc" />
                        </BarChart>
                    </ResponsiveContainer>
                );
            case 'item':
            default:
                return (
                    <ResponsiveContainer>
                        <BarChart data={itemData} margin={{ top: 5, right: 20, left: 0, bottom: 50 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.3)" />
                            <XAxis dataKey="name" tick={{ fill: 'rgb(100 116 139)', fontSize: 12 }} angle={-45} textAnchor="end" height={50} interval={0} />
                            <YAxis tickFormatter={formatYAxis} tick={{ fill: 'rgb(100 116 139)', fontSize: 12 }} width={80} />
                            <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(100, 116, 139, 0.1)'}}/>
                            <Legend wrapperStyle={{paddingTop: '30px'}}/>
                            <Bar dataKey="profit" name="Profit" fill="#4f46e5" />
                            <Bar dataKey="totalRevenue" name="Revenue" fill="#a5b4fc" />
                        </BarChart>
                    </ResponsiveContainer>
                );
        }
    };
    
    const getChartTitle = () => {
        switch (chartType) {
            case 'monthly': return 'Monthly P&L Summary';
            case 'category': return 'Profit by Category';
            case 'item':
            default: return 'Profit by Item';
        }
    }

    return (
        <div>
             <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{getChartTitle()}</h2>
                <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-lg">
                    <TabButton title="By Item" isActive={chartType === 'item'} onClick={() => setChartType('item')} />
                    <TabButton title="By Category" isActive={chartType === 'category'} onClick={() => setChartType('category')} />
                    <TabButton title="Monthly P&L" isActive={chartType === 'monthly'} onClick={() => setChartType('monthly')} />
                </div>
            </div>
            <div style={{ width: '100%', height: 400 }}>
                {renderChart()}
            </div>
        </div>
    );
};

export default ProfitChart;