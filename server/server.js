import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import * as pdfParse from 'pdf-parse';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Set up multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// File-based persistence for bank connections
const CONNECTIONS_FILE = path.join(__dirname, 'bankConnections.json');

// In-memory storage for multiple bank connections
// Each connection has its own tokens and accounts
let bankConnections = new Map();

// Load connections from file on startup
function loadConnections() {
  try {
    if (fs.existsSync(CONNECTIONS_FILE)) {
      const data = fs.readFileSync(CONNECTIONS_FILE, 'utf8');
      const connectionsArray = JSON.parse(data);
      connectionsArray.forEach(conn => {
        bankConnections.set(conn.id, conn);
      });
      console.log(`=== Loaded ${bankConnections.size} bank connections from file ===`);
    }
  } catch (error) {
    console.error('Error loading connections:', error.message);
  }
}

// Save connections to file
function saveConnections() {
  try {
    const connectionsArray = Array.from(bankConnections.values());
    fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(connectionsArray, null, 2));
    console.log(`=== Saved ${connectionsArray.length} bank connections to file ===`);
  } catch (error) {
    console.error('Error saving connections:', error.message);
  }
}

// Load connections on startup
loadConnections();

// Helper to get or create a connection
function getConnection(connectionId = null) {
  if (connectionId && bankConnections.has(connectionId)) {
    return bankConnections.get(connectionId);
  }
  // Create new connection if none exists
  const newId = connectionId || `conn_${Date.now()}`;
  const newConnection = {
    id: newId,
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    accounts: [],
    providerId: null
  };
  bankConnections.set(newId, newConnection);
  return newConnection;
}

// TrueLayer OAuth Configuration
const TRUELAYER_AUTH_URL = 'https://auth.truelayer.com/';
const TRUELAYER_API_URL = 'https://api.truelayer.com/';
const CLIENT_ID = process.env.TRUE_LAYER_CLIENT_ID;
const CLIENT_SECRET = process.env.TRUE_LAYER_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:5173/auth/truelayer/callback';

// Debug logging
console.log('=== TrueLayer Configuration ===');
console.log('CLIENT_ID:', CLIENT_ID ? 'Set' : 'NOT SET');
console.log('CLIENT_SECRET:', CLIENT_SECRET ? 'Set' : 'NOT SET');
console.log('REDIRECT_URI:', REDIRECT_URI);
console.log('================================');

