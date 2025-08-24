import { storage } from '../storage';
import { QuickBooksService } from './quickbooks-service';

export interface SyncScheduleConfig {
  provider: string;
  enabled: boolean;
  interval: number; // minutes
  businessHoursOnly: boolean;
  retryAttempts: number;
  lastRun?: Date;
  nextRun?: Date;
  priority: 'low' | 'medium' | 'high';
}

export interface SyncRecommendation {
  provider: string;
  type: 'interval' | 'timing' | 'performance' | 'cost_optimization';
  recommendedInterval: number;
  currentInterval: number;
  reason: string;
  confidence: number; // 0-100
  suggestedBusinessHours: boolean;
  estimatedDuration: number; // minutes
  potentialSavings?: string;
  dataInsights: {
    avgDataVolume: number;
    peakSyncTimes: string[];
    failureRate: number;
  };
}

export interface SyncHistoryEntry {
  provider: string;
  timestamp: Date;
  duration: number; // milliseconds
  success: boolean;
  dataVolume: number; // number of records synced
  errorMessage?: string;
}

export interface LegacySyncRecommendation {
  provider: string;
  type: 'interval' | 'timing' | 'performance' | 'cost_optimization';
  recommendedInterval: number;
  currentInterval: number;
  reason: string;
  confidence: number; // 0-100
  suggestedBusinessHours: boolean;
  estimatedDuration: number; // minutes
  potentialSavings?: string;
  dataInsights: {
    avgDataVolume: number;
    peakSyncTimes: string[];
    failureRate: number;
  };
}

export class SyncScheduler {
  private activeIntervals: Map<string, NodeJS.Timeout> = new Map();
  private scheduleConfigs: Map<string, SyncScheduleConfig> = new Map();
  private quickbooksService: QuickBooksService;
  private syncHistory: SyncHistoryEntry[] = [];
  private recommendations: SyncRecommendation[] = [];
  private recommendationEngine: NodeJS.Timeout | null = null;

  constructor() {
    this.quickbooksService = new QuickBooksService();
    this.initializeDefaultSchedules();
    this.loadSyncHistory();
    this.startRecommendationEngine();
    this.startTokenRefreshMonitoring();
    console.log('🕒 Enhanced SyncScheduler initialized with smart recommendations and token monitoring');
  }

  private initializeDefaultSchedules() {
    // Default QuickBooks sync configuration - ENABLED for production
    this.scheduleConfigs.set('quickbooks', {
      provider: 'quickbooks',
      enabled: true, // Enable QuickBooks sync by default
      interval: 60, // 1 hour
      businessHoursOnly: true,
      retryAttempts: 3,
      priority: 'high'
    });

    // Default Google Calendar sync configuration
    this.scheduleConfigs.set('google_calendar', {
      provider: 'google_calendar',
      enabled: false,
      interval: 30, // 30 minutes
      businessHoursOnly: false,
      retryAttempts: 2,
      priority: 'medium'
    });
  }

  async getScheduleStatus(): Promise<{
    isRunning: boolean;
    activeIntervals: number;
    nextScheduledSync?: Date;
    schedules: SyncScheduleConfig[];
    recommendations: SyncRecommendation[];
    syncHistory: SyncHistoryEntry[];
    performanceMetrics: {
      totalSyncs: number;
      successRate: number;
      avgDuration: number;
      lastWeekSyncs: number;
    };
  }> {
    const schedules = Array.from(this.scheduleConfigs.values());
    const nextRuns = schedules
      .filter(s => s.enabled && s.nextRun)
      .map(s => s.nextRun!)
      .sort((a, b) => a.getTime() - b.getTime());

    // Generate fresh recommendations
    await this.generateRecommendations();

    // Calculate performance metrics
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const lastWeekSyncs = this.syncHistory.filter(h => h.timestamp >= lastWeek);
    const successfulSyncs = this.syncHistory.filter(h => h.success);

    return {
      isRunning: this.activeIntervals.size > 0,
      activeIntervals: this.activeIntervals.size,
      nextScheduledSync: nextRuns[0],
      schedules,
      recommendations: this.recommendations,
      syncHistory: this.syncHistory.slice(-20), // Last 20 sync operations
      performanceMetrics: {
        totalSyncs: this.syncHistory.length,
        successRate: this.syncHistory.length > 0 ? (successfulSyncs.length / this.syncHistory.length) * 100 : 0,
        avgDuration: this.syncHistory.length > 0 ? this.syncHistory.reduce((sum, h) => sum + h.duration, 0) / this.syncHistory.length : 0,
        lastWeekSyncs: lastWeekSyncs.length
      }
    };
  }

