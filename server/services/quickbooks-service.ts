import axios from 'axios';
import OAuthClient from 'intuit-oauth';
import crypto from 'crypto';
import { storage } from '../storage';

interface QuickBooksTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  realmId: string;
}

interface QuickBooksCustomer {
  Id: string;
  Name: string;
  CompanyName?: string;
  PrimaryEmailAddr?: {
    Address: string;
  };
  PrimaryPhone?: {
    FreeFormNumber: string;
  };
  BillAddr?: {
    Line1?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
  };
  Active: boolean;
}

interface QuickBooksItem {
  Id: string;
  Name: string;
  Type: string;
  UnitPrice?: number;
  QtyOnHand?: number;
  Description?: string;
  Active: boolean;
}

export class QuickBooksService {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private oauthClient: OAuthClient;
  private environment: 'production' | 'sandbox';
  private webhookVerifierToken: string;

  constructor() {
    // Use standardized QBO_ environment variables
    this.clientId = process.env.QBO_CLIENT_ID!;
    this.clientSecret = process.env.QBO_CLIENT_SECRET!;
    this.webhookVerifierToken = process.env.QBO_WEBHOOK_VERIFIER!;
    // Use environment variable to determine sandbox vs production
    this.environment = (process.env.QBO_ENV as 'production' | 'sandbox') || 'production';
    
    // Use QBO_BASE_URL if provided, otherwise use default based on environment
    let baseUrl = process.env.QBO_BASE_URL || (
      this.environment === 'production' 
        ? 'https://quickbooks.api.intuit.com/v3/company'
        : 'https://sandbox-quickbooks.api.intuit.com/v3/company'
    );
    
    // Ensure no trailing slash
    this.baseUrl = baseUrl.replace(/\/$/, '');
    
    // Always use production redirect URI to match QuickBooks app configuration
    const redirectUri = process.env.QBO_REDIRECT_URI || 'https://www.wemakemarin.com/quickbooks/callback';

    // Initialize Intuit OAuth Client
    this.oauthClient = new OAuthClient({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      environment: this.environment,
      redirectUri: redirectUri
    });

    console.log('🔧 QuickBooks OAuth Configuration:');
    console.log(`   Environment: ${this.environment}`);
    console.log(`   OAuth Callback: ${redirectUri}`);
    console.log(`   Company ID: ${process.env.QBO_COMPANY_ID}`);
    console.log(`   Base URL: ${this.baseUrl}`);
    console.log(`   Webhook URL: ${process.env.QBO_WEBHOOK_URI}`);

    if (!this.clientId || !this.clientSecret) {
      throw new Error('QuickBooks OAuth credentials not configured. Please set QBO_CLIENT_ID and QBO_CLIENT_SECRET environment variables.');
    }

    console.log('✅ QuickBooks service initialized successfully');
  }

  // Generate OAuth authorization URL using Intuit OAuth Client
  getAuthorizationUrl(userId: string, redirectUri?: string): string {
    const scope = [OAuthClient.scopes.Accounting];
    const state = Buffer.from(JSON.stringify({ userId, timestamp: Date.now() })).toString('base64');
    
    // Always use production redirect URI
    const productionRedirectUri = process.env.QBO_REDIRECT_URI || 'https://www.wemakemarin.com/quickbooks/callback';
    
    // Create a temporary OAuth client with the correct redirect URI
    const tempOAuthClient = new OAuthClient({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      environment: this.environment,
      redirectUri: productionRedirectUri
    });
    
    return tempOAuthClient.authorizeUri({
      scope,
      state
    });
  }

