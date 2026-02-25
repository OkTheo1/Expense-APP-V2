import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Plus, Settings, Building2, RefreshCw, Trash2, TrendingUp, TrendingDown, Calendar, Filter, Edit2, Save, X, ArrowRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import DraggableBlock from '@/components/dashboard/DraggabbleBlock';
import BalanceBlock from '@/components/dashboard/BalanceBlock';
import SpendingBlock from '@/components/dashboard/SpendingBlock';
import CategoryChartBlock from '@/components/dashboard/CategoryChartBlock';
import RecentTransactionsBlock from '@/components/dashboard/RecentTransactionsBlock';
import ProjectedExpensesBlock from '@/components/dashboard/ProjectedExpensesBlock';
import BankBalanceBlock from '@/components/dashboard/BankBalanceBlock';
import BankTransactionsBlock from '@/components/dashboard/BankTransactionsBlock';
import BankSelector from '@/components/BankSelector';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from 'sonner';
import { 
  getExpenses, 
  getBudgets, 
  getProfile, 
  getDashboardBlocks, 
  saveDashboardBlocks,
  getRecurringTransactions 
} from '@/lib/localDatabase';
import { 
  getBankAccounts, 
  getBankTransactions, 
  getBankName, 
  filterByBank,
  filterAccountsByBank,
  getTotalBankBalance,
  getFilteredBankBalance,
  fetchBankAccounts,
  fetchBankTransactions,
  checkBankConnection,
  disconnectBank,
  getTransactionsByCategory,
  groupAccountsByBank,
  saveAccountNameMapping,
  getAccountCustomName,
  getAccountDisplayName,
  getAccountTypeName
} from '@/lib/bankData';

const API_BASE = 'http://localhost:3001';

