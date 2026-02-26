import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Sparkles, Repeat, BarChart2, ArrowUpRight, ArrowDownRight, Fuel } from 'lucide-react';
import { format, addMonths, startOfMonth, endOfMonth, subMonths } from 'date-fns';

const FREQUENCY_MULTIPLIERS = {
  daily: 30,
  weekly: 4.33,
  monthly: 1,
  yearly: 1 / 12,
};

function toMonthly(amount, frequency) {
  return amount * (FREQUENCY_MULTIPLIERS[frequency] || 1);
}

export default function NextMonthProjectionBlock({ recurringTransactions = [], bankTransactions = [], currency = 'GBP' }) {
  const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '€';
  const nextMonth = addMonths(new Date(), 1);
  const nextMonthName = format(nextMonth, 'MMMM yyyy');

  // Active recurring income items (normalized to monthly)
  const recurringIncomeItems = useMemo(() =>
    recurringTransactions
      .filter(r => r.type === 'income' && r.isActive !== false)
      .map(r => ({ ...r, monthlyAmount: toMonthly(r.amount, r.frequency) })),
    [recurringTransactions]
  );

  // Active recurring expense items (normalized to monthly)
  const recurringExpenseItems = useMemo(() =>
    recurringTransactions
      .filter(r => r.type !== 'income' && r.isActive !== false)
      .map(r => ({ ...r, monthlyAmount: toMonthly(r.amount, r.frequency) })),
    [recurringTransactions]
  );

  const totalRecurringIncome = recurringIncomeItems.reduce((s, r) => s + r.monthlyAmount, 0);
  const totalRecurringExpenses = recurringExpenseItems.reduce((s, r) => s + r.monthlyAmount, 0);

  // Recurring-only net (no variable/bank data)
  const recurringNet = totalRecurringIncome - totalRecurringExpenses;

  // Average monthly bank income, expenses, and fuel over last 3 months
  const { avgBankIncome, avgBankExpenses, avgFuelExpenses } = useMemo(() => {
    const now = new Date();
    let incomeTotal = 0, expenseTotal = 0, fuelTotal = 0, months = 0;
    for (let i = 1; i <= 3; i++) {
      const start = startOfMonth(subMonths(now, i)).toISOString().split('T')[0];
      const end = endOfMonth(subMonths(now, i)).toISOString().split('T')[0];
      const monthTxs = bankTransactions.filter(tx => tx.date >= start && tx.date <= end);
      const inc = monthTxs.filter(tx => tx.amount > 0).reduce((s, tx) => s + tx.amount, 0);
      const exp = monthTxs.filter(tx => tx.amount < 0).reduce((s, tx) => s + Math.abs(tx.amount), 0);
      const fuel = monthTxs
        .filter(tx => tx.amount < 0 && tx.category === 'Fuel')
        .reduce((s, tx) => s + Math.abs(tx.amount), 0);
      if (inc > 0 || exp > 0) {
        incomeTotal += inc;
        expenseTotal += exp;
        fuelTotal += fuel;
        months++;
      }
    }
    return {
      avgBankIncome: months > 0 ? incomeTotal / months : 0,
      avgBankExpenses: months > 0 ? expenseTotal / months : 0,
      avgFuelExpenses: months > 0 ? fuelTotal / months : 0,
    };
  }, [bankTransactions]);

  // Projected income: use recurring if set, else avg bank income
  const projectedIncome = totalRecurringIncome > 0 ? totalRecurringIncome : avgBankIncome;

  // Projected variable expenses = avg bank expenses minus recurring (to avoid double-counting)
  const rawVariableExpenses = Math.max(0, avgBankExpenses - totalRecurringExpenses);

  // Fuel is broken out from variable; other variable = remainder
  const fuelExpenses = avgFuelExpenses;
  const otherVariableExpenses = Math.max(0, rawVariableExpenses - fuelExpenses);

  // Total projected expenses
  const projectedExpenses = totalRecurringExpenses + rawVariableExpenses;

  const netBalance = projectedIncome - projectedExpenses;
  const savingsRate = projectedIncome > 0 ? (netBalance / projectedIncome) * 100 : 0;
  const expenseRatio = projectedIncome > 0 ? Math.min(100, (projectedExpenses / projectedIncome) * 100) : 100;

  const hasData = projectedIncome > 0 || projectedExpenses > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 flex items-center justify-center border border-violet-500/20 shadow-lg shadow-violet-500/10">
          <Sparkles className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">Forecast</p>
          <p className="text-white font-semibold text-sm">{nextMonthName}</p>
        </div>
      </div>

      {!hasData ? (
        <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-6 text-center">
          <Sparkles className="h-8 w-8 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">No data yet</p>
          <p className="text-slate-600 text-xs mt-1">Add recurring transactions or connect your bank</p>
        </div>
      ) : (
        <>
          {/* Net Balance Hero Card */}
          <div className={`relative overflow-hidden rounded-2xl p-5 border ${
            netBalance >= 0
              ? 'bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border-emerald-500/20'
              : 'bg-gradient-to-br from-red-500/10 via-rose-500/5 to-transparent border-red-500/20'
          }`}>
            {/* Glow blob */}
            <div className={`absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-30 ${
              netBalance >= 0 ? 'bg-emerald-400' : 'bg-red-400'
            }`} />
            <div className="relative">
              <p className="text-xs text-slate-400 mb-1 uppercase tracking-wider">Projected Net</p>
              <div className="flex items-end gap-2">
                <p className={`text-3xl font-bold tracking-tight ${netBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {netBalance < 0 ? '-' : ''}{symbol}{Math.abs(netBalance).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                {netBalance >= 0 ? (
                  <ArrowUpRight className="h-5 w-5 text-emerald-400 mb-1" />
                ) : (
                  <ArrowDownRight className="h-5 w-5 text-red-400 mb-1" />
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {netBalance >= 0
                  ? `${savingsRate.toFixed(0)}% savings rate`
                  : `${Math.abs(savingsRate).toFixed(0)}% over budget`}
              </p>

              {/* Recurring-only net */}
              {(totalRecurringIncome > 0 || totalRecurringExpenses > 0) && (
                <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Repeat className="h-3 w-3 text-slate-500" />
                    <span className="text-xs text-slate-500">Recurring only</span>
                  </div>
                  <span className={`text-xs font-semibold ${recurringNet >= 0 ? 'text-teal-400' : 'text-orange-400'}`}>
                    {recurringNet < 0 ? '-' : '+'}{symbol}{Math.abs(recurringNet).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {/* Income vs Expense bar */}
              <div className="mt-3 space-y-1.5">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Expenses</span>
                  <span>{expenseRatio.toFixed(0)}% of income</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      expenseRatio > 90 ? 'bg-red-400' : expenseRatio > 70 ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                    style={{ width: `${expenseRatio}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Income Card */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <span className="text-sm text-slate-300 font-medium">Projected Income</span>
              </div>
              <span className="text-emerald-400 font-bold text-sm">
                {symbol}{projectedIncome.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {recurringIncomeItems.length > 0 ? (
              <div className="space-y-1.5 pt-1 border-t border-white/5">
                {recurringIncomeItems.slice(0, 4).map((r, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Repeat className="h-3 w-3 text-slate-600" />
                      <span className="text-xs text-slate-400 truncate max-w-[120px]">{r.title}</span>
                      {r.frequency !== 'monthly' && (
                        <span className="text-xs text-slate-600 capitalize">({r.frequency})</span>
                      )}
                    </div>
                    <span className="text-xs text-emerald-400/80">{symbol}{r.monthlyAmount.toFixed(2)}</span>
                  </div>
                ))}
                {recurringIncomeItems.length > 4 && (
                  <p className="text-xs text-slate-600">+{recurringIncomeItems.length - 4} more</p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 pt-1 border-t border-white/5">
                <BarChart2 className="h-3 w-3 text-slate-600" />
                <span className="text-xs text-slate-500">Based on 3-month bank average</span>
              </div>
            )}
          </div>

          {/* Expenses Card */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                </div>
                <span className="text-sm text-slate-300 font-medium">Projected Expenses</span>
              </div>
              <span className="text-red-400 font-bold text-sm">
                {symbol}{projectedExpenses.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="space-y-1.5 pt-1 border-t border-white/5">
              {recurringExpenseItems.slice(0, 4).map((r, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Repeat className="h-3 w-3 text-slate-600" />
                    <span className="text-xs text-slate-400 truncate max-w-[120px]">{r.title}</span>
                    {r.frequency !== 'monthly' && (
                      <span className="text-xs text-slate-600 capitalize">({r.frequency})</span>
                    )}
                  </div>
                  <span className="text-xs text-red-400/80">{symbol}{r.monthlyAmount.toFixed(2)}</span>
                </div>
              ))}
              {recurringExpenseItems.length > 4 && (
                <p className="text-xs text-slate-600">+{recurringExpenseItems.length - 4} more</p>
              )}
              {fuelExpenses > 0 && (
                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                  <div className="flex items-center gap-1.5">
                    <Fuel className="h-3 w-3 text-amber-500" />
                    <span className="text-xs text-amber-400/80">Fuel (variable, 3mo avg)</span>
                  </div>
                  <span className="text-xs text-amber-400/80">{symbol}{fuelExpenses.toFixed(2)}</span>
                </div>
              )}
              {otherVariableExpenses > 0 && (
                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                  <div className="flex items-center gap-1.5">
                    <BarChart2 className="h-3 w-3 text-slate-600" />
                    <span className="text-xs text-slate-500">Other variable (3mo avg)</span>
                  </div>
                  <span className="text-xs text-slate-400">{symbol}{otherVariableExpenses.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer note */}
          <p className="text-xs text-slate-600 text-center pb-2">
            Based on recurring transactions &amp; bank history
          </p>
        </>
      )}
    </div>
  );
}
