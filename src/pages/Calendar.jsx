import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Download, Building2, Plus, Loader2, ChevronDown, Calendar as CalendarIcon, X, TrendingUp, TrendingDown } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
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
  'Income': '📈',
  'Uncategorized': '❓'
};

export default function CalendarPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [accountFilter, setAccountFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const status = await checkBankConnection();
      setIsConnected(status.connected);
      
      if (status.connected) {
        const localAccounts = getBankAccounts();
        const localTransactions = getBankTransactions();
        
        if (localAccounts.length > 0) {
          setAccounts(localAccounts);
        }
        
        if (localTransactions.length > 0) {
          setTransactions(localTransactions);
        } else {
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

  const availableAccounts = useMemo(() => {
    return accounts.map(account => ({
      id: account.account_id,
      name: getAccountCustomName(account.account_id) || getAccountDisplayName(account)
    }));
  }, [accounts]);

  const availableCategories = useMemo(() => {
    const categories = new Set();
    transactions.forEach(tx => {
      categories.add(tx.category || 'Uncategorized');
    });
    return Array.from(categories).sort();
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    if (accountFilter !== 'all') {
      filtered = filtered.filter(tx => tx.accountId === accountFilter);
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(tx => (tx.category || 'Uncategorized') === categoryFilter);
    }

    return filtered;
  }, [transactions, accountFilter, categoryFilter]);

  const transactionsByDate = useMemo(() => {
    const grouped = {};
    filteredTransactions.forEach(tx => {
      const date = tx.date;
      if (!grouped[date]) {
        grouped[date] = { income: 0, expenses: 0, transactions: [] };
      }
      if (tx.amount > 0) {
        grouped[date].income += tx.amount;
      } else {
        grouped[date].expenses += Math.abs(tx.amount);
      }
      grouped[date].transactions.push(tx);
    });
    return grouped;
  }, [filteredTransactions]);

  const selectedDateTransactions = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return transactionsByDate[dateStr]?.transactions || [];
  }, [selectedDate, transactionsByDate]);

  const dailyTotals = useMemo(() => {
    const totals = {};
    filteredTransactions.forEach(tx => {
      const date = tx.date;
      if (!totals[date]) {
        totals[date] = { income: 0, expenses: 0, net: 0 };
      }
      if (tx.amount > 0) {
        totals[date].income += tx.amount;
      } else {
        totals[date].expenses += Math.abs(tx.amount);
      }
      totals[date].net += tx.amount;
    });
    return totals;
  }, [filteredTransactions]);

  const monthStats = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    
    let income = 0;
    let expenses = 0;
    let transactionCount = 0;
    
    filteredTransactions.forEach(tx => {
      const txDate = parseISO(tx.date);
      if (txDate >= start && txDate <= end) {
        if (tx.amount > 0) {
          income += tx.amount;
        } else {
          expenses += Math.abs(tx.amount);
        }
        transactionCount++;
      }
    });
    
    return { income, expenses, net: income - expenses, transactionCount };
  }, [filteredTransactions, currentMonth]);

  const getTransactionAccountName = (tx) => {
    const account = accounts.find(a => a.account_id === tx.accountId);
    if (!account) return tx.accountName || 'Unknown';
    
    const customName = getAccountCustomName(account.account_id);
    if (customName) return customName;
    
    return getAccountDisplayName(account);
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const renderDay = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayData = dailyTotals[dateStr];
    const hasTransactions = dayData && (dayData.income > 0 || dayData.expenses > 0);
    const isSelected = selectedDate && isSameDay(date, selectedDate);
    const isToday = isSameDay(date, new Date());
    const isCurrentMonth = isSameMonth(date, currentMonth);

    return (
      <div 
        key={date.toISOString()}
        className={`
          relative h-20 p-1 border border-slate-800 cursor-pointer transition-all hover:bg-slate-800/50
          ${!isCurrentMonth ? 'opacity-30' : ''}
          ${isSelected ? 'bg-teal-500/20 border-teal-500/50' : ''}
          ${isToday ? 'bg-slate-800' : ''}
        `}
        onClick={() => setSelectedDate(date)}
      >
        <div className={`
          text-xs font-medium mb-1
          ${isToday ? 'text-teal-400' : isCurrentMonth ? 'text-slate-300' : 'text-slate-600'}
        `}>
          {format(date, 'd')}
        </div>
        
        {hasTransactions && (
          <div className="space-y-0.5">
            {dayData.income > 0 && (
              <div className="text-[10px] text-green-400 truncate px-0.5">
                +{formatAmount(dayData.income)}
              </div>
            )}
            {dayData.expenses > 0 && (
              <div className="text-[10px] text-red-400 truncate px-0.5">
                -{formatAmount(dayData.expenses)}
              </div>
            )}
          </div>
        )}
        
        {dayData && dayData.income > 0 && dayData.expenses > 0 && (
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
          </div>
        )}
      </div>
    );
  };

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
            <p className="text-slate-400 mb-6">Connect your bank account to view your transaction calendar</p>
            <Link
              to={createPageUrl('Bank')}
              className="inline-flex items-center bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              Go to Bank Page
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <Link 
          to={createPageUrl('Dashboard')} 
          className="inline-flex items-center text-slate-400 hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-4xl font-light text-white tracking-tight">
              Transaction Calendar
            </h1>
            <p className="text-slate-400 mt-2">
              View all your transactions on a calendar
            </p>
          </div>
          <div className="flex flex-wrap gap-2 mt-4 sm:mt-0">
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
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-400 mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-medium">Income</span>
              </div>
              <p className="text-xl font-bold text-green-400">
                {formatAmount(monthStats.income)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-400 mb-1">
                <TrendingDown className="w-4 h-4" />
                <span className="text-sm font-medium">Expenses</span>
              </div>
              <p className="text-xl font-bold text-red-400">
                {formatAmount(monthStats.expenses)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-teal-400 mb-1">
                <CalendarIcon className="w-4 h-4" />
                <span className="text-sm font-medium">Net</span>
              </div>
              <p className={`text-xl font-bold ${monthStats.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {monthStats.net >= 0 ? '+' : ''}{formatAmount(monthStats.net)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <span className="text-sm font-medium">Transactions</span>
              </div>
              <p className="text-xl font-bold text-white">
                {monthStats.transactionCount}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-lg">
                    {format(currentMonth, 'MMMM yyyy')}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    >
                      <ChevronDown className="h-4 w-4 rotate-90" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMonth(new Date())}
                    >
                      Today
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    >
                      <ChevronDown className="h-4 w-4 -rotate-90" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Select value={accountFilter} onValueChange={setAccountFilter}>
                    <SelectTrigger className="w-full sm:w-40 bg-slate-800 border-slate-700">
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
                    <SelectTrigger className="w-full sm:w-40 bg-slate-800 border-slate-700">
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
                </div>

                <div className="grid grid-cols-7 gap-0 border border-slate-800 rounded-lg overflow-hidden">
                  {weekDays.map(day => (
                    <div 
                      key={day} 
                      className="p-2 text-center text-xs font-medium text-slate-400 bg-slate-800/50 border-b border-slate-800"
                    >
                      {day}
                    </div>
                  ))}
                  
                  {calendarDays.map(date => renderDay(date))}
                </div>

                <div className="flex items-center gap-4 mt-4 text-xs text-slate-400">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span>Income</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span>Expense</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="bg-slate-900/50 border-slate-800 sticky top-8">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-lg">
                    {selectedDate ? format(selectedDate, 'EEEE, MMM d') : 'Select a Day'}
                  </CardTitle>
                  {selectedDate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedDate(null)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {selectedDate ? (
                  <div>
                    {selectedDateTransactions.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="p-2 rounded bg-slate-800/50">
                          <div className="text-xs text-green-400">Income</div>
                          <div className="text-sm font-bold text-green-400">
                            {formatAmount(
                              selectedDateTransactions
                                .filter(tx => tx.amount > 0)
                                .reduce((sum, tx) => sum + tx.amount, 0)
                            )}
                          </div>
                        </div>
                        <div className="p-2 rounded bg-slate-800/50">
                          <div className="text-xs text-red-400">Expenses</div>
                          <div className="text-sm font-bold text-red-400">
                            {formatAmount(
                              selectedDateTransactions
                                .filter(tx => tx.amount < 0)
                                .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="h-[400px] overflow-y-auto pr-4">
                      {selectedDateTransactions.length > 0 ? (
                        <div className="space-y-2">
                          {selectedDateTransactions
                            .sort((a, b) => new Date(b.date) - new Date(a.date))
                            .map(tx => (
                              <div 
                                key={tx.id}
                                className="p-3 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-sm shrink-0">
                                      {CATEGORY_ICONS[tx.category] || '❓'}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-medium text-white text-sm truncate">
                                        {tx.merchant || tx.description || 'Unknown'}
                                      </p>
                                      <p className="text-xs text-slate-400 truncate">
                                        {tx.category || 'Uncategorized'}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className={`font-semibold text-sm ${
                                      tx.amount > 0 ? 'text-green-400' : 'text-red-400'
                                    }`}>
                                      {tx.amount > 0 ? '+' : ''}{formatAmount(tx.amount)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <CalendarIcon className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                          <p className="text-slate-400 text-sm">No transactions on this day</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CalendarIcon className="h-12 w-12 text-slate-600 mx-auto mb-2" />
                    <p className="text-slate-400">Click on a date to view transactions</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
