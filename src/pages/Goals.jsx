import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Plus, Target, Edit2, Trash2, TrendingUp, Calendar, DollarSign, CheckCircle2, AlertCircle } from 'lucide-react';
import { format, parseISO, differenceInDays, isPast } from 'date-fns';
import { toast } from 'sonner';
import { getGoals, createGoal, updateGoal, deleteGoal, getExpenses, createExpense, getProfile } from '@/lib/localDatabase';

const COLORS = [
  { value: '#14b8a6', label: 'Teal' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#10b981', label: 'Emerald' },
  { value: '#ef4444', label: 'Red' }
];

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [contributeDialog, setContributeDialog] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [currency, setCurrency] = useState('GBP');
  const [formData, setFormData] = useState({
    name: '',
    targetAmount: '',
    currentAmount: '0',
    targetDate: '',
    color: '#14b8a6',
    notes: ''
  });
  const [contributeAmount, setContributeAmount] = useState('');

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
      const goalsData = getGoals();
      const expensesData = getExpenses();
      setGoals(goalsData.sort((a, b) => new Date(a.targetDate) - new Date(b.targetDate)));
      setExpenses(expensesData);

      // Check for completed goals
      goalsData.forEach(goal => {
        if (!goal.isCompleted && goal.currentAmount >= goal.targetAmount) {
          toast.success(`🎉 Goal "${goal.name}" completed!`, {
            duration: 5000
          });
          updateGoal(goal.id, { isCompleted: true });
        }
      });
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (goal = null) => {
    if (goal) {
      setEditingGoal(goal);
      setFormData({
        name: goal.name,
        targetAmount: goal.targetAmount.toString(),
        currentAmount: goal.currentAmount.toString(),
        targetDate: goal.targetDate,
        color: goal.color,
        notes: goal.notes || ''
      });
    } else {
      setEditingGoal(null);
      setFormData({
        name: '',
        targetAmount: '',
        currentAmount: '0',
        targetDate: '',
        color: '#14b8a6',
        notes: ''
      });
    }
    setDialogOpen(true);
  };

  const openContributeDialog = (goal) => {
    setSelectedGoal(goal);
    setContributeAmount('');
    setContributeDialog(true);
  };

  const handleSave = () => {
    try {
      const data = {
        ...formData,
        targetAmount: parseFloat(formData.targetAmount),
        currentAmount: parseFloat(formData.currentAmount),
        currency,
        isCompleted: parseFloat(formData.currentAmount) >= parseFloat(formData.targetAmount)
      };

      if (editingGoal) {
        updateGoal(editingGoal.id, data);
        toast.success('Goal updated');
      } else {
        createGoal(data);
        toast.success('Goal created');
      }

      setDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Failed to save');
    }
  };

  const handleContribute = () => {
    try {
      const amount = parseFloat(contributeAmount);
      const newCurrent = selectedGoal.currentAmount + amount;

      updateGoal(selectedGoal.id, {
        currentAmount: newCurrent,
        isCompleted: newCurrent >= selectedGoal.targetAmount
      });

      // Create expense transaction linked to goal
      createExpense({
        title: `Contribution to ${selectedGoal.name}`,
        amount,
        type: 'expense',
        category: 'Savings',
        date: format(new Date(), 'yyyy-MM-dd'),
        currency,
        notes: `Goal contribution: ${selectedGoal.name}`
      });

      toast.success('Contribution added');
      setContributeDialog(false);
      loadData();
    } catch (error) {
      console.error('Error adding contribution:', error);
      toast.error('Failed to add contribution');
    }
  };

  const handleDelete = (id) => {
    deleteGoal(id);
    setGoals(goals.filter(g => g.id !== id));
    toast.success('Goal deleted');
  };

  const getCurrencySymbol = (curr) => {
    return curr === 'GBP' ? '£' : curr === 'USD' ? '$' : '€';
  };

  const getProgressPercentage = (goal) => {
    return Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
  };

  const getDaysRemaining = (targetDate) => {
    const days = differenceInDays(parseISO(targetDate), new Date());
    return days;
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
              Savings Goals
            </h1>
            <p className="text-slate-400 mt-2">
              Track and achieve your financial objectives
            </p>
          </div>
          <Button 
            onClick={() => openDialog()}
          variant="outline"
          className="mt-4 sm:mt-0 glass-card border-white/10 text-slate-300 hover:text-white hover:border-teal-500/30 rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Goal
          </Button>
        </div>

        {goals.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2">
            {goals.map((goal) => {
              const progress = getProgressPercentage(goal);
              const daysRemaining = getDaysRemaining(goal.targetDate);
              const isOverdue = daysRemaining < 0;
              const isNearTarget = progress >= 90 && !goal.isCompleted;

              return (
                <div 
                  key={goal.id} 
                  className={`glass-card rounded-2xl border transition-all duration-300 p-6 ${
                    goal.isCompleted 
                      ? 'border-emerald-500/30 shadow-lg shadow-emerald-500/10'
                      : isNearTarget
                      ? 'border-amber-500/30 shadow-lg shadow-amber-500/10'
                      : 'border-white/10 hover:border-teal-500/30'
                  }`}
                  style={{ borderColor: goal.isCompleted ? undefined : `${goal.color}20` }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div 
                        className="h-14 w-14 rounded-2xl flex items-center justify-center border"
                        style={{ 
                          backgroundColor: `${goal.color}20`,
                          borderColor: `${goal.color}40`
                        }}
                      >
                        {goal.isCompleted ? (
                          <CheckCircle2 className="h-7 w-7" style={{ color: goal.color }} />
                        ) : (
                          <Target className="h-7 w-7" style={{ color: goal.color }} />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-medium text-white mb-1">{goal.name}</h3>
                        <div className="flex items-center gap-3 text-sm text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(parseISO(goal.targetDate), 'MMM d, yyyy')}
                          </span>
                          {!goal.isCompleted && (
                            <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-400' : ''}`}>
                              {isOverdue ? (
                                <>
                                  <AlertCircle className="w-3 h-3" />
                                  {Math.abs(daysRemaining)} days overdue
                                </>
                              ) : (
                                <>
                                  <TrendingUp className="w-3 h-3" />
                                  {daysRemaining} days left
                                </>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Progress Circle */}
                  <div className="flex items-center justify-center mb-6">
                    <div className="relative w-40 h-40">
                      <svg className="transform -rotate-90 w-40 h-40">
                        <circle
                          cx="80"
                          cy="80"
                          r="70"
                          stroke="rgba(255,255,255,0.1)"
                          strokeWidth="8"
                          fill="none"
                        />
                        <circle
                          cx="80"
                          cy="80"
                          r="70"
                          stroke={goal.color}
                          strokeWidth="8"
                          fill="none"
                          strokeDasharray={`${2 * Math.PI * 70}`}
                          strokeDashoffset={`${2 * Math.PI * 70 * (1 - progress / 100)}`}
                          strokeLinecap="round"
                          className="transition-all duration-500"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-light text-white">
                          {progress.toFixed(0)}%
                        </span>
                        <span className="text-xs text-slate-400">complete</span>
                      </div>
                    </div>
                  </div>

                  {/* Amounts */}
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Current</span>
                      <span className="text-lg font-medium text-white">
                        {getCurrencySymbol(goal.currency)}{goal.currentAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Target</span>
                      <span className="text-lg font-medium" style={{ color: goal.color }}>
                        {getCurrencySymbol(goal.currency)}{goal.targetAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-white/5">
                      <span className="text-sm text-slate-400">Remaining</span>
                      <span className="text-lg font-medium text-slate-300">
                        {getCurrencySymbol(goal.currency)}{Math.max(0, goal.targetAmount - goal.currentAmount).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {goal.notes && (
                    <p className="text-sm text-slate-400 mb-4 p-3 glass-card rounded-xl border border-white/5">
                      {goal.notes}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {!goal.isCompleted && (
                      <Button
                        onClick={() => openContributeDialog(goal)}
                        className="flex-1 rounded-xl"
                        style={{ 
                          backgroundColor: `${goal.color}30`,
                          color: goal.color,
                          border: `1px solid ${goal.color}40`
                        }}
                      >
                        <DollarSign className="w-4 h-4 mr-2" />
                        Contribute
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDialog(goal)}
                      className="text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-xl"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(goal.id)}
                      className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {isNearTarget && !goal.isCompleted && (
                    <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm text-center">
                      🎯 Almost there! Just {getCurrencySymbol(goal.currency)}{(goal.targetAmount - goal.currentAmount).toFixed(2)} to go!
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="glass-card rounded-2xl border border-white/10 p-12 text-center">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 flex items-center justify-center border border-teal-500/20 mx-auto mb-6">
              <Target className="h-8 w-8 text-teal-400" />
            </div>
            <h2 className="text-2xl font-light text-white mb-3">No Goals Yet</h2>
            <p className="text-slate-400 mb-6">
              Start setting savings goals and track your progress
            </p>
            <Button 
              onClick={() => openDialog()}
              variant="outline"
              className="glass-card border-white/10 text-slate-300 hover:text-white hover:border-teal-500/30 rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Goal
            </Button>
          </div>
        )}

        {/* Add/Edit Goal Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="glass-strong border-white/10 text-white sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-white">
                {editingGoal ? 'Edit Goal' : 'Add New Goal'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Goal Name</Label>
                <Input
                  placeholder="e.g., Emergency Fund"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="glass-card border-white/10 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Target Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.targetAmount}
                    onChange={(e) => setFormData({ ...formData, targetAmount: e.target.value })}
                    className="glass-card border-white/10 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Current Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.currentAmount}
                    onChange={(e) => setFormData({ ...formData, currentAmount: e.target.value })}
                    className="glass-card border-white/10 text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Target Date</Label>
                <Input
                  type="date"
                  value={formData.targetDate}
                  onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                  className="glass-card border-white/10 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Color</Label>
                <div className="flex gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      className={`w-10 h-10 rounded-xl transition-all ${
                        formData.color === color.value 
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' 
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.label}
                    />
                  ))}
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="glass-card border-white/10 text-white">
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={!formData.name || !formData.targetAmount || !formData.targetDate}
                variant="outline"
                className="glass-card border-white/10 text-slate-200 hover:text-white hover:border-teal-500/30"
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Contribute Dialog */}
        <Dialog open={contributeDialog} onOpenChange={setContributeDialog}>
          <DialogContent className="glass-strong border-white/10 text-white sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white">
                Add Contribution
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="glass-card p-4 rounded-xl border border-white/5">
                <p className="text-sm text-slate-400 mb-1">Contributing to</p>
                <p className="text-lg font-medium text-white">{selectedGoal?.name}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={contributeAmount}
                  onChange={(e) => setContributeAmount(e.target.value)}
                  className="glass-card border-white/10 text-white text-2xl"
                  autoFocus
                />
              </div>
              {selectedGoal && contributeAmount && (
                <div className="glass-card p-4 rounded-xl border border-white/5 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">New Total</span>
                    <span className="text-white font-medium">
                      {getCurrencySymbol(selectedGoal.currency)}
                      {(selectedGoal.currentAmount + parseFloat(contributeAmount)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Progress</span>
                    <span className="text-teal-400 font-medium">
                      {Math.min(((selectedGoal.currentAmount + parseFloat(contributeAmount)) / selectedGoal.targetAmount) * 100, 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setContributeDialog(false)} className="glass-card border-white/10 text-white">
                Cancel
              </Button>
              <Button 
                onClick={handleContribute}
                disabled={!contributeAmount || parseFloat(contributeAmount) <= 0}
                variant="outline"
                className="glass-card border-white/10 text-slate-200 hover:text-white hover:border-teal-500/30"
              >
                Add Contribution
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
