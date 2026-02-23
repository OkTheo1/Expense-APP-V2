import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Building2, RefreshCw, Loader2, Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { toast } from 'sonner';
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
  getAccountCustomName
} from '@/lib/bankData';

const API_BASE = 'http://localhost:3001';

export default function Bank() {
  const [isConnected, setIsConnected] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
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
        setAccounts(apiAccounts);
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

        {/* Quick Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6 text-center">
              <p className="text-slate-400 text-sm">Connected Banks</p>
              <p className="text-3xl font-semibold text-white mt-1">{banks.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6 text-center">
              <p className="text-slate-400 text-sm">Total Accounts</p>
              <p className="text-3xl font-semibold text-white mt-1">{accounts.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6 text-center">
              <p className="text-slate-400 text-sm">Total Balance</p>
              <p className="text-3xl font-semibold text-green-400 mt-1">
                {formatAmount(accounts.reduce((sum, acc) => sum + (acc.balance?.available || acc.balance?.current || 0), 0))}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
