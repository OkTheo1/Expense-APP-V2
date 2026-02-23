import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { 
  LayoutDashboard, Receipt, PiggyBank, BarChart3, 
  ChevronLeft, ChevronRight, Wallet, Settings,
  TrendingUp, Target, Calculator, User, Plus, Repeat, Building2
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const navItems = [
  { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
  { name: 'Bank', icon: Building2, page: 'Bank' },
  { name: 'Transactions', icon: Receipt, page: 'Expenses' },
  { name: 'Recurring', icon: Repeat, page: 'RecurringTransactions' },
  { name: 'Budgets', icon: PiggyBank, page: 'Budgets' },
  { name: 'Analytics', icon: BarChart3, page: 'Analytics' },
  { name: 'Net Worth', icon: TrendingUp, page: 'NetWorth' },
  { name: 'Goals', icon: Target, page: 'Goals' },
  { name: 'Debt', icon: Calculator, page: 'Debt' },
  { name: 'Settings', icon: Settings, page: 'Settings' },
];

export default function Layout({ children, currentPageName }) {
  const [collapsed, setCollapsed] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      const data = await base44.entities.Profile.list();
      setProfiles(data);
      
      const defaultProfile = data.find(p => p.isDefault) || data[0];
      if (defaultProfile) {
        setCurrentProfile(defaultProfile.id);
        localStorage.setItem('currentProfile', defaultProfile.id);
      } else if (data.length === 0) {
        const newProfile = await base44.entities.Profile.create({
          name: 'Personal',
          currency: 'GBP',
          isDefault: true,
          color: '#14b8a6'
        });
        setProfiles([newProfile]);
        setCurrentProfile(newProfile.id);
        localStorage.setItem('currentProfile', newProfile.id);
      }
    } catch (error) {
      console.error('Error loading profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileChange = (profileId) => {
    setCurrentProfile(profileId);
    localStorage.setItem('currentProfile', profileId);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 glass-strong transition-all duration-300 ease-in-out ${
          collapsed ? 'w-20' : 'w-72'
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            {!collapsed && (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
                  <Wallet className="h-5 w-5 text-white" />
                </div>
                <div>
                  <span className="text-lg font-semibold text-white">BudgetFlow</span>
                  <p className="text-xs text-slate-400">Financial Manager</p>
                </div>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="text-slate-400 hover:text-white hover:bg-white/5 rounded-xl ml-auto"
            >
              {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            </Button>
          </div>

          {/* Profile Switcher */}
          {!loading && !collapsed && (
            <div className="p-4 border-b border-white/5">
              <label className="text-xs text-slate-400 mb-2 block">Profile</label>
              <Select value={currentProfile} onValueChange={handleProfileChange}>
                <SelectTrigger className="glass-card border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-strong border-white/10">
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id} className="text-white">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: profile.color }}
                        />
                        {profile.name}
                        <span className="text-xs text-slate-400 ml-auto">({profile.currency})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = currentPageName === item.page;
              return (
                <Link
                  key={item.name}
                  to={createPageUrl(item.page)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                    isActive
                      ? 'bg-gradient-to-r from-teal-500/20 to-emerald-500/20 text-teal-400 shadow-lg shadow-teal-500/10 border border-teal-500/20'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  } ${collapsed ? 'justify-center' : ''}`}
                  title={collapsed ? item.name : ''}
                >
                  <item.icon className={`h-5 w-5 ${isActive ? 'text-teal-400' : ''} ${!isActive && 'group-hover:scale-110 transition-transform'}`} />
                  {!collapsed && <span>{item.name}</span>}
                  {!collapsed && isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-400 shadow-lg shadow-teal-400/50" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          {!collapsed && (
            <div className="p-4 mt-auto border-t border-white/5">
              <div className="glass-card p-4 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-teal-500/20 to-emerald-500/20 flex items-center justify-center border border-teal-500/20">
                    <User className="h-5 w-5 text-teal-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {profiles.find(p => p.id === currentProfile)?.name || 'Personal'}
                    </p>
                    <p className="text-xs text-slate-400 truncate">Active Profile</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className={`transition-all duration-300 ${collapsed ? 'ml-20' : 'ml-72'}`}>
        <div className="min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
}
