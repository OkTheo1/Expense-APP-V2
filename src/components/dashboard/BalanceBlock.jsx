import React from 'react';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';

const formatCurrency = (amount, currency) => {
  const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '';
  return `${symbol}${amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
};

export default function BalanceBlock({ balance, currency, change, thisMonth, lastMonth }) {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 flex items-center justify-center border border-teal-500/20">
            <Wallet className="h-6 w-6 text-teal-400" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Total Balance</p>
            <p className="text-3xl font-light text-white mt-1">
              {formatCurrency(balance, currency)}
            </p>
          </div>
        </div>
        <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full ${
          change >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
        }`}>
          {change >= 0 ? (
            <TrendingUp className="h-4 w-4" />
          ) : (
            <TrendingDown className="h-4 w-4" />
          )}
          <span className="text-sm font-medium">{Math.abs(change).toFixed(1)}%</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-4 rounded-xl border border-white/5">
          <p className="text-xs text-slate-400 mb-1">This Month</p>
          <p className="text-xl font-light text-white">
            {formatCurrency(thisMonth || 0, currency)}
          </p>
        </div>
        <div className="glass-card p-4 rounded-xl border border-white/5">
          <p className="text-xs text-slate-400 mb-1">Last Month</p>
          <p className="text-xl font-light text-white">
            {formatCurrency(lastMonth || 0, currency)}
          </p>
        </div>
      </div>
    </div>
  );
}
