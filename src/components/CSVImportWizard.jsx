import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, CheckCircle2, AlertCircle, Loader2, Download, FileSpreadsheet, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const CURRENCY_SYMBOLS = {
  '£': 'GBP',
  '$': 'USD',
  '€': 'EUR'
};

// Monzo category mapping to common expense categories
const MONZO_CATEGORY_MAP = {
  'Shopping': 'Shopping',
  'Groceries': 'Groceries',
  'Eating out': 'Dining',
  'Entertainment': 'Entertainment',
  'Transport': 'Transport',
  'Bills': 'Bills',
  'General': 'General',
  'Finances': 'Finance',
  'Holidays': 'Travel',
  'Personal care': 'Personal Care',
  'Gifts': 'Gifts',
  'Savings': 'Savings',
  'Income': 'Income',
  'Transfers': 'Transfer'
};

export default function CSVImportWizard({ open, onOpenChange, onImportComplete, profileCurrency }) {
  const [file, setFile] = useState(null);
  const [step, setStep] = useState(1);
  const [csvData, setCsvData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [detectedFormat, setDetectedFormat] = useState(null);
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
  const [importMode, setImportMode] = useState(null); // 'monzo' or 'generic'

  const currentProfile = localStorage.getItem('currentProfile');

  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result.map(v => v.replace(/^"|"$/g, '').trim());
  };

  const detectCSVFormat = (headers, sampleRow) => {
    // Check for Monzo format
    const monzoHeaders = ['Transaction ID', 'Date', 'Time', 'Type', 'Name', 'Emoji', 'Category', 'Amount', 'Currency'];
    const isMonzo = monzoHeaders.filter(h => headers.includes(h)).length >= 6;
    
    if (isMonzo) {
      return 'monzo';
    }
    
    // Check for generic format
    return 'generic';
  };

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
    
    if (lines.length < 2) {
      toast.error('CSV file appears to be empty');
      return;
    }
    
    const csvHeaders = parseCSVLine(lines[0]);
    const rows = lines.slice(1).map(line => {
      const values = parseCSVLine(line);
      return csvHeaders.reduce((obj, header, index) => {
        obj[header] = values[index] || '';
        return obj;
      }, {});
    });

    setHeaders(csvHeaders);
    setCsvData(rows);
    
    // Detect format
    const format = detectCSVFormat(csvHeaders, rows[0]);
    setDetectedFormat(format);
    
    if (format === 'monzo') {
      setImportMode('monzo');
      // Pre-configure Monzo mapping
      setColumnMapping({
        title: 'Name',
        amount: 'Amount',
        category: 'Category',
        date: 'Date',
        type: 'Type',
        notes: 'Notes and #tags'
      });
      setStep(2);
    } else {
      setImportMode('generic');
      // Auto-detect mappings for generic CSV
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
    }
  };

  const parseMonzoDate = (dateStr) => {
    // Monzo format: DD/MM/YYYY
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return dateStr; // Return as-is if not in expected format
  };

  const parseMonzoAmount = (row) => {
    // Monzo has separate columns: Amount, Money Out, Money In
    // Negative Amount = money out (expense)
    // Positive Amount = money in (income)
    // But also check Money Out and Money In columns
    
    const amount = parseFloat(row['Amount'] || '0');
    const moneyOut = parseFloat(row['Money Out'] || '0');
    const moneyIn = parseFloat(row['Money In'] || '0');
    
    if (moneyOut > 0) {
      return -moneyOut; // Expense
    } else if (moneyIn > 0) {
      return moneyIn; // Income
    }
    
    return amount; // Use the main Amount column
  };

  const detectMonzoTransactionType = (row) => {
    const amount = parseFloat(row['Amount'] || '0');
    const moneyOut = parseFloat(row['Money Out'] || '0');
    const moneyIn = parseFloat(row['Money In'] || '0');
    const type = row['Type'] || '';
    
    if (moneyOut > 0 || amount < 0 || type.toLowerCase().includes('payment')) {
      return 'expense';
    } else if (moneyIn > 0 || amount > 0 || type.toLowerCase().includes('income') || type.toLowerCase().includes('transfer in')) {
      return 'income';
    }
    
    return 'expense'; // Default
  };

  const mapMonzoCategory = (category) => {
    return MONZO_CATEGORY_MAP[category] || category || 'Other';
  };

  const detectCurrency = (amountStr) => {
    if (!amountStr) return { currency: profileCurrency, cleanAmount: '0' };
    
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
        const dateStr = row[columnMapping.date];
        
        if (!title || !dateStr) continue;

        let amount;
        let type;
        let category;
        
        if (importMode === 'monzo') {
          // Monzo-specific processing
          amount = parseMonzoAmount(row);
          type = detectMonzoTransactionType(row);
          category = mapMonzoCategory(row['Category']);
          
          // Skip zero amounts
          if (amount === 0) continue;
          
          // Use description from Type + Name if title is empty
          const finalTitle = title || `${row['Type'] || ''} ${row['Name'] || ''}`.trim() || 'Unknown';
          
          expensesToCreate.push({
            title: finalTitle,
            amount: Math.abs(amount), // Store as positive, type determines direction
            type: type,
            category: category,
            date: parseMonzoDate(dateStr),
            currency: 'GBP',
            originalAmount: amount,
            originalCurrency: 'GBP',
            notes: row['Notes and #tags'] || '',
            profile: currentProfile,
            // Additional Monzo-specific fields
            merchant: row['Name'] || null,
            transactionId: row['Transaction ID'] || null
          });
        } else {
          // Generic CSV processing
          const amountStr = row[columnMapping.amount];
          const { currency: detectedCurrency, cleanAmount } = detectCurrency(amountStr);
          amount = parseFloat(cleanAmount);

          // Convert to profile currency if different
          if (detectedCurrency !== profileCurrency) {
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

          // Skip zero amounts
          if (!amount || isNaN(amount)) continue;

          expensesToCreate.push({
            title,
            amount: Math.abs(amount),
            type: columnMapping.type && row[columnMapping.type] ? row[columnMapping.type].toLowerCase() : (amount < 0 ? 'expense' : 'income'),
            category: columnMapping.category && row[columnMapping.category] ? row[columnMapping.category] : 'Other',
            date: dateStr,
            currency: profileCurrency,
            originalAmount: parseFloat(cleanAmount),
            originalCurrency: detectedCurrency,
            notes: columnMapping.notes && row[columnMapping.notes] ? row[columnMapping.notes] : '',
            profile: currentProfile
          });
        }
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
      toast.error('Import failed: ' + error.message);
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
    setDetectedFormat(null);
    setColumnMapping({
      title: '',
      amount: '',
      category: '',
      date: '',
      type: '',
      notes: ''
    });
    setResults(null);
    setImportMode(null);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="glass-strong border-white/10 text-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Import Transactions from CSV
          </DialogTitle>
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
                <p className="text-sm text-slate-300 mb-2 font-medium">Supported Formats:</p>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li className="flex items-center gap-2">
                    <ChevronRight className="w-3 h-3 text-teal-400" />
                    <span className="text-teal-400">Monzo CSV</span> - Automatically detected and optimized
                  </li>
                  <li className="flex items-center gap-2">
                    <ChevronRight className="w-3 h-3 text-slate-400" />
                    <span>Generic CSV</span> - Manual column mapping
                  </li>
                </ul>
              </div>

              <div className="glass-card p-4 rounded-xl border border-white/5">
                <p className="text-sm text-slate-300 mb-2 font-medium">CSV Format Requirements:</p>
                <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                  <li>Must include columns for: Title/Description, Amount, Date</li>
                  <li>Date format: YYYY-MM-DD or DD/MM/YYYY (Monzo)</li>
                  <li>Amount can include currency symbols (£, $, €) - will be auto-detected</li>
                  <li>Optional: Category, Type (expense/income), Notes</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 2: Column Mapping */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="glass-card p-4 rounded-xl border border-white/5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-300">
                    File: <span className="text-white font-medium">{file?.name}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {csvData.length} rows detected
                  </p>
                </div>
                {detectedFormat === 'monzo' && (
                  <span className="px-3 py-1 bg-teal-500/20 text-teal-400 rounded-full text-xs font-medium">
                    Monzo Format Detected ✓
                  </span>
                )}
              </div>

              {importMode === 'monzo' ? (
                // Monzo-specific preview
                <div className="space-y-4">
                  <div className="glass-card p-4 rounded-xl border border-teal-500/20 bg-teal-500/5">
                    <p className="text-sm text-teal-400 font-medium mb-3">Monzo CSV Detected</p>
                    <p className="text-xs text-slate-300">
                      The following fields will be automatically mapped:
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Date:</span>
                        <span className="text-white">Date (DD/MM/YYYY)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Amount:</span>
                        <span className="text-white">Money Out / Money In</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Title:</span>
                        <span className="text-white">Name</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Category:</span>
                        <span className="text-white">Category (mapped)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Notes:</span>
                        <span className="text-white">Notes and #tags</span>
                      </div>
                    </div>
                  </div>

                  {/* Show sample data */}
                  <div className="glass-card p-3 rounded-xl border border-white/5">
                    <p className="text-xs text-slate-400 mb-2">Sample (first 3 rows):</p>
                    <div className="space-y-1 text-xs">
                      {csvData.slice(0, 3).map((row, i) => (
                        <div key={i} className="flex justify-between text-slate-300">
                          <span className="truncate flex-1">{row['Name'] || row['Type']}</span>
                          <span className="text-teal-400 ml-2">{row['Date']}</span>
                          <span className={`ml-2 ${parseFloat(row['Amount'] || '0') < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            £{Math.abs(parseFloat(row['Amount'] || '0')).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                // Generic column mapping
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

                  <div className="glass-card p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                    <p className="text-sm text-amber-400">
                      💡 Currency will be auto-detected from amount (£, $, €) and converted to {profileCurrency} if needed
                    </p>
                  </div>
                </div>
              )}

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
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Import {csvData.length} Transactions
                    </>
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
