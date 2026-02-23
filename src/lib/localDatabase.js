// Local Storage Database for Expense App
// Uses browser's localStorage to persist data

const STORAGE_KEYS = {
  EXPENSES: 'expense_app_expenses',
  BUDGETS: 'expense_app_budgets',
  PROFILE: 'expense_app_profile',
  RECURRING: 'expense_app_recurring',
  DASHBOARD_BLOCKS: 'expense_app_dashboard_blocks',
  GOALS: 'expense_app_goals',
  DEBTS: 'expense_app_debts',
  NET_WORTH: 'expense_app_net_worth'
};

// Helper to get data from localStorage
export const getFromStorage = (key, defaultValue = []) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (error) {
    console.error(`Error reading ${key} from localStorage:`, error);
    return defaultValue;
  }
};

// Helper to save data to localStorage
export const saveToStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(`Error saving ${key} to localStorage:`, error);
    return false;
  }
};

// Generate unique ID
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// ============ EXPENSES ============
export const getExpenses = () => {
  return getFromStorage(STORAGE_KEYS.EXPENSES, []);
};

export const getExpenseById = (id) => {
  const expenses = getExpenses();
  return expenses.find(e => e.id === id);
};

export const createExpense = (expense) => {
  const expenses = getExpenses();
  const newExpense = {
    ...expense,
    id: generateId(),
    createdAt: new Date().toISOString()
  };
  expenses.push(newExpense);
  saveToStorage(STORAGE_KEYS.EXPENSES, expenses);
  return newExpense;
};

export const updateExpense = (id, updates) => {
  const expenses = getExpenses();
  const index = expenses.findIndex(e => e.id === id);
  if (index !== -1) {
    expenses[index] = { ...expenses[index], ...updates, updatedAt: new Date().toISOString() };
    saveToStorage(STORAGE_KEYS.EXPENSES, expenses);
    return expenses[index];
  }
  return null;
};

export const deleteExpense = (id) => {
  const expenses = getExpenses();
  const filtered = expenses.filter(e => e.id !== id);
  saveToStorage(STORAGE_KEYS.EXPENSES, filtered);
  return true;
};

// ============ BUDGETS ============
export const getBudgets = () => {
  return getFromStorage(STORAGE_KEYS.BUDGETS, []);
};

export const createBudget = (budget) => {
  const budgets = getBudgets();
  const newBudget = {
    ...budget,
    id: generateId(),
    createdAt: new Date().toISOString()
  };
  budgets.push(newBudget);
  saveToStorage(STORAGE_KEYS.BUDGETS, budgets);
  return newBudget;
};

export const updateBudget = (id, updates) => {
  const budgets = getBudgets();
  const index = budgets.findIndex(b => b.id === id);
  if (index !== -1) {
    budgets[index] = { ...budgets[index], ...updates };
    saveToStorage(STORAGE_KEYS.BUDGETS, budgets);
    return budgets[index];
  }
  return null;
};

export const deleteBudget = (id) => {
  const budgets = getBudgets();
  const filtered = budgets.filter(b => b.id !== id);
  saveToStorage(STORAGE_KEYS.BUDGETS, filtered);
  return true;
};

// ============ PROFILE ============
export const getProfile = () => {
  return getFromStorage(STORAGE_KEYS.PROFILE, null);
};

export const saveProfile = (profile) => {
  const newProfile = {
    ...profile,
    id: profile.id || generateId(),
    updatedAt: new Date().toISOString()
  };
  saveToStorage(STORAGE_KEYS.PROFILE, newProfile);
  return newProfile;
};

// ============ RECURRING TRANSACTIONS ============
export const getRecurringTransactions = () => {
  return getFromStorage(STORAGE_KEYS.RECURRING, []);
};

export const createRecurringTransaction = (recurring) => {
  const recurs = getRecurringTransactions();
  const newRecurring = {
    ...recurring,
    id: generateId(),
    createdAt: new Date().toISOString()
  };
  recurs.push(newRecurring);
  saveToStorage(STORAGE_KEYS.RECURRING, recurs);
  return newRecurring;
};

export const updateRecurringTransaction = (id, updates) => {
  const recurs = getRecurringTransactions();
  const index = recurs.findIndex(r => r.id === id);
  if (index !== -1) {
    recurs[index] = { ...recurs[index], ...updates };
    saveToStorage(STORAGE_KEYS.RECURRING, recurs);
    return recurs[index];
  }
  return null;
};

export const deleteRecurringTransaction = (id) => {
  const recurs = getRecurringTransactions();
  const filtered = recurs.filter(r => r.id !== id);
  saveToStorage(STORAGE_KEYS.RECURRING, filtered);
  return true;
};

// ============ GOALS ============
export const getGoals = () => {
  return getFromStorage(STORAGE_KEYS.GOALS, []);
};

export const createGoal = (goal) => {
  const goals = getGoals();
  const newGoal = {
    ...goal,
    id: generateId(),
    createdAt: new Date().toISOString()
  };
  goals.push(newGoal);
  saveToStorage(STORAGE_KEYS.GOALS, goals);
  return newGoal;
};

export const updateGoal = (id, updates) => {
  const goals = getGoals();
  const index = goals.findIndex(g => g.id === id);
  if (index !== -1) {
    goals[index] = { ...goals[index], ...updates };
    saveToStorage(STORAGE_KEYS.GOALS, goals);
    return goals[index];
  }
  return null;
};

