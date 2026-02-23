import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Plus, Settings, Building2 } from 'lucide-react';
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
  getFilteredBankBalance
} from '@/lib/bankData';

export default function Dashboard() {
  const [expenses, setExpenses] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [recurringTransactions, setRecurringTransactions] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggedBlock, setDraggedBlock] = useState(null);
  const [currency, setCurrency] = useState('GBP');
  const [editMode, setEditMode] = useState(false);
  const [selectedBank, setSelectedBank] = useState('all');
  const [bankAccounts, setBankAccounts] = useState([]);
  const [bankTransactions, setBankTransactions] = useState([]);

  const currentProfile = localStorage.getItem('currentProfile');

  useEffect(() => {
    loadData();
    loadBlocks();
    loadProfileCurrency();
    loadBankData();
  }, []);

  const loadBankData = () => {
    try {
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

  const thisMonthExpenses = expenses.filter(e => 
    e.date >= monthStart && e.date <= monthEnd
  );

  const totalSpent = thisMonthExpenses.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);
  const totalIncome = thisMonthExpenses.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
  const totalBudget = budgets.reduce((sum, b) => sum + b.limit, 0);
  
  // Calculate expected monthly income from recurring transactions
  const monthlyRecurringIncome = recurringTransactions
    .filter(r => r.type === 'income')
    .reduce((sum, r) => sum + r.amount, 0);
  
  const balance = totalIncome - totalSpent;

  const lastMonthStart = startOfMonth(subMonths(new Date(), 1)).toISOString().split('T')[0];
  const lastMonthEnd = endOfMonth(subMonths(new Date(), 1)).toISOString().split('T')[0];
  const lastMonthSpent = expenses
    .filter(e => e.date >= lastMonthStart && e.date <= lastMonthEnd && e.type === 'expense')
    .reduce((sum, e) => sum + e.amount, 0);
  
  const change = lastMonthSpent > 0 ? ((totalSpent - lastMonthSpent) / lastMonthSpent) * 100 : 0;

  const spendingByCategory = thisMonthExpenses
    .filter(e => e.type === 'expense')
    .reduce((acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
      return acc;
    }, {});

const pieData = Object.entries(spendingByCategory).map(([name, value]) => ({
    name,
    value
  }));

  // Filter bank transactions by selected bank
  const filteredBankTransactions = useMemo(() => {
    if (!selectedBank || selectedBank === 'all') {
      return bankTransactions;
    }
    
    return filterByBank(bankTransactions, selectedBank, bankAccounts);
  }, [bankTransactions, selectedBank, bankAccounts]);

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
        return <RecentTransactionsBlock transactions={thisMonthExpenses} currency={currency} />;
      case 'bank-transactions':
        return <BankTransactionsBlock currency={currency} limit={10} transactions={filteredBankTransactions} />;
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
          
          {/* Bank Selector */}
          {bankAccounts.length > 0 && (
            <div className="flex items-center gap-3 mt-4 sm:mt-0">
              <BankSelector 
                value={selectedBank} 
                onChange={handleBankChange}
                showAllOption={true}
              />
            </div>
          )}
          
          <div className="flex items-center gap-3 mt-4 sm:mt-0 ml-auto">
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
            <Link to={createPageUrl('AddExpense')}>
              <Button className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white shadow-lg shadow-teal-500/30 rounded-xl px-6">
                <Plus className="w-4 h-4 mr-2" />
                Add Transaction
              </Button>
            </Link>
          </div>
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