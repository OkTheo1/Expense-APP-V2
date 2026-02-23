import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Palette, Database, Globe } from 'lucide-react';

export default function Settings() {
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
              <p className="text-slate-400">Manage your data and backups</p>
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
    </div>
  );
}
