import React from 'react';
import { ArrowUpRight, ArrowDownLeft, Receipt } from 'lucide-react';
import { format } from 'date-fns';

const CATEGORY_ICONS = {
  'Housing': '🏠',
  'Food & Dining': '🍽️',
  'Transportation': '🚗',
  'Entertainment': '🎬',
  'Shopping': '🛍️',
  'Utilities': '💡',
  'Healthcare': '🏥',
  'Education': '📚',
  'Personal': '👤',
  'Savings': '💰',
  'Other': '📦',
  'Salary': '💼',
  'Freelance': '💻',
  'Investment': '📈'
};

export default function RecentTransactionsBlock({ transactions, currency }) {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center border border-orange-500/20">
          <Receipt className="h-6 w-6 text-orange-400" />
        </div>
        <div>
          <p className="text-sm text-slate-400">Recent Activity</p>
          <p className="text-lg font-medium text-white mt-0.5">Latest Transactions</p>
        </div>
      </div>
      {transactions && transactions.length > 0 ? (
        <div className="space-y-2">
          {transactions.slice(0, 5).map((transaction) => (
            <div 
              key={transaction.id}
              className="glass-card p-3 rounded-xl border border-white/5 hover:border-teal-500/30 transition-all duration-200 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl glass flex items-center justify-center text-lg border border-white/5">
                    {CATEGORY_ICONS[transaction.category] || '📦'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white group-hover:text-teal-400 transition-colors">
                      {transaction.title}
                    </p>
                    <p className="text-xs text-slate-400">
                      {transaction.category} • {format(new Date(transaction.date), 'MMM d')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${
                    transaction.type === 'income' ? 'text-emerald-400' : 'text-slate-300'
                  }`}>
                    {transaction.type === 'income' ? '+' : '-'}
                    {currency === 'GBP' && '£'}
                    {currency === 'USD' && '$'}
                    {currency === 'EUR' && '€'}
                    {transaction.amount.toFixed(2)}
                  </span>
                  {transaction.type === 'income' ? (
                    <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <ArrowDownLeft className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="h-48 flex items-center justify-center text-slate-500">
          No transactions yet
        </div>
      )}
    </div>
  );
}