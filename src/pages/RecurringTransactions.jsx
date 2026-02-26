import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Repeat, Trash2, Edit2, Play, Pause, Calendar, Download } from 'lucide-react';
import { format, addDays, addWeeks, addMonths, addYears, parseISO, isAfter, isBefore } from 'date-fns';
import { toast } from 'sonner';
import { getRecurringTransactions, createRecurringTransaction, updateRecurringTransaction, deleteRecurringTransaction, getExpenses, createExpense, getProfile } from '@/lib/localDatabase';

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
  { value: 'Other', icon: '📦' },
  { value: 'Salary', icon: '💼' },
  { value: 'Freelance', icon: '💻' },
  { value: 'Investment', icon: '📈' }
];

const FREQUENCY_LABELS = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly'
};

export default function RecurringTransactions() {
  const [recurring, setRecurring] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [currency, setCurrency] = useState('GBP');
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    type: 'expense',
    category: '',
    frequency: 'monthly',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: '',
    notes: '',
    isActive: true
  });

  useEffect(() => {
    loadData();
    loadCurrency();
  }, []);

  const loadCurrency = () => {
    try {
      const profile = getProfile();
      if (profile && profile.currency) {
        setCurrency(profile.currency);
      }
    } catch (error) {
      console.error('Error loading currency:', error);
    }
  };

  const loadData = () => {
    try {
      const data = getRecurringTransactions();
      setRecurring(data.sort((a, b) => new Date(b.startDate) - new Date(a.startDate)));
    } catch (error) {
      console.error('Error loading recurring transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Title', 'Amount', 'Type', 'Category', 'Frequency', 'Start Date', 'End Date', 'Active', 'Notes'];
    const rows = recurring.map(r => [
      r.title,
      r.amount,
      r.type,
      r.category,
      r.frequency,
      r.startDate,
      r.endDate || '',
      r.isActive ? 'Yes' : 'No',
      r.notes || ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recurring-transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    toast.success('Exported to CSV');
  };

  const generateTransactions = (recurringItem) => {
    const today = new Date();
    const startDate = parseISO(recurringItem.startDate);
    const endDate = recurringItem.endDate ? parseISO(recurringItem.endDate) : null;
    const lastGenerated = recurringItem.lastGenerated ? parseISO(recurringItem.lastGenerated) : null;

    let currentDate = lastGenerated || startDate;
    const transactionsToCreate = [];

    while (isBefore(currentDate, today) || currentDate.toDateString() === today.toDateString()) {
      if (endDate && isAfter(currentDate, endDate)) break;

      if (!lastGenerated || isAfter(currentDate, lastGenerated)) {
        transactionsToCreate.push({
          title: recurringItem.title,
          amount: recurringItem.amount,
          type: recurringItem.type,
          category: recurringItem.category,
          date: format(currentDate, 'yyyy-MM-dd'),
          currency: recurringItem.currency,
          notes: `Auto-generated from recurring: ${recurringItem.title}`
        });
      }

      switch (recurringItem.frequency) {
        case 'daily':
          currentDate = addDays(currentDate, 1);
          break;
        case 'weekly':
          currentDate = addWeeks(currentDate, 1);
          break;
        case 'monthly':
          currentDate = addMonths(currentDate, 1);
          break;
        case 'yearly':
          currentDate = addYears(currentDate, 1);
          break;
      }
    }

    if (transactionsToCreate.length > 0) {
      transactionsToCreate.forEach(t => createExpense(t));
      updateRecurringTransaction(recurringItem.id, {
        lastGenerated: format(today, 'yyyy-MM-dd')
      });
      toast.success(`Generated ${transactionsToCreate.length} transaction(s)`);
      loadData();
    } else {
      toast.info('No new transactions to generate');
    }
  };

  const openDialog = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        title: item.title,
        amount: item.amount.toString(),
        type: item.type,
        category: item.category,
        frequency: item.frequency,
        startDate: item.startDate,
        endDate: item.endDate || '',
        notes: item.notes || '',
        isActive: item.isActive
      });
    } else {
      setEditingItem(null);
      setFormData({
        title: '',
        amount: '',
        type: 'expense',
        category: '',
        frequency: 'monthly',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: '',
        notes: '',
        isActive: true
      });
    }
    setDialogOpen(true);
  };

  const handleSave = () => {
    try {
      const data = {
        ...formData,
        amount: parseFloat(formData.amount),
        currency
      };

      if (editingItem) {
        updateRecurringTransaction(editingItem.id, data);
        toast.success('Recurring transaction updated');
      } else {
        createRecurringTransaction(data);
        toast.success('Recurring transaction created');
      }

      setDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Failed to save');
    }
  };

  const handleDelete = (id) => {
    deleteRecurringTransaction(id);
    setRecurring(recurring.filter(r => r.id !== id));
    toast.success('Recurring transaction deleted');
  };

  const toggleActive = (item) => {
    updateRecurringTransaction(item.id, {
      isActive: !item.isActive
    });
    setRecurring(recurring.map(r => r.id === item.id ? { ...r, isActive: !r.isActive } : r));
    toast.success(item.isActive ? 'Paused' : 'Activated');
  };

  const getCurrencySymbol = (curr) => {
    return curr === 'GBP' ? '£' : curr === 'USD' ? '$' : '€';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-4xl font-light text-white tracking-tight">
              Recurring Transactions
            </h1>
            <p className="text-slate-400 mt-2">
              Automate your regular income and expenses
            </p>
          </div>
          <div className="flex gap-2 mt-4 sm:mt-0">
            {recurring.length > 0 && (
              <Button 
                variant="outline"
                onClick={exportToCSV}
                className="glass-card border-white/10 text-slate-300 hover:text-white rounded-xl"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            )}
            <Button 
              onClick={() => openDialog()}
              variant="outline"
              className="glass-card border-white/10 text-slate-300 hover:text-white hover:border-teal-500/30 rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Recurring
            </Button>
          </div>
        </div>

        {recurring.length > 0 ? (
          <div className="grid gap-4">
            {recurring.map((item) => (
              <div key={item.id} className="glass-card rounded-2xl border border-white/10 hover:border-teal-500/30 transition-all duration-300 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`h-14 w-14 rounded-2xl flex items-center justify-center text-2xl border ${
                      item.isActive 
                        ? 'bg-gradient-to-br from-teal-500/20 to-emerald-500/20 border-teal-500/20'
                        : 'bg-white/5 border-white/10'
                    }`}>
                      {CATEGORIES.find(c => c.value === item.category)?.icon || '📦'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-medium text-white">{item.title}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          item.type === 'income' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                        }`}>
                          {item.type === 'income' ? 'Income' : 'Expense'}
                        </span>
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          <Repeat className="w-3 h-3 inline mr-1" />
                          {FREQUENCY_LABELS[item.frequency]}
                        </span>
                        {!item.isActive && (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 text-slate-400 border border-white/10">
                            Paused
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-sm mb-2">{item.category}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>Started: {format(parseISO(item.startDate), 'MMM d, yyyy')}</span>
                        {item.endDate && (
                          <span>Ends: {format(parseISO(item.endDate), 'MMM d, yyyy')}</span>
                        )}
                        {item.lastGenerated && (
                          <span>Last: {format(parseISO(item.lastGenerated), 'MMM d, yyyy')}</span>
                        )}
                      </div>
                      {item.notes && (
                        <p className="text-xs text-slate-500 mt-2">{item.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <span className={`text-2xl font-light ${item.type === 'income' ? 'text-emerald-400' : 'text-white'}`}>
                      {item.type === 'income' ? '+' : ''}{getCurrencySymbol(item.currency)}{item.amount.toFixed(2)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => generateTransactions(item)}
                      className="text-slate-400 hover:text-teal-400 hover:bg-teal-500/10"
                      title="Generate transactions now"
                    >
                      <Calendar className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleActive(item)}
                      className="text-slate-400 hover:text-amber-400 hover:bg-amber-500/10"
                    >
                      {item.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDialog(item)}
                      className="text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(item.id)}
                      className="text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card rounded-2xl border border-white/10 p-12 text-center">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-purple-500/20 mx-auto mb-6">
              <Repeat className="h-8 w-8 text-purple-400" />
            </div>
            <h2 className="text-2xl font-light text-white mb-3">No Recurring Transactions</h2>
            <p className="text-slate-400 mb-6">
              Set up automatic recurring income or expenses like rent, subscriptions, or salary
            </p>
            <Button 
              onClick={() => openDialog()}
              variant="outline"
              className="glass-card border-white/10 text-slate-300 hover:text-white hover:border-teal-500/30 rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Recurring Transaction
            </Button>
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="glass-strong border-white/10 text-white sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-white">
                {editingItem ? 'Edit Recurring Transaction' : 'Add Recurring Transaction'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Title</Label>
                <Input
                  placeholder="e.g., Netflix Subscription"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="glass-card border-white/10 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="glass-card border-white/10 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger className="glass-card border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="glass-strong border-white/10">
                      <SelectItem value="expense" className="text-white">Expense</SelectItem>
                      <SelectItem value="income" className="text-white">Income</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger className="glass-card border-white/10 text-white">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="glass-strong border-white/10">
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value} className="text-white">
                          {cat.icon} {cat.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Frequency</Label>
                  <Select
                    value={formData.frequency}
                    onValueChange={(value) => setFormData({ ...formData, frequency: value })}
                  >
                    <SelectTrigger className="glass-card border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="glass-strong border-white/10">
                      <SelectItem value="daily" className="text-white">Daily</SelectItem>
                      <SelectItem value="weekly" className="text-white">Weekly</SelectItem>
                      <SelectItem value="monthly" className="text-white">Monthly</SelectItem>
                      <SelectItem value="yearly" className="text-white">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Start Date</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="glass-card border-white/10 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">End Date (Optional)</Label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="glass-card border-white/10 text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Notes (Optional)</Label>
                <Textarea
                  placeholder="Additional details..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="glass-card border-white/10 text-white resize-none"
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-between glass-card p-4 rounded-xl border border-white/5">
                <Label className="text-slate-300">Active</Label>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="glass-card border-white/10 text-white">
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={!formData.title || !formData.amount || !formData.category}
                variant="outline"
                className="glass-card border-white/10 text-slate-200 hover:text-white hover:border-teal-500/30"
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
