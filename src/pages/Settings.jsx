import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Palette, Database, Globe, Upload, FileSpreadsheet } from 'lucide-react';
import { Button } from "@/components/ui/button";
import CSVImportWizard from '@/components/CSVImportWizard';

export default function Settings() {
  const [csvImportOpen, setCsvImportOpen] = useState(false);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-light text-white tracking-tight mb-8">
          Settings
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Appearance */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-white">
                <Palette className="h-5 w-5 text-teal-400" />
                Appearance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400">Dark mode with mint/teal accents enabled</p>
            </CardContent>
          </Card>

          {/* Data & Backup */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-white">
                <Database className="h-5 w-5 text-purple-400" />
                Data & Backup
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 mb-4">Manage your data and backups</p>
              <Button 
                onClick={() => setCsvImportOpen(true)}
                className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import Transactions
              </Button>
            </CardContent>
          </Card>

          {/* Currency */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-white">
                <Globe className="h-5 w-5 text-blue-400" />
                Currency
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400">Default: GBP (£)</p>
            </CardContent>
          </Card>
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
