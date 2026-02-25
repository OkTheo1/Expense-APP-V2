// Bank Data Service - handles TrueLayer integration and transaction management
import { getFromStorage, saveToStorage } from './localDatabase';

const STORAGE_KEYS = {
  BANK_ACCOUNTS: 'expense_app_bank_accounts',
  BANK_TRANSACTIONS: 'expense_app_bank_transactions',
  BANK_CATEGORIES: 'expense_app_bank_categories',
  BANK_ACCOUNT_MAPPINGS: 'expense_app_bank_account_mappings'
};

const API_BASE = 'http://localhost:3001';

// Map of provider IDs to bank names
const PROVIDER_NAME_MAP = {
  'ob-monzo': 'Monzo',
  'monzo': 'Monzo',
  'ob-barclays': 'Barclays',
  'barclays': 'Barclays',
  'ob-barclaycard': 'Barclaycard',
  'barclaycard': 'Barclaycard',
  'ob-hsbc': 'HSBC',
  'hsbc': 'HSBC',
  'ob-lloyds': 'Lloyds',
  'lloyds': 'Lloyds',
  'ob-natwest': 'NatWest',
  'natwest': 'NatWest',
  'ob-santander': 'Santander',
  'santander': 'Santander',
  'ob-tsb': 'TSB',
  'tsb': 'TSB',
  'ob-co-op': 'Co-operative Bank',
  'co_op': 'Co-operative Bank',
  'ob-nationwide': 'Nationwide',
  'nationwide': 'Nationwide',
  'ob-halifax': 'Halifax',
  'halifax': 'Halifax',
  'ob-m&s': 'M&S Bank',
  'm&s': 'M&S Bank',
  'ob-first-direct': 'First Direct',
  'first_direct': 'First Direct',
  'ob-virgin-money': 'Virgin Money',
  'virgin_money': 'Virgin Money',
  'ob-standard-chartered': 'Standard Chartered',
  'standard_chartered': 'Standard Chartered'
};

// Default account type mappings
const DEFAULT_ACCOUNT_TYPE_NAMES = {
  'transaction': 'Current Account',
  'current_account': 'Current Account',
  'savings_account': 'Savings Account',
  'credit_card': 'Credit Card',
  'mortgage': 'Mortgage',
  'loan': 'Loan'
};

// Default category rules for auto-categorization
const DEFAULT_CATEGORY_RULES = {
  'Salary': ['salary', 'wages', 'payroll', 'monthly salary', 'net pay'],
  'Food & Dining': ['tesco', 'sainsbury', 'asda', 'morrisons', 'ocado', 'waitrose', 'marks & spencer', 'm&s', 'cafe', 'coffee', 'restaurant', 'pizza', 'burger', 'mcdonald', 'kfc', 'subway', 'deliveroo', 'uber eats', 'just eat', 'takeaway', 'food', 'grocery', 'supermarket'],
  'Transportation': ['uber', 'lyft', 'taxi', 'train', 'rail', 'bus', 'tube', 'metro', 'petrol', 'fuel', 'shell', 'bp', 'esso', 'parking', 'car park', 'dvla', 'vehicle', 'car'],
  'Housing': ['rent', 'mortgage', 'council tax', 'water', 'electricity', 'gas', 'energy', 'broadband', 'internet', 'tv', 'netflix', 'spotify'],
  'Shopping': ['amazon', 'ebay', 'argos', 'currys', 'john lewis', 'next', 'zara', 'h&m', 'primark', 'tk maxx', 'home bargains', 'poundland', 'ikea'],
  'Entertainment': ['cinema', 'theatre', 'concert', 'ticket', 'game', 'steam', 'playstation', 'xbox', 'subscription', 'netflix', 'disney', 'spotify', 'apple music'],
  'Health & Fitness': ['gym', 'fitness', 'pharmacy', 'chemist', 'doctor', 'dentist', 'hospital', 'medical', 'health', 'boots'],
  'Insurance': ['insurance', 'aviva', 'direct line', 'churchill', 'axiom', 'legal & general'],
  'Subscriptions': ['subscription', 'membership', 'monthly', 'annual', 'premium'],
  'Transfer': ['transfer', 'payment sent', 'payment received', 'bank transfer', 'faster payment'],
  'Cash': ['cash', 'atm', 'withdrawal', 'cashback']
};

