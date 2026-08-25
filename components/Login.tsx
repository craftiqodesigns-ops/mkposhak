import React, { useState } from 'react';

interface AuthProps {
    onLoginSuccess: () => void;
    currentPin?: string;
}

const Auth: React.FC<AuthProps> = ({ onLoginSuccess, currentPin }) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');

    const targetPin = currentPin || localStorage.getItem('app_security_pin') || '1234';

    const handlePinSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!pin.trim()) {
            setError('Please enter your PIN.');
            return;
        }

        if (pin === targetPin) {
            sessionStorage.setItem('is_pin_authenticated', 'true');
            onLoginSuccess();
        } else {
            setError('Incorrect PIN. Please try again.');
            setPin('');
        }
    };

    const handleKeyClick = (num: string) => {
        if (pin.length < 6) {
            setPin(prev => prev + num);
            setError('');
        }
    };

    const handleDeleteKey = () => {
        setPin(prev => prev.slice(0, -1));
        setError('');
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="bg-white dark:bg-slate-800 shadow-xl rounded-2xl p-8 space-y-6 border border-slate-200 dark:border-slate-700">
                    <div className="text-center space-y-2">
                        <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            MK POSHAK HOUSE
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Enter Security PIN to unlock dashboard
                        </p>
                    </div>

                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 px-4 py-2.5 rounded-xl text-sm text-center font-medium">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handlePinSubmit} className="space-y-5">
                        <div className="relative">
                            <input
                                type="password"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                required
                                value={pin}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    setPin(val);
                                    setError('');
                                }}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-xl text-center text-2xl tracking-[0.5em] font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="••••"
                                autoFocus
                            />
                        </div>

                        {/* On-screen Keypad */}
                        <div className="grid grid-cols-3 gap-2 pt-1">
                            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                                <button
                                    key={num}
                                    type="button"
                                    onClick={() => handleKeyClick(num)}
                                    className="py-3 bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-semibold rounded-xl text-lg shadow-sm transition-colors active:scale-95"
                                >
                                    {num}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => setPin('')}
                                className="py-3 bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-400 font-medium rounded-xl text-xs uppercase transition-colors"
                            >
                                Clear
                            </button>
                            <button
                                type="button"
                                onClick={() => handleKeyClick('0')}
                                className="py-3 bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-semibold rounded-xl text-lg shadow-sm transition-colors active:scale-95"
                            >
                                0
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteKey}
                                className="py-3 bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 font-medium rounded-xl text-sm transition-colors"
                            >
                                ⌫
                            </button>
                        </div>

                        <button
                            type="submit"
                            className="w-full py-3 px-4 rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 font-semibold shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                        >
                            Unlock Dashboard
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Auth;