// Root endpoint - shows server status
app.get('/', (req, res) => {
  res.json({ 
    name: 'Expense App Server',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      connect: '/auth/truelayer',
      accounts: '/api/accounts',
      transactions: '/api/transactions',
      disconnect: '/auth/truelayer/disconnect'
    }
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Check connection status
app.get('/api/connection-status', (req, res) => {
  const connections = Array.from(bankConnections.values());
  const totalAccounts = connections.reduce((sum, conn) => sum + conn.accounts.length, 0);
  const isConnected = connections.some(conn => conn.accessToken && conn.expiresAt > Date.now());
  
  res.json({
    connected: isConnected,
    hasAccounts: totalAccounts > 0,
    accountsCount: totalAccounts,
    connectionsCount: connections.length
  });
});

// Step 1: Redirect to TrueLayer auth
app.get('/auth/truelayer', (req, res) => {
  console.log('=== Starting TrueLayer OAuth Flow ===');
  
  if (!CLIENT_ID) {
    console.error('ERROR: TRUE_LAYER_CLIENT_ID not configured');
    return res.redirect(`${process.env.FRONTEND_URL}/Settings?error=client_id_missing`);
  }

  // Generate a new connection ID for this auth flow
  const connectionId = `conn_${Date.now()}`;
  
  // Store the connection ID temporarily in a cookie or return it
  // For simplicity, we'll use it in the state parameter
  const state = JSON.stringify({ connectionId });

  // Include offline_access to get refresh token
  // Use uk-ob-all for maximum coverage of UK banks and credit cards
  const authParams = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'info accounts balance transactions offline_access',
    providers: 'uk-ob-all uk-oauth-all uk-cb-ob-all',
    state: state
  });

  const authUrl = `${TRUELAYER_AUTH_URL}?${authParams.toString()}`;
  console.log('Redirecting to:', authUrl);
  console.log('Connection ID:', connectionId);
  
  // Initialize the connection
  const connection = getConnection(connectionId);
  connection.providerId = 'truelayer';
  
  res.redirect(authUrl);
});

// Step 2: Handle callback and exchange code for tokens
app.get('/auth/truelayer/callback', async (req, res) => {
  const { code, error: authError, state } = req.query;
  
  console.log('=== TrueLayer Callback ===');
  console.log('Code received:', code ? 'Yes' : 'No');
  console.log('Error:', authError || 'None');

  if (authError) {
    console.error('Auth error:', authError);
    return res.redirect(`${process.env.FRONTEND_URL}/Settings?error=${authError}`);
  }

  if (!code) {
    console.error('No authorization code received');
    return res.redirect(`${process.env.FRONTEND_URL}/Settings?error=no_code`);
  }

  // Parse connection ID from state if available
  let connectionId = null;
  try {
    if (state) {
      const stateData = JSON.parse(state);
      connectionId = stateData.connectionId;
    }
  } catch (e) {
    console.log('Could not parse state:', e);
  }

  // If no connection ID from state, create one
  if (!connectionId) {
    connectionId = `conn_${Date.now()}`;
  }

  const connection = getConnection(connectionId);

  try {
    // Exchange authorization code for tokens
    console.log('Exchanging code for tokens...');
    console.log('Connection ID:', connectionId);
    
    const tokenResponse = await axios.post(
      `${TRUELAYER_AUTH_URL}connect/token`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        code: code
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    console.log('Token response received:', {
      access_token: tokenResponse.data.access_token ? 'Present' : 'Missing',
      refresh_token: tokenResponse.data.refresh_token ? 'Present' : 'Missing',
      expires_in: tokenResponse.data.expires_in
    });

    // Store tokens for this connection
    connection.accessToken = tokenResponse.data.access_token;
    connection.refreshToken = tokenResponse.data.refresh_token;
    connection.expiresAt = Date.now() + (tokenResponse.data.expires_in * 1000);

    // Fetch accounts
    console.log('Fetching accounts...');
    await fetchAccounts(connection);

    // Save connections to file
    saveConnections();

    console.log('=== OAuth Flow Complete ===');
    console.log(`Total connections: ${bankConnections.size}`);
    res.redirect(`${process.env.FRONTEND_URL}/Settings?connected=true`);

  } catch (error) {
    console.error('=== Token Exchange Error ===');
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      console.error('No response received');
    } else {
      console.error('Error:', error.message);
    }
    res.redirect(`${process.env.FRONTEND_URL}/Settings?error=token_exchange_failed`);
  }
});

// Fetch balance for a specific account
async function fetchAccountBalance(connection, accountId) {
  try {
    // Try the standard balances endpoint
    console.log(`Fetching balance from /accounts/${accountId}/balances...`);
    const response = await axios.get(`${TRUELAYER_API_URL}data/v1/accounts/${accountId}/balances`, {
      headers: {
        'Authorization': `Bearer ${connection.accessToken}`
      }
    });

    console.log(`Balance response status: ${response.status}`, JSON.stringify(response.data, null, 2));

    // TrueLayer returns balance data in results array
    // Take the first balance record (most recent)
    if (response.data.results && response.data.results.length > 0) {
      const balance = response.data.results[0];
      console.log(`Balance found for account ${accountId}:`, JSON.stringify(balance, null, 2));
      return {
        available: balance.available?.amount ?? balance.available ?? 0,
        current: balance.current?.amount ?? balance.current ?? 0,
        overdraft: balance.overlay?.overdraft?.amount ?? 0,
        currency: balance.available?.currency || balance.current?.currency || 'GBP'
      };
    }
    console.log(`No balance results for account ${accountId}, response:`, response.data);
    return null;
  } catch (error) {
    // Log detailed error
    console.log(`Primary balance endpoint failed for ${accountId}:`, error.response?.status, error.response?.data || error.message);
    
    // If standard endpoint fails, try alternative endpoints
    console.log(`Trying alternative balance endpoints for account ${accountId}...`);
    
    try {
      // Try with /balance endpoint (singular)
      console.log(`Fetching balance from /accounts/${accountId}/balance...`);
      const altResponse = await axios.get(`${TRUELAYER_API_URL}data/v1/accounts/${accountId}/balance`, {
        headers: {
          'Authorization': `Bearer ${connection.accessToken}`
        }
      });
      
      console.log(`Alt balance response status: ${altResponse.status}`, JSON.stringify(altResponse.data, null, 2));
      
      // Check for results array (TrueLayer returns balance in results[0])
      if (altResponse.data.results && altResponse.data.results.length > 0) {
        const balance = altResponse.data.results[0];
        console.log(`Alt balance parsed for ${accountId}:`, JSON.stringify(balance, null, 2));
        return {
          available: balance.available ?? 0,
          current: balance.current ?? 0,
          overdraft: balance.overdraft ?? 0,
          currency: balance.currency || 'GBP'
        };
      }
    } catch (altError) {
      console.log(`Alternative balance endpoint also failed for ${accountId}:`, altError.response?.status, altError.response?.data || altError.message);
    }
    
    // Return a default balance object so accounts still show
    console.log(`Could not fetch balance for account ${accountId}, using default 0`);
    return {
      available: 0,
      current: 0,
      overdraft: 0,
      currency: 'GBP'
    };
  }
}

// Fetch accounts from TrueLayer for a specific connection
async function fetchAccounts(connection) {
  try {
    console.log('=== Calling TrueLayer accounts API ===');
    const accountsResponse = await axios.get(`${TRUELAYER_API_URL}data/v1/accounts`, {
      headers: {
        'Authorization': `Bearer ${connection.accessToken}`
      }
    });

    console.log('TrueLayer accounts response:', JSON.stringify(accountsResponse.data, null, 2));
    
    const accounts = accountsResponse.data.results || [];
    
    // Fetch balances for each account
    console.log(`Fetching balances for ${accounts.length} accounts...`);
    for (const account of accounts) {
      const balance = await fetchAccountBalance(connection, account.account_id);
      if (balance) {
        account.balance = balance;
        console.log(`  Balance for ${account.display_name}: available=${balance.available}, current=${balance.current}`);
      } else {
        console.log(`  No balance data for ${account.display_name}`);
      }
    }

    connection.accounts = accounts;
    console.log(`Fetched ${connection.accounts.length} accounts with balances for connection ${connection.id}`);
    return connection.accounts;
  } catch (error) {
    console.error('Error fetching accounts:', error.response?.data || error.message);
    throw error;
  }
}

// Get all accounts from all connections
async function getAllAccounts() {
  const allAccounts = [];
  
  for (const [id, connection] of bankConnections) {
    // Check if token needs refresh
    if (connection.expiresAt && connection.expiresAt < Date.now()) {
      if (connection.refreshToken) {
        try {
          await refreshToken(connection);
        } catch (e) {
          console.error(`Failed to refresh token for ${id}:`, e.message);
          continue;
        }
      } else {
        continue;
      }
    }

    // Fetch accounts if we have a valid token
    if (connection.accessToken) {
      try {
        await fetchAccounts(connection);
      } catch (e) {
        console.error(`Failed to fetch accounts for ${id}:`, e.message);
      }
    }
    
    // Add accounts from this connection
    if (connection.accounts.length > 0) {
      allAccounts.push(...connection.accounts);
    }
  }
  
  return allAccounts;
}

// Get all transactions from all connections
async function getAllTransactions() {
  const allTransactions = [];
  const now = new Date();
  
  for (const [id, connection] of bankConnections) {
    if (!connection.accessToken || !connection.accounts.length) {
      continue;
    }

    // Fetch transactions for each account
    for (const account of connection.accounts) {
      try {
        // TrueLayer has a maximum date range limit (typically 90 days)
        // We'll use 90 days as that's the standard Open Banking limit
        let fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
        const fromDateStr = fromDate.toISOString().split('T')[0];
        const toDateStr = now.toISOString().split('T')[0];
        
        console.log(`Fetching transactions for account ${account.display_name} from ${fromDateStr} to ${toDateStr}`);
        
        const response = await axios.get(
          `${TRUELAYER_API_URL}data/v1/accounts/${account.account_id}/transactions`,
          {
            headers: {
              'Authorization': `Bearer ${connection.accessToken}`
            },
            params: {
              from: fromDateStr,
              to: toDateStr
            }
          }
        );

        const transactions = response.data.results || [];
        
        console.log(`  Fetched ${transactions.length} transactions for account ${account.display_name}`);
        
        // Normalize transactions
        const normalized = transactions.map(tx => ({
          id: tx.transaction_id,
          date: tx.timestamp,
          description: tx.description,
          amount: tx.amount,
          currency: tx.currency || 'GBP',
          merchant: tx.merchant_name || tx.metadata?.merchant_name || null,
          accountId: account.account_id,
          accountName: account.display_name,
          providerId: account.provider?.provider_id || account.provider_id,
          providerName: account.provider?.display_name || 'Unknown'
        }));

        allTransactions.push(...normalized);

      } catch (txError) {
        const errData = txError.response?.data;
        console.error(`Error fetching transactions for account ${account.account_id}:`, errData || txError.message);
        
        // SCA expired - mark connection as needing re-auth
        if (errData?.error === 'sca_exceeded') {
          connection.scaExpired = true;
          saveConnections();
        }
      }
    }
  }

  // Sort by date descending
  allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  console.log(`=== Total transactions fetched: ${allTransactions.length} ===`);
  return allTransactions;
}

// Get accounts endpoint
app.get('/api/accounts', async (req, res) => {
  try {
    console.log('=== /api/accounts called ===');
    const accounts = await getAllAccounts();
    console.log(`Returning ${accounts.length} accounts`);
    res.json({ accounts });

  } catch (error) {
    console.error('Error in /api/accounts:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// Debug endpoint to force refresh accounts
app.post('/api/accounts/refresh', async (req, res) => {
  try {
    console.log('=== Force refreshing all accounts ===');
    for (const [id, connection] of bankConnections) {
      if (connection.accessToken) {
        console.log(`Fetching accounts for connection ${id}...`);
        try {
          await fetchAccounts(connection);
          console.log(`Got ${connection.accounts.length} accounts for ${id}`);
        } catch (e) {
          console.error(`Error fetching accounts for ${id}:`, e.message);
        }
      }
    }
    saveConnections();
    res.json({ success: true, accounts: Array.from(bankConnections.values()).map(c => c.accounts).flat() });
  } catch (error) {
    console.error('Error refreshing accounts:', error);
    res.status(500).json({ error: 'Failed to refresh accounts' });
  }
});

// Debug endpoint to list all connections
app.get('/api/debug/connections', (req, res) => {
  const connections = Array.from(bankConnections.values()).map(conn => ({
    id: conn.id,
    hasAccessToken: !!conn.accessToken,
    hasRefreshToken: !!conn.refreshToken,
    expiresAt: conn.expiresAt,
    accountsCount: conn.accounts.length,
    providerId: conn.providerId
  }));
  res.json({ connections });
});

// Get transactions endpoint
app.get('/api/transactions', async (req, res) => {
  try {
    console.log('=== Fetching Transactions ===');
    
    const transactions = await getAllTransactions();
    console.log(`Total transactions: ${transactions.length}`);

    // Check if all connections have SCA expired
    const connections = Array.from(bankConnections.values());
    const allScaExpired = connections.length > 0 && connections.every(c => c.scaExpired);
    const anyScaExpired = connections.some(c => c.scaExpired);

    res.json({ 
      transactions,
      scaExpired: anyScaExpired,
      requiresReauth: allScaExpired
    });

  } catch (error) {
    console.error('=== Transactions Error ===');
    console.error('Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Refresh token helper
async function refreshToken(connection) {
  if (!connection.refreshToken) {
    throw new Error('No refresh token available');
  }

  console.log(`Refreshing access token for connection ${connection.id}...`);

  const response = await axios.post(
    `${TRUELAYER_AUTH_URL}connect/token`,
    new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: connection.refreshToken
    }).toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  connection.accessToken = response.data.access_token;
  connection.refreshToken = response.data.refresh_token;
  connection.expiresAt = Date.now() + (response.data.expires_in * 1000);

  // Save connections to file after refresh
  saveConnections();

  console.log(`Token refreshed successfully for connection ${connection.id}`);
}

// Refresh token endpoint
app.post('/auth/truelayer/refresh', async (req, res) => {
  try {
    for (const [id, connection] of bankConnections) {
      if (connection.refreshToken) {
        await refreshToken(connection);
      }
    }
    // Save after refresh
    saveConnections();
    res.json({ success: true });
  } catch (error) {
    console.error('Refresh error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// Disconnect endpoint - removes all connections
app.post('/auth/truelayer/disconnect', (req, res) => {
  bankConnections.clear();
  // Save to file after disconnect
  saveConnections();
  console.log('Disconnected all banks from TrueLayer');
  res.json({ success: true });
});

// Disconnect specific bank
app.post('/auth/truelayer/disconnect/:connectionId', (req, res) => {
  const { connectionId } = req.params;
  if (bankConnections.has(connectionId)) {
    bankConnections.delete(connectionId);
    // Save to file after disconnect
    saveConnections();
    console.log(`Disconnected bank: ${connectionId}`);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Connection not found' });
  }
});

// Barclaycard PDF Import Endpoint
app.post('/api/import/barclaycard-pdf', upload.single('pdfFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    console.log('=== Processing Barclaycard PDF ===');
    
    // Parse the PDF
    const pdfData = await pdfParse(req.file.buffer);
    const pdfText = pdfData.text;
    
    // Extract account details
    const accountNumberMatch = pdfText.match(/Number\s+(\d{4}\s+\d{4}\s+\d{4}\s+\d{4})/);
    const accountNumber = accountNumberMatch ? accountNumberMatch[1].replace(/\s+/g, '') : null;
    
    const balanceMatch = pdfText.match(/Your new balance:\s+£([\d,.]+)/);
    const balance = balanceMatch ? parseFloat(balanceMatch[1].replace(/,/g, '')) : 0;
    
    const availableMatch = pdfText.match(/Available to spend:\s+£([\d,.]+)/);
    const available = availableMatch ? parseFloat(availableMatch[1].replace(/,/g, '')) : 0;
    
    const creditLimitMatch = pdfText.match(/Your current credit limit:\s+£([\d,.]+)/);
    const creditLimit = creditLimitMatch ? parseFloat(creditLimitMatch[1].replace(/,/g, '')) : 0;
    
    // Extract transactions
    const transactions = [];
    
    // Define regex patterns for different transaction types
    const transactionRegex = /(\d{2}\s+[A-Za-z]{3})([^£]+)£([\d,.]+)(?:\s*CR)?/g;
    
    let match;
    while ((match = transactionRegex.exec(pdfText)) !== null) {
      const dateStr = match[1].trim();
      const description = match[2].trim();
      const amountStr = match[3].trim();
      const isCredit = match[0].includes('CR');
      
      // Parse date (assuming current year)
      const currentYear = new Date().getFullYear();
      const dateParts = dateStr.split(' ');
      const day = parseInt(dateParts[0]);
      const monthAbbr = dateParts[1];
      
      // Convert month abbreviation to month number
      const months = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      };
      
      const month = months[monthAbbr];
      const date = new Date(currentYear, month, day);
      
      // Parse amount
      const amount = parseFloat(amountStr.replace(/,/g, ''));
      
      // Determine transaction type and category
      let category = 'Uncategorized';
      let type = 'expense';
      
      if (description.includes('Payment') && description.includes('Thank You')) {
        type = 'transfer';
        category = 'Credit Card Payment';
      } else if (isCredit) {
        type = 'income';
        category = 'Refund';
      } else {
        // Categorize expenses
        if (description.includes('Shell') || description.includes('Service Stati')) {
          category = 'Fuel';
        } else if (description.includes('Temu')) {
          category = 'Shopping';
        } else if (description.includes('Costa') || description.includes('Coffee')) {
          category = 'Food & Dining';
        }
      }
      
      transactions.push({
        id: `barclaycard_${date.getTime()}_${Math.floor(Math.random() * 1000)}`,
        date: date.toISOString(),
        description: description,
        amount: isCredit ? amount : -amount, // Credits are positive, debits are negative
        currency: 'GBP',
        merchant: description.split(',')[0].trim(),
        accountId: `barclaycard_${accountNumber}`,
        accountName: 'Barclaycard Platinum Visa',
        providerId: 'barclaycard',
        providerName: 'Barclaycard',
        category: category,
        type: type
      });
    }
    
    // Create account object
    const account = {
      account_id: `barclaycard_${accountNumber}`,
      account_type: 'CREDIT_CARD',
      display_name: 'Barclaycard Platinum Visa',
      currency: 'GBP',
      account_number: {
        number: accountNumber ? accountNumber.slice(-4) : '8005'
      },
      provider: {
        display_name: 'Barclaycard',
        provider_id: 'barclaycard',
        logo_uri: ''
      },
      balance: {
        available: available,
        current: -balance, // Negative because it's owed
        currency: 'GBP',
        credit_limit: creditLimit
      }
    };
    
    console.log(`Extracted ${transactions.length} transactions from Barclaycard statement`);
    
    res.json({
      account: account,
      transactions: transactions
    });
    
  } catch (error) {
    console.error('Error processing PDF:', error);
    res.status(500).json({ error: 'Failed to process PDF file' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n=== Server Running ===`);
  console.log(`Backend: http://localhost:${PORT}`);
  console.log(`Frontend: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log(`\nEndpoints:`);
  console.log(`  - GET  /api/health`);
  console.log(`  - GET  /auth/truelayer (connect bank)`);
  console.log(`  - GET  /auth/truelayer/callback`);
  console.log(`  - GET  /api/accounts`);
  console.log(`  - GET  /api/transactions`);
  console.log(`  - POST /auth/truelayer/refresh`);
  console.log(`  - POST /auth/truelayer/disconnect`);
  console.log(`  - POST /api/import/barclaycard-pdf`);
  console.log(`======================\n`);
});
