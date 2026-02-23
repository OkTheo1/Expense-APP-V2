import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { createExpense } from '@/lib/localDatabase';

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

export default function AddExpense() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    
    createExpense({
      ...formData,
      amount: parseFloat(formData.amount),
      type: 'expense'
    });
    
    navigate(createPageUrl('Dashboard'));
  };

  const quickAmounts = [10, 25, 50, 100, 250];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link 
          to={createPageUrl('Dashboard')} 
          className="inline-flex items-center text-slate-500 hover:text-slate-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Link>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-light text-slate-900">Add Expense</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-slate-700">Description</Label>
                <Input
                  id="title"
                  placeholder="What did you spend on?"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="h-12 border-slate-200 focus:border-slate-400 focus:ring-slate-400"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount" className="text-slate-700">Amount</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">$</span>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="h-14 pl-8 text-2xl font-light border-slate-200 focus:border-slate-400 focus:ring-slate-400"
                    required
                  />
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {quickAmounts.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setFormData({ ...formData, amount: amount.toString() })}
                      className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-colors"
                    >
                      ${amount}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category" className="text-slate-700">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                  required
                >
                  <SelectTrigger className="h-12 border-slate-200">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
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

              <div className="space-y-2">
                <Label htmlFor="date" className="text-slate-700">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="h-12 border-slate-200 focus:border-slate-400 focus:ring-slate-400"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-slate-700">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any additional details..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="border-slate-200 focus:border-slate-400 focus:ring-slate-400 resize-none"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(createPageUrl('Dashboard'))}
                  className="flex-1 h-12 border-slate-200 text-slate-600"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !formData.title || !formData.amount || !formData.category}
                  className="flex-1 h-12 bg-slate-900 hover:bg-slate-800 text-white"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Expense'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}