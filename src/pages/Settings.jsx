import React, { useState } from 'react';
import { Palette, Database, Globe, Upload } from 'lucide-react';
import { Button } from "@/components/ui/button";
import CSVImportWizard from '@/components/CSVImportWizard';

export default function Settings() {
  const [csvImportOpen, setCsvImportOpen] = useState(false);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-light text-white tracking-tight mb-2">Settings</h1>
        <p className="text-slate-400 mb-8">Manage your app preferences and data</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Appearance */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 flex items-center justify-center border border-teal-500/20">
                <Palette className="h-6 w-6 text-teal-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Appearance</h3>
                <p className="text-xs text-slate-500">Theme & display settings</p>
              </div>
            </div>
            <div className="h-px bg-white/5 mb-4" />
            <div className="flex items-center justify-between">
              <p className="text-slate-400 text-sm">Dark mode</p>
              <span className="text-xs px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 font-medium">Active</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-slate-400 text-sm">Accent colour</p>
              <span className="text-xs px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 font-medium">Teal / Emerald</span>
            </div>
          </div>

          {/* Data & Backup */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-purple-500/20">
                <Database className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Data & Import</h3>
                <p className="text-xs text-slate-500">Manage your transaction data</p>
              </div>
            </div>
            <div className="h-px bg-white/5 mb-4" />
            <p className="text-slate-400 text-sm mb-4">Import transactions from a CSV file exported from your bank.</p>
            <Button
              onClick={() => setCsvImportOpen(true)}
              variant="outline"
              className="glass-card border-white/10 text-slate-300 hover:text-white hover:border-teal-500/30 rounded-xl w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Transactions
            </Button>
          </div>

          {/* Currency */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center border border-blue-500/20">
                <Globe className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Currency & Region</h3>
                <p className="text-xs text-slate-500">Localisation settings</p>
              </div>
            </div>
            <div className="h-px bg-white/5 mb-4" />
            <div className="flex items-center justify-between">
              <p className="text-slate-400 text-sm">Default currency</p>
              <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">GBP (£)</span>
            </div>
          </div>
        </div>
      </div>

      <CSVImportWizard
        open={csvImportOpen}
        onOpenChange={setCsvImportOpen}
        profileCurrency="GBP"
      />
    </div>
  );
}
