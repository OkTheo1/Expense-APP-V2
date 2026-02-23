import React, { useState, useEffect } from 'react';
import { Banknote, TrendingUp, TrendingDown, RefreshCw, Building2, Loader2 } from 'lucide-react';
import { 
  getBankAccounts, 
  getBankTransactions, 
  fetchBankAccounts, 
  fetchBankTransactions,
  getTotalBankBalance,
  getTransactionsByCategory,
  checkBankConnection
} from '@/lib/bankData';

export default function BankBalanceBlock({ currency = 'GBP', accounts: propAccounts = null, balance: propBalance = null }) {
  const [accounts, setAccounts] = useState([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // If accounts are passed via props, use them directly
    if (propAccounts !== null) {
      setAccounts(propAccounts);
      setBalance(propBalance !== null ? propBalance : 0);
      checkConnectionStatus();
    } else {
      loadBankData();
    }
  }, [propAccounts, propBalance]);

  const checkConnectionStatus = async () => {
    const status = await checkBankConnection();
    setIsConnected(status.connected);
    setLoading(false);
  };

  const loadBankData = async () => {
    setLoading(true);
    
    // Check connection status
    const status = await checkBankConnection();
    setIsConnected(status.connected);
    
    if (status.connected) {
      // Load from local storage first
      const localAccounts = getBankAccounts();
      const localBalance = getTotalBankBalance();
      
      if (localAccounts.length > 0) {
        setAccounts(localAccounts);
        setBalance(localBalance);
      }
      
      // Then fetch fresh data
      try {
        const [fetchedAccounts, fetchedTransactions] = await Promise.all([
          fetchBankAccounts(),
          fetchBankTransactions()
        ]);
        
        if (fetchedAccounts.length > 0) {
          setAccounts(fetchedAccounts);
          setBalance(getTotalBankBalance());
        }
      } catch (error) {
        console.error('Error fetching bank data:', error);
      }
    }
    
    setLoading(false);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const [fetchedAccounts, fetchedTransactions] = await Promise.all([
        fetchBankAccounts(),
        fetchBankTransactions()
      ]);
      
      if (fetchedAccounts.length > 0) {
        setAccounts(fetchedAccounts);
        setBalance(getTotalBankBalance());
      }
    } catch (error) {
      console.error('Error refreshing bank data:', error);
    }
    setIsRefreshing(false);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <div className="animate-pulse flex items-center justify-center h-32">
          <Loader2 className="h-8 w-8 text-teal-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-teal-400" />
          </div>
          <div>
            <h3 className="text-white font-medium">Bank Balance</h3>
            <p className="text-slate-400 text-sm">Connect your bank to see balance</p>
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 flex items-center justify-center">
            <Banknote className="h-5 w-5 text-teal-400" />
          </div>
          <div>
            <h3 className="text-white font-medium">Bank Balance</h3>
            <p className="text-slate-400 text-sm">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="mb-6">
        <p className="text-slate-400 text-sm mb-1">Total Balance</p>
        <p className="text-3xl font-semibold text-white">{formatCurrency(balance)}</p>
      </div>

      <div className="space-y-3">
        {accounts.map((account, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-white text-sm font-medium">{account.display_name}</p>
                <p className="text-slate-500 text-xs">
                  •••• {account.account_number?.account_particulars?.slice(-4) || '****'}
                </p>
              </div>
            </div>
            <p className="text-white font-medium">
              {formatCurrency(account.balance?.available || account.balance?.current || 0)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
