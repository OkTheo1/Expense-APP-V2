import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Building2, RefreshCw, Loader2, Plus, Trash2, Edit2, Save, X, AlertTriangle } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  getBankAccounts, 
  getBankTransactions, 
  fetchBankAccounts, 
  fetchBankTransactions,
  checkBankConnection,
  disconnectBank,
  getBankName,
  getAccountTypeName,
  getAccountDisplayName,
  groupAccountsByBank,
  saveAccountNameMapping,
  getAccountCustomName,
  refreshBankConnection,
  removeBank
} from '@/lib/bankData';

const API_BASE = 'http://localhost:3001';

export default function Bank() {
  const [isConnected, setIsConnected] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [editCustomName, setEditCustomName] = useState('');
  const [bankToRemove, setBankToRemove] = useState(null);
  const [scaExpired, setScaExpired] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const status = await checkBankConnection();
      setIsConnected(status.connected);
      
      if (status.connected) {
        const apiAccounts = await fetchBankAccounts();
        setAccounts(apiAccounts);

        // Check if SCA has expired by calling transactions endpoint
        try {
          const txRes = await fetch(`${API_BASE}/api/transactions`);
          const txData = await txRes.json();
          if (txData.scaExpired) {
            setScaExpired(true);
          }
        } catch (e) {
          // ignore
        }
      }
    } catch (error) {
      console.error('Error loading bank data:', error);
    }
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
      toast.success('Bank disconnected');
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Failed to disconnect');
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      // First try to refresh the connection (auto-reconnect if needed)
      const refreshResult = await refreshBankConnection();
      
      // If reconnect was triggered, the page will redirect, so don't continue
      if (refreshResult.reconnected) {
        setIsLoading(false);
        return;
      }
      
      // Otherwise fetch fresh data
      const apiAccounts = await fetchBankAccounts();
      await fetchBankTransactions();
      setAccounts(apiAccounts);
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

  const handleRemoveBank = async () => {
    if (!bankToRemove) return;
    
    try {
      const success = await removeBank(bankToRemove);
      if (success) {
        toast.success(`${bankToRemove} removed successfully`);
        // Reload accounts from storage
        const updatedAccounts = getBankAccounts();
        setAccounts(updatedAccounts);
        
        // If no more accounts, show connect screen
        if (updatedAccounts.length === 0) {
          setIsConnected(false);
        }
      } else {
        toast.error('Failed to remove bank');
      }
    } catch (error) {
      console.error('Error removing bank:', error);
      toast.error('Failed to remove bank');
    } finally {
      setBankToRemove(null);
    }
  };

  // Group accounts by bank
  const groupedAccounts = useMemo(() => {
    return groupAccountsByBank(accounts);
  }, [accounts]);

  // Get unique banks
  const banks = useMemo(() => {
    return Object.keys(groupedAccounts).sort();
  }, [groupedAccounts]);

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
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
              variant="outline"
              className="glass-card border-white/10 text-slate-300 hover:text-white hover:border-teal-500/30 rounded-xl"
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

        {/* Credit Card Support Note */}
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
          <span className="text-blue-400 text-sm shrink-0 mt-0.5">ℹ️</span>
          <p className="text-slate-400 text-xs leading-relaxed">
            <span className="text-slate-300 font-medium">Credit card support is limited.</span>{' '}
            TrueLayer supports some cards (Barclaycard, Amex UK, Capital One, MBNA) via Open Banking, but most credit cards are not available.
            For unsupported cards, use{' '}
            <a href="/Settings" className="text-teal-400 hover:text-teal-300 underline">CSV Import</a>{' '}
            in Settings to import your statement manually.
          </p>
        </div>

        {/* SCA Expired Banner */}
        {scaExpired && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-amber-300 font-medium">Re-authentication required</p>
              <p className="text-amber-400/80 text-sm mt-1">
                Your bank session has expired (SCA). Transaction data cannot be fetched until you reconnect.
              </p>
            </div>
            <Button
              onClick={handleConnectBank}
              className="bg-amber-500 hover:bg-amber-600 text-black shrink-0"
              size="sm"
            >
              Reconnect Bank
            </Button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-4xl font-light text-white tracking-tight">
              Banks
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
              title={isLoading ? "Refreshing..." : "Refresh (will auto-reconnect if needed)"}
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

        {/* Connected Accounts Grouped by Bank */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {banks.map(bankName => (
            <div key={bankName} className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 flex items-center justify-center border border-teal-500/20">
                    <Building2 className="h-5 w-5 text-teal-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">{bankName}</p>
                    <p className="text-xs text-slate-500">{groupedAccounts[bankName].length} account{groupedAccounts[bankName].length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBankToRemove(bankName)}
                  className="text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl"
                  title="Remove bank"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-4 space-y-3">
                {groupedAccounts[bankName].map((account, index) => (
                  <div key={index} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
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
                              className="h-8 bg-emerald-600 hover:bg-emerald-700"
                            >
                              <Save className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleCancelEdit}
                              className="h-8 text-slate-400"
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
                              className="text-slate-500 hover:text-teal-400 transition-colors"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        <p className="text-slate-500 text-xs mt-1">
                          •••• {account.account_number?.account_particulars?.slice(-4) || account.account_id?.slice(-4) || '****'}
                        </p>
                      </div>
                      {account.balance && (
                        <div className="text-right">
                          <p className={`text-lg font-semibold ${(account.balance.current ?? account.balance.available ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatAmount(account.balance.current ?? account.balance.available ?? 0)}
                          </p>
                          {account.balance.available !== undefined && account.balance.available !== account.balance.current && (
                            <p className="text-xs text-slate-500">{formatAmount(account.balance.available)} available</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 flex items-center justify-center border border-teal-500/20">
                <Building2 className="h-5 w-5 text-teal-400" />
              </div>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">Connected Banks</p>
            </div>
            <p className="text-3xl font-bold text-white">{banks.length}</p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center border border-blue-500/20">
                <Building2 className="h-5 w-5 text-blue-400" />
              </div>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">Total Accounts</p>
            </div>
            <p className="text-3xl font-bold text-white">{accounts.length}</p>
          </div>
          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 rounded-2xl p-5">
            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full blur-2xl opacity-20 bg-emerald-400" />
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/20">
                <RefreshCw className="h-5 w-5 text-emerald-400" />
              </div>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">Total Balance</p>
            </div>
            <p className="text-3xl font-bold text-emerald-400">
              {formatAmount(accounts.reduce((sum, acc) => sum + (acc.balance?.available || acc.balance?.current || 0), 0))}
            </p>
          </div>
        </div>
      </div>

      {/* Remove Bank Confirmation Dialog */}
      <AlertDialog open={!!bankToRemove} onOpenChange={() => setBankToRemove(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Remove Bank</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Are you sure you want to remove {bankToRemove}? This will remove all accounts from this bank. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 text-white hover:bg-slate-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRemoveBank}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Remove Bank
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
