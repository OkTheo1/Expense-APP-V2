import React, { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, CreditCard, Loader2, Building2, RefreshCw } from 'lucide-react';
import { 
  getBankTransactions, 
  getTransactionsByCategory, 
  checkBankConnection,
  fetchBankTransactions,
  refreshBankConnection
} from '@/lib/bankData';

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

export default function BankTransactionsBlock({ currency = 'GBP', limit = 10, transactions: propTransactions = null }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadTransactions();
  }, [propTransactions]);

  const loadTransactions = async () => {
    setLoading(true);
    
    // Check connection status
    const status = await checkBankConnection();
    setIsConnected(status.connected);
    
    if (status.connected) {
      // Use provided transactions from props if available, otherwise fetch locally
      let localTransactions;
      if (propTransactions && propTransactions.length > 0) {
        localTransactions = propTransactions;
      } else {
        localTransactions = getBankTransactions();
      }
      // Sort by date descending
      const sorted = localTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(sorted.slice(0, limit));
    }
    
    setLoading(false);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // First try to refresh the connection (auto-reconnect if needed)
      const refreshResult = await refreshBankConnection();
      
      // If reconnect was triggered, the page will redirect, so don't continue
      if (refreshResult.reconnected) {
        setIsRefreshing(false);
        return;
      }
      
      // Otherwise fetch fresh data
      const fetchedTransactions = await fetchBankTransactions();
      
      // Sort by date descending
      const sorted = fetchedTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(sorted.slice(0, limit));
    } catch (error) {
      console.error('Error refreshing transactions:', error);
    }
    setIsRefreshing(false);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  const formatCurrency = (amount) => {
    const formatted = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency
    }).format(Math.abs(amount));
    return amount < 0 ? `-${formatted}` : `+${formatted}`;
  };

  if (loading) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <div className="animate-pulse flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 text-teal-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-white font-medium">Bank Transactions</h3>
            <p className="text-slate-400 text-sm">Connect your bank to see transactions</p>
          </div>
        </div>
        <div className="text-center py-4">
          <p className="text-slate-500 text-sm">Go to Settings to connect your bank</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-white font-medium">Bank Transactions</h3>
            <p className="text-slate-400 text-sm">Latest from your bank</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          title={isRefreshing ? "Refreshing..." : "Refresh (will auto-reconnect if needed)"}
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </button>
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-slate-500">No transactions yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx) => (
            <div 
              key={tx.id} 
              className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm ${
                  tx.amount >= 0 
                    ? 'bg-green-500/10 text-green-400' 
                    : 'bg-red-500/10 text-red-400'
                }`}>
                  {tx.amount >= 0 ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <p className="text-white text-sm font-medium truncate max-w-[180px]">
                    {tx.merchant || tx.description}
                  </p>
                  <p className="text-slate-500 text-xs">
                    {CATEGORY_ICONS[tx.category] || '❓'} {tx.category} • {formatDate(tx.date)}
                  </p>
                </div>
              </div>
              <p className={`text-sm font-medium ${
                tx.amount >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {formatCurrency(tx.amount)}
              </p>
            </div>
          ))}
        </div>
      )}

      {transactions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-800">
          <p className="text-center text-slate-500 text-xs">
            Showing {transactions.length} most recent transactions
          </p>
        </div>
      )}
    </div>
  );
}