// Get bank accounts
export const getBankAccounts = () => {
  return getFromStorage(STORAGE_KEYS.BANK_ACCOUNTS, []);
};

// Get bank transactions
export const getBankTransactions = () => {
  return getFromStorage(STORAGE_KEYS.BANK_TRANSACTIONS, []);
};

// Get category rules
export const getCategoryRules = () => {
  return getFromStorage(STORAGE_KEYS.BANK_CATEGORIES, DEFAULT_CATEGORY_RULES);
};

// Save category rules
export const saveCategoryRules = (rules) => {
  saveToStorage(STORAGE_KEYS.BANK_CATEGORIES, rules);
};

// Auto-categorize a transaction based on description
export const categorizeTransaction = (description, rules = null) => {
  const categoryRules = rules || getCategoryRules();
  const lowerDescription = description.toLowerCase();
  
  for (const [category, keywords] of Object.entries(categoryRules)) {
    for (const keyword of keywords) {
      if (lowerDescription.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }
  
  return 'Uncategorized';
};

// Fetch accounts from TrueLayer
export const fetchBankAccounts = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/accounts`);
    const data = await response.json();
    
    if (data.accounts) {
      saveToStorage(STORAGE_KEYS.BANK_ACCOUNTS, data.accounts);
      return data.accounts;
    }
    return [];
  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    return [];
  }
};

// Fetch transactions from TrueLayer
export const fetchBankTransactions = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/transactions`);
    const data = await response.json();
    
    if (data.transactions) {
      const rules = getCategoryRules();
      const categorizedTransactions = data.transactions.map(tx => ({
        ...tx,
        category: categorizeTransaction(tx.description || tx.merchant || '', rules),
        importedAt: new Date().toISOString()
      }));
      
      saveToStorage(STORAGE_KEYS.BANK_TRANSACTIONS, categorizedTransactions);
      return categorizedTransactions;
    }
    return [];
  } catch (error) {
    console.error('Error fetching bank transactions:', error);
    return [];
  }
};

// Get total balance from all accounts (includes overdraft)
export const getTotalBankBalance = () => {
  const accounts = getBankAccounts();
  return accounts.reduce((total, account) => {
    const available = account.balance?.available || account.balance?.current || 0;
    const overdraft = account.balance?.overdraft || 0;
    return total + available + overdraft;
  }, 0);
};

// Get transactions by category
export const getTransactionsByCategory = (transactions = null) => {
  const txs = transactions || getBankTransactions();
  return txs.reduce((acc, tx) => {
    const category = tx.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = { total: 0, transactions: [] };
    }
    acc[category].total += Math.abs(tx.amount);
    acc[category].transactions.push(tx);
    return acc;
  }, {});
};

// Get monthly spending trends
export const getMonthlyTrends = (months = 6) => {
  const transactions = getBankTransactions();
  const monthlyData = {};
  
  transactions.forEach(tx => {
    const date = new Date(tx.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { income: 0, expenses: 0 };
    }
    
    if (tx.amount > 0) {
      monthlyData[monthKey].income += tx.amount;
    } else {
      monthlyData[monthKey].expenses += Math.abs(tx.amount);
    }
  });
  
  const sortedMonths = Object.keys(monthlyData).sort().slice(-months);
  return sortedMonths.map(month => ({
    month,
    ...monthlyData[month]
  }));
};

