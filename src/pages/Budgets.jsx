import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Plus, ArrowLeft, Trash2, Edit2, ChevronLeft, ChevronRight, Download, PiggyBank, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';
import { getBudgets, createBudget, updateBudget, deleteBudget, getExpenses } from '@/lib/localDatabase';

const CATEGORIES = [
  { value: 'Housing', icon: '🏠' },
  { value: 'Food & Dining', icon: '🍽️' },
  { value: 'Transportation', icon: '🚗' },
  { value: 'Entertainment', icon: '🎬' },
  { value: 'Shopping', icon: '🛍️' },
  { value: 'Utilities', icon: '💡' },
  { value: 'Healthcare', icon: '🏥' },
  { value: 'Education', icon: '📚' },
  { value: 'Personal', icon: '👤' },
  { value: 'Savings', icon: '💰' },
  { value: 'Other', icon: '📦' }
];

const CATEGORY_ICONS = CATEGORIES.reduce((acc, cat) => {
  acc[cat.value] = cat.icon;
  return acc;
}, {});

export default function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [formData, setFormData] = useState({ category: '', limit: '' });

  const currentMonth = format(selectedMonth, 'yyyy-MM');

  const exportToCSV = () => {
    const headers = ['Month', 'Category', 'Limit', 'Spent', 'Remaining'];
    const rows = budgets.map(b => {
      const spent = expenses.filter(e => e.category === b.category).reduce((sum, e) => sum + e.amount, 0);
      return [b.month, b.category, b.limit, spent, b.limit - spent];
    });

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budgets-${currentMonth}.csv`;
    a.click();
    toast.success('Exported to CSV');
  };

  useEffect(() => {
    loadData();
  }, [currentMonth]);

  const loadData = () => {
    setLoading(true);
    try {
      const budgetsData = getBudgets();
      const expensesData = getExpenses();
      // Filter budgets for current month
      const monthBudgets = budgetsData.filter(b => b.month === currentMonth);
      setBudgets(monthBudgets);
      setExpenses(expensesData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const monthStart = startOfMonth(selectedMonth).toISOString().split('T')[0];
  const monthEnd = endOfMonth(selectedMonth).toISOString().split('T')[0];

  const monthExpenses = expenses.filter(e => 
    e.date >= monthStart && e.date <= monthEnd
  );

  const spendingByCategory = monthExpenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {});

  const budgetStatus = budgets.map(budget => {
    const spent = spendingByCategory[budget.category] || 0;
    const percentage = budget.limit > 0 ? (spent / budget.limit) * 100 : 0;
    const remaining = budget.limit - spent;
    return { ...budget, spent, percentage, remaining };
  });

  const totalBudget = budgets.reduce((sum, b) => sum + b.limit, 0);
  const totalSpent = budgetStatus.reduce((sum, b) => sum + b.spent, 0);

  const usedCategories = budgets.map(b => b.category);
  const availableCategories = CATEGORIES.filter(c => !usedCategories.includes(c.value));

  const openDialog = (budget = null) => {
    if (budget) {
      setEditingBudget(budget);
      setFormData({ category: budget.category, limit: budget.limit.toString() });
    } else {
      setEditingBudget(null);
      setFormData({ category: '', limit: '' });
    }
    setDialogOpen(true);
  };

  const handleSave = () => {
    setSaving(true);
    try {
      if (editingBudget) {
        updateBudget(editingBudget.id, {
          limit: parseFloat(formData.limit)
        });
      } else {
        createBudget({
          month: currentMonth,
          category: formData.category,
          limit: parseFloat(formData.limit)
        });
      }
      loadData();
      setDialogOpen(false);
      toast.success(editingBudget ? 'Budget updated' : 'Budget created');
    } catch (error) {
      console.error('Error saving budget:', error);
      toast.error('Failed to save budget');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (budget) => {
    deleteBudget(budget.id);
    setBudgets(budgets.filter(b => b.id !== budget.id));
    toast.success('Budget deleted');
  };

  const copyFromLastMonth = () => {
    const lastMonth = format(subMonths(selectedMonth, 1), 'yyyy-MM');
    const allBudgets = getBudgets();
    const lastMonthBudgets = allBudgets.filter(b => b.month === lastMonth);
    
    if (lastMonthBudgets.length === 0) {
      toast.error('No budgets from last month to copy');
      return;
    }

    setSaving(true);
    try {
      for (const budget of lastMonthBudgets) {
        if (!usedCategories.includes(budget.category)) {
          createBudget({
            month: currentMonth,
            category: budget.category,
            limit: budget.limit
          });
        }
      }
      loadData();
      toast.success('Budgets copied from last month');
    } catch (error) {
      console.error('Error copying budgets:', error);
      toast.error('Failed to copy budgets');
    } finally {
      setSaving(false);
    }
  };

  const overBudgetCount = budgetStatus.filter(b => b.percentage > 100).length;
  const onTrackCount = budgetStatus.filter(b => b.percentage <= 80).length;
  const symbol = '£';
  const overallPct = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <Link
          to={createPageUrl('Dashboard')}
          className="inline-flex items-center text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-4xl font-light text-white tracking-tight">Budgets</h1>
            <p className="text-slate-400 mt-2">Set spending limits for each category</p>
          </div>
          <div className="flex items-center gap-3 mt-4 sm:mt-0">
            {budgets.length > 0 && (
              <Button
                variant="outline"
                onClick={exportToCSV}
                className="glass-card border-white/10 text-slate-300 hover:text-white hover:border-teal-500/30 rounded-xl"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            )}
            <Button
              variant="outline"
              onClick={copyFromLastMonth}
              disabled={saving}
              className="glass-card border-white/10 text-slate-300 hover:text-white hover:border-teal-500/30 rounded-xl"
            >
              Copy from Last Month
            </Button>
            <Button
              onClick={() => openDialog()}
              disabled={availableCategories.length === 0}
              className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white shadow-lg shadow-teal-500/30 rounded-xl px-6"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Budget
            </Button>
          </div>
        </div>

        {/* Summary stat cards */}
        {budgetStatus.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 flex items-center justify-center border border-teal-500/20">
                  <PiggyBank className="h-5 w-5 text-teal-400" />
                </div>
                <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">Total Budget</p>
              </div>
              <p className="text-2xl font-bold text-white">{symbol}{totalBudget.toFixed(2)}</p>
              <p className="text-xs text-slate-500 mt-1">{symbol}{totalSpent.toFixed(2)} spent</p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center border border-emerald-500/20">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                </div>
                <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">On Track</p>
              </div>
              <p className="text-2xl font-bold text-emerald-400">{onTrackCount}</p>
              <p className="text-xs text-slate-500 mt-1">categories under 80%</p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center border ${
                  overBudgetCount > 0
                    ? 'bg-gradient-to-br from-red-500/20 to-rose-500/20 border-red-500/20'
                    : 'bg-gradient-to-br from-slate-700/20 to-slate-600/20 border-slate-700/20'
                }`}>
                  <AlertTriangle className={`h-5 w-5 ${overBudgetCount > 0 ? 'text-red-400' : 'text-slate-500'}`} />
                </div>
                <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">Over Budget</p>
              </div>
              <p className={`text-2xl font-bold ${overBudgetCount > 0 ? 'text-red-400' : 'text-slate-500'}`}>{overBudgetCount}</p>
              <p className="text-xs text-slate-500 mt-1">categories exceeded</p>
            </div>
          </div>
        )}

        {/* Month Selector */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
              className="text-slate-400 hover:text-white hover:bg-white/5 rounded-xl"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-white">{format(selectedMonth, 'MMMM yyyy')}</h2>
              {totalBudget > 0 && (
                <p className="text-sm text-slate-400 mt-0.5">
                  {symbol}{totalSpent.toFixed(2)} of {symbol}{totalBudget.toFixed(2)} — {overallPct.toFixed(0)}% used
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
              className="text-slate-400 hover:text-white hover:bg-white/5 rounded-xl"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
          {totalBudget > 0 && (
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  overallPct > 100 ? 'bg-red-400' : overallPct >= 80 ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
                style={{ width: `${overallPct}%` }}
              />
            </div>
          )}
        </div>

        {/* Budget List */}
        {budgetStatus.length > 0 ? (
          <div className="space-y-4">
            {budgetStatus
              .sort((a, b) => b.percentage - a.percentage)
              .map((budget) => {
                const isOver = budget.percentage > 100;
                const isWarning = budget.percentage >= 80 && !isOver;
                const statusColor = isOver ? 'red' : isWarning ? 'amber' : 'emerald';
                const barColor = isOver ? 'bg-red-400' : isWarning ? 'bg-amber-400' : 'bg-emerald-400';
                const glowColor = isOver ? 'shadow-red-500/10' : isWarning ? 'shadow-amber-500/10' : 'shadow-emerald-500/10';
                const borderColor = isOver ? 'border-red-500/20' : isWarning ? 'border-amber-500/20' : 'border-slate-800';

                return (
                  <div
                    key={budget.id}
                    className={`relative overflow-hidden bg-slate-900/50 border rounded-2xl p-6 shadow-lg ${borderColor} ${glowColor}`}
                  >
                    {/* Glow blob */}
                    {(isOver || isWarning) && (
                      <div className={`absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl opacity-20 ${
                        isOver ? 'bg-red-400' : 'bg-amber-400'
                      }`} />
                    )}

                    <div className="relative flex items-start justify-between mb-5">
                      <div className="flex items-center gap-4">
                        <div className={`h-14 w-14 rounded-2xl flex items-center justify-center text-2xl border ${
                          isOver
                            ? 'bg-gradient-to-br from-red-500/20 to-rose-500/10 border-red-500/20'
                            : isWarning
                            ? 'bg-gradient-to-br from-amber-500/20 to-yellow-500/10 border-amber-500/20'
                            : 'bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border-emerald-500/20'
                        }`}>
                          {CATEGORY_ICONS[budget.category]}
                        </div>
                        <div>
                          <h3 className="font-semibold text-white text-lg">{budget.category}</h3>
                          <p className="text-slate-400 text-sm">
                            {symbol}{budget.spent.toFixed(2)} of {symbol}{budget.limit.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDialog(budget)}
                          className="text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-xl"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(budget)}
                          className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="relative h-2.5 bg-white/5 rounded-full overflow-hidden mb-3">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                        style={{ width: `${Math.min(100, budget.percentage)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-semibold ${
                        isOver ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {budget.percentage.toFixed(0)}% used
                      </span>
                      <span className={`text-sm font-medium ${
                        budget.remaining < 0 ? 'text-red-400' : 'text-slate-300'
                      }`}>
                        {budget.remaining < 0
                          ? `${symbol}${Math.abs(budget.remaining).toFixed(2)} over budget`
                          : `${symbol}${budget.remaining.toFixed(2)} remaining`}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 flex items-center justify-center border border-teal-500/20 mx-auto mb-6">
              <PiggyBank className="h-8 w-8 text-teal-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No budgets set</h3>
            <p className="text-slate-400 mb-6">
              Set monthly spending limits to stay on track with your financial goals
            </p>
            <Button
              onClick={() => openDialog()}
              className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white shadow-lg shadow-teal-500/30 rounded-xl px-6"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Budget
            </Button>
          </div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="bg-slate-900 border border-slate-700 text-white sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white text-xl font-semibold">
                {editingBudget ? 'Edit Budget' : 'Add Budget'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {!editingBudget && (
                <div className="space-y-2">
                  <Label className="text-slate-300">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {availableCategories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value} className="text-slate-200">
                          <span className="flex items-center gap-2">
                            <span>{cat.icon}</span>
                            <span>{cat.value}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-slate-300">Monthly Limit</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{symbol}</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.limit}
                    onChange={(e) => setFormData({ ...formData, limit: e.target.value })}
                    className="pl-7 bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !formData.limit || (!editingBudget && !formData.category)}
                className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white"
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
