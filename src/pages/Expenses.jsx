import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Search, Filter, Download, TrendingUp, TrendingDown, Building2, Plus, Loader2 } from 'lucide-react';
import { format, parseISO, subMonths } from 'date-fns';
import { toast } from 'sonner';
import { 
  getBankTransactions, 
  fetchBankTransactions,
  checkBankConnection,
  fetchBankAccounts,
  getBankAccounts,
  getAccountDisplayName,
  getAccountCustomName
} from '@/lib/bankData';

const CATEGORY_ICONS = {
  'Food & Dining': '🍽️',
  'Transportation': '🚗',
  'Housing': '🏠',
  'Shopping': '🛍️',
  'Entertainment': '🎬',
  'Health & Fitness': '💊',
  'Insurance': '🛡️',
  'Salary': '💰',
  'Subscriptions': '📱',
  'Transfer': '↔️',
  'Cash': '💵',
  'Uncategorized': '❓'
};

export default function Expenses() {
  const [isConnected, setIsConnected] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const status = await checkBankConnection();
      setIsConnected(status.connected);
      
      if (status.connected) {
        // First try to load from local storage
        const localAccounts = getBankAccounts();
        const localTransactions = getBankTransactions();
        
        if (localAccounts.length > 0) {
          setAccounts(localAccounts);
        }
        
        if (localTransactions.length > 0) {
          setTransactions(localTransactions);
        } else {
          // If no local data, fetch from API
          await refreshData();
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      const [apiAccounts, apiTransactions] = await Promise.all([
        fetchBankAccounts(),
        fetchBankTransactions()
      ]);
      
      setAccounts(apiAccounts);
      setTransactions(apiTransactions);
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Description', 'Category', 'Amount', 'Account'];
    const rows = filteredTransactions.map(tx => [
      tx.date,
      tx.description || tx.merchant || '',
      tx.category || 'Uncategorized',
      tx.amount.toFixed(2),
      getTransactionAccountName(tx)
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bank-transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    toast.success('Exported to CSV');
  };

  const getTransactionAccountName = (tx) => {
    const account = accounts.find(a => a.account_id === tx.accountId);
    if (!account) return tx.accountName || 'Unknown';
    
    const customName = getAccountCustomName(account.account_id);
    if (customName) return customName;
    
    return getAccountDisplayName(account);
  };

  const getMonthOptions = () => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      const date = subMonths(new Date(), i);
      months.push({
        value: format(date, 'yyyy-MM'),
        label: format(date, 'MMMM yyyy')
      });
    }
    return months;
  };

  const availableCategories = useMemo(() => {
    const categories = new Set();
    transactions.forEach(tx => {
      categories.add(tx.category || 'Uncategorized');
    });
    return Array.from(categories).sort();
  }, [transactions]);

  const availableAccounts = useMemo(() => {
    return accounts.map(account => ({
      id: account.account_id,
      name: getAccountCustomName(account.account_id) || getAccountDisplayName(account)
    }));
  }, [accounts]);

  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];
    const now = new Date();
    
    // Filter by month
    if (monthFilter !== 'all') {
      filtered = filtered.filter(tx => tx.date && tx.date.startsWith(monthFilter));
    }

    // Filter by category
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(tx => (tx.category || 'Uncategorized') === categoryFilter);
    }

    // Filter by account
    if (accountFilter !== 'all') {
      filtered = filtered.filter(tx => tx.accountId === accountFilter);
    }

    // Filter by type (income/expense)
    if (typeFilter === 'income') {
      filtered = filtered.filter(tx => tx.amount > 0);
    } else if (typeFilter === 'expense') {
      filtered = filtered.filter(tx => tx.amount < 0);
    }

    // Filter by search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(tx => 
        (tx.description && tx.description.toLowerCase().includes(term)) ||
        (tx.merchant && tx.merchant.toLowerCase().includes(term)) ||
        (tx.category && tx.category.toLowerCase().includes(term))
      );
    }

    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, monthFilter, categoryFilter, accountFilter, typeFilter, searchTerm]);

  const groupedTransactions = useMemo(() => {
    const groups = {};
    filteredTransactions.forEach(tx => {
      const date = tx.date;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(tx);
    });
    return groups;
  }, [filteredTransactions]);

  const totalIncome = filteredTransactions.filter(tx => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
  const totalExpenses = filteredTransactions.filter(tx => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return format(parseISO(dateString), 'EEEE, MMMM d, yyyy');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          <Link 
            to={createPageUrl('Dashboard')} 
            className="inline-flex items-center text-slate-400 hover:text-white mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>

          <div className="text-center py-20">
            <Building2 className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <h2 className="text-2xl font-light text-white mb-2">Connect Your Bank</h2>
            <p className="text-slate-400 mb-6">Connect your bank account to view your transactions here</p>
            <Link
              to={createPageUrl('Bank')}
              className="inline-flex items-center bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              Go to Bank Page
            </Link>
            <p className="text-xs text-slate-500 mt-4">
              Your transaction history will appear here once connected
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <Link 
          to={createPageUrl('Dashboard')} 
          className="inline-flex items-center text-slate-400 hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-4xl font-light text-white tracking-tight">
              Transactions
            </h1>
            <p className="text-slate-400 mt-2">
              {filteredTransactions.length} transactions from {accounts.length} account{accounts.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-2 mt-4 sm:mt-0">
            <Button
              onClick={refreshData}
              disabled={isRefreshing}
              variant="outline"
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
            <Button 
              variant="outline"
              onClick={exportToCSV}
              className="rounded-full"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-400 mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-medium">Income</span>
              </div>
              <p className="text-2xl font-bold text-green-400">
                {formatAmount(totalIncome)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-400 mb-1">
                <TrendingDown className="w-4 h-4" />
                <span className="text-sm font-medium">Expenses</span>
              </div>
              <p className="text-2xl font-bold text-red-400">
                {formatAmount(totalExpenses)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-slate-900/50 border-slate-800 mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-800 border-slate-700 text-white"
                />
              </div>
              
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-32 bg-slate-800 border-slate-700">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all" className="text-slate-200">All</SelectItem>
                  <SelectItem value="income" className="text-slate-200">Income</SelectItem>
                  <SelectItem value="expense" className="text-slate-200">Expense</SelectItem>
                </SelectContent>
              </Select>

              <Select value={accountFilter} onValueChange={setAccountFilter}>
                <SelectTrigger className="w-full sm:w-48 bg-slate-800 border-slate-700">
                  <SelectValue placeholder="Account" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all" className="text-slate-200">All Accounts</SelectItem>
                  {availableAccounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id} className="text-slate-200">
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-48 bg-slate-800 border-slate-700">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all" className="text-slate-200">All Categories</SelectItem>
                  {availableCategories.map(cat => (
                    <SelectItem key={cat} value={cat} className="text-slate-200">
                      {CATEGORY_ICONS[cat] || '📦'} {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger className="w-full sm:w-40 bg-slate-800 border-slate-700">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all" className="text-slate-200">All Time</SelectItem>
                  {getMonthOptions().map(month => (
                    <SelectItem key={month.value} value={month.value} className="text-slate-200">
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(searchTerm || categoryFilter !== 'all' || accountFilter !== 'all' || monthFilter !== 'all' || typeFilter !== 'all') && (
              <Button 
                variant="ghost" 
                onClick={() => {
                  setSearchTerm('');
                  setCategoryFilter('all');
                  setAccountFilter('all');
                  setMonthFilter('all');
                  setTypeFilter('all');
                }}
                className="mt-2 text-slate-400 hover:text-white"
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Transactions List */}
        {Object.keys(groupedTransactions).length > 0 ? (
          <div className="space-y-6">
            {Object.entries(groupedTransactions)
              .sort(([a], [b]) => new Date(b) - new Date(a))
              .map(([date, dayTransactions]) => (
                <div key={date}>
                  <h3 className="text-sm font-medium text-slate-400 mb-3">
                    {formatDate(date)}
                  </h3>
                  <Card className="bg-slate-900/50 border-slate-800">
                    <CardContent className="p-0 divide-y divide-slate-800">
                      {dayTransactions.map((tx) => (
                        <div 
                          key={tx.id} 
                          className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-slate-800 flex items-center justify-center text-xl">
                              {CATEGORY_ICONS[tx.category] || '❓'}
                            </div>
                            <div>
                              <p className="font-medium text-white">{tx.merchant || tx.description || 'Unknown'}</p>
                              <p className="text-sm text-slate-400">
                                {tx.category || 'Uncategorized'} · {getTransactionAccountName(tx)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-semibold text-lg ${
                              tx.amount > 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {tx.amount > 0 ? '+' : ''}{formatAmount(tx.amount)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              ))}
          </div>
        ) : (
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
                <Filter className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No transactions found</h3>
              <p className="text-slate-400">
                {transactions.length > 0 
                  ? 'Try adjusting your filters' 
                  : 'No transactions available from your connected accounts'
                }
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
