import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, CreditCard, PiggyBank, Wallet, ChevronDown } from 'lucide-react';
import { getBankAccounts, getBankName, getAccountTypeName, getAccountCustomName } from '@/lib/bankData';

// Account type icons
const ACCOUNT_ICONS = {
  'current account': <Wallet className="h-4 w-4" />,
  'current': <Wallet className="h-4 w-4" />,
  'savings account': <PiggyBank className="h-4 w-4" />,
  'savings': <PiggyBank className="h-4 w-4" />,
  'credit card': <CreditCard className="h-4 w-4" />,
  'credit_card': <CreditCard className="h-4 w-4" />,
  'default': <Building2 className="h-4 w-4" />
};

const getAccountIcon = (accountType) => {
  const type = (accountType || '').toLowerCase();
  return ACCOUNT_ICONS[type] || ACCOUNT_ICONS.default;
};

export default function BankSelector({ 
  value = 'all', 
  onChange, 
  showAllOption = true,
  className = '',
  label = 'Filter by Bank'
}) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = () => {
    try {
      const bankAccounts = getBankAccounts();
      setAccounts(bankAccounts);
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group accounts by bank
  const groupedAccounts = accounts.reduce((acc, account) => {
    const bankName = getBankName(account);
    if (!acc[bankName]) {
      acc[bankName] = [];
    }
    acc[bankName].push(account);
    return acc;
  }, {});

  const banks = Object.keys(groupedAccounts).sort();

  const formatValue = (val) => {
    if (val === 'all') return 'all';
    // Check if it's a bank-level filter
    if (val.startsWith('bank:')) {
      return val;
    }
    // It's a specific account
    return `account:${val}`;
  };

  const handleValueChange = (newValue) => {
    if (onChange) {
      onChange(newValue);
    }
  };

  if (loading) {
    return (
      <div className={`animate-pulse h-10 bg-slate-800 rounded-lg ${className}`} />
    );
  }

  if (accounts.length === 0) {
    return null; // Don't show selector if no accounts connected
  }

  return (
    <div className={className}>
      <Select value={value} onValueChange={handleValueChange}>
        <SelectTrigger className="w-full sm:w-64 bg-slate-800 border-slate-700 text-white">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent className="bg-slate-800 border-slate-700">
          {showAllOption && (
            <SelectItem value="all" className="text-white">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-400" />
                <span>All Banks</span>
              </div>
            </SelectItem>
          )}
          
          {/* Individual banks */}
          {banks.map((bankName) => (
            <React.Fragment key={bankName}>
              {/* Bank header */}
              <SelectItem 
                value={`bank:${bankName}`} 
                className="text-white font-medium"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-teal-400" />
                  <span>{bankName}</span>
                  <span className="text-xs text-slate-400 ml-auto">
                    ({groupedAccounts[bankName].length})
                  </span>
                </div>
              </SelectItem>
              
              {/* Individual accounts under each bank */}
              {groupedAccounts[bankName].map((account) => {
                const accountId = account.account_id;
                const customName = getAccountCustomName(accountId);
                const accountType = getAccountTypeName(account);
                const displayName = customName || accountType;
                
                return (
                  <SelectItem 
                    key={accountId} 
                    value={accountId}
                    className="text-slate-300 pl-6"
                  >
                    <div className="flex items-center gap-2">
                      {getAccountIcon(accountType)}
                      <span className="truncate max-w-[150px]">
                        {displayName}
                      </span>
                      {account.balance && (
                        <span className="text-xs text-slate-500 ml-auto">
                          £{(account.balance.available || account.balance.current || 0).toFixed(0)}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                );
              })}
            </React.Fragment>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// Helper function to filter transactions by selected bank/account
export function filterByBank(transactions, selectedValue, accounts) {
  if (!selectedValue || selectedValue === 'all') {
    return transactions;
  }

  // Get all account IDs to include
  const accountIdsToInclude = new Set();

  if (selectedValue.startsWith('bank:')) {
    // Include all accounts from this bank
    const bankName = selectedValue.replace('bank:', '');
    accounts.forEach(account => {
      if (getBankName(account) === bankName) {
        accountIdsToInclude.add(account.account_id);
      }
    });
  } else {
    // Include only this specific account
    accountIdsToInclude.add(selectedValue);
  }

  return transactions.filter(tx => 
    tx.accountId && accountIdsToInclude.has(tx.accountId)
  );
}

// Get selected bank/account info
export function getSelectedBankInfo(selectedValue, accounts) {
  if (!selectedValue || selectedValue === 'all') {
    return { type: 'all', name: 'All Banks' };
  }

  if (selectedValue.startsWith('bank:')) {
    const bankName = selectedValue.replace('bank:', '');
    return { type: 'bank', name: bankName };
  }

  // Specific account
  const account = accounts.find(a => a.account_id === selectedValue);
  if (account) {
    return { 
      type: 'account', 
      name: getAccountCustomName(account.account_id) || getAccountTypeName(account),
      bank: getBankName(account)
    };
  }

  return { type: 'all', name: 'All Banks' };
}
