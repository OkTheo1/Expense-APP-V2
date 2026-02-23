import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Calendar, Building2, Loader2 } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { getExpenses, getProfile } from '@/lib/localDatabase';
import { 
  getBankTransactions, 
  checkBankConnection, 
  getTransactionsByCategory, 
  getMonthlyTrends 
} from '@/lib/bankData';

const COLORS = ['#0f172a', '#334155', '#64748b', '#94a3b8', '#cbd5e1', '#059669', '#0891b2', '#7c3aed', '#db2777', '#f59e0b', '#84cc16'];

const CATEGORY_ICONS = {
  'Housing': '🏠',
  'Food & Dining': '🍽️',
  'Transportation': '🚗',
  'Entertainment': '🎬',
  'Shopping': '🛍️',
  'Utilities': '💡',
  'Healthcare': '🏥',
  'Education': '📚',
  'Personal': '👤',
  'Savings': '💰',
  'Other': '📦',
  'Salary': '💼',
  'Freelance': '💻',
  'Investment': '📈',
  'Insurance': '🛡️',
  'Subscriptions': '📱',
  'Transfer': '↔️',
  'Cash': '💵',
  'Uncategorized': '❓'
};

export default function Analytics() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('6');
  const [currency, setCurrency] = useState('GBP');
  const [bankConnected, setBankConnected] = useState(false);
  const [bankTransactions, setBankTransactions] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const profile = getProfile();
      if (profile && profile.currency) {
        setCurrency(profile.currency);
      }
      
      const data = getExpenses();
      setExpenses(data);
      
      // Check bank connection
      const status = await checkBankConnection();
      setBankConnected(status.connected);
      
      if (status.connected) {
        const bankTxs = getBankTransactions();
        setBankTransactions(bankTxs);
      }
    } catch (error) {
      console.error('Error loading expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrencySymbol = () => {
    return currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '€';
  };

  const months = parseInt(timeRange);
  const startDate = startOfMonth(subMonths(new Date(), months - 1));
  const endDate = endOfMonth(new Date());

  // Manual expenses filtering
  const filteredExpenses = expenses.filter(e => {
    const expenseDate = new Date(e.date);
    return expenseDate >= startDate && expenseDate <= endDate;
  });

  // Bank transactions filtering
  const filteredBankTransactions = bankTransactions.filter(e => {
    const txDate = new Date(e.date);
    return txDate >= startDate && txDate <= endDate;
  });

  // Separate income and expenses (manual)
  const incomeExpenses = filteredExpenses.filter(e => e.type === 'income');
  const expenseItems = filteredExpenses.filter(e => e.type !== 'income' || !e.type);

  // Bank transaction stats
  const bankIncome = filteredBankTransactions.filter(t => t.amount > 0);
  const bankExpenses = filteredBankTransactions.filter(t => t.amount < 0);
  const bankTotalIncome = bankIncome.reduce((sum, t) => sum + t.amount, 0);
  const bankTotalExpenses = bankExpenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Monthly spending trend (manual)
  const monthlyData = eachMonthOfInterval({ start: startDate, end: endDate }).map(date => {
    const monthStart = startOfMonth(date).toISOString().split('T')[0];
    const monthEnd = endOfMonth(date).toISOString().split('T')[0];
    const monthExpenses = expenseItems.filter(e => e.date >= monthStart && e.date <= monthEnd);
    const monthIncome = incomeExpenses.filter(e => e.date >= monthStart && e.date <= monthEnd);
    const totalExpense = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalIncome = monthIncome.reduce((sum, e) => sum + e.amount, 0);
    
    // Bank data for this month
    const bankMonthTxs = filteredBankTransactions.filter(t => {
      const txDate = new Date(t.date);
      return txDate >= startOfMonth(date) && txDate <= endOfMonth(date);
    });
    const bankMonthIncome = bankMonthTxs.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    const bankMonthExpenses = bankMonthTxs.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    return {
      month: format(date, 'MMM'),
      fullMonth: format(date, 'MMMM yyyy'),
      expense: totalExpense,
      income: totalIncome,
      bankExpense: bankMonthExpenses,
      bankIncome: bankMonthIncome,
      count: monthExpenses.length
    };
  });

  // Category breakdown (manual expenses)
  const categoryData = Object.entries(
    expenseItems.reduce((acc, expense) => {
      const cat = expense.category || 'Other';
      acc[cat] = (acc[cat] || 0) + expense.amount;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }))
   .sort((a, b) => b.value - a.value);

  // Bank category breakdown
  const bankCategoryData = getTransactionsByCategory(filteredBankTransactions);
  const bankCategoryChartData = Object.entries(bankCategoryData).map(([name, data]) => ({
    name,
    value: data.total,
    count: data.transactions.length
  })).sort((a, b) => b.value - a.value);

  // Daily spending pattern (bank)
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dailyPattern = dayNames.map((day, index) => {
    const dayExpenses = filteredBankTransactions.filter(t => 
      t.amount < 0 && new Date(t.date).getDay() === index
    );
    const total = dayExpenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const weeks = months * 4.33;
    return {
      day,
      average: dayExpenses.length > 0 ? total / weeks : 0,
      total
    };
  });

  // Top spending categories (bank)
  const topBankCategories = bankCategoryChartData.slice(0, 5);

  // Month-over-month comparison
  const currentMonthStart = startOfMonth(new Date()).toISOString().split('T')[0];
  const currentMonthEnd = endOfMonth(new Date()).toISOString().split('T')[0];
  const lastMonthStart = startOfMonth(subMonths(new Date(), 1)).toISOString().split('T')[0];
  const lastMonthEnd = endOfMonth(subMonths(new Date(), 1)).toISOString().split('T')[0];

  const currentMonthTotal = expenseItems
    .filter(e => e.date >= currentMonthStart && e.date <= currentMonthEnd)
    .reduce((sum, e) => sum + e.amount, 0);

  const lastMonthTotal = expenseItems
    .filter(e => e.date >= lastMonthStart && e.date <= lastMonthEnd)
    .reduce((sum, e) => sum + e.amount, 0);

  const monthChange = lastMonthTotal > 0 
    ? ((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 
    : 0;

  // Average transaction (bank)
  const avgBankTransaction = bankExpenses.length > 0 
    ? bankExpenses.reduce((sum, t) => sum + Math.abs(t.amount), 0) / bankExpenses.length 
    : 0;

  // Totals
  const totalSpending = expenseItems.reduce((sum, e) => sum + e.amount, 0);
  const totalIncome = incomeExpenses.reduce((sum, e) => sum + e.amount, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-teal-400 animate-spin" />
      </div>
    );
  }

  const symbol = getCurrencySymbol();

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

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-light text-white tracking-tight">
              Analytics
            </h1>
            <p className="text-slate-400 mt-1">
              Insights into your spending patterns
            </p>
          </div>
          <div className="flex items-center gap-4 mt-4 sm:mt-0">
            {bankConnected && (
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <Building2 className="h-4 w-4" />
                Bank Connected
              </div>
            )}
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-48 border-slate-700 bg-slate-800">
                <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="3" className="text-slate-200">Last 3 months</SelectItem>
                <SelectItem value="6" className="text-slate-200">Last 6 months</SelectItem>
                <SelectItem value="12" className="text-slate-200">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6">
              <p className="text-sm text-slate-400">Manual Expenses</p>
              <p className="text-2xl font-light text-white mt-1">
                {symbol}{totalSpending.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-2">Last {months} months</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6">
              <p className="text-sm text-slate-400">Bank Expenses</p>
              <p className="text-2xl font-light text-red-400 mt-1">
                {symbol}{bankTotalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-2">{filteredBankTransactions.length} transactions</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6">
              <p className="text-sm text-slate-400">Avg Bank Transaction</p>
              <p className="text-2xl font-light text-white mt-1">
                {symbol}{avgBankTransaction.toFixed(2)}
              </p>
              <p className="text-xs text-slate-500 mt-2">per transaction</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6">
              <p className="text-sm text-slate-400">vs Last Month</p>
              <div className="flex items-center gap-2 mt-1">
                <p className={`text-2xl font-light ${
                  monthChange > 0 ? 'text-red-400' : monthChange < 0 ? 'text-green-400' : 'text-white'
                }`}>
                  {monthChange > 0 ? '+' : ''}{monthChange.toFixed(1)}%
                </p>
                {monthChange > 0 ? (
                  <TrendingUp className="w-5 h-5 text-red-400" />
                ) : monthChange < 0 ? (
                  <TrendingDown className="w-5 h-5 text-green-400" />
                ) : (
                  <Minus className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {monthChange > 0 ? 'Spending increased' : monthChange < 0 ? 'Spending decreased' : 'No change'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Monthly Spending Trend */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg font-medium text-white">Monthly Income vs Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `${symbol}${v}`} />
                    <Tooltip 
                      formatter={(value) => [`${symbol}${value.toFixed(2)}`]}
                      labelFormatter={(label, payload) => payload[0]?.payload?.fullMonth || label}
                      contentStyle={{ 
                        borderRadius: '12px', 
                        border: 'none', 
                        backgroundColor: '#1e293b',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' 
                      }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="income" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      fill="url(#colorIncome)" 
                      name="Manual Income"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="expense" 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      fill="url(#colorExpense)" 
                      name="Manual Expenses"
                    />
                    {bankConnected && (
                      <>
                        <Area 
                          type="monotone" 
                          dataKey="bankIncome" 
                          stroke="#14b8a6" 
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          fill="transparent" 
                          name="Bank Income"
                        />
                        <Area 
                          type="monotone" 
                          dataKey="bankExpense" 
                          stroke="#f97316" 
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          fill="transparent" 
                          name="Bank Expenses"
                        />
                      </>
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Category Breakdown (Bank) */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg font-medium text-white">
                Bank Spending by Category
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bankCategoryChartData.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={bankCategoryChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {bankCategoryChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value) => [`${symbol}${value.toFixed(2)}`, 'Spent']}
                        contentStyle={{ 
                          borderRadius: '12px', 
                          border: 'none', 
                          backgroundColor: '#1e293b'
                        }}
                        labelStyle={{ color: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-72 flex items-center justify-center text-slate-400">
                  No bank data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Spending Pattern (Bank) */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg font-medium text-white">Bank Spending by Day of Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyPattern}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `${symbol}${v.toFixed(0)}`} />
                    <Tooltip 
                      formatter={(value) => [`${symbol}${value.toFixed(2)}`, 'Avg Spending']}
                      contentStyle={{ 
                        borderRadius: '12px', 
                        border: 'none', 
                        backgroundColor: '#1e293b'
                      }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="average" fill="#0f172a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Top Categories (Bank) */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg font-medium text-white">Top Bank Spending Categories</CardTitle>
            </CardHeader>
            <CardContent>
              {topBankCategories.length > 0 ? (
                <div className="space-y-4">
                  {topBankCategories.map((category, index) => {
                    const percentage = (category.value / bankTotalExpenses) * 100;
                    return (
                      <div key={category.name}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{CATEGORY_ICONS[category.name] || '📦'}</span>
                            <span className="font-medium text-slate-200">{category.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-medium text-white">
                              {symbol}{category.value.toFixed(2)}
                            </span>
                            <span className="text-sm text-slate-400 ml-2">
                              {percentage.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-500"
                            style={{ 
                              width: `${percentage}%`,
                              backgroundColor: COLORS[index % COLORS.length]
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-slate-400">
                  No bank data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
