import React from 'react';
import { TrendingDown } from 'lucide-react';
import { Progress } from "@/components/ui/progress";

export default function SpendingBlock({ spent, budget, currency }) {
  const percentage = budget > 0 ? (spent / budget) * 100 : 0;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-purple-500/20">
            <TrendingDown className="h-6 w-6 text-purple-400" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Monthly Spending</p>
            <p className="text-3xl font-light text-white mt-1">
              {currency === 'GBP' && '£'}
              {currency === 'USD' && '$'}
              {currency === 'EUR' && '€'}
              {spent.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Budget Progress</span>
          <span className={`font-medium ${
            percentage > 100 ? 'text-red-400' : percentage >= 80 ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {percentage.toFixed(0)}%
          </span>
        </div>
        <Progress 
          value={Math.min(100, percentage)} 
          className={`h-2 bg-white/5 ${
            percentage > 100 ? '[&>div]:bg-gradient-to-r [&>div]:from-red-500 [&>div]:to-pink-500' : 
            percentage >= 80 ? '[&>div]:bg-gradient-to-r [&>div]:from-amber-500 [&>div]:to-orange-500' : 
            '[&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:to-teal-500'
          }`}
        />
        <p className="text-xs text-slate-500">
          {currency === 'GBP' && '£'}{(budget - spent).toFixed(2)} remaining of {currency === 'GBP' && '£'}{budget.toFixed(2)} budget
        </p>
      </div>
    </div>
  );
}