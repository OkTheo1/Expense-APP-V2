import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Building2, TrendingUp, TrendingDown, RefreshCw, Loader2, Calendar, Filter, Plus, Trash2, CheckCircle, Edit2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { 
  getBankAccounts, 
  getBankTransactions, 
  fetchBankAccounts, 
  fetchBankTransactions,
  checkBankConnection,
  disconnectBank,
  getTransactionsByCategory,
  getTopMerchants,
  getBankName,
  getAccountTypeName,
  getAccountDisplayName,
  groupAccountsByBank,
  saveAccountNameMapping,
  getAccountCustomName
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

export default function Bank() {
  const [isConnected, setIsConnected] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [editCustomName, setEditCustomName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const status = await checkBankConnection();
      setIsConnected(status.connected);
      
      if (status.connected) {
        const apiAccounts = await fetchBankAccounts();
        const apiTransactions = await fetchBankTransactions();
        
        setAccounts(apiAccounts);
        setTransactions(apiTransactions);
        
        if (apiTransactions.length > 0) {
          calculateStats(apiTransactions);
        }
      }
    } catch (error) {
      console.error('Error loading bank data:', error);
    }
  };

  const calculateStats = (txs) => {
    const categoryData = getTransactionsByCategory(txs);
    const topMerchants = getTopMerchants(5);
    
    const totalIncome = txs.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = txs.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    setStats({
      totalIncome,
      totalExpenses,
      categoryData,
      topMerchants,
      transactionCount: txs.length
    });
  };

  const handleConnectBank = async () => {
    setIsLoading(true);
    try {
      window.location.href = `${API_BASE}/auth/truelayer`;
    } catch (error) {
      console.error('Error connecting bank:', error);
      toast.error('Failed to connect bank');
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectBank();
      setIsConnected(false);
      setAccounts([]);
      setTransactions([]);
      setStats(null);
      toast.success('Bank disconnected');
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Failed to disconnect');
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const apiAccounts = await fetchBankAccounts();
      const apiTransactions = await fetchBankTransactions();
      setAccounts(apiAccounts);
      setTransactions(apiTransactions);
      calculateStats(apiTransactions);
      toast.success('Bank data refreshed');
    } catch (error) {
      console.error('Error refreshing:', error);
      toast.error('Failed to refresh bank data');
    } finally {
      setIsLoading(false);
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
    loadData();
    toast.success('Account name updated');
  };

  const handleCancelEdit = () => {
    setEditingAccountId(null);
    setEditCustomName('');
  };

  // Group accounts by bank
  const groupedAccounts = useMemo(() => {
    return groupAccountsByBank(accounts);
  }, [accounts]);

  // Get unique banks
  const banks = useMemo(() => {
    return Object.keys(groupedAccounts).sort();
  }, [groupedAccounts]);

  const availableCategories = useMemo(() => {
    const categories = new Set();
    transactions.forEach(tx => {
      categories.add(tx.category || 'Uncategorized');
    });
    return Array.from(categories).sort();
  }, [transactions]);

  // Get available accounts for filtering
  const availableAccounts = useMemo(() => {
    return accounts.map(account => ({
      id: account.account_id,
      name: getAccountCustomName(account.account_id) || getAccountDisplayName(account),
      bank: account.provider?.display_name || 'Unknown Bank'
    }));
  }, [accounts]);

  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];
    const now = new Date();
    
    switch (filter) {
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
  }, [transactions, filter, categoryFilter]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  // Get display name for a transaction's account
  const getTransactionAccountDisplay = (tx) => {
    const account = accounts.find(a => a.account_id === tx.accountId);
    if (!account) return tx.accountName || 'Unknown';
    
    const customName = getAccountCustomName(account.account_id);
    if (customName) return customName;
    
    return getAccountDisplayName(account);
  };

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
            <p className="text-slate-400 mb-6">Connect your bank account to see your transactions and statistics</p>
            <Button
              onClick={handleConnectBank}
              disabled={isLoading}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Connect Bank Account
            </Button>
            <p className="text-xs text-slate-500 mt-4">
              Powered by TrueLayer. Uses live banking data.
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
              Bank
            </h1>
            <p className="text-slate-400 mt-2">
              {accounts.length} account{accounts.length !== 1 ? 's' : ''} connected
            </p>
          </div>
          <div className="flex gap-2 mt-4 sm:mt-0">
            <Button
              onClick={handleRefresh}
              disabled={isLoading}
              variant="outline"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </>
              )}
            </Button>
            <Button
              onClick={handleConnectBank}
              variant="outline"
              className="border-teal-600 text-teal-400 hover:bg-teal-600 hover:text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Another Bank
            </Button>
            <Button
              onClick={handleDisconnect}
              variant="destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Stats Summary - At the top */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Income (Filtered)</p>
                  <p className="text-xl font-semibold text-green-400">
                    {formatAmount(filteredTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0))}
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
                  <p className="text-slate-400 text-sm">Expenses (Filtered)</p>
                  <p className="text-xl font-semibold text-red-400">
                    {formatAmount(filteredTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0))}
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
                  <p className="text-xl font-semibold text-white">{filteredTransactions.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Connected Accounts Grouped by Bank */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {banks.map(bankName => (
            <Card key={bankName} className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-white">
                  <Building2 className="h-5 w-5 text-teal-400" />
                  {bankName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {groupedAccounts[bankName].map((account, index) => (
                  <div key={index} className="bg-slate-800/50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        {editingAccountId === account.account_id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editCustomName}
                              onChange={(e) => setEditCustomName(e.target.value)}
                              placeholder="Enter custom name..."
                              className="bg-slate-700 border-slate-600 text-white text-sm h-8"
                            />
                            <Button 
                              size="sm" 
                              onClick={() => handleSaveAccountName(account.account_id)}
                              className="h-8 bg-green-600 hover:bg-green-700"
                            >
                              <Save className="h-3 w-3" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={handleCancelEdit}
                              className="h-8"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className="text-white font-medium">
                              {getAccountCustomName(account.account_id) || getAccountTypeName(account)}
                            </p>
                            <button
                              onClick={() => handleEditAccountName(account)}
                              className="text-slate-400 hover:text-white"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        <p className="text-slate-400 text-xs mt-1">
                          •••• {account.account_number?.account_particulars?.slice(-4) || account.account_id?.slice(-4) || '****'}
                        </p>
                        {account.balance && (
                          <p className="text-green-400 text-sm mt-1">
                            {formatAmount(account.balance.available || account.balance.current || 0)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bank Statistics */}
        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-white">
                  <Building2 className="h-5 w-5 text-purple-400" />
                  Bank Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/30 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Total Income</p>
                    <p className="text-green-400 font-semibold">{formatAmount(stats.totalIncome)}</p>
                  </div>
                  <div className="bg-slate-800/30 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Total Expenses</p>
                    <p className="text-red-400 font-semibold">{formatAmount(stats.totalExpenses)}</p>
                  </div>
                </div>
                <div className="bg-slate-800/30 rounded-lg p-3">
                  <p className="text-slate-400 text-xs">Transactions</p>
                  <p className="text-white font-semibold">{stats.transactionCount}</p>
                </div>
                {stats.topMerchants && stats.topMerchants.length > 0 && (
                  <div>
                    <p className="text-slate-400 text-xs mb-2">Top Merchants</p>
                    <div className="space-y-1">
                      {stats.topMerchants.map((m, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-white truncate max-w-[150px]">{m.merchant}</span>
                          <span className="text-slate-400">£{m.amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-48 bg-slate-800 border-slate-700">
                <SelectValue placeholder="Filter by time" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all" className="text-slate-200">All Time</SelectItem>
                <SelectItem value="this-month" className="text-slate-200">This Month</SelectItem>
                <SelectItem value="last-month" className="text-slate-200">Last Month</SelectItem>
                <SelectItem value="last-3-months" className="text-slate-200">Last 3 Months</SelectItem>
                <SelectItem value="this-year" className="text-slate-200">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48 bg-slate-800 border-slate-700">
                <SelectValue placeholder="Filter by category" />
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

          {(filter !== 'all' || categoryFilter !== 'all') && (
            <Button 
              variant="ghost" 
              onClick={() => { setFilter('all'); setCategoryFilter('all'); }}
              className="text-slate-400 hover:text-white"
            >
              Clear Filters
            </Button>
          )}
        </div>

        {/* Transactions Table */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full">
              <thead className="sticky top-0 bg-slate-900">
                <tr className="border-b border-slate-800">
                  <th className="text-left p-4 text-slate-400 text-sm font-medium">Date</th>
                  <th className="text-left p-4 text-slate-400 text-sm font-medium">Description</th>
                  <th className="text-left p-4 text-slate-400 text-sm font-medium">Category</th>
                  <th className="text-left p-4 text-slate-400 text-sm font-medium">Account</th>
                  <th className="text-right p-4 text-slate-400 text-sm font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length > 0 ? (
                  filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="p-4 text-white text-sm">{formatDate(tx.date)}</td>
                      <td className="p-4 text-white text-sm max-w-[200px] truncate">
                        {tx.merchant || tx.description}
                      </td>
                      <td className="p-4 text-slate-400 text-sm">
                        <span className="bg-slate-800 px-2 py-1 rounded text-xs">
                          {CATEGORY_ICONS[tx.category] || '❓'} {tx.category || 'Uncategorized'}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400 text-sm">{getTransactionAccountDisplay(tx)}</td>
                      <td className={`p-4 text-sm text-right font-medium ${
                        tx.amount < 0 ? 'text-red-400' : 'text-green-400'
                      }`}>
                        {formatAmount(tx.amount)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      No transactions found for the selected filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
