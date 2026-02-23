import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Plus, ArrowLeft, Trash2, Edit2, ChevronLeft, ChevronRight, Download } from 'lucide-react';
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link 
          to={createPageUrl('Dashboard')} 
          className="inline-flex items-center text-slate-500 hover:text-slate-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-light text-slate-900 tracking-tight">
              Budgets
            </h1>
            <p className="text-slate-500 mt-1">
              Set spending limits for each category
            </p>
          </div>
          <div className="flex items-center gap-3 mt-4 sm:mt-0">
            {budgets.length > 0 && (
              <Button
                variant="outline"
                onClick={exportToCSV}
                className="border-slate-200"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            )}
            {budgets.length === 0 && (
              <Button
                variant="outline"
                onClick={copyFromLastMonth}
                disabled={saving}
                className="border-slate-200"
              >
                Copy from Last Month
              </Button>
            )}
            <Button 
              onClick={() => openDialog()}
              disabled={availableCategories.length === 0}
              className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-6"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Budget
            </Button>
          </div>
        </div>

        {/* Month Selector */}
        <Card className="border-0 shadow-sm mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
                className="text-slate-600"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="text-center">
                <h2 className="text-xl font-medium text-slate-900">
                  {format(selectedMonth, 'MMMM yyyy')}
                </h2>
                <p className="text-sm text-slate-500">
                  ${totalSpent.toFixed(2)} spent of ${totalBudget.toFixed(2)} budget
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
                className="text-slate-600"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
            {totalBudget > 0 && (
              <Progress 
                value={Math.min(100, (totalSpent / totalBudget) * 100)} 
                className="h-2 mt-4"
              />
            )}
          </CardContent>
        </Card>

        {/* Budget List */}
        {budgetStatus.length > 0 ? (
          <div className="grid gap-4">
            {budgetStatus
              .sort((a, b) => b.percentage - a.percentage)
              .map((budget) => (
                <Card key={budget.id} className="border-0 shadow-sm overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl">
                          {CATEGORY_ICONS[budget.category]}
                        </div>
                        <div>
                          <h3 className="font-medium text-slate-900 text-lg">{budget.category}</h3>
                          <p className="text-slate-500">
                            ${budget.spent.toFixed(2)} of ${budget.limit.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDialog(budget)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(budget)}
                          className="text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <Progress 
                      value={Math.min(100, budget.percentage)} 
                      className={`h-3 ${
                        budget.percentage > 100 ? '[&>div]:bg-red-500' : 
                        budget.percentage >= 80 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'
                      }`}
                    />
                    <div className="flex items-center justify-between mt-3">
                      <span className={`text-sm font-medium ${
                        budget.percentage > 100 ? 'text-red-500' : 
                        budget.percentage >= 80 ? 'text-amber-500' : 'text-slate-500'
                      }`}>
                        {budget.percentage.toFixed(0)}% used
                      </span>
                      <span className={`text-sm ${
                        budget.remaining < 0 ? 'text-red-500' : 'text-emerald-500'
                      }`}>
                        {budget.remaining < 0 
                          ? `$${Math.abs(budget.remaining).toFixed(2)} over budget`
                          : `$${budget.remaining.toFixed(2)} remaining`
                        }
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        ) : (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center text-3xl">
                💰
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No budgets set</h3>
              <p className="text-slate-500 mb-4">
                Set monthly spending limits to stay on track with your financial goals
              </p>
              <Button 
                onClick={() => openDialog()}
                className="bg-slate-900 hover:bg-slate-800 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Budget
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingBudget ? 'Edit Budget' : 'Add Budget'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {!editingBudget && (
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCategories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
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
                <Label>Monthly Limit</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.limit}
                    onChange={(e) => setFormData({ ...formData, limit: e.target.value })}
                    className="pl-7"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={saving || !formData.limit || (!editingBudget && !formData.category)}
                className="bg-slate-900 hover:bg-slate-800 text-white"
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