export const deleteGoal = (id) => {
  const goals = getGoals();
  const filtered = goals.filter(g => g.id !== id);
  saveToStorage(STORAGE_KEYS.GOALS, filtered);
  return true;
};

// ============ DEBTS ============
export const getDebts = () => {
  return getFromStorage(STORAGE_KEYS.DEBTS, []);
};

export const createDebt = (debt) => {
  const debts = getDebts();
  const newDebt = {
    ...debt,
    id: generateId(),
    createdAt: new Date().toISOString()
  };
  debts.push(newDebt);
  saveToStorage(STORAGE_KEYS.DEBTS, debts);
  return newDebt;
};

export const updateDebt = (id, updates) => {
  const debts = getDebts();
  const index = debts.findIndex(d => d.id === id);
  if (index !== -1) {
    debts[index] = { ...debts[index], ...updates };
    saveToStorage(STORAGE_KEYS.DEBTS, debts);
    return debts[index];
  }
  return null;
};

export const deleteDebt = (id) => {
  const debts = getDebts();
  const filtered = debts.filter(d => d.id !== id);
  saveToStorage(STORAGE_KEYS.DEBTS, filtered);
  return true;
};

// ============ NET WORTH ============
export const getNetWorthSnapshots = () => {
  return getFromStorage(STORAGE_KEYS.NET_WORTH, []);
};

export const createNetWorthSnapshot = (snapshot) => {
  const snapshots = getNetWorthSnapshots();
  const newSnapshot = {
    ...snapshot,
    id: generateId(),
    createdAt: new Date().toISOString()
  };
  snapshots.push(newSnapshot);
  saveToStorage(STORAGE_KEYS.NET_WORTH, snapshots);
  return newSnapshot;
};

export const updateNetWorthSnapshot = (id, updates) => {
  const snapshots = getNetWorthSnapshots();
  const index = snapshots.findIndex(s => s.id === id);
  if (index !== -1) {
    snapshots[index] = { ...snapshots[index], ...updates };
    saveToStorage(STORAGE_KEYS.NET_WORTH, snapshots);
    return snapshots[index];
  }
  return null;
};

export const deleteNetWorthSnapshot = (id) => {
  const snapshots = getNetWorthSnapshots();
  const filtered = snapshots.filter(s => s.id !== id);
  saveToStorage(STORAGE_KEYS.NET_WORTH, filtered);
  return true;
};

// ============ DASHBOARD BLOCKS ============
export const getDashboardBlocks = () => {
  return getFromStorage(STORAGE_KEYS.DASHBOARD_BLOCKS, []);
};

export const saveDashboardBlocks = (blocks) => {
  saveToStorage(STORAGE_KEYS.DASHBOARD_BLOCKS, blocks);
  return blocks;
};

// ============ UTILITY FUNCTIONS ============
export const clearAllData = () => {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
};

// Initialize with sample data if empty
export const initializeSampleData = () => {
  const expenses = getExpenses();
  if (expenses.length === 0) {
    const sampleExpenses = [
      { id: generateId(), title: 'Grocery Shopping', amount: 85.50, type: 'expense', category: 'Food & Dining', date: '2024-01-15', currency: 'GBP', notes: 'Weekly groceries', createdAt: new Date().toISOString() },
      { id: generateId(), title: 'Monthly Rent', amount: 1200, type: 'expense', category: 'Housing', date: '2024-01-01', currency: 'GBP', notes: 'January rent', createdAt: new Date().toISOString() },
      { id: generateId(), title: 'Electric Bill', amount: 120, type: 'expense', category: 'Utilities', date: '2024-01-10', currency: 'GBP', notes: 'Electricity', createdAt: new Date().toISOString() },
      { id: generateId(), title: 'Salary', amount: 3500, type: 'income', category: 'Salary', date: '2024-01-05', currency: 'GBP', notes: 'January salary', createdAt: new Date().toISOString() },
      { id: generateId(), title: 'Gas Bill', amount: 65, type: 'expense', category: 'Utilities', date: '2024-01-12', currency: 'GBP', notes: 'Gas bill', createdAt: new Date().toISOString() },
    ];
    saveToStorage(STORAGE_KEYS.EXPENSES, sampleExpenses);
  }

  const profile = getProfile();
  if (!profile) {
    saveProfile({
      name: 'Demo User',
      currency: 'GBP',
      monthlyBudget: 2000
    });
  }

  const budgets = getBudgets();
  if (budgets.length === 0) {
    const sampleBudgets = [
      { id: generateId(), category: 'Food & Dining', limit: 500, period: 'monthly' },
      { id: generateId(), category: 'Transportation', limit: 200, period: 'monthly' },
      { id: generateId(), category: 'Entertainment', limit: 150, period: 'monthly' },
    ];
    saveToStorage(STORAGE_KEYS.BUDGETS, sampleBudgets);
  }

  // Sample goals
  const goals = getGoals();
  if (goals.length === 0) {
    const sampleGoals = [
      { id: generateId(), name: 'Emergency Fund', targetAmount: 5000, currentAmount: 2500, targetDate: '2024-12-31', color: '#14b8a6', currency: 'GBP', isCompleted: false },
      { id: generateId(), name: 'New Laptop', targetAmount: 1500, currentAmount: 500, targetDate: '2024-06-30', color: '#3b82f6', currency: 'GBP', isCompleted: false },
    ];
    saveToStorage(STORAGE_KEYS.GOALS, sampleGoals);
  }

  // No sample debts - user must add their own
};
