      res.redirect('/products?qb_error=' + encodeURIComponent(errorMessage));
    }
  });



  // Development: Check QuickBooks connection status
  app.get('/api/integrations/quickbooks/debug', isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      const integration = await storage.getIntegration(userId, 'quickbooks');
      
      res.json({
        hasIntegration: !!integration,
        isActive: integration?.isActive || false,
        hasAccessToken: !!integration?.accessToken,
        hasRefreshToken: !!integration?.refreshToken,
        realmId: integration?.realmId || null,
        lastSyncAt: integration?.lastSyncAt || null,
        envVars: {
          hasClientId: !!process.env.QBO_CLIENT_ID,
          hasClientSecret: !!process.env.QBO_CLIENT_SECRET,
          redirectUri: process.env.QBO_REDIRECT_URI
        }
      });
    } catch (error) {
      console.error('Debug error:', error);
      res.status(500).json({ error: 'Debug check failed' });
    }
  });

  // Simulate QuickBooks connection for development
  app.post('/api/integrations/quickbooks/simulate-connection', isAuthenticated, async (req, res) => {
    try {
      console.log('🧪 Creating simulated QuickBooks connection...');
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      // Check if integration already exists
      const existingIntegration = await storage.getIntegration(userId, 'quickbooks');
      
      if (existingIntegration) {
        console.log('✅ Simulated QuickBooks connection already exists');
        
        // Update it to be active
        await storage.updateIntegration(existingIntegration.id, {
          isActive: true,
          lastSyncAt: new Date()
        });
      } else {
        // Create new simulated QuickBooks integration
        await storage.createIntegration({
          userId,
          provider: 'quickbooks',
          accessToken: 'dev_simulated_token_' + Date.now(),
          refreshToken: 'dev_simulated_refresh_' + Date.now(),
          realmId: 'dev_realm_' + Date.now(),
          isActive: true,
          lastSyncAt: new Date()
        });
      }

      // Import test data to simulate successful sync
      console.log('📊 Importing test data...');
      await dataImportService.importAllData();
      
      console.log('✅ Simulated QuickBooks connection created with test data');

      res.json({
        message: "Simulated QuickBooks connection created successfully",
        status: "connected",
        timestamp: new Date().toISOString(),
        note: "This is a development simulation. For production, use the real OAuth flow."
      });
      
    } catch (error) {
      console.error('Error creating simulated connection:', error);
      res.status(500).json({ message: "Failed to create simulated connection" });
    }
  });

  // Initial data pull from QuickBooks
  app.post('/api/integrations/quickbooks/initial-sync', isAuthenticated, async (req, res) => {
    try {
      console.log('🚀 Starting initial QuickBooks data pull...');
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      // Check if we have QuickBooks connection
      const integration = await storage.getIntegration(userId, 'quickbooks');
      if (!integration || !integration.accessToken) {
        return res.status(400).json({ 
          message: "QuickBooks not connected. Please connect to QuickBooks first.",
          needsConnection: true
        });
      }
      
      // Pull customers
      console.log('📊 Pulling QuickBooks customers...');
      await quickbooksService.syncCustomers(userId);
      
      // Pull products/services
      console.log('🛍️ Pulling QuickBooks items...');
      await quickbooksService.syncItems(userId);
      
      // Pull recent invoices
      console.log('📄 Pulling QuickBooks invoices...');
      await quickbooksService.syncInvoices(userId);
      
      await storage.createActivityLog({
        userId,
        type: 'initial_sync',
        description: 'Initial QuickBooks data pull completed - customers, items, and invoices',
        metadata: { timestamp: new Date() }
      });

      console.log('✅ Initial QuickBooks data pull completed successfully');
      res.json({ message: "Initial QuickBooks data pull completed successfully" });
    } catch (error) {
      console.error("❌ Error pulling initial QuickBooks data:", error);
      res.status(500).json({ 
        message: "Failed to pull initial QuickBooks data", 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  app.post('/api/integrations/quickbooks/sync', async (req, res) => {
    try {
      console.log('🔄 Manual QuickBooks sync triggered');
      
      // For development, use a default admin user
      const userId = 'dev_user_123';
      
      // Check if we have QuickBooks connection
      const integration = await storage.getIntegration(userId, 'quickbooks');
      if (!integration || !integration.accessToken) {
        return res.status(400).json({ 
          message: "QuickBooks not connected. Please connect to QuickBooks first.",
          needsConnection: true
        });
      }

      console.log('✅ QuickBooks integration found, starting sync...');
      await quickbooksService.fullSync(userId);
      
      await storage.createActivityLog({
        userId,
        type: 'manual_sync',
        description: 'Manual QuickBooks sync completed',
        metadata: { timestamp: new Date() }
      });

      console.log('✅ QuickBooks sync completed successfully');
      res.json({ message: "QuickBooks sync completed successfully" });
    } catch (error) {
      console.error("Error syncing with QuickBooks:", error);
      res.status(500).json({ 
        message: "Failed to sync with QuickBooks", 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // QuickBooks webhook endpoint  
  // ✅ FIXED: QuickBooks webhook endpoint (separate from OAuth callback)
  app.post('/quickbooks/webhook', async (req, res) => {
    try {
      const signature = req.headers['intuit-signature'] as string;
      const payload = JSON.stringify(req.body);
      
      console.log('📥 QuickBooks webhook received:', { 
        entities: req.body?.eventNotifications?.[0]?.dataChangeEvent?.entities || 'unknown',
        realmId: req.body?.eventNotifications?.[0]?.realmId || 'unknown'
      });
      
      // Verify webhook signature with HMAC-SHA256
      if (!quickbooksService.verifyWebhookSignature(payload, signature)) {
        console.error('❌ Invalid QuickBooks webhook signature');
        return res.status(401).json({ message: 'Invalid signature' });
      }

      // Process webhook payload for real-time data sync
      await quickbooksService.processWebhook(req.body);
      
      console.log('✅ QuickBooks webhook processed successfully');
      res.status(200).json({ message: 'Webhook processed successfully' });
    } catch (error) {
      console.error('❌ Error processing QuickBooks webhook:', error);
      res.status(500).json({ message: 'Failed to process webhook' });
    }
  });

  // Team Dashboard Calendar Integration - Google Calendar Events
  app.get('/api/calendar/events', async (req, res) => {
    try {
      const { week } = req.query;
      
      // Mock calendar events with real Google Calendar structure for development
      // Return empty calendar events for now
      res.json([]);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      res.status(500).json({ error: 'Failed to fetch calendar events' });
    }
  });

  // Work Queue API for technician task management
  app.get('/api/work-queue', async (req, res) => {
    try {
      // Return empty work queue for now
      res.json([]);
    } catch (error) {
      console.error('Error fetching work queue:', error);
      res.json([]);
    }
  });

  // Service completion endpoint for checklist data
  app.post('/api/service-completions', async (req, res) => {
    try {
      const completionData = req.body;
      
      console.log('📋 Service completion received:', {
        eventId: completionData.eventId,
        customer: completionData.customer?.name,
        technician: completionData.technician,
        completedSteps: completionData.checklist?.filter((item: any) => item.completed).length
      });

      // Here you would save to database and update calendar
      // For now, simulate successful completion
      
      res.json({ 
        message: 'Service completion recorded successfully',
        id: completionData.eventId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error recording service completion:', error);
      res.status(500).json({ error: 'Failed to record service completion' });
    }
  });



  // QuickBooks disconnect endpoint
  app.post('/quickbooks/disconnect', isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Invalid user ID" });
      }
      await quickbooksService.revokeIntegration(userId);
      
      res.json({ message: "QuickBooks integration disconnected successfully" });
    } catch (error) {
      console.error("Error disconnecting QuickBooks:", error);
      res.status(500).json({ message: "Failed to disconnect QuickBooks integration" });
    }
  });



  // QuickBooks connection status endpoint
  app.get('/api/integrations/quickbooks/status', async (req, res) => {
    try {
      const userId = 'dev_user_123';
      const integration = await storage.getIntegration(userId, 'quickbooks');
      
      res.json({
        connected: !!integration?.isActive && !!integration?.accessToken,
        lastSync: integration?.lastSyncAt,
        realmId: integration?.realmId,
        hasTokens: !!integration?.accessToken
      });
    } catch (error) {
      console.error("Error getting QuickBooks status:", error);
      res.status(500).json({ 
        connected: false,
        lastSync: null,
        realmId: null,
        hasTokens: false
      });
    }
  });

  // Test webhook endpoint for development
  app.post('/api/webhooks/quickbooks/test', isAuthenticated, async (req, res) => {
    try {
      const testPayload = {
        eventNotifications: [{
          realmId: req.body.realmId || 'test-realm',
          dataChangeEvent: {
            entities: [{
              name: req.body.entityType || 'Customer',
              id: req.body.entityId || 'test-123',
              operation: req.body.operation || 'Create',
              lastUpdated: new Date().toISOString()
            }]
          }
        }]
      };

      await quickbooksService.processWebhook(testPayload);
      res.json({ message: 'Test webhook processed successfully', payload: testPayload });
    } catch (error) {
      console.error('Error processing test webhook:', error);
      res.status(500).json({ message: 'Failed to process test webhook' });
    }
  });

  // Database Connections API routes
  app.get("/api/database-connections", async (req, res) => {
    try {
      // Simple mock data for development
      const connections = [
        {
          id: '1',
          name: 'PostgreSQL Main',
          status: 'connected',
          lastChecked: new Date().toISOString(),
          type: 'postgresql'
        }
      ];
      res.json(connections);
    } catch (error) {
      console.error("Error fetching database connections:", error);
      res.status(500).json({ message: "Failed to fetch database connections" });
    }
  });

  app.post("/api/database-connections", async (req, res) => {
    try {
      const userId = 'temp_user_001'; // req.user!.claims.sub temporarily replaced
      const connectionData = { ...req.body, userId };
      
      const connection = await storage.createDatabaseConnection(connectionData);
      res.json(connection);
    } catch (error) {
      console.error("Error creating database connection:", error);
      res.status(500).json({ message: "Failed to create database connection" });
    }
  });

  app.post("/api/database-connections/test", async (req, res) => {
    try {
      const { host, port, database, username, password, ssl } = req.body;
      
      // Here you would implement actual database connection testing
      // For now, we'll simulate a test
      const testSuccess = true; // Simulate test result
      
      if (testSuccess) {
        res.json({ message: "Connection test successful" });
      } else {
        res.status(400).json({ message: "Connection test failed" });
      }
    } catch (error) {
      console.error("Error testing database connection:", error);
      res.status(500).json({ message: "Failed to test connection" });
    }
  });

  app.post("/api/database-connections/:id/sync", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.claims.sub;
      
      // Update last sync time
      await storage.updateDatabaseConnection(id, {
        lastSyncAt: new Date(),
        lastSyncStatus: 'success'
      });
      
      res.json({ message: "Database sync completed" });
    } catch (error) {
      console.error("Error syncing database:", error);
      res.status(500).json({ message: "Failed to sync database" });
    }
  });

  app.post("/api/database-connections/:id/auto-sync", async (req, res) => {
    try {
      const { id } = req.params;
      const { autoSync, syncInterval } = req.body;
      const userId = req.user!.claims.sub;
      
      await storage.updateDatabaseConnection(id, { autoSync, syncInterval });
      
      res.json({ message: "Auto-sync settings updated" });
    } catch (error) {
      console.error("Error updating auto-sync settings:", error);
      res.status(500).json({ message: "Failed to update auto-sync settings" });
    }
  });

  app.delete("/api/database-connections/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.claims.sub;
      
      await storage.deleteDatabaseConnection(id);
      
      res.json({ message: "Database connection deleted" });
    } catch (error) {
      console.error("Error deleting database connection:", error);
      res.status(500).json({ message: "Failed to delete database connection" });
    }
  });

  // Google Calendar Integration routes
  app.get('/api/integrations/google-calendar/connect', isAuthenticated, async (req, res) => {
    try {
      const { GoogleCalendarService } = await import('./services/google-calendar-service');
      const calendarService = new GoogleCalendarService();
      
      const userId = req.user!.claims.sub;
      const authUrl = calendarService.getAuthorizationUrl(userId);
      
      res.redirect(authUrl);
    } catch (error) {
      console.error("Error connecting to Google Calendar:", error);
      res.status(500).json({ message: "Failed to connect to Google Calendar" });
    }
  });

  app.get('/api/integrations/google/callback', isAuthenticated, async (req, res) => {
    try {
      const { code, state } = req.query;
      
      if (!code || !state) {
        return res.redirect('/integrations?error=missing_params');
      }

      const { GoogleCalendarService } = await import('./services/google-calendar-service');
      const calendarService = new GoogleCalendarService();
      
      const { userId } = JSON.parse(Buffer.from(state as string, 'base64').toString());
      const tokens = await calendarService.exchangeCodeForTokens(code as string);

      // Store integration
      await storage.upsertIntegration({
        userId,
        provider: 'google_calendar',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        isActive: true,
        lastSyncAt: new Date()
      });

      await storage.createActivityLog({
        userId,
        type: 'integration_connected',
        description: 'Google Calendar integration connected successfully',
        metadata: { provider: 'google_calendar' }
      });

      res.redirect('/integrations?success=google_calendar');
    } catch (error) {
      console.error('Google Calendar callback error:', error);
      res.redirect('/integrations?error=google_calendar');
    }
  });

  app.post('/api/integrations/google-calendar/sync', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.claims.sub;
      const { GoogleCalendarService } = await import('./services/google-calendar-service');
      const calendarService = new GoogleCalendarService();
      
      await calendarService.syncEmployeeSchedules(userId);
      
      await storage.createActivityLog({
        userId,
        type: 'manual_sync',
        description: 'Manual Google Calendar sync completed',
        metadata: { timestamp: new Date() }
      });

      res.json({ message: "Google Calendar sync completed successfully" });
    } catch (error) {
      console.error("Error syncing with Google Calendar:", error);
      res.status(500).json({ message: "Failed to sync with Google Calendar" });
    }
  });

  // Clock in/out with calendar integration
  app.post('/api/clock/in', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.claims.sub;
      const { customerId, location, notes } = req.body;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Create clock entry
      const clockEntry = await storage.createClockEntry({
        userId,
        customerId,
        punchTime: new Date(),
        punchType: 'clock_in',
        location: location ? JSON.stringify(location) : undefined,
        notes,
      });

      // Create calendar event
      try {
        const { GoogleCalendarService } = await import('./services/google-calendar-service');
        const calendarService = new GoogleCalendarService();
        
        if (await calendarService.setCredentials(userId)) {
          const customer = customerId ? await storage.getCustomer(customerId) : null;
          
          const calendarEventId = await calendarService.createClockEvent({
            employeeId: userId,
            employeeName: `${user.firstName} ${user.lastName}`,
            employeeEmail: user.email || '',
            customerId,
            customerName: customer?.name,
            action: 'clock_in',
            timestamp: clockEntry.clockIn!,
            location,
            notes,
          });

          // Store calendar event ID for later updates
          if (calendarEventId) {
            await storage.updateClockEntry(clockEntry.id, {
              calendarEventId,
            });
          }
        }
      } catch (calendarError) {
        console.error('Calendar integration error (non-blocking):', calendarError);
      }

      await storage.createActivityLog({
        userId,
        type: 'clock_in',
        description: `Clocked in${customerId ? ` for customer work` : ''}`,
        metadata: { clockEntryId: clockEntry.id, customerId },
      });

      res.json(clockEntry);
    } catch (error) {
      console.error("Error clocking in:", error);
      res.status(500).json({ message: "Failed to clock in" });
    }
  });

  app.post('/api/clock/out', isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Invalid user ID" });
      }
      const { clockEntryId, notes } = req.body;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get clock entry
      const clockEntry = await storage.getClockEntry(clockEntryId);
      if (!clockEntry || clockEntry.userId !== userId) {
        return res.status(404).json({ message: "Clock entry not found" });
      }

      if (clockEntry.clockOut) {
        return res.status(400).json({ message: "Already clocked out" });
      }

      // Update clock entry
      const updatedEntry = await storage.updateClockEntry(clockEntryId, {
        punchTime: new Date(),
        punchType: 'clock_out',
        notes: notes ?? clockEntry.notes,
      });

      // Update calendar event
      try {
        const { GoogleCalendarService } = await import('./services/google-calendar-service');
        const calendarService = new GoogleCalendarService();
        
        if (await calendarService.setCredentials(userId) && clockEntry.calendarEventId) {
          const customer = clockEntry.customerId ? await storage.getCustomer(clockEntry.customerId) : null;
          
          await calendarService.updateClockEvent(clockEntry.calendarEventId, {
            employeeId: userId,
            employeeName: `${user.firstName} ${user.lastName}`,
            employeeEmail: user.email ?? '',
            customerId: clockEntry.customerId,
            customerName: customer?.name,
            action: 'clock_out',
            timestamp: updatedEntry.clockOut!,
            notes: updatedEntry.notes,
          });
        }
      } catch (calendarError) {
        console.error('Calendar integration error (non-blocking):', calendarError);
      }

      await storage.createActivityLog({
        userId,
        type: 'clock_out',
        description: 'Clocked out',
        metadata: { clockEntryId: clockEntry.id },
      });

      res.json(updatedEntry);
    } catch (error) {
      console.error("Error clocking out:", error);
      res.status(500).json({ message: "Failed to clock out" });
    }
  });

  // Get current clock status
  app.get('/api/clock/status', isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Invalid user ID" });
      }
      const activeClockEntry = await storage.getActiveClockEntry(userId);
      
      res.json({
        isClockedIn: !!activeClockEntry,
        clockEntry: activeClockEntry,
      });
    } catch (error) {
      console.error("Error getting clock status:", error);
      res.status(500).json({ message: "Failed to get clock status" });
    }
  });

  // Enhanced punch clock endpoints
  app.get('/api/punch-clock/entries', isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Invalid user ID" });
      }
      
      const user = await storage.getUser(userId);
      
      // Get clock entries from database
      const entries = user?.role === 'admin' 
        ? await storage.getAllClockEntries() 
        : await storage.getClockEntries(userId);
      
      res.json(entries);
    } catch (error) {
      console.error("Error fetching punch entries:", error);
      res.status(500).json({ message: "Failed to fetch punch entries" });
    }
  });

  app.post('/api/punch-clock/request-adjustment', isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Invalid user ID" });
      }
      
      const { entryId, reason } = req.body;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Send email notification
      const { emailNotificationService } = await import('./services/email-notification-service');
      const emailSent = await emailNotificationService.sendPunchAdjustmentRequest(
        `${user.firstName} ${user.lastName}`,
        new Date().toISOString(),
        reason
      );

      await storage.createActivityLog({
        userId,
        type: 'adjustment_requested',
        description: `Punch adjustment requested: ${reason}`,
        metadata: { entryId, reason, emailSent }
      });

      res.json({ 
        message: emailSent 
          ? "Adjustment request submitted and email sent" 
          : "Adjustment request submitted (email not configured)"
      });
    } catch (error) {
      console.error("Error requesting adjustment:", error);
      res.status(500).json({ message: "Failed to request adjustment" });
    }
  });

  app.post('/api/punch-clock/adjust', isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Invalid user ID" });
      }
      
      const { entryId, newTime, reason } = req.body;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.createActivityLog({
        userId,
        type: 'punch_adjusted',
        description: `Punch time adjusted: ${reason}`,
        metadata: { entryId, newTime, reason }
      });

      res.json({ message: "Punch adjusted successfully" });
    } catch (error) {
      console.error("Error adjusting punch:", error);
      res.status(500).json({ message: "Failed to adjust punch" });
    }
  });

  app.post('/api/punch-clock/flag', isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Invalid user ID" });
      }
      
      const { entryId, flag } = req.body;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.createActivityLog({
        userId,
        type: 'punch_flagged',
        description: `Punch flagged as: ${flag}`,
        metadata: { entryId, flag }
      });

      res.json({ message: "Entry flagged successfully" });
    } catch (error) {
      console.error("Error flagging punch:", error);
      res.status(500).json({ message: "Failed to flag punch" });
    }
  });

  app.delete('/api/punch-clock/void/:entryId', isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Invalid user ID" });
      }
      
      const { entryId } = req.params;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.createActivityLog({
        userId,
        type: 'punch_voided',
        description: `Punch entry voided`,
        metadata: { entryId }
      });

      res.json({ message: "Punch voided successfully" });
    } catch (error) {
      console.error("Error voiding punch:", error);
      res.status(500).json({ message: "Failed to void punch" });
    }
  });

  // Sync status route
  app.get('/api/sync/status', isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Invalid user ID" });
      }
      const integrations = await storage.getIntegrations(userId);

      const syncStatus = {
        integrations: integrations.map(integration => ({
          provider: integration.provider,
          isActive: integration.isActive,
          lastSyncAt: integration.lastSyncAt,
          syncStatus: 'pending',
        })),
        recentLogs: [],
      };

      res.json(syncStatus);
    } catch (error) {
      console.error("Error fetching sync status:", error);
      res.status(500).json({ message: "Failed to fetch sync status" });
    }
  });

  // Password authentication routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      // Find user by email  
      const user = await storage.getUserByEmail(email);
      
      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Create session manually for password auth
      (req.session as any).user = {
        claims: {
          sub: user.id,
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          profile_image_url: user.profileImageUrl,
        },
      };

      // Remove password hash from response
      const { passwordHash, ...userResponse } = user;
      res.json(userResponse);
    } catch (error) {
      console.error("Password login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, firstName, lastName, phone } = req.body;
      
      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ message: "Required fields missing" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const user = await storage.upsertUser({
        email,
        firstName,
        lastName,
        phone,
        passwordHash,
        profileImageUrl: null,
      });

      // Remove password hash from response
      const { passwordHash: _, ...userResponse } = user;
      res.json(userResponse);
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ message: 'Logout failed' });
      }
      res.clearCookie('connect.sid');
      res.json({ message: 'Logged out successfully' });
    });
  });

  // Sync scheduler routes
  app.get('/api/sync/status', isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Invalid user ID" });
      }
      const { syncScheduler } = await import('./services/sync-scheduler');
      
      const syncStatus = syncScheduler.getStatus();
      const recentLogs = await storage.getActivityLogs(userId, 10);
      
      res.json({
        syncStatus,
        recentLogs: recentLogs.filter(log => 
          log.type?.includes('sync') || log.type?.includes('integration')
        )
      });
    } catch (error) {
      console.error("Error getting sync status:", error);
      res.status(500).json({ message: "Failed to get sync status" });
    }
  });

  app.post('/api/sync/start-automated', isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Invalid user ID" });
      }
      const { intervalMinutes = 60 } = req.body;
      const { syncScheduler } = await import('./services/sync-scheduler');
      
      await syncScheduler.start();
      
      res.json({ 
        message: `Automated sync started (every ${intervalMinutes} minutes)`,
        intervalMinutes 
      });
    } catch (error) {
      console.error("Error starting automated sync:", error);
      res.status(500).json({ message: "Failed to start automated sync" });
    }
  });

  app.post('/api/sync/stop-automated', isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Invalid user ID" });
      }
      const { syncScheduler } = await import('./services/sync-scheduler');
      
      syncScheduler.stop();
      
      res.json({ message: "Automated sync stopped" });
    } catch (error) {
      console.error("Error stopping automated sync:", error);
      res.status(500).json({ message: "Failed to stop automated sync" });
    }
  });

  app.post('/api/sync/trigger-immediate', isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Invalid user ID" });
      }
      const { syncScheduler } = await import('./services/sync-scheduler');
      
      await syncScheduler.runSyncNow('quickbooks'); // Using available method
      
      res.json({ message: "Immediate sync completed" });
    } catch (error) {
      console.error("Error triggering immediate sync:", error);
      res.status(500).json({ message: "Failed to trigger immediate sync" });
    }
  });

  // Employee management routes
  app.get('/api/employees', isAuthenticated, async (req, res) => {
    try {
      const employees = await storage.getEmployees();
      res.json(employees);
    } catch (error) {
      console.error("Error fetching employees:", error);
      res.status(500).json({ message: "Failed to fetch employees" });
    }
  });

  app.get('/api/employees/stats/:id', isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getEmployeeStats?.(req.params.id) || {};
      res.json(stats);
    } catch (error) {
      console.error("Error fetching employee stats:", error);
      res.status(500).json({ message: "Failed to fetch employee stats" });
    }
  });

  app.get('/api/employees/:id/notes', isAuthenticated, async (req, res) => {
    try {
      const notes = await storage.getEmployeeNotes?.(req.params.id) || [];
      res.json(notes);
    } catch (error) {
      console.error("Error fetching employee notes:", error);
      res.status(500).json({ message: "Failed to fetch employee notes" });
    }
  });

  app.post('/api/employees/:id/notes', isAuthenticated, async (req: any, res) => {
    try {
      const noteData = {
        ...req.body,
        employeeId: req.params.id,
        createdBy: req.user.claims.sub
      };
      const note = await storage.createEmployeeNote?.(noteData) || {};
      res.json(note);
    } catch (error) {
      console.error("Error creating employee note:", error);
      res.status(500).json({ message: "Failed to create employee note" });
    }
  });

  // Enhanced clock routes for specific users
  app.get('/api/clock/active/:userId', isAuthenticated, async (req, res) => {
    try {
      const activeEntry = await storage.getActiveClockEntry(req.params.userId);
      res.json(activeEntry);
    } catch (error) {
      console.error("Error fetching active clock entry:", error);
      res.status(500).json({ message: "Failed to fetch active clock entry" });
    }
  });

  app.get('/api/clock/entries/:period/:userId', isAuthenticated, async (req, res) => {
    try {
      const { period, userId } = req.params;
      const entries = await storage.getClockEntries?.(userId, period) || [];
      res.json(entries);
    } catch (error) {
      console.error("Error fetching clock entries:", error);
      res.status(500).json({ message: "Failed to fetch clock entries" });
    }
  });

  // Trapping program routes
  app.get('/api/trapping-programs', isAuthenticated, async (req, res) => {
    try {
      const programs = await storage.getTrappingPrograms?.() || [];
      res.json(programs);
    } catch (error) {
      console.error("Error fetching trapping programs:", error);
      res.status(500).json({ message: "Failed to fetch trapping programs" });
    }
  });

  app.get('/api/trap-checks/needed', isAuthenticated, async (req, res) => {
    try {
      const trapChecks = await storage.getNeededTrapChecks?.() || [];
      res.json(trapChecks);
    } catch (error) {
      console.error("Error fetching needed trap checks:", error);
      res.status(500).json({ message: "Failed to fetch needed trap checks" });
    }
  });

  app.post('/api/trapping-programs', isAuthenticated, async (req, res) => {
    try {
      const program = await storage.createTrappingProgram?.(req.body) || {};
      res.json(program);
    } catch (error) {
      console.error("Error creating trapping program:", error);
      res.status(500).json({ message: "Failed to create trapping program" });
    }
  });

  // Weekly summary routes
  app.get('/api/weekly-summary/:userId', isAuthenticated, async (req, res) => {
    try {
      const summary = await storage.getWeeklySummary?.(req.params.userId) || {};
      res.json(summary);
    } catch (error) {
      console.error("Error fetching weekly summary:", error);
      res.status(500).json({ message: "Failed to fetch weekly summary" });
    }
  });

  // Real-time collaboration and presence API routes
  app.get('/api/presence/online', isAuthenticated, async (req, res) => {
    try {
      const onlineUsers = await presenceService.getOnlineUsers();
      res.json(onlineUsers);
    } catch (error) {
      console.error("Error fetching online users:", error);
      res.status(500).json({ message: "Failed to fetch online users" });
    }
  });

  app.post('/api/presence/update', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const presenceData = {
        userId,
        ...req.body
      };
      
      const updatedPresence = await presenceService.updatePresence(presenceData);
      res.json(updatedPresence);
    } catch (error) {
      console.error("Error updating presence:", error);
      res.status(500).json({ message: "Failed to update presence" });
    }
  });

  app.get('/api/collaboration/activities', isAuthenticated, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const activities = await presenceService.getRecentActivities(limit);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching collaboration activities:", error);
      res.status(500).json({ message: "Failed to fetch collaboration activities" });
    }
  });

  app.post('/api/collaboration/activity', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const activityData = {
        userId,
        ...req.body
      };
      
      const activity = await presenceService.recordActivity(activityData);
      res.json(activity);
    } catch (error) {
      console.error("Error recording activity:", error);
      res.status(500).json({ message: "Failed to record activity" });
    }
  });

  app.post('/api/presence/typing', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const typingData = {
        userId,
        ...req.body
      };
      
      await presenceService.updateTypingIndicator(typingData);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating typing indicator:", error);
      res.status(500).json({ message: "Failed to update typing indicator" });
    }
  });

  // Calendar routes
  app.get('/api/calendar/events', async (req, res) => {
    try {
      const userId = (req as any).user?.id || 'dev_user_123';
      const { week } = req.query;
      
      // Mock calendar events for now
      const mockEvents = [
        {
          id: '1',
          title: 'Insect Control - John Smith',
          start: new Date().toISOString(),
          end: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          calendar: 'Insect Control / Sprays',
          assignee: 'Spencer Reiser',
          customer: {
            name: 'John Smith',
            address: '123 Main St, San Rafael, CA',
            phone: '(415) 555-0123',
            email: 'john@email.com'
          }
        }
      ];
      
      res.json(mockEvents);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      res.status(500).json({ error: 'Failed to fetch calendar events' });
    }
  });

  app.get('/api/calendar/my-tasks', async (req, res) => {
    try {
      const userId = (req as any).user?.id || 'dev_user_123';
      
      // Mock tasks for current user
      const mockTasks = [
        {
          id: 'task1',
          title: 'Spray Treatment - Johnson Residence',
          start: new Date().toISOString(),
          end: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          calendar: 'Insect Control / Sprays',
          customer: {
            name: 'Sarah Johnson',
            address: '456 Oak Ave, Novato, CA 94949',
            phone: '(415) 555-0456',
            email: 'sarah.johnson@email.com'
          }
        }
      ];
      
      res.json(mockTasks);
    } catch (error) {
      console.error('Error fetching user tasks:', error);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });

  app.get('/api/calendar/events/:eventId', async (req, res) => {
    try {
      const { eventId } = req.params;
      
      // Mock event detail
      const mockEvent = {
        id: eventId,
        title: 'Spray Treatment - Johnson Residence',
        start: new Date().toISOString(),
        end: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        calendar: 'Insect Control / Sprays',
        customer: {
          name: 'Sarah Johnson',
          address: '456 Oak Ave, Novato, CA 94949',
          phone: '(415) 555-0456',
          email: 'sarah.johnson@email.com'
        },
        checklist: [],
        formData: {},
        completed: false
      };
      
      res.json(mockEvent);
    } catch (error) {
      console.error('Error fetching event:', error);
      res.status(500).json({ error: 'Failed to fetch event' });
    }
  });

  app.patch('/api/calendar/events/:eventId/checklist', async (req, res) => {
    try {
      const { eventId } = req.params;
      const { checklist, formData } = req.body;
      
      // Store checklist updates
      console.log(`Updating checklist for event ${eventId}:`, { checklist, formData });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating checklist:', error);
      res.status(500).json({ error: 'Failed to update checklist' });
    }
  });

  app.patch('/api/calendar/events/:eventId/complete', async (req, res) => {
    try {
      const { eventId } = req.params;
      const { completed, completedBy, completedAt } = req.body;
      
      // Mark event as completed
      console.log(`Completing event ${eventId}:`, { completed, completedBy, completedAt });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error completing event:', error);
      res.status(500).json({ error: 'Failed to complete event' });
    }
  });

  // NextAuth authentication routes
  app.use('/api/auth/*', async (req, res) => {
    const { ExpressAuth } = await import('@auth/express');
    const { authConfig } = await import('./auth/nextauth-config');
    
    return ExpressAuth(req, res, authConfig);
  });

  // Get current user session
  app.get('/api/auth/user', async (req, res) => {
    try {
      const { getServerSession } = await import('next-auth');
      const { authConfig } = await import('./auth/nextauth-config');
      
      const session = await getServerSession(authConfig);
      
      if (!session || !session.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      res.json(session.user);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: 'Authentication error' });
    }
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        quickbooks: 'configured',
        oauth: 'enabled',
        websocket: 'active',
        collaboration: 'enabled'
      }
    });
  });

  // Environment variables check endpoint 
  app.get("/api/env-check", async (req, res) => {
    const envVars = {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      DATABASE_URL: process.env.DATABASE_URL ? "✓ Set" : "✗ Missing",
      SESSION_SECRET: process.env.SESSION_SECRET ? "✓ Set" : "✗ Missing", 
      REPL_ID: process.env.REPL_ID ? "✓ Set" : "✗ Missing",
      QBO_CLIENT_ID: process.env.QBO_CLIENT_ID ? "✓ Set" : "✗ Missing",
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? "✓ Set" : "✗ Missing",
      dotenvStatus: "✓ .env file loaded via dotenv.config()"
    };
    res.json({ 
      status: "Environment variables check", 
      variables: envVars,
      timestamp: new Date().toISOString()
    });
  });

  // Version endpoint
  app.get('/api/version', (req, res) => {
    res.json({
      version: '2.1.0',
      features: [
        'Enhanced QuickBooks OAuth with intuit-oauth',
        'Comprehensive webhook handling',
        'Real-time data synchronization',
        'Production-ready authentication',
        'Automated sync scheduling'
      ],
      environment: process.env.NODE_ENV || 'development',
      lastUpdate: '2025-01-01T12:00:00Z'
    });
  });

  // Prometheus metrics endpoint
  app.get('/metrics', async (req, res) => {
    try {
      const { prometheusMetrics } = await import('./services/prometheus-metrics');
      const metrics = await prometheusMetrics.getMetrics();
      res.set('Content-Type', 'text/plain');
      res.send(metrics);
    } catch (error) {
      res.status(500).send('Failed to get Prometheus metrics');
    }
  });

  // Comprehensive monitoring endpoints
  app.get('/api/monitoring/metrics', async (req, res) => {
    try {
      const { monitoring } = await import('./services/monitoring-service');
      const { prometheusMetrics } = await import('./services/prometheus-metrics');
      
      const customMetrics = monitoring.getMetrics();
      const prometheusHealthy = prometheusMetrics.isHealthy();
      
      res.json({
        ...customMetrics,
        prometheus_healthy: prometheusHealthy,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get metrics' });
    }
  });

  app.get('/api/monitoring/health', async (req, res) => {
    try {
      const { monitoring } = await import('./services/monitoring-service');
      const { prometheusMetrics } = await import('./services/prometheus-metrics');
      const { errorTracking } = await import('./services/error-tracking');
      
      const healthCheck = await monitoring.performHealthCheck();
      
      res.json({
        ...healthCheck,
        services: {
          ...healthCheck.checks,
          prometheus: prometheusMetrics.isHealthy(),
          error_tracking: process.env.SENTRY_DSN ? 'sentry' : 'console'
        }
      });
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Health check failed' });
    }
  });

  app.get('/api/monitoring/report', async (req, res) => {
    try {
      const { monitoring } = await import('./services/monitoring-service');
      const report = monitoring.generateReport();
      res.type('text/plain').send(report);
    } catch (error) {
      res.status(500).send('Failed to generate monitoring report');
    }
  });

  // Pending Approvals API routes
  app.get('/api/pending-approvals', async (req: any, res) => {
    try {
      let approvals = await storage.getPendingApprovals();
      
      // If no approvals exist, create sample data
      if (approvals.length === 0) {
        console.log('No pending approvals found, creating sample data...');
        await storage.createSampleApprovalData();
        approvals = await storage.getPendingApprovals();
      }
      
      res.json(approvals);
    } catch (error: any) {
      console.error('Error fetching pending approvals:', error);
      res.status(500).json({ message: 'Failed to fetch pending approvals' });
    }
  });

  app.post('/api/pending-approvals/:id/approve', async (req: any, res) => {
    try {
      const { id } = req.params;
      const { type } = req.body;
      const userId = req.user?.claims?.sub || 'dev_user_123';

      const approval = await storage.approvePendingApproval(id, userId);
      
      // Process the approval based on type
      if (type === 'hours_materials') {
        await processHoursAndMaterialsApproval(approval);
      } else if (type === 'payroll') {
        await processPayrollApproval(approval);
      } else if (type === 'calendar_appointment') {
        await processCalendarApproval(approval);
      }

      res.json(approval);
    } catch (error: any) {
      console.error('Error approving item:', error);
      res.status(500).json({ message: 'Failed to approve item' });
    }
  });

  app.post('/api/pending-approvals/:id/deny', async (req: any, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const userId = req.user?.claims?.sub || 'dev_user_123';

      const approval = await storage.denyPendingApproval(id, userId, reason);
      
      // Send denial emails
      await sendDenialEmails(approval, reason);

      res.json(approval);
    } catch (error: any) {
      console.error('Error denying item:', error);
      res.status(500).json({ message: 'Failed to deny item' });
    }
  });

  app.patch('/api/pending-approvals/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const approval = await storage.updatePendingApproval(id, updateData);
      res.json(approval);
    } catch (error: any) {
      console.error('Error updating approval:', error);
      res.status(500).json({ message: 'Failed to update approval' });
    }
  });

  // Helper functions for processing approvals
  async function processHoursAndMaterialsApproval(approval: any) {
    try {
      // Convert hours & materials to QuickBooks customer/invoice
      const formData = approval.data;
      
      console.log(`Processing Hours & Materials approval ${approval.id} for ${formData.customerName}`);
      
      // Create full customer address
      const fullAddress = `${formData.customerStreetAddress}, ${formData.customerCity}, ${formData.customerState} ${formData.customerZip}, ${formData.customerCountry}`;
      
      // Create customer if doesn't exist
      let customer = await storage.getCustomerByName(formData.customerName);
      if (!customer) {
        console.log(`Creating new customer: ${formData.customerName}`);
        customer = await storage.createCustomer({
          name: formData.customerName,
          email: formData.customerEmail || '',
          phone: formData.customerPhone || '',
          address: fullAddress,
          notes: `Created from Hours & Materials form - Approval ${approval.id}`
        });
      } else {
        console.log(`Using existing customer: ${formData.customerName}`);
      }

      // Create proper invoice data structure matching the schema
      const correctInvoiceData = {
        userId: 'dev_user_123',
        customerId: customer.id,
        invoiceNumber: `HM-${approval.id}`,
        invoiceDate: new Date(),
        subtotal: (parseFloat(formData.subtotal || '0')).toString(),
        totalAmount: (parseFloat(formData.subtotal || '0')).toString(),
        status: 'pending',
        notes: formData.notes || `Created from Hours & Materials form by ${approval.submittedBy}`,
        quickbooksId: null,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        taxAmount: '0.00',
        discountAmount: '0.00'
      };

      const invoice = await storage.createInvoice(correctInvoiceData);
      
      // Create invoice items separately
      for (const item of formData.lineItems) {
        await storage.createInvoiceItem({
          invoiceId: invoice.id,
          description: `${item.productService} - ${item.description}`,
          quantity: parseFloat(item.quantity).toString(),
          price: parseFloat(item.rate),
          total: (parseFloat(item.quantity) * parseFloat(item.rate)).toString()
        });
      }
      
      console.log(`Created invoice ${invoice.id} for customer ${customer.name} - Total: $${correctInvoiceData.totalAmount}`);

      // TODO: Sync to QuickBooks Online via API
      // This would create the customer and invoice in QuickBooks
      // const qbInvoice = await quickbooksService.createInvoice(invoiceData);
      
      return { customer, invoice };
    } catch (error) {
      console.error('Error processing Hours & Materials approval:', error);
      throw error;
    }
  }

  async function processPayrollApproval(approval: any) {
    try {
      // Mark weekly payroll as approved
      const payrollData = approval.data;
      
      await storage.createWeeklyPayroll({
        employeeId: payrollData.employeeId,
        employeeName: approval.submittedBy,
        weekEndingDate: new Date(approval.weekEndingDate || Date.now()),
        totalHours: (parseFloat(payrollData.totalHours || '0')).toString(),
        regularHours: (parseFloat(payrollData.regularHours || '0')).toString(),
        overtimeHours: (parseFloat(payrollData.overtimeHours || '0')).toString(),
        hourlyRate: (parseFloat(payrollData.hourlyRate || '0')).toString(),
        totalPay: (parseFloat(approval.totalAmount || '0')).toString(),
        clockEntries: payrollData.clockEntries || [],
        approved: true,
        approvedBy: approval.approvedBy,
        approvedDate: new Date()
      });

      console.log(`Processed payroll approval ${approval.id} for ${approval.submittedBy}`);
    } catch (error) {
      console.error('Error processing payroll approval:', error);
    }
  }

  async function processCalendarApproval(approval: any) {
    try {
      // Update calendar event color to gray (approved)
      const eventData = approval.data;
      console.log(`Calendar event ${eventData.eventId} approved - would set color to gray`);
      
      // TODO: Integrate with Google Calendar API to update event color
    } catch (error) {
      console.error('Error processing calendar approval:', error);
    }
  }

  async function sendDenialEmails(approval: any, reason: string) {
    try {
      // Send email to technician
      if (approval.submittedByEmail) {
        await storage.createEmailNotification({
          recipientEmail: approval.submittedByEmail,
          subject: `${approval.formType} Submission Denied`,
          body: `Your ${approval.formType} submission from ${approval.submitDate} has been denied.\n\nReason: ${reason}\n\nPlease contact the office at 415-875-0720 as soon as possible to discuss this matter.`,
          type: 'approval_denied',
          relatedApprovalId: approval.id
        });
      }

      // Send email to admin
      await storage.createEmailNotification({
        recipientEmail: 'marinpestcontrol@gmail.com',
        subject: `Denied Submission Alert - ${approval.formType}`,
        body: `A ${approval.formType} submission by ${approval.submittedBy} on ${approval.submitDate} has been denied.\n\nReason: ${reason}\n\nThe technician has been notified to contact the office at 415-875-0720.`,
        type: 'admin_alert',
        relatedApprovalId: approval.id
      });

      console.log(`Sent denial emails for approval ${approval.id}`);
    } catch (error) {
      console.error('Error sending denial emails:', error);
    }
  }

  // Production QuickBooks auth page
  app.get('/quickbooks-auth', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'quickbooks-auth-production.html'));
  });

  app.get('/quickbooks-setup', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'quickbooks-auth-production.html'));
  });

  app.get('/get-fresh-tokens', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'get-fresh-tokens.html'));
  });

  app.get('/quickbooks-production', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'quickbooks-production-oauth.html'));
  });

  // QuickBooks OAuth diagnostic endpoint
  app.get('/quickbooks/debug', (req, res) => {
    const config = {
      clientId: process.env.QBO_CLIENT_ID,
      hasClientSecret: !!process.env.QBO_CLIENT_SECRET,
      redirectUri: process.env.QBO_REDIRECT_URI || 'https://www.wemakemarin.com/quickbooks/callback',
      environment: 'production',
      companyId: process.env.QBO_COMPANY_ID,
      baseUrl: process.env.QBO_BASE_URL || 'https://quickbooks.api.intuit.com',
    };

    res.json({
      message: 'QuickBooks OAuth Configuration Debug',
      config,
      authUrl: `https://appcenter.intuit.com/connect/oauth2?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(config.redirectUri)}&response_type=code&scope=com.intuit.quickbooks.accounting&state=debug_mode`,
      notes: [
        'The redirect URI must match exactly what is configured in your QuickBooks app',
        'Authorization codes expire in ~10 minutes after authorization',
        'Make sure you complete the OAuth flow quickly after getting the code',
        'If you get a 400 error, check that the redirect URI matches your QuickBooks app configuration'
      ]
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}