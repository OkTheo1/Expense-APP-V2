import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, TrendingUp, TrendingDown, DollarSign, Edit2, Trash2 } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';
import { format, subMonths, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { getNetWorthSnapshots, createNetWorthSnapshot, deleteNetWorthSnapshot, getDebts, getProfile } from '@/lib/localDatabase';

export default function NetWorth() {
  const [snapshots, setSnapshots] = useState([]);
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSnapshot, setEditingSnapshot] = useState(null);
  const [currency, setCurrency] = useState('GBP');
  const [timeRange, setTimeRange] = useState('12');
  const [showDebtOverlay, setShowDebtOverlay] = useState(true);
  const [formData, setFormData] = useState({
    month: format(new Date(), 'yyyy-MM'),
    assets: '',
    liabilities: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
    loadCurrency();
  }, []);

  const loadCurrency = () => {
    try {
      const profile = getProfile();
      if (profile && profile.currency) {
        setCurrency(profile.currency);
      }
    } catch (error) {
      console.error('Error loading currency:', error);
    }
  };

  const loadData = () => {
    try {
      const snapshotsData = getNetWorthSnapshots();
      const debtsData = getDebts();
      // Sort by month
      snapshotsData.sort((a, b) => a.month.localeCompare(b.month));
      setSnapshots(snapshotsData);
      setDebts(debtsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (snapshot = null) => {
    if (snapshot) {
      setEditingSnapshot(snapshot);
      setFormData({
        month: snapshot.month,
        assets: snapshot.assets.toString(),
        liabilities: snapshot.liabilities.toString(),
        notes: snapshot.notes || ''
      });
    } else {
      setEditingSnapshot(null);
      setFormData({
        month: format(new Date(), 'yyyy-MM'),
        assets: '',
        liabilities: '',
        notes: ''
      });
    }
    setDialogOpen(true);
  };

  const handleSave = () => {
    try {
      const assets = parseFloat(formData.assets);
      const liabilities = parseFloat(formData.liabilities);
      
      const data = {
        month: formData.month,
        assets,
        liabilities,
        netWorth: assets - liabilities,
        currency,
        notes: formData.notes
      };

      if (editingSnapshot) {
        // Update existing - need to find and update
        const allSnapshots = getNetWorthSnapshots();
        const index = allSnapshots.findIndex(s => s.id === editingSnapshot.id);
        if (index !== -1) {
          allSnapshots[index] = { ...allSnapshots[index], ...data };
          // Save back
          localStorage.setItem('expense_app_net_worth', JSON.stringify(allSnapshots));
        }
        toast.success('Snapshot updated');
      } else {
        createNetWorthSnapshot(data);
        toast.success('Snapshot created');
      }

      setDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Failed to save');
    }
  };

  const handleDelete = (id) => {
    deleteNetWorthSnapshot(id);
    setSnapshots(snapshots.filter(s => s.id !== id));
    toast.success('Snapshot deleted');
  };

  const getCurrencySymbol = (curr) => {
    return curr === 'GBP' ? '£' : curr === 'USD' ? '$' : '€';
  };

  const filteredSnapshots = snapshots.slice(-parseInt(timeRange));
  
  const chartData = filteredSnapshots.map(s => ({
    month: format(parseISO(s.month + '-01'), 'MMM yy'),
    assets: s.assets,
    liabilities: s.liabilities,
    netWorth: s.netWorth,
    totalDebt: debts.reduce((sum, d) => sum + d.amount, 0)
  }));

  const latestSnapshot = snapshots[snapshots.length - 1];
  const previousSnapshot = snapshots[snapshots.length - 2];
  const netWorthChange = latestSnapshot && previousSnapshot 
    ? latestSnapshot.netWorth - previousSnapshot.netWorth 
    : 0;
  const changePercentage = previousSnapshot 
    ? (netWorthChange / previousSnapshot.netWorth) * 100 
    : 0;

  const totalDebt = debts.reduce((sum, d) => sum + d.amount, 0);

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-4xl font-light text-white tracking-tight">
              Net Worth Tracker
            </h1>
            <p className="text-slate-400 mt-2">
              Monitor your financial progress over time
            </p>
          </div>
          <Button 
            onClick={() => openDialog()}
            className="mt-4 sm:mt-0 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white shadow-lg shadow-teal-500/30 rounded-xl px-6"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Snapshot
          </Button>
        </div>

        {snapshots.length > 0 ? (
          <>
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4 mb-8">
              <div className="glass-card rounded-2xl border border-white/10 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 flex items-center justify-center border border-teal-500/20">
                    <TrendingUp className="h-5 w-5 text-teal-400" />
                  </div>
                  <span className="text-sm text-slate-400">Net Worth</span>
                </div>
                <p className="text-3xl font-light text-white mb-1">
                  {getCurrencySymbol(currency)}{latestSnapshot?.netWorth.toFixed(2) || '0.00'}
                </p>
                {netWorthChange !== 0 && (
                  <div className={`flex items-center gap-1 text-sm ${netWorthChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {netWorthChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    <span>{netWorthChange > 0 ? '+' : ''}{getCurrencySymbol(currency)}{Math.abs(netWorthChange).toFixed(2)}</span>
                    <span className="text-slate-500">({changePercentage > 0 ? '+' : ''}{changePercentage.toFixed(1)}%)</span>
                  </div>
                )}
              </div>

              <div className="glass-card rounded-2xl border border-white/10 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center border border-blue-500/20">
                    <DollarSign className="h-5 w-5 text-blue-400" />
                  </div>
                  <span className="text-sm text-slate-400">Assets</span>
                </div>
                <p className="text-3xl font-light text-white">
                  {getCurrencySymbol(currency)}{latestSnapshot?.assets.toFixed(2) || '0.00'}
                </p>
              </div>

              <div className="glass-card rounded-2xl border border-white/10 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center border border-red-500/20">
                    <DollarSign className="h-5 w-5 text-red-400" />
                  </div>
                  <span className="text-sm text-slate-400">Liabilities</span>
                </div>
                <p className="text-3xl font-light text-white">
                  {getCurrencySymbol(currency)}{latestSnapshot?.liabilities.toFixed(2) || '0.00'}
                </p>
              </div>

              <div className="glass-card rounded-2xl border border-white/10 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-purple-500/20">
                    <TrendingDown className="h-5 w-5 text-purple-400" />
                  </div>
                  <span className="text-sm text-slate-400">Total Debt</span>
                </div>
                <p className="text-3xl font-light text-white">
                  {getCurrencySymbol(currency)}{totalDebt.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Chart Controls */}
            <div className="flex flex-wrap gap-4 mb-6">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="glass-card border-white/10 text-white w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-strong border-white/10">
                  <SelectItem value="6" className="text-white">Last 6 months</SelectItem>
                  <SelectItem value="12" className="text-white">Last 12 months</SelectItem>
                  <SelectItem value="24" className="text-white">Last 24 months</SelectItem>
                  <SelectItem value="999" className="text-white">All time</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant={showDebtOverlay ? "default" : "outline"}
                onClick={() => setShowDebtOverlay(!showDebtOverlay)}
                className={showDebtOverlay 
                  ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
                  : "glass-card border-white/10 text-slate-300"
                }
              >
                Show Debt Progress
              </Button>
            </div>

            {/* Charts */}
            <div className="grid gap-6 mb-8">
              {/* Net Worth Trend */}
              <div className="glass-card rounded-2xl border border-white/10 p-6">
                <h3 className="text-lg font-medium text-white mb-6">Net Worth Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="month" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(30, 41, 59, 0.95)', 
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: '12px',
                        color: '#fff'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="netWorth" 
                      stroke="#14b8a6" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorNetWorth)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Assets vs Liabilities */}
              <div className="glass-card rounded-2xl border border-white/10 p-6">
                <h3 className="text-lg font-medium text-white mb-6">Assets vs Liabilities</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="month" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(30, 41, 59, 0.95)', 
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: '12px',
                        color: '#fff'
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="assets" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      name="Assets"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="liabilities" 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      name="Liabilities"
                    />
                    {showDebtOverlay && (
                      <Line 
                        type="monotone" 
                        dataKey="totalDebt" 
                        stroke="#a855f7" 
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        name="Total Debt"
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Snapshots List */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white">Monthly Snapshots</h3>
              {snapshots.slice().reverse().map((snapshot) => (
                <div key={snapshot.id} className="glass-card rounded-2xl border border-white/10 hover:border-teal-500/30 transition-all duration-300 p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-3">
                        <h4 className="text-xl font-medium text-white">
                          {format(parseISO(snapshot.month + '-01'), 'MMMM yyyy')}
                        </h4>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          snapshot.netWorth > 0 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {getCurrencySymbol(snapshot.currency)}{snapshot.netWorth.toFixed(2)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-slate-400 mb-1">Assets</p>
                          <p className="text-white font-medium">{getCurrencySymbol(snapshot.currency)}{snapshot.assets.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 mb-1">Liabilities</p>
                          <p className="text-white font-medium">{getCurrencySymbol(snapshot.currency)}{snapshot.liabilities.toFixed(2)}</p>
                        </div>
                        {snapshot.notes && (
                          <div className="col-span-2 md:col-span-1">
                            <p className="text-slate-400 mb-1">Notes</p>
                            <p className="text-white text-xs">{snapshot.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDialog(snapshot)}
                        className="text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(snapshot.id)}
                        className="text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="glass-card rounded-2xl border border-white/10 p-12 text-center">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 flex items-center justify-center border border-teal-500/20 mx-auto mb-6">
              <TrendingUp className="h-8 w-8 text-teal-400" />
            </div>
            <h2 className="text-2xl font-light text-white mb-3">No Snapshots Yet</h2>
            <p className="text-slate-400 mb-6">
              Start tracking your net worth with monthly snapshots
            </p>
            <Button 
              onClick={() => openDialog()}
              className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add First Snapshot
            </Button>
          </div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="glass-strong border-white/10 text-white sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-white">
                {editingSnapshot ? 'Edit Snapshot' : 'Add Snapshot'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Month</Label>
                <Input
                  type="month"
                  value={formData.month}
                  onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                  className="glass-card border-white/10 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Total Assets</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.assets}
                    onChange={(e) => setFormData({ ...formData, assets: e.target.value })}
                    className="glass-card border-white/10 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Total Liabilities</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.liabilities}
                    onChange={(e) => setFormData({ ...formData, liabilities: e.target.value })}
                    className="glass-card border-white/10 text-white"
                  />
                </div>
              </div>

              {formData.assets && formData.liabilities && (
                <div className="glass-card p-4 rounded-xl border border-white/5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Net Worth</span>
                    <span className="text-xl font-medium text-teal-400">
                      {getCurrencySymbol(currency)}{(parseFloat(formData.assets) - parseFloat(formData.liabilities)).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-slate-300">Notes (Optional)</Label>
                <Textarea
                  placeholder="Any notes about this month..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="glass-card border-white/10 text-white resize-none"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="glass-card border-white/10 text-white">
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={!formData.month || !formData.assets || !formData.liabilities}
                className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white"
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