// Get spending by merchant
export const getTopMerchants = (limit = 10) => {
  const transactions = getBankTransactions();
  const merchantSpending = {};
  
  transactions
    .filter(tx => tx.amount < 0)
    .forEach(tx => {
      const merchant = tx.merchant || tx.description || 'Unknown';
      if (!merchantSpending[merchant]) {
        merchantSpending[merchant] = 0;
      }
      merchantSpending[merchant] += Math.abs(tx.amount);
    });
  
  return Object.entries(merchantSpending)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([merchant, amount]) => ({ merchant, amount }));
};

// Clear all bank data
export const clearBankData = () => {
  localStorage.removeItem(STORAGE_KEYS.BANK_ACCOUNTS);
  localStorage.removeItem(STORAGE_KEYS.BANK_TRANSACTIONS);
};

// Connect to a new bank (starts OAuth flow)
export const connectBank = () => {
  window.location.href = `${API_BASE}/auth/truelayer`;
};

// Disconnect bank
export const disconnectBank = async () => {
  try {
    await fetch(`${API_BASE}/auth/truelayer/disconnect`, { method: 'POST' });
    clearBankData();
    return true;
  } catch (error) {
    console.error('Error disconnecting bank:', error);
    return false;
  }
};

// Check connection status
export const checkBankConnection = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/connection-status`);
    return await response.json();
  } catch (error) {
    console.error('Error checking connection status:', error);
    return { connected: false };
  }
};

// Refresh bank connection (auto-reconnect if needed)
export const refreshBankConnection = async () => {
  try {
    // First try to refresh the token
    const refreshResponse = await fetch(`${API_BASE}/auth/truelayer/refresh`, { method: 'POST' });
    const refreshData = await refreshResponse.json();
    
    if (refreshData.success) {
      return { success: true, reconnected: false };
    }
    
    // If refresh failed, need to reconnect
    console.log('Token refresh failed, initiating auto-reconnect...');
    window.location.href = `${API_BASE}/auth/truelayer`;
    return { success: false, reconnected: true };
  } catch (error) {
    console.error('Error refreshing connection, auto-reconnecting...', error);
    // Auto-reconnect by redirecting to OAuth
    window.location.href = `${API_BASE}/auth/truelayer`;
    return { success: false, reconnected: true };
  }
};

// Get bank name from account
export const getBankName = (account) => {
  // Handle nested provider structure from TrueLayer API
  const providerId = account.provider?.provider_id || account.provider_id || account.provider || '';
  const providerName = account.provider?.display_name || account.provider_name || '';
  
  const lowerProviderId = providerId.toLowerCase();
  if (PROVIDER_NAME_MAP[lowerProviderId]) {
    return PROVIDER_NAME_MAP[lowerProviderId];
  }
  
  const displayName = (account.display_name || '').toLowerCase();
  for (const [key, name] of Object.entries(PROVIDER_NAME_MAP)) {
    if (displayName.includes(key) || providerName.toLowerCase().includes(key)) {
      return name;
    }
  }
  
  // Fallback to provider display name
  if (providerName) {
    return providerName;
  }
  
  return 'Unknown Bank';
};

// Get account type/subtype display name
export const getAccountTypeName = (account) => {
  const accountType = (account.account_type || account.type || '').toLowerCase();
  const accountSubtype = (account.account_subtype || account.subtype || '').toLowerCase();
  
  // Check subtype first
  if (accountSubtype) {
    // Capitalize first letter
    return accountSubtype.charAt(0).toUpperCase() + accountSubtype.slice(1).replace(/_/g, ' ');
  }
  
  // Check default type mappings
  if (DEFAULT_ACCOUNT_TYPE_NAMES[accountType]) {
    return DEFAULT_ACCOUNT_TYPE_NAMES[accountType];
  }
  
  // Capitalize type
  if (accountType) {
    return accountType.charAt(0).toUpperCase() + accountType.slice(1).replace(/_/g, ' ');
  }
  
  return 'Account';
};

// Get account display name with bank and type
export const getAccountDisplayName = (account) => {
  const bankName = getBankName(account);
  const accountType = getAccountTypeName(account);
  return `${bankName} - ${accountType}`;
};

// Group accounts by bank
export const groupAccountsByBank = (accounts) => {
  const grouped = {};
  
  accounts.forEach(account => {
    const bankName = getBankName(account);
    if (!grouped[bankName]) {
      grouped[bankName] = [];
    }
    grouped[bankName].push({
      ...account,
      bankName,
      accountTypeName: getAccountTypeName(account),
      displayName: getAccountDisplayName(account)
    });
  });
  
  return grouped;
};

// Save account name mapping (for custom names)
export const saveAccountNameMapping = (accountId, customName) => {
  const mappings = getFromStorage(STORAGE_KEYS.BANK_ACCOUNT_MAPPINGS, {});
  mappings[accountId] = customName;
  saveToStorage(STORAGE_KEYS.BANK_ACCOUNT_MAPPINGS, mappings);
};

// Get custom account name
export const getAccountCustomName = (accountId) => {
  const mappings = getFromStorage(STORAGE_KEYS.BANK_ACCOUNT_MAPPINGS, {});
  return mappings[accountId] || null;
};

// Filter transactions by selected bank/account
export const filterByBank = (transactions, selectedValue, accounts) => {
  if (!selectedValue || selectedValue === 'all') {
    return transactions;
  }

  const accountIdsToInclude = new Set();

  if (selectedValue.startsWith('bank:')) {
    const bankName = selectedValue.replace('bank:', '');
    accounts.forEach(account => {
      if (getBankName(account) === bankName) {
        accountIdsToInclude.add(account.account_id);
      }
    });
  } else {
    accountIdsToInclude.add(selectedValue);
  }

  return transactions.filter(tx => 
    tx.accountId && accountIdsToInclude.has(tx.accountId)
  );
};

// Filter accounts by selected bank/account
export const filterAccountsByBank = (accounts, selectedValue) => {
  if (!selectedValue || selectedValue === 'all') {
    return accounts;
  }

  if (selectedValue.startsWith('bank:')) {
    const bankName = selectedValue.replace('bank:', '');
    return accounts.filter(account => getBankName(account) === bankName);
  } else {
    return accounts.filter(account => account.account_id === selectedValue);
  }
};

// Get total balance from filtered accounts (includes overdraft)
export const getFilteredBankBalance = (accounts) => {
  return accounts.reduce((total, account) => {
    const available = account.balance?.available || account.balance?.current || 0;
    const overdraft = account.balance?.overdraft || 0;
    return total + available + overdraft;
  }, 0);
};

// Remove a specific bank (all accounts from that bank)
export const removeBank = async (bankName) => {
  try {
    // Get current accounts from storage
    const currentAccounts = getBankAccounts();
    
    // Filter out accounts from the specified bank
    const remainingAccounts = currentAccounts.filter(account => {
      const accountBankName = getBankName(account);
      return accountBankName !== bankName;
    });
    
    // Save the filtered accounts back to storage
    saveToStorage(STORAGE_KEYS.BANK_ACCOUNTS, remainingAccounts);
    
    // Also remove transactions for accounts that were removed
    const currentTransactions = getBankTransactions();
    const removedAccountIds = currentAccounts
      .filter(account => getBankName(account) === bankName)
      .map(account => account.account_id);
    
    const remainingTransactions = currentTransactions.filter(tx => 
      !removedAccountIds.includes(tx.accountId)
    );
    
    saveToStorage(STORAGE_KEYS.BANK_TRANSACTIONS, remainingTransactions);
    
    // Also clean up any account name mappings for removed accounts
    const mappings = getFromStorage(STORAGE_KEYS.BANK_ACCOUNT_MAPPINGS, {});
    const newMappings = { ...mappings };
    removedAccountIds.forEach(accountId => {
      delete newMappings[accountId];
    });
    saveToStorage(STORAGE_KEYS.BANK_ACCOUNT_MAPPINGS, newMappings);
    
    return true;
  } catch (error) {
    console.error('Error removing bank:', error);
    return false;
  }
};
