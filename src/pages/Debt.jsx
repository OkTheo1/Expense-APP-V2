import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Calculator, Edit2, Trash2, TrendingDown, DollarSign, Calendar, Percent } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import { getDebts, createDebt, updateDebt, deleteDebt, getProfile } from '@/lib/localDatabase';

export default function Debt() {
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState(null);
  const [currency, setCurrency] = useState('GBP');
  const [extraPayment, setExtraPayment] = useState('');
const [formData, setFormData] = useState({
    name: '',
    amount: '',
    interestRate: '',
    promotionalRate: '',
    promotionalMonths: '',
    minimumPayment: '',
    notes: ''
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
      let data = getDebts();
      // Handle legacy data that might have 'balance' instead of 'amount'
      data = data.map(d => ({
        ...d,
        amount: d.amount || d.balance || 0,
        balance: undefined // Remove legacy field
      }));
      setDebts(data);
    } catch (error) {
      console.error('Error loading debts:', error);
    } finally {
      setLoading(false);
    }
  };

const openDialog = (debt = null) => {
    if (debt) {
      setEditingDebt(debt);
      setFormData({
        name: debt.name,
        amount: debt.amount.toString(),
        interestRate: debt.interestRate?.toString() || '',
        promotionalRate: debt.promotionalRate?.toString() || '',
        promotionalMonths: debt.promotionalMonths?.toString() || '',
        minimumPayment: debt.minimumPayment?.toString() || '',
        notes: debt.notes || ''
      });
    } else {
      setEditingDebt(null);
      setFormData({
        name: '',
        amount: '',
        interestRate: '',
        promotionalRate: '',
        promotionalMonths: '',
        minimumPayment: '',
        notes: ''
      });
    }
    setDialogOpen(true);
  };

const handleSave = () => {
    try {
      const data = {
        name: formData.name,
        amount: parseFloat(formData.amount),
        interestRate: parseFloat(formData.interestRate) || 0,
        promotionalRate: formData.promotionalRate ? parseFloat(formData.promotionalRate) : null,
        promotionalMonths: formData.promotionalMonths ? parseInt(formData.promotionalMonths) : null,
        minimumPayment: parseFloat(formData.minimumPayment) || 0,
        notes: formData.notes,
        currency
      };

      if (editingDebt) {
        updateDebt(editingDebt.id, data);
        toast.success('Debt updated');
      } else {
        createDebt(data);
        toast.success('Debt added');
      }

      setDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Failed to save');
    }
  };

  const handleDelete = (id) => {
    deleteDebt(id);
    setDebts(debts.filter(d => d.id !== id));
    toast.success('Debt deleted');
  };

  const calculateSnowball = (debts, extra = 0) => {
    const sortedDebts = [...debts].sort((a, b) => a.amount - b.amount);
    return calculatePayoff(sortedDebts, extra);
  };

  const calculateAvalanche = (debts, extra = 0) => {
    const sortedDebts = [...debts].sort((a, b) => b.interestRate - a.interestRate);
    return calculatePayoff(sortedDebts, extra);
  };

const calculatePayoff = (sortedDebts, extraPayment) => {
    let debtsCopy = sortedDebts.map(d => ({ ...d, remaining: d.amount }));
    let month = 0;
    let totalInterest = 0;
    const timeline = [];

    while (debtsCopy.some(d => d.remaining > 0)) {
      month++;
      let availableExtra = extraPayment;

      debtsCopy.forEach((debt, index) => {
        if (debt.remaining > 0) {
          // Check if promotional period is still active
          let currentRate = debt.interestRate;
          if (debt.promotionalMonths && month <= debt.promotionalMonths && debt.promotionalRate !== null) {
            currentRate = debt.promotionalRate;
          }
          
          const monthlyRate = currentRate / 100 / 12;
          const interest = debt.remaining * monthlyRate;
          totalInterest += interest;

          let payment = debt.minimumPayment;
          
          // Apply extra payment to first non-zero debt
          if (index === debtsCopy.findIndex(d => d.remaining > 0)) {
            payment += availableExtra;
            availableExtra = 0;
          }

          const principal = payment - interest;
          debt.remaining = Math.max(0, debt.remaining - principal);

          // If debt is paid off, add its minimum payment to extra for next debt
          if (debt.remaining === 0) {
            availableExtra += debt.minimumPayment;
          }
        }
      });

      const totalRemaining = debtsCopy.reduce((sum, d) => sum + d.remaining, 0);
      timeline.push({
        month,
        remaining: totalRemaining,
        interest: totalInterest
      });

      if (month > 600) break; // Safety limit
    }

    return { months: month, totalInterest, timeline };
  };

  const getCurrencySymbol = (curr) => {
    return curr === 'GBP' ? '£' : curr === 'USD' ? '$' : '€';
  };

  const totalDebt = debts.reduce((sum, d) => sum + d.amount, 0);
  const totalMinPayment = debts.reduce((sum, d) => sum + d.minimumPayment, 0);
  const extra = parseFloat(extraPayment) || 0;

  const snowball = debts.length > 0 ? calculateSnowball(debts, extra) : null;
  const avalanche = debts.length > 0 ? calculateAvalanche(debts, extra) : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-4xl font-light text-white tracking-tight">
              Debt Calculator
            </h1>
            <p className="text-slate-400 mt-2">
              Compare debt payoff strategies
            </p>
          </div>
          <Button 
            onClick={() => openDialog()}
          variant="outline"
          className="mt-4 sm:mt-0 glass-card border-white/10 text-slate-300 hover:text-white hover:border-teal-500/30 rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Debt
          </Button>
        </div>

        {debts.length > 0 ? (
          <>
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4 mb-8">
              <div className="glass-card rounded-2xl border border-white/10 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center border border-red-500/20">
                    <DollarSign className="h-5 w-5 text-red-400" />
                  </div>
                  <span className="text-sm text-slate-400">Total Debt</span>
                </div>
                <p className="text-3xl font-light text-white">
                  {getCurrencySymbol(currency)}{totalDebt.toFixed(2)}
                </p>
              </div>

              <div className="glass-card rounded-2xl border border-white/10 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center border border-blue-500/20">
                    <Calculator className="h-5 w-5 text-blue-400" />
                  </div>
                  <span className="text-sm text-slate-400">Min Payment</span>
                </div>
                <p className="text-3xl font-light text-white">
                  {getCurrencySymbol(currency)}{totalMinPayment.toFixed(2)}
                </p>
              </div>

              <div className="glass-card rounded-2xl border border-white/10 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-purple-500/20">
                    <TrendingDown className="h-5 w-5 text-purple-400" />
                  </div>
                  <span className="text-sm text-slate-400">Avg Interest</span>
                </div>
                <p className="text-3xl font-light text-white">
                  {(debts.reduce((sum, d) => sum + d.interestRate, 0) / debts.length).toFixed(1)}%
                </p>
              </div>

              <div className="glass-card rounded-2xl border border-white/10 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center border border-emerald-500/20">
                    <Calendar className="h-5 w-5 text-emerald-400" />
                  </div>
                  <span className="text-sm text-slate-400">Debts</span>
                </div>
                <p className="text-3xl font-light text-white">
                  {debts.length}
                </p>
              </div>
            </div>

            {/* Extra Payment Input */}
            <div className="glass-card rounded-2xl border border-white/10 p-6 mb-8">
              <Label className="text-slate-300 mb-2 block">Extra Monthly Payment (Optional)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={extraPayment}
                onChange={(e) => setExtraPayment(e.target.value)}
                className="glass-card border-white/10 text-white max-w-xs"
              />
              <p className="text-xs text-slate-400 mt-2">
                Add extra monthly payment to accelerate debt payoff
              </p>
            </div>

            {/* Comparison */}
            <Tabs defaultValue="comparison" className="mb-8">
              <TabsList className="glass-card border-white/10">
                <TabsTrigger value="comparison" className="data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-400">
                  Comparison
                </TabsTrigger>
                <TabsTrigger value="debts" className="data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-400">
                  Debts List
                </TabsTrigger>
              </TabsList>

              <TabsContent value="comparison" className="space-y-6">
                {snowball && avalanche && (
                  <>
                    {/* Side-by-side comparison */}
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Snowball Method */}
                      <div className="glass-card rounded-2xl border border-blue-500/30 p-6">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center border border-blue-500/20">
                            ❄️
                          </div>
                          <div>
                            <h3 className="text-xl font-medium text-white">Snowball Method</h3>
                            <p className="text-xs text-slate-400">Smallest balance first</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="glass-card p-4 rounded-xl border border-white/5">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm text-slate-400">Payoff Time</span>
                              <span className="text-2xl font-light text-blue-400">
                                {snowball.months} months
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">
                              {Math.floor(snowball.months / 12)} years, {snowball.months % 12} months
                            </p>
                          </div>

                          <div className="glass-card p-4 rounded-xl border border-white/5">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-slate-400">Total Interest</span>
                              <span className="text-xl font-light text-white">
                                {getCurrencySymbol(currency)}{snowball.totalInterest.toFixed(2)}
                              </span>
                            </div>
                          </div>

                          <div className="glass-card p-4 rounded-xl border border-white/5">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-slate-400">Total Paid</span>
                              <span className="text-xl font-light text-white">
                                {getCurrencySymbol(currency)}{(totalDebt + snowball.totalInterest).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Avalanche Method */}
                      <div className="glass-card rounded-2xl border border-purple-500/30 p-6">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-purple-500/20">
                            ⛰️
                          </div>
                          <div>
                            <h3 className="text-xl font-medium text-white">Avalanche Method</h3>
                            <p className="text-xs text-slate-400">Highest interest first</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="glass-card p-4 rounded-xl border border-white/5">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm text-slate-400">Payoff Time</span>
                              <span className="text-2xl font-light text-purple-400">
                                {avalanche.months} months
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">
                              {Math.floor(avalanche.months / 12)} years, {avalanche.months % 12} months
                            </p>
                          </div>

                          <div className="glass-card p-4 rounded-xl border border-white/5">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-slate-400">Total Interest</span>
                              <span className="text-xl font-light text-white">
                                {getCurrencySymbol(currency)}{avalanche.totalInterest.toFixed(2)}
                              </span>
                            </div>
                          </div>

                          <div className="glass-card p-4 rounded-xl border border-white/5">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-slate-400">Total Paid</span>
                              <span className="text-xl font-light text-white">
                                {getCurrencySymbol(currency)}{(totalDebt + avalanche.totalInterest).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Savings Comparison */}
                    {snowball.months !== avalanche.months && (
                      <div className="glass-card rounded-2xl border border-emerald-500/30 p-6 shadow-lg shadow-emerald-500/10">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center border border-emerald-500/20">
                            💰
                          </div>
                          <h3 className="text-lg font-medium text-white">Best Strategy</h3>
                        </div>
                        
                        {avalanche.totalInterest < snowball.totalInterest ? (
                          <div className="space-y-2">
                            <p className="text-slate-300">
                              <span className="text-emerald-400 font-medium">Avalanche method</span> saves you{' '}
                              <span className="text-emerald-400 font-medium">
                                {getCurrencySymbol(currency)}{(snowball.totalInterest - avalanche.totalInterest).toFixed(2)}
                              </span>{' '}
                              in interest and gets you debt-free{' '}
                              <span className="text-emerald-400 font-medium">
                                {snowball.months - avalanche.months} months faster
                              </span>
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-slate-300">
                              Both methods result in similar costs. Choose{' '}
                              <span className="text-blue-400 font-medium">Snowball</span> for psychological wins (paying off smaller debts first) or{' '}
                              <span className="text-purple-400 font-medium">Avalanche</span> for mathematical optimization.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Chart */}
                    <div className="glass-card rounded-2xl border border-white/10 p-6">
                      <h3 className="text-lg font-medium text-white mb-6">Payoff Timeline</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                          <XAxis 
                            dataKey="month" 
                            stroke="#94a3b8"
                            label={{ value: 'Months', position: 'insideBottom', offset: -5, fill: '#94a3b8' }}
                          />
                          <YAxis 
                            stroke="#94a3b8"
                            label={{ value: 'Remaining Debt', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'rgba(30, 41, 59, 0.95)', 
                              border: '1px solid rgba(148, 163, 184, 0.1)',
                              borderRadius: '12px',
                              color: '#fff'
                            }}
                          />
                          <Legend />
                          <Line 
                            data={snowball.timeline} 
                            dataKey="remaining" 
                            stroke="#3b82f6" 
                            name="Snowball"
                            strokeWidth={2}
                          />
                          <Line 
                            data={avalanche.timeline} 
                            dataKey="remaining" 
                            stroke="#a855f7" 
                            name="Avalanche"
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="debts" className="space-y-4">
                {debts.map((debt) => (
                  <div key={debt.id} className="glass-card rounded-2xl border border-white/10 hover:border-red-500/30 transition-all duration-300 p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-xl font-medium text-white mb-2">{debt.name}</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Amount</p>
                            <p className="text-lg font-medium text-red-400">
                              {getCurrencySymbol(debt.currency)}{debt.amount.toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Interest Rate</p>
                            <p className="text-lg font-medium text-white">
                              {debt.interestRate}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Min Payment</p>
                            <p className="text-lg font-medium text-white">
                              {getCurrencySymbol(debt.currency)}{debt.minimumPayment.toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Monthly Interest</p>
                            <p className="text-lg font-medium text-orange-400">
                              {getCurrencySymbol(debt.currency)}{(debt.amount * (debt.interestRate / 100 / 12)).toFixed(2)}
                            </p>
                          </div>
                        </div>
                        {debt.notes && (
                          <p className="text-sm text-slate-400 mt-3 p-3 glass-card rounded-xl border border-white/5">
                            {debt.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDialog(debt)}
                          className="text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(debt.id)}
                          className="text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="glass-card rounded-2xl border border-white/10 p-12 text-center">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center border border-red-500/20 mx-auto mb-6">
              <Calculator className="h-8 w-8 text-red-400" />
            </div>
            <h2 className="text-2xl font-light text-white mb-3">No Debts Added</h2>
            <p className="text-slate-400 mb-6">
              Add your debts to compare Snowball vs Avalanche payoff strategies
            </p>
            <Button 
              onClick={() => openDialog()}
              variant="outline"
              className="glass-card border-white/10 text-slate-300 hover:text-white hover:border-teal-500/30 rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add First Debt
            </Button>
          </div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="glass-strong border-white/10 text-white sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-white">
                {editingDebt ? 'Edit Debt' : 'Add Debt'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Debt Name</Label>
                <Input
                  placeholder="e.g., Credit Card"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                  <Label className="text-slate-300">Interest Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 18.9"
                    value={formData.interestRate}
                    onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                    className="glass-card border-white/10 text-white"
                  />
                </div>
              </div>

              {/* Promotional Rate Section */}
              <div className="glass-card rounded-xl border border-teal-500/20 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Label className="text-teal-400 text-sm font-medium">Promotional Offer (Optional)</Label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-400 text-xs">Promotional Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 0"
                      value={formData.promotionalRate}
                      onChange={(e) => setFormData({ ...formData, promotionalRate: e.target.value })}
                      className="glass-card border-white/10 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-400 text-xs">Months at Promo Rate</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 24"
                      value={formData.promotionalMonths}
                      onChange={(e) => setFormData({ ...formData, promotionalMonths: e.target.value })}
                      className="glass-card border-white/10 text-white"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  For 0% APR credit cards, enter 0 for rate and months remaining
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Minimum Monthly Payment</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.minimumPayment}
                  onChange={(e) => setFormData({ ...formData, minimumPayment: e.target.value })}
                  className="glass-card border-white/10 text-white"
                />
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="glass-card border-white/10 text-white">
                Cancel
              </Button>
<Button 
                onClick={handleSave}
                disabled={!formData.name || !formData.amount || !formData.minimumPayment}
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