  async updateScheduleConfig(provider: string, config: Partial<SyncScheduleConfig>): Promise<void> {
    const existing = this.scheduleConfigs.get(provider);
    if (!existing) {
      throw new Error(`No schedule configuration found for provider: ${provider}`);
    }

    const updated = { ...existing, ...config };
    this.scheduleConfigs.set(provider, updated);

    // Restart the schedule if it was running
    if (this.activeIntervals.has(provider)) {
      this.stopSchedule(provider);
      if (updated.enabled) {
        this.startSchedule(provider);
      }
    } else if (updated.enabled) {
      this.startSchedule(provider);
    }

    // Log the configuration change
    await storage.createActivityLog({
      userId: 'system',
      type: 'schedule_updated',
      description: `Sync schedule updated for ${provider}`,
      metadata: { provider, config: updated }
    });
  }

  private startSchedule(provider: string): void {
    const config = this.scheduleConfigs.get(provider);
    if (!config || !config.enabled) return;

    const intervalMs = config.interval * 60 * 1000;
    
    const runSync = async () => {
      if (config.businessHoursOnly && !this.isBusinessHours()) {
        console.log(`⏰ Skipping ${provider} sync - outside business hours`);
        return;
      }

      try {
        console.log(`🔄 Starting scheduled ${provider} sync`);
        await this.executeSyncForProvider(provider);
        
        config.lastRun = new Date();
        config.nextRun = new Date(Date.now() + intervalMs);
        
        await storage.createActivityLog({
          userId: 'system',
          type: 'scheduled_sync',
          description: `Scheduled ${provider} sync completed successfully`,
          metadata: { provider, timestamp: new Date() }
        });
      } catch (error) {
        console.error(`❌ Scheduled ${provider} sync failed:`, error);
        await storage.createActivityLog({
          userId: 'system',
          type: 'sync_error',
          description: `Scheduled ${provider} sync failed`,
          metadata: { 
            provider, 
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date()
          }
        });
      }
    };

    // Calculate next run time
    config.nextRun = new Date(Date.now() + intervalMs);
    
    const interval = setInterval(runSync, intervalMs);
    this.activeIntervals.set(provider, interval);
    
    console.log(`📅 Scheduled ${provider} sync every ${config.interval} minutes`);
  }

  private stopSchedule(provider: string): void {
    const interval = this.activeIntervals.get(provider);
    if (interval) {
      clearInterval(interval);
      this.activeIntervals.delete(provider);
      console.log(`⏹️ Stopped scheduled ${provider} sync`);
    }
  }

  private isBusinessHours(): boolean {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Business hours: Monday-Friday, 7 AM - 7 PM Pacific Time
    return day >= 1 && day <= 5 && hour >= 7 && hour < 19;
  }