  // Refresh tokens using refresh token
  async refreshTokens(refreshToken: string): Promise<QuickBooksTokens> {
    try {
      console.log('🔄 Attempting to refresh QuickBooks tokens');
      
      // Set the refresh token in the client
      (this.oauthClient as any).token = {
        refresh_token: refreshToken
      };
      
      const tokenResponse = await this.oauthClient.refresh();
      
      console.log('✅ Tokens refreshed successfully');
      return {
        access_token: tokenResponse.token.access_token,
        refresh_token: tokenResponse.token.refresh_token,
        token_type: tokenResponse.token.token_type || 'Bearer',
        expires_in: tokenResponse.token.expires_in || 3600,
        scope: tokenResponse.token.scope || '',
        realmId: tokenResponse.token.realmId || ''
      };
    } catch (error: any) {
      console.error('❌ Failed to refresh tokens:', error);
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  // Get company info to test connection
  async getCompanyInfo(accessToken: string, realmId: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/${realmId}/companyinfo/${realmId}`;
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      return response.data.CompanyInfo;
    } catch (error: any) {
      console.error('Failed to get company info:', error.response?.data || error);
      throw new Error('Failed to get company information');
    }
  }

  // Exchange authorization code for tokens using Intuit OAuth Client
  async exchangeCodeForTokens(code: string, redirectUri: string, realmId: string): Promise<QuickBooksTokens> {
    try {
      console.log('🔄 Token exchange attempt:', {
        codeLength: code.length,
        redirectUri,
        realmId,
        environment: this.environment,
        clientIdLength: this.clientId.length
      });

      // Use the main OAuth client to exchange the code
      // This ensures consistency with the authorization flow
      const authResponse = await this.oauthClient.createToken(code);
      
      console.log('✅ OAuth Response received:', {
        hasToken: !!authResponse.token,
        tokenType: authResponse.token?.token_type,
        hasAccessToken: !!authResponse.token?.access_token,
        hasRefreshToken: !!authResponse.token?.refresh_token,
        realmId: authResponse.token?.realmId || realmId,
        expiresIn: authResponse.token?.expires_in
      });

      if (!authResponse.token || !authResponse.token.access_token) {
        console.error('❌ Invalid token response:', authResponse);
        throw new Error('No valid token received from QuickBooks');
      }

      return {
        access_token: authResponse.token.access_token,
        refresh_token: authResponse.token.refresh_token,
        token_type: authResponse.token.token_type || 'Bearer',
        expires_in: authResponse.token.expires_in || 3600,
        scope: authResponse.token.scope || 'com.intuit.quickbooks.accounting',
        realmId: authResponse.token.realmId || realmId
      };
    } catch (error: any) {
      console.error('❌ Error exchanging code for tokens:', {
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        data: error.data,
        authResponse: error.authResponse,
        intuit_tid: error.intuit_tid,
        code: code.substring(0, 20) + '...',
        redirectUri: redirectUri
      });
      console.error('OAuth Client environment:', this.environment);
      console.error('OAuth Client ID:', this.clientId.substring(0, 10) + '...');
      
      // More detailed error message based on error type
      if (error.status === 400) {
        throw new Error(`QuickBooks OAuth Error (400): The authorization code may be invalid or expired. Original error: ${error.message}`);
      } else {
        throw new Error(`Failed to exchange authorization code for tokens: ${error.message}`);
      }
    }
  }

  // Refresh access token using Intuit OAuth Client
  async refreshAccessToken(refreshToken: string): Promise<QuickBooksTokens> {
    try {
      console.log('🔄 Starting token refresh process...');
      
      // Create a new OAuth client specifically for token refresh
      const refreshClient = new OAuthClient({
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        environment: this.environment,
        redirectUri: process.env.QBO_REDIRECT_URI || 'https://www.wemakemarin.com/quickbooks/callback'
      });

      console.log('🔄 Calling refreshUsingToken with refresh token...');
      
      // Use the proper refreshUsingToken method instead of refresh()
      const authResponse = await refreshClient.refreshUsingToken(refreshToken);
      
      console.log('✅ Token refresh response received');
      
      if (!authResponse || !authResponse.getToken()) {
        throw new Error('No token data received from QuickBooks refresh');
      }

      const tokenData = authResponse.getToken();
      console.log('📄 Token data extracted successfully');

      return {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || refreshToken, // Keep original if not provided
        token_type: tokenData.token_type || 'Bearer',
        expires_in: tokenData.expires_in || 3600,
        scope: tokenData.scope || 'com.intuit.quickbooks.accounting',
        realmId: tokenData.realmId || ''
      };
    } catch (error: any) {
      console.error('❌ Token refresh failed:', {
        message: error.message,
        authResponse: error.authResponse,
        intuit_tid: error.intuit_tid,
        originalError: error
      });
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  // Make authenticated API requests to QuickBooks directly
  private async makeQuickBooksAPIRequest(userId: string, endpoint: string, method: 'GET' | 'POST' | 'PUT' = 'GET', data?: any): Promise<any> {
    const integration = await storage.getIntegration(userId, 'quickbooks');
    if (!integration || !integration.isActive) {
      throw new Error('QuickBooks integration not found or inactive');
    }

    const accessToken = await this.getValidAccessToken(userId);
    const realmId = integration.realmId;
    
    if (!realmId) {
      throw new Error('QuickBooks realm ID not found');
    }

    const url = `${this.baseUrl}/${realmId}/${endpoint}`;
    
    try {
      const response = await axios({
        method,
        url,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        data,
        timeout: 30000
      });
      
      return response.data;
    } catch (error: any) {
      console.error('QuickBooks API request failed:', {
        endpoint,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      throw new Error(`QuickBooks API request failed: ${error.message}`);
    }
  }

  // Get valid access token (refresh if needed)
  async getValidAccessToken(userId: string): Promise<string> {
    const integration = await storage.getIntegration(userId, 'quickbooks');
    if (!integration || !integration.isActive) {
      throw new Error('QuickBooks integration not found or inactive');
    }

    // If no access token, try to refresh using refresh token
    if (!integration.accessToken && !integration.refreshToken) {
      throw new Error('QuickBooks token expired and refresh failed');
    }
    
    if (!integration.accessToken && integration.refreshToken) {
      // Skip refresh attempts for test tokens or clearly invalid tokens
      if (integration.refreshToken.startsWith('test_')) {
        console.log('⚠️ Test refresh token detected - re-authorization required');
        throw new Error('QuickBooks re-authorization required (test token)');
      }
      
      console.log('No access token found, attempting refresh...');
      try {
        const refreshedTokens = await this.refreshAccessToken(integration.refreshToken);
        
        // Update stored tokens
        await storage.upsertIntegration({
          userId,
          provider: 'quickbooks',
          accessToken: refreshedTokens.access_token,
          refreshToken: refreshedTokens.refresh_token,
          realmId: integration.realmId || refreshedTokens.realmId,
          isActive: true,
          lastSyncAt: new Date()
        });
        
        return refreshedTokens.access_token;
      } catch (refreshError) {
        console.error('Failed to refresh QuickBooks token:', refreshError);
        throw new Error('QuickBooks token expired and refresh failed');
      }
    }

    try {
      // Test token validity by making a simple API call
      const testResponse = await axios.get(
        `${this.baseUrl}/${integration.realmId}/companyinfo/${integration.realmId}`,
        {
          headers: {
            'Authorization': `Bearer ${integration.accessToken}`,
            'Accept': 'application/json'
          },
          timeout: 10000
        }
      );
      
      // If successful, return current token
      return integration.accessToken || '';
    } catch (error: any) {
      console.log('Token validation failed, attempting refresh...');
      
      // If 401 or connection issues, try to refresh token
      if (integration.refreshToken) {
        // Skip refresh attempts for test tokens
        if (integration.refreshToken.startsWith('test_')) {
          console.log('⚠️ Test refresh token detected - re-authorization required');
          throw new Error('QuickBooks re-authorization required (test token)');
        }
        
        try {
          const refreshedTokens = await this.refreshAccessToken(integration.refreshToken);
          
          // Update stored tokens
          await storage.upsertIntegration({
            userId,
            provider: 'quickbooks',
            accessToken: refreshedTokens.access_token,
            refreshToken: refreshedTokens.refresh_token,
            realmId: integration.realmId || refreshedTokens.realmId,
            isActive: true,
            lastSyncAt: new Date()
          });
          
          return refreshedTokens.access_token;
        } catch (refreshError) {
          console.error('Failed to refresh QuickBooks token:', refreshError);
          throw new Error('QuickBooks token expired and refresh failed');
        }
      }
      
      throw new Error('QuickBooks token validation failed and no refresh token available');
    }
  }

  // Sync customers from QuickBooks
  async syncCustomers(userId: string): Promise<void> {
    try {
      const response = await this.makeQuickBooksAPIRequest(userId, 'query?query=SELECT * FROM Customer MAXRESULTS 1000');
      const customers: QuickBooksCustomer[] = response.QueryResponse?.Customer || [];

      let created = 0, updated = 0, skipped = 0;

      for (const qbCustomer of customers) {
        // Check if customer already exists by QuickBooks ID
        const existingCustomer = await storage.getCustomerByQuickbooksId(qbCustomer.Id);
        
        const customerData = {
          userId,
          name: qbCustomer.Name,
          companyName: qbCustomer.CompanyName || null,
          email: qbCustomer.PrimaryEmailAddr?.Address || null,
          phone: qbCustomer.PrimaryPhone?.FreeFormNumber || null,
          address: qbCustomer.BillAddr ? 
            [qbCustomer.BillAddr.Line1, qbCustomer.BillAddr.City, qbCustomer.BillAddr.CountrySubDivisionCode, qbCustomer.BillAddr.PostalCode]
              .filter(Boolean).join(', ') : null,
          quickbooksId: qbCustomer.Id
        };
        
        if (existingCustomer) {
          // Update existing customer
          await storage.updateCustomer(existingCustomer.id, customerData);
          updated++;
        } else {
          // Create new customer
          await storage.createCustomer(customerData);
          created++;
        }
      }

      // Log sync activity with detailed stats
      await storage.createActivityLog({
        userId,
        type: 'quickbooks_sync',
        description: `QuickBooks sync: ${created} new, ${updated} updated, ${skipped} skipped customers`,
        metadata: { 
          customerCount: customers.length,
          created,
          updated,
          skipped
        }
      });
      
      console.log(`✅ Customer sync complete: ${created} created, ${updated} updated, ${skipped} skipped`);

    } catch (error: any) {
      console.error('Error syncing customers:', error.message);
      throw new Error('Failed to sync customers from QuickBooks');
    }
  }

  // Sync products/items from QuickBooks
  async syncItems(userId: string): Promise<void> {
    try {
      const response = await this.makeQuickBooksAPIRequest(userId, 'query?query=SELECT * FROM Item MAXRESULTS 1000');
      const items: QuickBooksItem[] = response.QueryResponse?.Item || [];

      let created = 0, updated = 0, skipped = 0;

      for (const qbItem of items) {
        // Check if product already exists by QuickBooks ID
        const existingProduct = await storage.getProductByQuickbooksId(qbItem.Id);
        
        // Determine product type: service, material (non-inventory), or product
        let productType = 'product';
        if (qbItem.Type?.toLowerCase() === 'service') {
          productType = 'service';
        } else if (qbItem.Type?.toLowerCase() === 'noninventory' || qbItem.Type?.toLowerCase() === 'non-inventory') {
          productType = 'material';
        }
        
        const productData = {
          userId,
          name: qbItem.Name,
          description: qbItem.Description || null,
          unitPrice: qbItem.UnitPrice?.toString() || '0.00',
          type: productType,
          quickbooksId: qbItem.Id,
          qtyOnHand: qbItem.QtyOnHand || null
        };
        
        if (existingProduct) {
          // Update existing product
          await storage.updateProduct(existingProduct.id, productData);
          updated++;
        } else {
          // Create new product
          await storage.createProduct(productData);
          created++;
        }
      }

      // Log sync activity with detailed stats
      await storage.createActivityLog({
        userId,
        type: 'quickbooks_sync',
        description: `QuickBooks sync: ${created} new, ${updated} updated, ${skipped} skipped items`,
        metadata: { 
          itemCount: items.length,
          created,
          updated,
          skipped
        }
      });
      
      console.log(`✅ Item sync complete: ${created} created, ${updated} updated, ${skipped} skipped`);

    } catch (error: any) {
      console.error('Error syncing items:', error.response?.data || error.message);
      throw new Error('Failed to sync items from QuickBooks');
    }
  }

  // Full sync (customers and items)
  // Sync recent invoices (last N days)
  async syncRecentInvoices(userId: string, days: number = 30): Promise<{ count: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    try {
      const response = await this.makeQuickBooksAPIRequest(
        userId,
        `query?query=SELECT * FROM Invoice WHERE TxnDate >= '${cutoffDate.toISOString().split('T')[0]}' MAXRESULTS 1000`
      );

      const invoices = response.QueryResponse?.Invoice || [];
      let syncCount = 0;

      for (const qbInvoice of invoices) {
        await this.processInvoice(qbInvoice, userId);
        syncCount++;
      }

      console.log(`Synced ${syncCount} recent invoices`);
      return { count: syncCount };
    } catch (error) {
      console.error('Error syncing recent invoices:', error);
      throw error;
    }
  }


  private async processInvoice(qbInvoice: any, userId: string): Promise<void> {
    try {
      const invoice = await storage.createInvoice({
        userId,
        customerId: qbInvoice.CustomerRef?.value || '',
        quickbooksId: qbInvoice.Id,
        invoiceNumber: qbInvoice.DocNumber || 'QB-' + qbInvoice.Id,
        invoiceDate: new Date(qbInvoice.TxnDate || Date.now()),
        dueDate: qbInvoice.DueDate ? new Date(qbInvoice.DueDate) : null,
        status: qbInvoice.Balance > 0 ? 'sent' : 'paid',
        subtotal: qbInvoice.TotalAmt?.toString() || '0',
        taxAmount: qbInvoice.TxnTaxDetail?.TotalTax?.toString() || '0',
        totalAmount: qbInvoice.TotalAmt?.toString() || '0',
        notes: qbInvoice.CustomerMemo?.value || null
      });

      // Process invoice line items if present
      if (qbInvoice.Line && Array.isArray(qbInvoice.Line)) {
        for (const line of qbInvoice.Line) {
          if (line.DetailType === 'SalesItemLineDetail' && line.SalesItemLineDetail) {
            await storage.createInvoiceItem({
              invoiceId: invoice.id,
              productId: line.SalesItemLineDetail.ItemRef?.value || null,
              description: line.Description || 'QuickBooks Item',
              quantity: line.SalesItemLineDetail.Qty?.toString() || '1',
              unitPrice: line.SalesItemLineDetail.UnitPrice?.toString() || '0',
              amount: line.Amount?.toString() || '0'
            });
          }
        }
      }
    } catch (error) {
      console.error('Error processing invoice:', error);
      throw error;
    }
  }

  async syncInvoices(userId: string): Promise<void> {
    try {
      const response = await this.makeQuickBooksAPIRequest(
        userId,
        'query?query=SELECT * FROM Invoice MAXRESULTS 1000'
      );

      const invoices = response.QueryResponse?.Invoice || [];
      
      for (const qbInvoice of invoices) {
        await this.processInvoice(qbInvoice, userId);
      }

      console.log(`Synced ${invoices.length} invoices`);
    } catch (error) {
      console.error('Error syncing invoices:', error);
      throw error;
    }
  }

  async fullSync(userId: string): Promise<void> {
    console.log(`Starting full QuickBooks sync for user ${userId}`);
    
    const startTime = Date.now();
    
    try {
      await this.syncCustomers(userId);
      await this.syncItems(userId);
      await this.syncInvoices(userId);
      
      const duration = Date.now() - startTime;
      console.log(`Full sync completed in ${Math.round(duration / 1000)}s`);
      
      // Update last sync time
      const integration = await storage.getIntegration(userId, 'quickbooks');
      if (integration) {
        await storage.upsertIntegration({
          userId,
          provider: 'quickbooks',
          isActive: integration.isActive,
          accessToken: integration.accessToken || '',
          refreshToken: integration.refreshToken || '',
          companyId: integration.companyId || undefined,
          realmId: integration.realmId || '',
          settings: integration.settings as any,
          lastSyncAt: new Date()
        });
      }
      
    } catch (error) {
      console.error('Full sync failed:', error);
      throw error;
    }
  }

  // Webhook signature verification
  verifyWebhookSignature(payload: string, intuitSignature: string): boolean {
    try {
      const hash = crypto
        .createHmac('sha256', this.webhookVerifierToken)
        .update(payload)
        .digest('base64');
      
      return hash === intuitSignature;
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  // Process webhook notifications
  async processWebhook(webhookPayload: any): Promise<void> {
    try {
      const events = webhookPayload.eventNotifications || [];
      
      for (const event of events) {
        const { realmId, dataChangeEvent } = event;
        
        // Find integration by realmId
        const integration = await storage.getIntegrationByRealmId(realmId);
        if (!integration || !integration.isActive) {
          console.log(`No active integration found for realm ${realmId}`);
          continue;
        }

        // Process data change events
        for (const change of dataChangeEvent.entities) {
          await this.processWebhookEntity(integration.userId, change);
        }

        // Update last sync time
        await storage.upsertIntegration({
          userId: integration.userId,
          provider: integration.provider,
          isActive: integration.isActive,
          accessToken: integration.accessToken || '',
          refreshToken: integration.refreshToken || '',
          companyId: integration.companyId || undefined,
          realmId: integration.realmId || '',
          settings: integration.settings as any,
          lastSyncAt: new Date()
        });

        // Log webhook processing
        await storage.createActivityLog({
          userId: integration.userId,
          type: 'webhook_processed',
          description: `Processed QuickBooks webhook for ${dataChangeEvent.entities.length} entities`,
          metadata: { 
            realmId, 
            entityCount: dataChangeEvent.entities.length,
            operation: dataChangeEvent.entities[0]?.operation || 'unknown'
          }
        });
      }
    } catch (error) {
      console.error('Error processing webhook:', error);
      throw error;
    }
  }

  // Process individual webhook entity changes
  private async processWebhookEntity(userId: string, entity: any): Promise<void> {
    const { name: entityType, id: entityId, operation } = entity;
    
    try {
      switch (entityType.toLowerCase()) {
        case 'customer':
          if (operation === 'Create' || operation === 'Update') {
            await this.syncSpecificCustomer(userId, entityId);
          } else if (operation === 'Delete') {
            await this.handleCustomerDeletion(userId, entityId);
          }
          break;
          
        case 'item':
          if (operation === 'Create' || operation === 'Update') {
            await this.syncSpecificItem(userId, entityId);
          } else if (operation === 'Delete') {
            await this.handleItemDeletion(userId, entityId);
          }
          break;
          
        case 'invoice':
          if (operation === 'Create' || operation === 'Update') {
            await this.syncSpecificInvoice(userId, entityId);
          } else if (operation === 'Delete') {
            await this.handleInvoiceDeletion(userId, entityId);
          }
          break;
          
        default:
          console.log(`Unhandled entity type: ${entityType}`);
      }
    } catch (error) {
      console.error(`Error processing ${entityType} ${operation}:`, error);
    }
  }

  // Sync specific customer by ID
  private async syncSpecificCustomer(userId: string, customerId: string): Promise<void> {
    try {
      const response = await this.makeQuickBooksAPIRequest(userId, `customers/${customerId}`);
      const customer: QuickBooksCustomer = response.QueryResponse?.Customer?.[0] || response.Customer;
      
      if (customer) {
        // Upsert customer in our database
        await storage.createCustomer({
          userId,
          name: customer.Name,
          companyName: customer.CompanyName || null,
          email: customer.PrimaryEmailAddr?.Address || null,
          phone: customer.PrimaryPhone?.FreeFormNumber || null,
          address: customer.BillAddr ? 
            [customer.BillAddr.Line1, customer.BillAddr.City, customer.BillAddr.CountrySubDivisionCode, customer.BillAddr.PostalCode]
              .filter(Boolean).join(', ') : null,
          quickbooksId: customer.Id
        });
      }
    } catch (error) {
      console.error('Error syncing specific customer:', error);
    }
  }

  // Sync specific item by ID
  private async syncSpecificItem(userId: string, itemId: string): Promise<void> {
    try {
      const response = await this.makeQuickBooksAPIRequest(userId, `items/${itemId}`);
      const item: QuickBooksItem = response.QueryResponse?.Item?.[0] || response.Item;
      
      if (item) {
        // Upsert product in our database
        await storage.createProduct({
          userId,
          name: item.Name,
          description: item.Description || null,
          unitPrice: item.UnitPrice?.toString() || '0',
          type: item.Type?.toLowerCase() === 'service' ? 'service' : 'product',
          quickbooksId: item.Id
        });
      }
    } catch (error) {
      console.error('Error syncing specific item:', error);
    }
  }

  // Sync specific invoice by ID
  private async syncSpecificInvoice(userId: string, invoiceId: string): Promise<void> {
    try {
      const response = await this.makeQuickBooksAPIRequest(userId, `invoices/${invoiceId}`);
      const invoice = response.QueryResponse?.Invoice?.[0] || response.Invoice;
      
      if (invoice) {
        // Process invoice data
        await this.processInvoice(invoice, userId);
      }
    } catch (error) {
      console.error('Error syncing specific invoice:', error);
    }
  }

  // Handle entity deletions
  private async handleCustomerDeletion(userId: string, customerId: string): Promise<void> {
    // Mark customer as inactive rather than deleting
    const customers = await storage.getCustomers(userId);
    const customer = customers.find(c => c.quickbooksId === customerId);
    if (customer) {
      // We don't have an updateCustomer method, so we'll log this for now
      await storage.createActivityLog({
        userId,
        type: 'customer_deleted_qb',
        description: `Customer ${customer.name} was deleted in QuickBooks`,
        metadata: { customerId, quickbooksId: customerId }
      });
    }
  }

  private async handleItemDeletion(userId: string, itemId: string): Promise<void> {
    const products = await storage.getProducts(userId);
    const product = products.find(p => p.quickbooksId === itemId);
    if (product) {
      await storage.createActivityLog({
        userId,
        type: 'product_deleted_qb',
        description: `Product ${product.name} was deleted in QuickBooks`,
        metadata: { productId: product.id, quickbooksId: itemId }
      });
    }
  }

  private async handleInvoiceDeletion(userId: string, invoiceId: string): Promise<void> {
    const invoices = await storage.getInvoices(userId);
    const invoice = invoices.find(i => i.quickbooksId === invoiceId);
    if (invoice) {
      await storage.createActivityLog({
        userId,
        type: 'invoice_deleted_qb',
        description: `Invoice ${invoice.invoiceNumber} was deleted in QuickBooks`,
        metadata: { invoiceId: invoice.id, quickbooksId: invoiceId }
      });
    }
  }

  // Revoke QuickBooks integration
  async revokeIntegration(userId: string): Promise<void> {
    try {
      const integration = await storage.getIntegration(userId, 'quickbooks');
      if (!integration) {
        throw new Error('QuickBooks integration not found');
      }

      // Create a revoke client for token revocation
      const revokeClient = new OAuthClient({
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        environment: this.environment,
        redirectUri: process.env.QBO_REDIRECT_URI || 'https://www.wemakemarin.com/quickbooks/callback'
      });

      await revokeClient.revoke();

      // Deactivate integration in our database
      await storage.upsertIntegration({
        userId: integration.userId,
        provider: integration.provider,
        isActive: false,
        accessToken: '',
        refreshToken: '',
        companyId: integration.companyId,
        realmId: integration.realmId,
        settings: integration.settings as any,
        lastSyncAt: integration.lastSyncAt
      });

      await storage.createActivityLog({
        userId,
        type: 'integration_revoked',
        description: 'QuickBooks integration was revoked',
        metadata: { provider: 'quickbooks' }
      });

    } catch (error: any) {
      console.error('Error revoking QuickBooks integration:', error);
      throw new Error('Failed to revoke QuickBooks integration');
    }
  }
}

export const quickbooksService = new QuickBooksService();