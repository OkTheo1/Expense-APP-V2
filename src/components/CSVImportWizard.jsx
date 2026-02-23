import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, CheckCircle2, AlertCircle, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';

const CURRENCY_SYMBOLS = {
  '£': 'GBP',
  '$': 'USD',
  '€': 'EUR'
};

export default function CSVImportWizard({ open, onOpenChange, onImportComplete, profileCurrency }) {
  const [file, setFile] = useState(null);
  const [step, setStep] = useState(1);
  const [csvData, setCsvData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState({
    title: '',
    amount: '',
    category: '',
    date: '',
    type: '',
    notes: ''
  });
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);

  const currentProfile = localStorage.getItem('currentProfile');

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    setFile(selectedFile);
    
    // Parse CSV
    const text = await selectedFile.text();
    const lines = text.split('\n').filter(line => line.trim());
    const csvHeaders = lines[0].split(',').map(h => h.trim().replace(/['"]/g, ''));
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/['"]/g, ''));
      return csvHeaders.reduce((obj, header, index) => {
        obj[header] = values[index] || '';
        return obj;
      }, {});
    });

    setHeaders(csvHeaders);
    setCsvData(rows);
    
    // Auto-detect mappings
    const autoMapping = {};
    csvHeaders.forEach(header => {
      const lower = header.toLowerCase();
      if (lower.includes('title') || lower.includes('description') || lower.includes('name')) {
        autoMapping.title = header;
      }
      if (lower.includes('amount') || lower.includes('price') || lower.includes('cost')) {
        autoMapping.amount = header;
      }
      if (lower.includes('category') || lower.includes('type')) {
        autoMapping.category = header;
      }
      if (lower.includes('date')) {
        autoMapping.date = header;
      }
      if (lower.includes('note')) {
        autoMapping.notes = header;
      }
    });
    setColumnMapping({ ...columnMapping, ...autoMapping });
    setStep(2);
  };

  const detectCurrency = (amountStr) => {
    for (const [symbol, currency] of Object.entries(CURRENCY_SYMBOLS)) {
      if (amountStr.includes(symbol)) {
        return { currency, cleanAmount: amountStr.replace(symbol, '').replace(/,/g, '').trim() };
      }
    }
    return { currency: profileCurrency, cleanAmount: amountStr.replace(/,/g, '').trim() };
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const expensesToCreate = [];
      
      for (const row of csvData) {
        if (!columnMapping.title || !columnMapping.amount || !columnMapping.date) {
          toast.error('Please map required fields: Title, Amount, and Date');
          setImporting(false);
          return;
        }

        const title = row[columnMapping.title];
        const amountStr = row[columnMapping.amount];
        const dateStr = row[columnMapping.date];

        if (!title || !amountStr || !dateStr) continue;

        // Detect currency and clean amount
        const { currency: detectedCurrency, cleanAmount } = detectCurrency(amountStr);
        let amount = parseFloat(cleanAmount);

        // Convert to profile currency if different
        if (detectedCurrency !== profileCurrency) {
          // Simple conversion rates (in real app, use live rates)
          const rates = {
            'GBP-USD': 1.27,
            'USD-GBP': 0.79,
            'EUR-GBP': 0.86,
            'GBP-EUR': 1.17,
            'USD-EUR': 0.92,
            'EUR-USD': 1.09
          };
          const conversionKey = `${detectedCurrency}-${profileCurrency}`;
          if (rates[conversionKey]) {
            amount = amount * rates[conversionKey];
          }
        }

        expensesToCreate.push({
          title,
          amount,
          type: columnMapping.type && row[columnMapping.type] ? row[columnMapping.type].toLowerCase() : 'expense',
          category: columnMapping.category && row[columnMapping.category] ? row[columnMapping.category] : 'Other',
          date: dateStr,
          currency: profileCurrency,
          originalAmount: parseFloat(cleanAmount),
          originalCurrency: detectedCurrency,
          notes: columnMapping.notes && row[columnMapping.notes] ? row[columnMapping.notes] : '',
          profile: currentProfile
        });
      }

      if (expensesToCreate.length > 0) {
        await base44.entities.Expense.bulkCreate(expensesToCreate);
        setResults({
          success: true,
          imported: expensesToCreate.length,
          skipped: csvData.length - expensesToCreate.length
        });
        toast.success(`Imported ${expensesToCreate.length} transactions`);
        setStep(3);
        onImportComplete?.();
      } else {
        toast.error('No valid transactions found');
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Import failed');
      setResults({ success: false, error: error.message });
      setStep(3);
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setStep(1);
    setCsvData([]);
    setHeaders([]);
    setColumnMapping({
      title: '',
      amount: '',
      category: '',
      date: '',
      type: '',
      notes: ''
    });
    setResults(null);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="glass-strong border-white/10 text-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">Import Transactions from CSV</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {/* Step 1: Upload */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="border-2 border-dashed border-white/10 rounded-2xl p-12 text-center hover:border-teal-500/30 transition-all">
                <Upload className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-lg text-white mb-2">Upload CSV File</p>
                <p className="text-sm text-slate-400 mb-4">
                  Select a CSV file with your transaction data
                </p>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white">
                    Choose File
                  </Button>
                </label>
              </div>

              <div className="glass-card p-4 rounded-xl border border-white/5">
                <p className="text-sm text-slate-300 mb-2 font-medium">CSV Format Requirements:</p>
                <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                  <li>Must include columns for: Title/Description, Amount, Date</li>
                  <li>Date format: YYYY-MM-DD (e.g., 2024-01-15)</li>
                  <li>Amount can include currency symbols (£, $, €) - will be auto-detected</li>
                  <li>Optional: Category, Type (expense/income), Notes</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 2: Column Mapping */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="glass-card p-4 rounded-xl border border-white/5">
                <p className="text-sm text-slate-300">
                  File: <span className="text-white font-medium">{file?.name}</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {csvData.length} rows detected
                </p>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-slate-300 font-medium">Map CSV Columns:</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Title / Description *</Label>
                    <Select value={columnMapping.title} onValueChange={(v) => setColumnMapping({ ...columnMapping, title: v })}>
                      <SelectTrigger className="glass-card border-white/10 text-white">
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent className="glass-strong border-white/10">
                        {headers.map(h => (
                          <SelectItem key={h} value={h} className="text-white">{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300">Amount *</Label>
                    <Select value={columnMapping.amount} onValueChange={(v) => setColumnMapping({ ...columnMapping, amount: v })}>
                      <SelectTrigger className="glass-card border-white/10 text-white">
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent className="glass-strong border-white/10">
                        {headers.map(h => (
                          <SelectItem key={h} value={h} className="text-white">{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300">Date *</Label>
                    <Select value={columnMapping.date} onValueChange={(v) => setColumnMapping({ ...columnMapping, date: v })}>
                      <SelectTrigger className="glass-card border-white/10 text-white">
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent className="glass-strong border-white/10">
                        {headers.map(h => (
                          <SelectItem key={h} value={h} className="text-white">{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300">Category (Optional)</Label>
                    <Select value={columnMapping.category} onValueChange={(v) => setColumnMapping({ ...columnMapping, category: v })}>
                      <SelectTrigger className="glass-card border-white/10 text-white">
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent className="glass-strong border-white/10">
                        <SelectItem value={null} className="text-white">None</SelectItem>
                        {headers.map(h => (
                          <SelectItem key={h} value={h} className="text-white">{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300">Type (Optional)</Label>
                    <Select value={columnMapping.type} onValueChange={(v) => setColumnMapping({ ...columnMapping, type: v })}>
                      <SelectTrigger className="glass-card border-white/10 text-white">
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent className="glass-strong border-white/10">
                        <SelectItem value={null} className="text-white">None</SelectItem>
                        {headers.map(h => (
                          <SelectItem key={h} value={h} className="text-white">{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300">Notes (Optional)</Label>
                    <Select value={columnMapping.notes} onValueChange={(v) => setColumnMapping({ ...columnMapping, notes: v })}>
                      <SelectTrigger className="glass-card border-white/10 text-white">
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent className="glass-strong border-white/10">
                        <SelectItem value={null} className="text-white">None</SelectItem>
                        {headers.map(h => (
                          <SelectItem key={h} value={h} className="text-white">{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="glass-card p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                <p className="text-sm text-amber-400">
                  💡 Currency will be auto-detected from amount (£, $, €) and converted to {profileCurrency} if needed
                </p>
              </div>

              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setStep(1)} className="glass-card border-white/10 text-white">
                  Back
                </Button>
                <Button 
                  onClick={handleImport}
                  disabled={!columnMapping.title || !columnMapping.amount || !columnMapping.date || importing}
                  className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    'Import'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Results */}
          {step === 3 && results && (
            <div className="space-y-6 text-center">
              {results.success ? (
                <>
                  <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center border border-emerald-500/20 mx-auto">
                    <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-light text-white mb-2">Import Successful!</h3>
                    <p className="text-slate-400">
                      {results.imported} transactions imported
                      {results.skipped > 0 && ` • ${results.skipped} rows skipped`}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center border border-red-500/20 mx-auto">
                    <AlertCircle className="h-10 w-10 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-light text-white mb-2">Import Failed</h3>
                    <p className="text-slate-400">{results.error}</p>
                  </div>
                </>
              )}
              <Button 
                onClick={handleClose}
                className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white"
              >
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}