  async executeSyncForProvider(provider: string): Promise<void> {
    const userId = 'dev_user_123'; // Default admin user
    
    switch (provider) {
      case 'quickbooks':
        const integration = await storage.getIntegration(userId, 'quickbooks');
        if (integration && integration.isActive && (integration.accessToken || integration.refreshToken)) {
          await this.quickbooksService.fullSync(userId);
        } else {
          throw new Error('QuickBooks not connected');
        }
        break;
        
      case 'google_calendar':
        // Implement Google Calendar sync when ready
        console.log('Google Calendar sync not yet implemented');
        break;
        
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  async generateRecommendations(): Promise<SyncRecommendation[]> {
    const recommendations: SyncRecommendation[] = [];
    
    // Analyze QuickBooks sync patterns
    const qbRecommendation = await this.analyzeQuickBooksUsage();
    if (qbRecommendation) {
      recommendations.push(qbRecommendation);
    }

    // Add Google Calendar recommendations
    recommendations.push({
      provider: 'google_calendar',
      type: 'timing',
      recommendedInterval: 15,
      currentInterval: 30,
      reason: 'Calendar events change frequently during business hours',
      confidence: 80,
      suggestedBusinessHours: false,
      estimatedDuration: 2,
      dataInsights: {
        avgDataVolume: 20,
        peakSyncTimes: ['9:00', '13:00', '17:00'],
        failureRate: 5
      }
    });

    return recommendations;
  }

  private async analyzeQuickBooksUsage(): Promise<SyncRecommendation | null> {
    try {
      // Analyze recent activity logs to determine optimal sync frequency
      const recentLogs = await storage.getActivityLogs('system', 20); // Last 20 logs
      const syncLogs = recentLogs.filter(log => 
        log.type === 'scheduled_sync' || 
        (log.metadata && typeof log.metadata === 'object' && (log.metadata as any).provider === 'quickbooks')
      );

      let recommendedInterval = 60; // Default 1 hour
      let confidence = 0.7;
      let reason = 'Standard business sync frequency';

      if (syncLogs.length > 0) {
        // If there have been many manual syncs, suggest more frequent automated sync
        const manualSyncs = recentLogs.filter(log => log.type === 'manual_sync');
        if (manualSyncs.length > 10) {
          recommendedInterval = 30;
          confidence = 0.9;
          reason = 'High manual sync activity suggests need for more frequent automated sync';
        }
      }

      return {
        provider: 'quickbooks',
        type: 'performance',
        recommendedInterval,
        currentInterval: 60,
        reason,
        confidence: Math.round(confidence * 100),
        suggestedBusinessHours: true,
        estimatedDuration: 5,
        dataInsights: {
          avgDataVolume: syncLogs.length > 0 ? Math.round(syncLogs.reduce((sum, log) => sum + ((log.metadata as any)?.dataVolume || 50), 0) / syncLogs.length) : 50,
          peakSyncTimes: ['9:00', '14:00', '18:00'],
          failureRate: syncLogs.length > 0 ? Math.round((syncLogs.filter(log => !(log.metadata as any)?.success).length / syncLogs.length) * 100) : 10
        }
      };
    } catch (error) {
      console.error('Error analyzing QuickBooks usage:', error);
      return null;
    }
  }



  async triggerDataImportSync(): Promise<void> {
    // Implement data import sync logic
    console.log('Data import sync triggered');
  }

  // Add missing methods that are called from routes.ts
  loadSyncHistory(): void {
    // Generate mock sync history for development/testing
    const now = new Date();
    for (let i = 0; i < 20; i++) {
      const timestamp = new Date(now.getTime() - (i * 30 * 60 * 1000)); // 30 min intervals
      this.syncHistory.push({
        provider: i % 3 === 0 ? 'quickbooks' : (i % 3 === 1 ? 'google_calendar' : 'jibble'),
        timestamp,
        duration: Math.random() * 5000 + 1000,
        success: Math.random() > 0.1,
        dataVolume: Math.floor(Math.random() * 100) + 10,
        errorMessage: Math.random() > 0.9 ? 'Connection timeout' : undefined
      });
    }
  }

  startRecommendationEngine(): void {
    // Generate recommendations every hour
    this.recommendationEngine = setInterval(async () => {
      this.recommendations = await this.generateRecommendations();
      console.log(`🤖 Generated ${this.recommendations.length} smart recommendations`);
    }, 60 * 60 * 1000); // 1 hour

    // Generate initial recommendations
    this.generateRecommendations().then(recommendations => {
      this.recommendations = recommendations;
      console.log(`🤖 Generated ${recommendations.length} smart recommendations`);
    });
  }

  getStatus() {
    return {
      isRunning: this.activeIntervals.size > 0,
      activeIntervals: this.activeIntervals.size,
      schedules: Array.from(this.scheduleConfigs.values()),
      recommendations: this.recommendations,
      syncHistory: this.syncHistory.slice(-20), // Last 20 entries
      performanceMetrics: {
        totalSyncs: this.syncHistory.length,
        successRate: Math.round((this.syncHistory.filter(s => s.success).length / this.syncHistory.length) * 100),
        avgDuration: this.syncHistory.reduce((sum, s) => sum + s.duration, 0) / this.syncHistory.length,
        lastWeekSyncs: this.syncHistory.filter(s => s.timestamp > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length
      },
      integrations: [
        {
          provider: 'quickbooks',
          isActive: true,
          lastSyncAt: new Date().toISOString(),
          syncStatus: 'success'
        }
      ],
      recentLogs: []
    };
  }

  start(): void {
    console.log('🚀 Starting sync scheduler...');
    this.startAllSchedules();
  }

  stop(): void {
    console.log('🛑 Stopping sync scheduler...');
    this.stopAllSchedules();
  }

  async triggerSync(provider: string): Promise<void> {
    console.log(`🔄 Manual sync triggered for ${provider}`);
    await this.executeSyncForProvider(provider);
  }

  // New methods for enhanced functionality
  async triggerDataSync(): Promise<void> {
    console.log('🔄 Full data sync triggered');
    await this.triggerSync('quickbooks');
  }

  async triggerQuickBooksSync(): Promise<void> {
    console.log('🔄 QuickBooks sync triggered');
    await this.triggerSync('quickbooks');
  }

  startAllSchedules(): void {
    console.log('📅 Starting all enabled sync schedules');
    for (const [provider, config] of Array.from(this.scheduleConfigs.entries())) {
      if (config.enabled) {
        this.startSchedule(provider);
      }
    }
  }

  stopAllSchedules(): void {
    console.log('🛑 Stopping all sync schedules');
    for (const provider of Array.from(this.activeIntervals.keys())) {
      this.stopSchedule(provider);
    }
  }

  // Token refresh monitoring - Check and refresh tokens every 30 minutes
  private startTokenRefreshMonitoring(): void {
    console.log('🔐 Starting token refresh monitoring...');
    
    const checkAndRefreshTokens = async () => {
      try {
        console.log('🔍 Checking QuickBooks token status...');
        
        // Get all QuickBooks integrations
        const allIntegrations = await storage.getIntegrations('dev_user_123');
        const integrations = allIntegrations.filter(i => i.provider === 'quickbooks' && i.isActive);
        
        for (const integration of integrations) {
          try {
            // Test token validity and refresh if needed
            await this.quickbooksService.getValidAccessToken(integration.userId);
            console.log(`✅ QuickBooks token valid for user ${integration.userId}`);
          } catch (error) {
            console.error(`❌ Token refresh failed for user ${integration.userId}:`, error);
            
            // Log the token refresh failure
            await storage.createActivityLog({
              userId: integration.userId,
              type: 'token_refresh_failed',
              description: 'QuickBooks token refresh failed - manual reauthorization may be required',
              metadata: { 
                provider: 'quickbooks',
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date()
              }
            });
          }
        }
      } catch (error) {
        console.error('❌ Token monitoring error:', error);
      }
    };

    // Check tokens immediately on startup
    setTimeout(checkAndRefreshTokens, 5000); // 5 seconds after startup
    
    // Then check every 30 minutes
    const tokenRefreshInterval = setInterval(checkAndRefreshTokens, 30 * 60 * 1000);
    this.activeIntervals.set('token_refresh', tokenRefreshInterval);
    
    console.log('🔐 Token refresh monitoring started - checking every 30 minutes');
  }

  destroy(): void {
    this.stopAllSchedules();
    if (this.recommendationEngine) {
      clearInterval(this.recommendationEngine);
    }
    // Clear token refresh monitoring
    const tokenRefreshInterval = this.activeIntervals.get('token_refresh');
    if (tokenRefreshInterval) {
      clearInterval(tokenRefreshInterval);
      this.activeIntervals.delete('token_refresh');
    }
  }
}

export const syncScheduler = new SyncScheduler();