import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

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

// In-memory storage for multiple bank connections
// Each connection has its own tokens and accounts
let bankConnections = new Map();

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
const REDIRECT_URI = 'http://localhost:3001/auth/truelayer/callback';

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
  const authParams = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'info accounts balance transactions offline_access',
    providers: 'uk-ob-all uk-oauth-all',
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

// Fetch accounts from TrueLayer for a specific connection
async function fetchAccounts(connection) {
  try {
    const response = await axios.get(`${TRUELAYER_API_URL}data/v1/accounts`, {
      headers: {
        'Authorization': `Bearer ${connection.accessToken}`
      }
    });

    connection.accounts = response.data.results || [];
    console.log(`Fetched ${connection.accounts.length} accounts for connection ${connection.id}`);
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
  
  for (const [id, connection] of bankConnections) {
    if (!connection.accessToken || !connection.accounts.length) {
      continue;
    }

    // Fetch transactions for each account
    for (const account of connection.accounts) {
      try {
        // Calculate the from date - use account creation date or 10 years back
        let fromDate;
        const now = new Date();
        
        // Try to get account creation date from the account object
        // TrueLayer may provide this in various formats
        if (account.created_at) {
          fromDate = new Date(account.created_at);
        } else if (account.creation_date) {
          fromDate = new Date(account.creation_date);
        } else if (account.opening_date) {
          fromDate = new Date(account.opening_date);
        } else {
          // Default to 10 years ago if no creation date available
          fromDate = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());
        }
        
        // Don't go future dates
        if (fromDate > now) {
          fromDate = now;
        }
        
        // Calculate how far back we're fetching (for logging)
        const daysBack = Math.floor((now - fromDate) / (1000 * 60 * 60 * 24));
        console.log(`Fetching transactions for account ${account.account_id} from ${fromDate.toISOString().split('T')[0]} (${daysBack} days back)`);
        
        // Format date as YYYY-MM-DD
        const fromDateStr = fromDate.toISOString().split('T')[0];
        
        const response = await axios.get(
          `${TRUELAYER_API_URL}data/v1/accounts/${account.account_id}/transactions`,
          {
            headers: {
              'Authorization': `Bearer ${connection.accessToken}`
            },
            params: {
              from: fromDateStr,
              to: now.toISOString().split('T')[0]
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
        console.error(`Error fetching transactions for account ${account.account_id}:`, 
          txError.response?.data || txError.message);
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
    const accounts = await getAllAccounts();
    res.json({ accounts });

  } catch (error) {
    console.error('Error in /api/accounts:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// Get transactions endpoint
app.get('/api/transactions', async (req, res) => {
  try {
    console.log('=== Fetching Transactions ===');
    
    const transactions = await getAllTransactions();
    console.log(`Total transactions: ${transactions.length}`);
    res.json({ transactions });

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
    res.json({ success: true });
  } catch (error) {
    console.error('Refresh error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// Disconnect endpoint - removes all connections
app.post('/auth/truelayer/disconnect', (req, res) => {
  bankConnections.clear();
  console.log('Disconnected all banks from TrueLayer');
  res.json({ success: true });
});

// Disconnect specific bank
app.post('/auth/truelayer/disconnect/:connectionId', (req, res) => {
  const { connectionId } = req.params;
  if (bankConnections.has(connectionId)) {
    bankConnections.delete(connectionId);
    console.log(`Disconnected bank: ${connectionId}`);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Connection not found' });
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
  console.log(`======================\n`);
});
