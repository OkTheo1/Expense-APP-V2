import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, TrendingUp, Wallet, PiggyBank } from 'lucide-react';

export default function ProjectedExpensesBlock({ 
  totalIncome, 
  totalExpenses, 
  recurringExpenses,
  currency = 'GBP' 
}) {
  const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '€';
  
  // Calculate projected balance (Income - Recurring Expenses)
  const totalRecurringExpenses = recurringExpenses
    .filter(r => r.type !== 'income')
    .reduce((sum, r) => sum + r.amount, 0);
  
  const projectedBalance = totalIncome - totalRecurringExpenses;
  const hasRecurringIncome = recurringExpenses.some(r => r.type === 'income');
  
  return (
    <Card className="glass-card border border-white/10 h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium text-white flex items-center gap-2">
          <Wallet className="w-5 h-5 text-teal-400" />
          Projected Balance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Monthly Income */}
          <div className="flex justify-between items-center p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-slate-300">Expected Income</span>
            </div>
            <span className="text-lg font-semibold text-emerald-400">
              {symbol}{totalIncome.toFixed(2)}
            </span>
          </div>
          
          {/* Recurring Expenses */}
          <div className="flex justify-between items-center p-3 bg-red-500/10 rounded-xl border border-red-500/20">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-400" />
              <span className="text-sm text-slate-300">Recurring Expenses</span>
            </div>
            <span className="text-lg font-semibold text-red-400">
              {symbol}{totalRecurringExpenses.toFixed(2)}
            </span>
          </div>
          
          {/* Divider */}
          <div className="border-t border-white/10"></div>
          
          {/* Projected Balance */}
          <div className={`flex justify-between items-center p-4 rounded-xl border ${
            projectedBalance >= 0 
              ? 'bg-teal-500/10 border-teal-500/30' 
              : 'bg-red-500/10 border-red-500/30'
          }`}>
            <div className="flex items-center gap-2">
              <PiggyBank className={`w-5 h-5 ${projectedBalance >= 0 ? 'text-teal-400' : 'text-red-400'}`} />
              <span className="text-sm font-medium text-white">Projected Left This Month</span>
            </div>
            <span className={`text-2xl font-bold ${projectedBalance >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
              {symbol}{projectedBalance.toFixed(2)}
            </span>
          </div>
          
          {/* Info text */}
          <p className="text-xs text-slate-400 text-center">
            Based on your recurring transactions
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