const CATEGORY_ICONS = {
  'Food & Dining': '🍔',
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

export default function Dashboard() {
  const [expenses, setExpenses] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [recurringTransactions, setRecurringTransactions] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggedBlock, setDraggedBlock] = useState(null);
  const [currency, setCurrency] = useState('GBP');
  const [editMode, setEditMode] = useState(false);
  
  // Bank state
  const [selectedBank, setSelectedBank] = useState('all');
  const [bankAccounts, setBankAccounts] = useState([]);
  const [bankTransactions, setBankTransactions] = useState([]);
  const [isBankConnected, setIsBankConnected] = useState(false);
  const [isBankLoading, setIsBankLoading] = useState(false);
  const [bankFilter, setBankFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [editCustomName, setEditCustomName] = useState('');

  const currentProfile = localStorage.getItem('currentProfile');

  useEffect(() => {
    loadData();
    loadBlocks();
    loadProfileCurrency();
    loadBankData();
  }, []);

  const loadBankData = async () => {
    try {
      const status = await checkBankConnection();
      setIsBankConnected(status.connected);
      
      const accounts = getBankAccounts();
      const transactions = getBankTransactions();
      setBankAccounts(accounts);
      setBankTransactions(transactions);
    } catch (error) {
      console.error('Error loading bank data:', error);
    }
  };

  const loadProfileCurrency = () => {
    try {
      const profile = getProfile();
      if (profile && profile.currency) {
        setCurrency(profile.currency);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadData = () => {
    try {
      const expensesData = getExpenses();
      const budgetsData = getBudgets();
      const recurringData = getRecurringTransactions();
      setExpenses(expensesData);
      setBudgets(budgetsData);
      setRecurringTransactions(recurringData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBlocks = () => {
    try {
      let blocksData = getDashboardBlocks();
      
      if (blocksData.length === 0) {
        const defaultBlocks = [
          { id: '1', blockType: 'bank-balance', position: 0, width: 'half', isVisible: true },
          { id: '2', blockType: 'balance', position: 1, width: 'half', isVisible: true },
          { id: '3', blockType: 'spending', position: 2, width: 'half', isVisible: true },
          { id: '4', blockType: 'bank-transactions', position: 3, width: 'half', isVisible: true },
          { id: '5', blockType: 'projected-expenses', position: 4, width: 'half', isVisible: true },
          { id: '6', blockType: 'category-chart', position: 5, width: 'half', isVisible: true },
          { id: '7', blockType: 'recent-transactions', position: 6, width: 'half', isVisible: true },
        ];
        saveDashboardBlocks(defaultBlocks);
        blocksData = defaultBlocks;
      }
      
      setBlocks(blocksData.sort((a, b) => a.position - b.position));
    } catch (error) {
      console.error('Error loading blocks:', error);
      const defaultBlocks = [
        { id: '1', blockType: 'bank-balance', position: 0, width: 'half', isVisible: true },
        { id: '2', blockType: 'balance', position: 1, width: 'half', isVisible: true },
        { id: '3', blockType: 'spending', position: 2, width: 'half', isVisible: true },
        { id: '4', blockType: 'bank-transactions', position: 3, width: 'half', isVisible: true },
        { id: '5', blockType: 'category-chart', position: 4, width: 'half', isVisible: true },
        { id: '6', blockType: 'recent-transactions', position: 5, width: 'half', isVisible: true },
      ];
      setBlocks(defaultBlocks);
    }
  };

  // Bank handlers
  const handleConnectBank = async () => {
    setIsBankLoading(true);
    try {
      window.location.href = `${API_BASE}/auth/truelayer`;
    } catch (error) {
      console.error('Error connecting bank:', error);
      toast.error('Failed to connect bank');
      setIsBankLoading(false);
    }
  };

  const handleRefreshBank = async () => {
    setIsBankLoading(true);
    try {
      const apiAccounts = await fetchBankAccounts();
      const apiTransactions = await fetchBankTransactions();
      setBankAccounts(apiAccounts);
      setBankTransactions(apiTransactions);
      toast.success('Bank data refreshed');
    } catch (error) {
      console.error('Error refreshing:', error);
      toast.error('Failed to refresh bank data');
    } finally {
      setIsBankLoading(false);
    }
  };

  const handleDisconnectBank = async () => {
    try {
      await disconnectBank();
      setIsBankConnected(false);
      setBankAccounts([]);
      setBankTransactions([]);
      toast.success('Bank disconnected');
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Failed to disconnect');
    }
  };

  const handleEditAccountName = (account) => {
    setEditingAccountId(account.account_id);
    setEditCustomName(getAccountCustomName(account.account_id) || '');
  };

  const handleSaveAccountName = (accountId) => {
    saveAccountNameMapping(accountId, editCustomName);
    setEditingAccountId(null);
    setEditCustomName('');
    loadBankData();
    toast.success('Account name updated');
  };

  const handleCancelEdit = () => {
    setEditingAccountId(null);
    setEditCustomName('');
  };

  // Group accounts by bank
  const groupedAccounts = useMemo(() => {
    return groupAccountsByBank(bankAccounts);
  }, [bankAccounts]);

  const banks = useMemo(() => {
    return Object.keys(groupedAccounts).sort();
  }, [groupedAccounts]);

  const availableCategories = useMemo(() => {
    const categories = new Set();
    bankTransactions.forEach(tx => {
      categories.add(tx.category || 'Uncategorized');
    });
    return Array.from(categories).sort();
  }, [bankTransactions]);

  // Filtered bank transactions
  const filteredBankTransactions = useMemo(() => {
    let filtered = [...bankTransactions];
    const now = new Date();
    
    switch (bankFilter) {
      case 'this-month':
        filtered = filtered.filter(tx => {
          const txDate = new Date(tx.date);
          return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
        });
        break;
      case 'last-month':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        filtered = filtered.filter(tx => {
          const txDate = new Date(tx.date);
          return txDate.getMonth() === lastMonth.getMonth() && txDate.getFullYear() === lastMonth.getFullYear();
        });
        break;
      case 'this-year':
        filtered = filtered.filter(tx => new Date(tx.date).getFullYear() === now.getFullYear());
        break;
      case 'last-3-months':
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        filtered = filtered.filter(tx => new Date(tx.date) >= threeMonthsAgo);
        break;
      default:
        break;
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(tx => (tx.category || 'Uncategorized') === categoryFilter);
    }

    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [bankTransactions, bankFilter, categoryFilter]);

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleDragStart = (e, blockId) => {
    setDraggedBlock(blockId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedBlock(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetBlockId) => {
    e.preventDefault();
    
    if (draggedBlock === targetBlockId) return;

    const draggedIndex = blocks.findIndex(b => b.id === draggedBlock);
    const targetIndex = blocks.findIndex(b => b.id === targetBlockId);

    const newBlocks = [...blocks];
    const [removed] = newBlocks.splice(draggedIndex, 1);
    newBlocks.splice(targetIndex, 0, removed);

    const updatedBlocks = newBlocks.map((block, index) => ({
      ...block,
      position: index
    }));

    setBlocks(updatedBlocks);
    saveDashboardBlocks(updatedBlocks);

    toast.success('Dashboard layout updated');
  };

  const toggleBlockVisibility = (blockId) => {
    const updatedBlocks = blocks.map(b => b.id === blockId ? { ...b, isVisible: !b.isVisible } : b);
    setBlocks(updatedBlocks);
    saveDashboardBlocks(updatedBlocks);
  };

  const monthStart = startOfMonth(new Date()).toISOString().split('T')[0];
  const monthEnd = endOfMonth(new Date()).toISOString().split('T')[0];

  // This month's local expenses
  const thisMonthExpenses = expenses.filter(e => 
    e.date >= monthStart && e.date <= monthEnd
  );

  // This month's bank transactions
  const thisMonthBankTransactions = filteredBankTransactions.filter(tx => {
    const txDate = new Date(tx.date);
    const start = new Date(monthStart);
    const end = new Date(monthEnd);
    return txDate >= start && txDate <= end;
  });

  // Calculate bank totals (this month) - only use bank transactions
  const bankIncome = thisMonthBankTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const bankExpenses = thisMonthBankTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Calculate all-time bank totals only
  const allTimeBankIncome = bankTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const allTimeBankExpenses = bankTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Combined totals - this month (for spending block)
  const totalSpent = bankExpenses;
  const totalIncome = bankIncome;
  
  // Use actual bank balance from API (current balance, not available which includes overdraft)
  const balance = getTotalBankBalance();
  const totalBudget = budgets.reduce((sum, b) => sum + b.limit, 0);
  
  // Calculate expected monthly income from recurring transactions
  const monthlyRecurringIncome = recurringTransactions
    .filter(r => r.type === 'income')
    .reduce((sum, r) => sum + r.amount, 0);

  const lastMonthStart = startOfMonth(subMonths(new Date(), 1)).toISOString().split('T')[0];
  const lastMonthEnd = endOfMonth(subMonths(new Date(), 1)).toISOString().split('T')[0];
  
  // Last month's local expenses
  const lastMonthSpentLocal = expenses
    .filter(e => e.date >= lastMonthStart && e.date <= lastMonthEnd && e.type === 'expense')
    .reduce((sum, e) => sum + e.amount, 0);
  
  // Last month's bank transactions
  const lastMonthBankTransactions = filteredBankTransactions.filter(tx => {
    const txDate = new Date(tx.date);
    const start = new Date(lastMonthStart);
    const end = new Date(lastMonthEnd);
    return txDate >= start && txDate <= end;
  });
  
  const lastMonthBankExpenses = lastMonthBankTransactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  const lastMonthSpent = lastMonthSpentLocal + lastMonthBankExpenses;
  
  const change = lastMonthSpent > 0 ? ((totalSpent - lastMonthSpent) / lastMonthSpent) * 100 : 0;

  // Combined spending by category (local + bank)
  const spendingByCategory = thisMonthExpenses
    .filter(e => e.type === 'expense')
    .reduce((acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
      return acc;
    }, {});
  
  // Add bank transaction categories
  thisMonthBankTransactions
    .filter(t => t.amount < 0)
    .forEach(tx => {
      const cat = tx.category || 'Uncategorized';
      spendingByCategory[cat] = (spendingByCategory[cat] || 0) + Math.abs(tx.amount);
    });

  const pieData = Object.entries(spendingByCategory).map(([name, value]) => ({
    name,
    value
  }));

  // Combined transactions for recent activity
  const combinedTransactions = useMemo(() => {
    const localTxs = thisMonthExpenses.map(e => ({
      id: `local-${e.id}`,
      date: e.date,
      description: e.description || 'Local Expense',
      amount: e.type === 'income' ? e.amount : -e.amount,
      category: e.category,
      source: 'local'
    }));
    
    const bankTxs = thisMonthBankTransactions.map((tx, idx) => ({
      id: `bank-${idx}`,
      date: tx.date,
      description: tx.merchant || tx.description || 'Bank Transaction',
      amount: tx.amount,
      category: tx.category,
      source: 'bank'
    }));
    
    return [...localTxs, ...bankTxs]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 20);
  }, [thisMonthExpenses, thisMonthBankTransactions]);

  // Filter bank transactions by selected bank
  const filteredByBankTransactions = useMemo(() => {
    if (!selectedBank || selectedBank === 'all') {
      return filteredBankTransactions;
    }
    
    return filterByBank(filteredBankTransactions, selectedBank, bankAccounts);
  }, [filteredBankTransactions, selectedBank, bankAccounts]);

  // Filter bank accounts by selected bank
  const filteredBankAccounts = useMemo(() => {
    return filterAccountsByBank(bankAccounts, selectedBank);
  }, [bankAccounts, selectedBank]);

  // Calculate filtered bank balance
  const filteredBankBalance = useMemo(() => {
    return getFilteredBankBalance(filteredBankAccounts);
  }, [filteredBankAccounts]);

  // Get selected bank info for display
  const selectedBankInfo = useMemo(() => {
    if (!selectedBank || selectedBank === 'all') {
      return { type: 'all', name: 'All Banks', count: bankAccounts.length };
    }
    
    if (selectedBank.startsWith('bank:')) {
      const bankName = selectedBank.replace('bank:', '');
      const count = bankAccounts.filter(a => getBankName(a) === bankName).length;
      return { type: 'bank', name: bankName, count };
    }
    
    const account = bankAccounts.find(a => a.account_id === selectedBank);
    if (account) {
      return { 
        type: 'account', 
        name: account.display_name || getBankName(account),
        bank: getBankName(account),
        count: 1
      };
    }
    
    return { type: 'all', name: 'All Banks', count: bankAccounts.length };
  }, [selectedBank, bankAccounts]);

  const handleBankChange = (value) => {
    setSelectedBank(value);
  };

  const renderBlock = (block) => {
    switch (block.blockType) {
      case 'bank-balance':
        return <BankBalanceBlock currency={currency} accounts={filteredBankAccounts} balance={filteredBankBalance} />;
      case 'balance':
        return <BalanceBlock balance={balance} currency={currency} change={change} thisMonth={totalSpent} lastMonth={lastMonthSpent} />;
      case 'spending':
        return <SpendingBlock spent={totalSpent} budget={totalBudget} currency={currency} />;
      case 'category-chart':
        return <CategoryChartBlock data={pieData} currency={currency} />;
      case 'recent-transactions':
        return <RecentTransactionsBlock transactions={combinedTransactions} currency={currency} />;
      case 'bank-transactions':
        return <BankTransactionsBlock currency={currency} limit={10} transactions={filteredByBankTransactions} />;
      case 'projected-expenses':
        return (
          <ProjectedExpensesBlock 
            totalIncome={monthlyRecurringIncome || totalIncome}
            totalExpenses={totalSpent}
            recurringExpenses={recurringTransactions}
            currency={currency}
          />
        );
      default:
        return <div className="p-6 text-slate-400">Unknown block type: {block.blockType}</div>;
    }
  };

  // If no bank connected, show connection UI
  if (!isBankConnected && bankAccounts.length === 0) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
            <div>
              <h1 className="text-4xl font-light text-white tracking-tight">
                Dashboard
              </h1>
              <p className="text-slate-400 mt-2">
                {format(new Date(), 'EEEE, MMMM d, yyyy')}
              </p>
            </div>
          </div>

          {/* Regular Dashboard Blocks */}
          <div className="grid grid-cols-12 gap-6">
            {blocks
              .filter(block => block.isVisible && block.blockType !== 'bank-balance' && block.blockType !== 'bank-transactions')
              .map((block) => (
              <DraggableBlock
                key={block.id}
                id={block.id}
                width={block.width}
                editMode={editMode}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                isDragging={draggedBlock === block.id}
              >
                {renderBlock(block)}
              </DraggableBlock>
            ))}
          </div>

          {/* Bank Connection CTA */}
          <div className="mt-8">
            <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-teal-500/30">
              <CardContent className="p-8 text-center">
                <Building2 className="h-16 w-16 text-teal-400 mx-auto mb-4" />
                <h2 className="text-2xl font-light text-white mb-2">Connect Your Bank</h2>
                <p className="text-slate-400 mb-6">Link your bank account to see your transactions and financial overview</p>
                <Button
                  onClick={handleConnectBank}
                  disabled={isBankLoading}
                  className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white shadow-lg shadow-teal-500/30"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Connect Bank Account
                </Button>
                <p className="text-xs text-slate-500 mt-4">
                  Powered by TrueLayer. Your data is secure.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-4xl font-light text-white tracking-tight">
              Dashboard
            </h1>
            <p className="text-slate-400 mt-2">
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>

          {/* Bank Controls */}
          <div className="flex items-center gap-3 mt-4 sm:mt-0">
            {bankAccounts.length > 0 && (
              <BankSelector 
                value={selectedBank} 
                onChange={handleBankChange}
                showAllOption={true}
              />
            )}
            <Button
              onClick={handleRefreshBank}
              disabled={isBankLoading}
              variant="outline"
              className="border-white/10 text-slate-300 hover:text-white hover:border-teal-500/30"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isBankLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={handleConnectBank}
              variant="outline"
              className="border-teal-600 text-teal-400 hover:bg-teal-600 hover:text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Bank
            </Button>
            <Button
              onClick={handleDisconnectBank}
              variant="destructive"
              size="icon"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Bank Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Income (Bank)</p>
                  <p className="text-xl font-semibold text-green-400">
                    {formatAmount(filteredByBankTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <TrendingDown className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Expenses (Bank)</p>
                  <p className="text-xl font-semibold text-red-400">
                    {formatAmount(filteredByBankTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Filter className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Transactions</p>
                  <p className="text-xl font-semibold text-white">{filteredByBankTransactions.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Draggable Blocks Grid */}
        <div className="grid grid-cols-12 gap-6">
          {blocks
            .filter(block => block.isVisible)
            .map((block) => (
              <DraggableBlock
                key={block.id}
                id={block.id}
                width={block.width}
                editMode={editMode}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                isDragging={draggedBlock === block.id}
              >
                {renderBlock(block)}
              </DraggableBlock>
            ))}
        </div>

        {/* Layout Edit Controls */}
        <div className="flex items-center gap-3 mt-8">
          <Button 
            variant={editMode ? "default" : "outline"}
            onClick={() => setEditMode(!editMode)}
            className={editMode 
              ? "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/30 rounded-xl px-6 border-0"
              : "glass-card border-white/10 text-slate-300 hover:text-white hover:border-teal-500/30 rounded-xl px-6"
            }
          >
            <Settings className="w-4 h-4 mr-2" />
            {editMode ? 'Done Editing' : 'Edit Layout'}
          </Button>
        </div>

        {/* Helpful Tip */}
        {editMode && (
          <div className="mt-8 glass-card p-6 rounded-2xl border border-purple-500/30 shadow-lg shadow-purple-500/10">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-purple-500/20 flex-shrink-0">
                💡
              </div>
              <div>
                <p className="text-sm font-medium text-white mb-1">Edit Mode Active</p>
                <p className="text-xs text-slate-400">
                  Drag and drop blocks to rearrange your dashboard. Your layout is automatically saved.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
