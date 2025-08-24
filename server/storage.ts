import {
  users,
  customers,
  products,
  invoices,
  invoiceItems,
  integrations,
  activityLogs,
  timeEntries,
  materialEntries,
  clockEntries,
  timesheetLineItems,
  syncLogs,
  externalMappings,
  taskAssignments,
  employeeSchedules,
  customerNotes,
  databaseConnections,
  userPresence,
  collaborationActivity,
  type User,
  type UpsertUser,
  type Customer,
  type InsertCustomer,
  type Product,
  type InsertProduct,
  type Invoice,
  type InsertInvoice,
  type InvoiceItem,
  type InsertInvoiceItem,
  type Integration,
  type InsertIntegration,
  type ActivityLog,
  type InsertActivityLog,
  type TimeEntry,
  type InsertTimeEntry,
  type MaterialEntry,
  type InsertMaterialEntry,
  type ClockEntry,
  type InsertClockEntry,
  type TimesheetLineItem,
  type InsertTimesheetLineItem,
  type SyncLog,
  type InsertSyncLog,
  type ExternalMapping,
  type InsertExternalMapping,
  type TaskAssignment,
  type InsertTaskAssignment,
  type EmployeeSchedule,
  type InsertEmployeeSchedule,
  type CustomerNote,
  type InsertCustomerNote,
  type DatabaseConnection,
  type InsertDatabaseConnection,
  type UserPresence,
  type InsertUserPresence,
  type CollaborationActivity,
  type InsertCollaborationActivity,
  pendingApprovals,
  weeklyPayroll,
  emailNotifications,
  type PendingApproval,
  type InsertPendingApproval,
  type WeeklyPayroll,
  type InsertWeeklyPayroll,
  type EmailNotification,
  type InsertEmailNotification,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Customer operations
  getCustomers(userId: string): Promise<Customer[]>;
  searchCustomers(userId: string, query: string): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  getCustomerByName(name: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer>;
  deleteCustomer(id: string): Promise<void>;
  
  // Product operations
  getProducts(userId: string): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  
  // Invoice operations
  getInvoices(userId: string): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, invoice: Partial<InsertInvoice>): Promise<Invoice>;
  deleteInvoice(id: string): Promise<void>;
  
  // Invoice item operations
  getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]>;
  createInvoiceItem(item: InsertInvoiceItem): Promise<InvoiceItem>;
  updateInvoiceItem(id: string, item: Partial<InsertInvoiceItem>): Promise<InvoiceItem>;
  deleteInvoiceItem(id: string): Promise<void>;
  
  // Integration operations
  getIntegrations(userId: string): Promise<Integration[]>;
  getIntegration(userId: string, provider: string): Promise<Integration | undefined>;
  getIntegrationByRealmId(realmId: string): Promise<Integration | undefined>;
  upsertIntegration(integration: any): Promise<Integration>;
  
  // Activity log operations
  getActivityLogs(userId: string, limit?: number): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  
  // Time entry operations
  getTimeEntries(userId: string): Promise<TimeEntry[]>;
  getTimeEntry(id: string): Promise<TimeEntry | undefined>;
  createTimeEntry(timeEntry: InsertTimeEntry): Promise<TimeEntry>;
  updateTimeEntry(id: string, timeEntry: Partial<InsertTimeEntry>): Promise<TimeEntry>;
  deleteTimeEntry(id: string): Promise<void>;

  // Material entry operations
  getMaterialEntries(userId: string): Promise<MaterialEntry[]>;
  getMaterialEntry(id: string): Promise<MaterialEntry | undefined>;
  createMaterialEntry(materialEntry: InsertMaterialEntry): Promise<MaterialEntry>;
  updateMaterialEntry(id: string, materialEntry: Partial<InsertMaterialEntry>): Promise<MaterialEntry>;
  deleteMaterialEntry(id: string): Promise<void>;

  // Clock entry operations
  getClockEntries(userId: string): Promise<ClockEntry[]>;
  getActiveClockEntry(userId: string): Promise<ClockEntry | undefined>;
  createClockEntry(clockEntry: InsertClockEntry): Promise<ClockEntry>;
  updateClockEntry(id: string, clockEntry: Partial<InsertClockEntry>): Promise<ClockEntry>;

  // Timesheet line item operations
  getTimesheetLineItems(timeEntryId: string): Promise<TimesheetLineItem[]>;
  createTimesheetLineItem(lineItem: InsertTimesheetLineItem): Promise<TimesheetLineItem>;
  deleteTimesheetLineItems(timeEntryId: string): Promise<void>;

  // Sync log operations
  getSyncLogs(userId: string, limit?: number): Promise<SyncLog[]>;
  createSyncLog(log: InsertSyncLog): Promise<SyncLog>;

  // External mapping operations
  getExternalMapping(userId: string, provider: string, entityType: string, externalId: string): Promise<ExternalMapping | undefined>;
  createExternalMapping(mapping: InsertExternalMapping): Promise<ExternalMapping>;
  updateExternalMapping(id: string, mapping: Partial<InsertExternalMapping>): Promise<ExternalMapping>;

  // Customer notes operations
  getCustomerNotes(customerId: string): Promise<CustomerNote[]>;
  createCustomerNote(note: InsertCustomerNote): Promise<CustomerNote>;
  updateCustomerNote(id: string, note: Partial<InsertCustomerNote>): Promise<CustomerNote>;

  // Employee schedule operations
  getEmployeeSchedules(userId?: string): Promise<EmployeeSchedule[]>;
  getEmployeeSchedule(id: string): Promise<EmployeeSchedule | undefined>;
  createEmployeeSchedule(schedule: InsertEmployeeSchedule): Promise<EmployeeSchedule>;
  updateEmployeeSchedule(id: string, schedule: Partial<InsertEmployeeSchedule>): Promise<EmployeeSchedule>;
  deleteEmployeeSchedule(id: string): Promise<void>;

  // Task assignment operations
  getTaskAssignments(userId?: string): Promise<TaskAssignment[]>;
  createTaskAssignment(task: InsertTaskAssignment): Promise<TaskAssignment>;
  updateTaskAssignment(id: string, task: Partial<InsertTaskAssignment>): Promise<TaskAssignment>;

  // Employee operations
  getEmployees(): Promise<User[]>;
  getEmployee(id: string): Promise<User | undefined>;
  getEmployeeStats(id: string): Promise<any>;
  getEmployeeNotes(employeeId: string): Promise<any[]>;
  createEmployeeNote(data: any): Promise<any>;

  // Enhanced clock functionality  
  getClockEntries(userId: string, period?: string): Promise<ClockEntry[]>;

  // Trapping programs
  getTrappingPrograms(): Promise<any[]>;
  createTrappingProgram(data: any): Promise<any>;
  getNeededTrapChecks(): Promise<any[]>;

  // Weekly summaries
  getWeeklySummary(userId: string): Promise<any>;
  
  // Dashboard stats
  getDashboardStats(userId: string): Promise<{
    totalRevenue: number;
    activeCustomers: number;
    pendingInvoices: number;
    lastSyncAt: Date | null;
  }>;

  // Database Connection operations
  getDatabaseConnections(userId: string): Promise<DatabaseConnection[]>;
  getDatabaseConnection(id: string): Promise<DatabaseConnection | undefined>;
  createDatabaseConnection(connection: InsertDatabaseConnection): Promise<DatabaseConnection>;
  updateDatabaseConnection(id: string, connection: Partial<InsertDatabaseConnection>): Promise<DatabaseConnection>;
  deleteDatabaseConnection(id: string): Promise<void>;
  
  // Pending Approvals operations
  getPendingApprovals(): Promise<PendingApproval[]>;
  createPendingApproval(approval: InsertPendingApproval): Promise<PendingApproval>;
  approvePendingApproval(id: string, approvedBy: string): Promise<PendingApproval>;
  denyPendingApproval(id: string, approvedBy: string, reason: string): Promise<PendingApproval>;
  updatePendingApproval(id: string, data: Partial<InsertPendingApproval>): Promise<PendingApproval>;
  
  // Weekly Payroll operations
  createWeeklyPayroll(payroll: InsertWeeklyPayroll): Promise<WeeklyPayroll>;
  getWeeklyPayrollByEmployee(employeeId: string, weekEndingDate: Date): Promise<WeeklyPayroll | undefined>;
  
  // Email Notifications operations
  createEmailNotification(notification: InsertEmailNotification): Promise<EmailNotification>;
  getPendingEmailNotifications(): Promise<EmailNotification[]>;
  
  // Database test connection
  testConnection(): Promise<{ tablesCount: number; usersCount: number; customersCount: number }>;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Customer operations
  async getCustomers(userId: string): Promise<Customer[]> {
    // For development, return all customers regardless of userId since imported data doesn't have userId assigned
    return await db.select().from(customers).orderBy(desc(customers.createdAt)).limit(100);
  }

  async searchCustomers(userId: string, query: string): Promise<Customer[]> {
    const { ilike } = await import("drizzle-orm");
    return await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.userId, userId),
          ilike(customers.name, `%${query}%`)
        )
      )
      .limit(10);
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async getCustomerByName(name: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.name, name));
    return customer;
  }

  async getCustomerByQuickbooksId(quickbooksId: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.quickbooksId, quickbooksId));
    return customer;
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const [newCustomer] = await db.insert(customers).values(customer).returning();
    return newCustomer;
  }

  async updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer> {
    const [updatedCustomer] = await db
      .update(customers)
      .set({ ...customer, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    return updatedCustomer;
  }

  async deleteCustomer(id: string): Promise<void> {
    await db.delete(customers).where(eq(customers.id, id));
  }

  // Customer notes operations
  async getCustomerNotes(customerId: string): Promise<CustomerNote[]> {
    const { customerNotes } = await import("@shared/schema");
    return await db
      .select()
      .from(customerNotes)
      .where(eq(customerNotes.customerId, customerId))
      .orderBy(desc(customerNotes.createdAt));
  }

  async createCustomerNote(note: InsertCustomerNote): Promise<CustomerNote> {
    const { customerNotes } = await import("@shared/schema");
    const [newNote] = await db.insert(customerNotes).values(note).returning();
    return newNote;
  }

  // Product operations
  async getProducts(userId: string): Promise<Product[]> {
    // For development, return all products regardless of userId since imported data doesn't have userId assigned
    return await db.select().from(products).orderBy(desc(products.createdAt)).limit(100);
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async getProductByQuickbooksId(quickbooksId: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.quickbooksId, quickbooksId));
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product> {
    const [updatedProduct] = await db
      .update(products)
      .set({ ...product, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return updatedProduct;
  }

  async deleteProduct(id: string): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  // Invoice operations
  async getInvoices(userId: string): Promise<Invoice[]> {
    return await db.select().from(invoices).where(eq(invoices.userId, userId)).orderBy(desc(invoices.createdAt));
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice;
  }

  async getInvoiceByQuickbooksId(quickbooksId: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.quickbooksId, quickbooksId));
    return invoice;
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const [newInvoice] = await db.insert(invoices).values(invoice).returning();
    return newInvoice;
  }

  async updateInvoice(id: string, invoice: Partial<InsertInvoice>): Promise<Invoice> {
    const [updatedInvoice] = await db
      .update(invoices)
      .set({ ...invoice, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    return updatedInvoice;
  }

  async deleteInvoice(id: string): Promise<void> {
    await db.delete(invoices).where(eq(invoices.id, id));
  }

  // Invoice item operations
  async getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
    return await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
  }

  async createInvoiceItem(item: InsertInvoiceItem): Promise<InvoiceItem> {
    const [newItem] = await db.insert(invoiceItems).values(item).returning();
    return newItem;
  }

  async updateInvoiceItem(id: string, item: Partial<InsertInvoiceItem>): Promise<InvoiceItem> {
    const [updatedItem] = await db
      .update(invoiceItems)
      .set(item)
      .where(eq(invoiceItems.id, id))
      .returning();
    return updatedItem;
  }

  async deleteInvoiceItem(id: string): Promise<void> {
    await db.delete(invoiceItems).where(eq(invoiceItems.id, id));
  }

  // Integration operations
  async getIntegrations(userId: string): Promise<Integration[]> {
    return await db.select().from(integrations).where(eq(integrations.userId, userId));
  }

  async getIntegration(userId: string, provider: string): Promise<Integration | undefined> {
    const [integration] = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.userId, userId), eq(integrations.provider, provider)));
    return integration;
  }

  async getIntegrationByRealmId(realmId: string): Promise<Integration | undefined> {
    const [integration] = await db.select().from(integrations).where(eq(integrations.realmId, realmId));
    return integration;
  }

  async createIntegration(integration: InsertIntegration): Promise<Integration> {
    const [newIntegration] = await db
      .insert(integrations)
      .values(integration)
      .returning();
    return newIntegration;
  }

  async updateIntegration(id: string, updates: Partial<InsertIntegration>): Promise<Integration> {
    const [updatedIntegration] = await db
      .update(integrations)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, id))
      .returning();
    return updatedIntegration;
  }

  async upsertIntegration(integration: InsertIntegration): Promise<Integration> {
    // Try to find existing integration first
    const existing = await this.getIntegration(integration.userId, integration.provider);
    
    if (existing) {
      // Update existing integration
      return this.updateIntegration(existing.id, integration);
    } else {
      // Create new integration
      return this.createIntegration(integration);
    }
  }

  // Activity log operations
  async getActivityLogs(userId: string, limit = 50): Promise<ActivityLog[]> {
    return await db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.userId, userId))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
  }

  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [newLog] = await db.insert(activityLogs).values(log).returning();
    return newLog;
  }

  // Dashboard stats
  async getDashboardStats(userId: string): Promise<{
    totalRevenue: number;
    activeCustomers: number;
    pendingInvoices: number;
    lastSyncAt: Date | null;
  }> {
    // Get total revenue from paid invoices
    const revenueResult = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.userId, userId), eq(invoices.status, 'paid')));
    
    const totalRevenue = revenueResult.reduce((sum, invoice) => 
      sum + parseFloat(invoice.totalAmount || '0'), 0);

    // Get active customers count
    const customersResult = await db
      .select()
      .from(customers)
      .where(eq(customers.userId, userId));
    const activeCustomers = customersResult.length;

    // Get pending invoices count
    const pendingResult = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.userId, userId), eq(invoices.status, 'sent')));
    const pendingInvoices = pendingResult.length;

    // Get last sync time
    const integrationsResult = await db
      .select()
      .from(integrations)
      .where(eq(integrations.userId, userId))
      .orderBy(desc(integrations.lastSyncAt))
      .limit(1);
    
    const lastSyncAt = integrationsResult[0]?.lastSyncAt || null;

    return {
      totalRevenue,
      activeCustomers,
      pendingInvoices,
      lastSyncAt,
    };
  }

  // Time entry operations
  async getTimeEntries(userId: string): Promise<TimeEntry[]> {
    try {
      return await db.select().from(timeEntries).where(eq(timeEntries.userId, userId)).orderBy(desc(timeEntries.createdAt));
    } catch (error) {
      console.error('Error fetching time entries:', error);
      // Return empty array if there's a schema issue
      return [];
    }
  }

  async getTimeEntry(id: string): Promise<TimeEntry | undefined> {
    const [entry] = await db.select().from(timeEntries).where(eq(timeEntries.id, id));
    return entry;
  }

  async createTimeEntry(timeEntry: InsertTimeEntry): Promise<TimeEntry> {
    const [newEntry] = await db.insert(timeEntries).values(timeEntry).returning();
    return newEntry;
  }

  async updateTimeEntry(id: string, timeEntry: Partial<InsertTimeEntry>): Promise<TimeEntry> {
    const [updatedEntry] = await db
      .update(timeEntries)
      .set({ ...timeEntry, updatedAt: new Date() })
      .where(eq(timeEntries.id, id))
      .returning();
    return updatedEntry;
  }

  async deleteTimeEntry(id: string): Promise<void> {
    await db.delete(timeEntries).where(eq(timeEntries.id, id));
  }

  // Material entry operations
  async getMaterialEntries(userId: string): Promise<MaterialEntry[]> {
    return await db.select().from(materialEntries).where(eq(materialEntries.userId, userId)).orderBy(desc(materialEntries.createdAt));
  }

  async getMaterialEntry(id: string): Promise<MaterialEntry | undefined> {
    const [entry] = await db.select().from(materialEntries).where(eq(materialEntries.id, id));
    return entry;
  }

  async createMaterialEntry(materialEntry: InsertMaterialEntry): Promise<MaterialEntry> {
    const [newEntry] = await db.insert(materialEntries).values(materialEntry).returning();
    return newEntry;
  }

  async updateMaterialEntry(id: string, materialEntry: Partial<InsertMaterialEntry>): Promise<MaterialEntry> {
    const [updatedEntry] = await db
      .update(materialEntries)
      .set({ ...materialEntry, updatedAt: new Date() })
      .where(eq(materialEntries.id, id))
      .returning();
    return updatedEntry;
  }

  async deleteMaterialEntry(id: string): Promise<void> {
    await db.delete(materialEntries).where(eq(materialEntries.id, id));
  }

  // Clock entry operations
  async getClockEntries(userId: string, period?: string): Promise<any[]> {
    try {
      const entries = await db.select({
        id: clockEntries.id,
        userId: clockEntries.userId,
        customerId: clockEntries.customerId,
        punchType: sql<string>`COALESCE(${clockEntries.punchType}, 'in')`,
        punchTime: sql<Date>`COALESCE(${clockEntries.punchTime}, ${clockEntries.clockIn})`,
        notes: sql<string>`COALESCE(${clockEntries.notes}, 'Notes for your punchclock...')`,
        nextDuty: sql<string>`COALESCE(${clockEntries.nextDuty}, '')`,
        requiresAdjustment: sql<boolean>`COALESCE(${clockEntries.requiresAdjustment}, false)`,
        location: clockEntries.location,
        ipAddress: sql<string>`COALESCE(${clockEntries.ipAddress}, '127.0.0.1')`,
        userAgent: sql<string>`COALESCE(${clockEntries.userAgent}, 'Unknown')`,
        dailyTotalHours: sql<number>`COALESCE(${clockEntries.dailyTotalHours}, 0)`,
        weeklyTotalHours: sql<number>`COALESCE(${clockEntries.weeklyTotalHours}, 0)`,
        payStatus: sql<string>`COALESCE(${clockEntries.payStatus}, 'pending')`,
        createdAt: clockEntries.createdAt,
        user: {
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role
        },
        customer: {
          name: customers.name
        }
      })
      .from(clockEntries)
      .leftJoin(users, eq(clockEntries.userId, users.id))
      .leftJoin(customers, eq(clockEntries.customerId, customers.id))
      .where(eq(clockEntries.userId, userId))
      .orderBy(desc(sql`COALESCE(${clockEntries.punchTime}, ${clockEntries.clockIn})`))
      .limit(50);
      
      return entries;
    } catch (error) {
      console.error('Error fetching clock entries for user:', error);
      return [];
    }
  }

  async getActiveClockEntry(userId: string): Promise<ClockEntry | undefined> {
    const [entry] = await db.select().from(clockEntries).where(and(eq(clockEntries.userId, userId), eq(clockEntries.status, 'active')));
    return entry;
  }

  async getClockEntry(id: string): Promise<ClockEntry | undefined> {
    const [entry] = await db.select().from(clockEntries).where(eq(clockEntries.id, id));
    return entry;
  }

  async createClockEntry(clockEntry: InsertClockEntry): Promise<ClockEntry> {
    console.log('Creating clock entry:', clockEntry);
    const [newEntry] = await db.insert(clockEntries).values(clockEntry).returning();
    console.log('Created clock entry:', newEntry);
    return newEntry;
  }

  async updateClockEntry(id: string, clockEntry: Partial<InsertClockEntry>): Promise<ClockEntry> {
    const [updatedEntry] = await db
      .update(clockEntries)
      .set({ ...clockEntry, updatedAt: new Date() })
      .where(eq(clockEntries.id, id))
      .returning();
    return updatedEntry;
  }

  async getAllClockEntries(): Promise<any[]> {
    try {
      const entries = await db.select({
        id: clockEntries.id,
        userId: clockEntries.userId,
        customerId: clockEntries.customerId,
        punchType: sql<string>`COALESCE(${clockEntries.punchType}, 'in')`,
        punchTime: sql<Date>`COALESCE(${clockEntries.punchTime}, ${clockEntries.clockIn})`,
        notes: sql<string>`COALESCE(${clockEntries.notes}, 'Notes for your punchclock...')`,
        nextDuty: sql<string>`COALESCE(${clockEntries.nextDuty}, '')`,
        requiresAdjustment: sql<boolean>`COALESCE(${clockEntries.requiresAdjustment}, false)`,
        location: clockEntries.location,
        ipAddress: sql<string>`COALESCE(${clockEntries.ipAddress}, '127.0.0.1')`,
        userAgent: sql<string>`COALESCE(${clockEntries.userAgent}, 'Unknown')`,
        dailyTotalHours: sql<number>`COALESCE(${clockEntries.dailyTotalHours}, 0)`,
        weeklyTotalHours: sql<number>`COALESCE(${clockEntries.weeklyTotalHours}, 0)`,
        payStatus: sql<string>`COALESCE(${clockEntries.payStatus}, 'pending')`,
        createdAt: clockEntries.createdAt,
        user: {
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role
        },
        customer: {
          name: customers.name
        }
      })
      .from(clockEntries)
      .leftJoin(users, eq(clockEntries.userId, users.id))
      .leftJoin(customers, eq(clockEntries.customerId, customers.id))
      .orderBy(desc(sql`COALESCE(${clockEntries.punchTime}, ${clockEntries.clockIn})`))
      .limit(100);
      
      return entries;
    } catch (error) {
      console.error('Error fetching all clock entries:', error);
      return [];
    }
  }

  async flagClockEntry(id: string, flag: string): Promise<void> {
    try {
      await db.update(clockEntries)
        .set({ adminFlags: [flag] })
        .where(eq(clockEntries.id, id));
    } catch (error) {
      console.error('Error flagging clock entry:', error);
    }
  }

  // Get upcoming schedules for calendar sync
  async getUpcomingSchedules(): Promise<any[]> {
    // This would be implemented based on your scheduling system
    // For now, return empty array as placeholder
    return [];
  }

  // Get active integrations by provider
  async getActiveIntegrations(provider: string): Promise<Integration[]> {
    return await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.provider, provider), eq(integrations.isActive, true)));
  }

  // Timesheet line item operations
  async getTimesheetLineItems(timeEntryId: string): Promise<TimesheetLineItem[]> {
    return await db.select().from(timesheetLineItems).where(eq(timesheetLineItems.timeEntryId, timeEntryId));
  }

  async createTimesheetLineItem(lineItem: InsertTimesheetLineItem): Promise<TimesheetLineItem> {
    const [newItem] = await db.insert(timesheetLineItems).values(lineItem).returning();
    return newItem;
  }

  async deleteTimesheetLineItems(timeEntryId: string): Promise<void> {
    await db.delete(timesheetLineItems).where(eq(timesheetLineItems.timeEntryId, timeEntryId));
  }

  // Sync log operations
  async getSyncLogs(userId: string, limit: number = 50): Promise<SyncLog[]> {
    return await db.select().from(syncLogs).where(eq(syncLogs.userId, userId)).orderBy(desc(syncLogs.createdAt)).limit(limit);
  }

  async createSyncLog(log: InsertSyncLog): Promise<SyncLog> {
    const [newLog] = await db.insert(syncLogs).values(log).returning();
    return newLog;
  }

  // External mapping operations
  async getExternalMapping(userId: string, provider: string, entityType: string, externalId: string): Promise<ExternalMapping | undefined> {
    const [mapping] = await db.select().from(externalMappings).where(
      and(
        eq(externalMappings.userId, userId),
        eq(externalMappings.provider, provider),
        eq(externalMappings.entityType, entityType),
        eq(externalMappings.externalId, externalId)
      )
    );
    return mapping;
  }

  async createExternalMapping(mapping: InsertExternalMapping): Promise<ExternalMapping> {
    const [newMapping] = await db.insert(externalMappings).values(mapping).returning();
    return newMapping;
  }

  async updateExternalMapping(id: string, mapping: Partial<InsertExternalMapping>): Promise<ExternalMapping> {
    const [updatedMapping] = await db
      .update(externalMappings)
      .set(mapping)
      .where(eq(externalMappings.id, id))
      .returning();
    return updatedMapping;
  }

  // Customer notes operations
  async getCustomerNotes(customerId: string): Promise<CustomerNote[]> {
    return await db.select().from(customerNotes).where(eq(customerNotes.customerId, customerId)).orderBy(desc(customerNotes.createdAt));
  }

  async createCustomerNote(note: InsertCustomerNote): Promise<CustomerNote> {
    const [newNote] = await db.insert(customerNotes).values(note).returning();
    return newNote;
  }

  async updateCustomerNote(id: string, note: Partial<InsertCustomerNote>): Promise<CustomerNote> {
    const [updatedNote] = await db
      .update(customerNotes)
      .set(note)
      .where(eq(customerNotes.id, id))
      .returning();
    return updatedNote;
  }

  // Employee schedule operations
  async getEmployeeSchedules(userId?: string): Promise<EmployeeSchedule[]> {
    const query = db.select().from(employeeSchedules).orderBy(desc(employeeSchedules.startTime));
    if (userId) {
      return await query.where(eq(employeeSchedules.employeeId, userId));
    }
    return await query;
  }

  async getEmployeeSchedule(id: string): Promise<EmployeeSchedule | undefined> {
    const [schedule] = await db.select().from(employeeSchedules).where(eq(employeeSchedules.id, id));
    return schedule;
  }

  async createEmployeeSchedule(schedule: InsertEmployeeSchedule): Promise<EmployeeSchedule> {
    const [newSchedule] = await db.insert(employeeSchedules).values(schedule).returning();
    return newSchedule;
  }

  async updateEmployeeSchedule(id: string, schedule: Partial<InsertEmployeeSchedule>): Promise<EmployeeSchedule> {
    const [updatedSchedule] = await db
      .update(employeeSchedules)
      .set(schedule)
      .where(eq(employeeSchedules.id, id))
      .returning();
    return updatedSchedule;
  }

  async deleteEmployeeSchedule(id: string): Promise<void> {
    await db.delete(employeeSchedules).where(eq(employeeSchedules.id, id));
  }

  // Task assignment operations
  async getTaskAssignments(userId?: string): Promise<TaskAssignment[]> {
    const query = db.select().from(taskAssignments).orderBy(desc(taskAssignments.createdAt));
    if (userId) {
      return await query.where(eq(taskAssignments.assignedTo, userId));
    }
    return await query;
  }

  async createTaskAssignment(task: InsertTaskAssignment): Promise<TaskAssignment> {
    const [newTask] = await db.insert(taskAssignments).values(task).returning();
    return newTask;
  }

  async updateTaskAssignment(id: string, task: Partial<InsertTaskAssignment>): Promise<TaskAssignment> {
    const [updatedTask] = await db
      .update(taskAssignments)
      .set(task)
      .where(eq(taskAssignments.id, id))
      .returning();
    return updatedTask;
  }

  // Employee operations
  async getEmployees(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.isActive, true)).orderBy(users.firstName);
  }

  async getEmployee(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getEmployeeStats(id: string): Promise<any> {
    // Calculate basic stats from clock entries
    const clockData = await db.select().from(clockEntries).where(eq(clockEntries.userId, id));
    
    return {
      weekHours: 32.5,  // Mock data - implement actual calculation
      monthHours: 140.0,
      yearHours: 1680.0
    };
  }

  async getEmployeeNotes(employeeId: string): Promise<any[]> {
    // Return empty array for now - will implement when employeeNotes table is added
    return [];
  }

  async createEmployeeNote(data: any): Promise<any> {
    // Mock implementation - will implement when employeeNotes table is added
    return {
      id: 'note-' + Date.now(),
      ...data,
      createdAt: new Date()
    };
  }

  async getTrappingPrograms(): Promise<any[]> {
    // Mock implementation - will implement when trappingPrograms table is added
    return [];
  }

  async createTrappingProgram(data: any): Promise<any> {
    // Mock implementation
    return {
      id: 'trap-' + Date.now(),
      ...data,
      createdAt: new Date()
    };
  }

  async getNeededTrapChecks(): Promise<any[]> {
    // Mock implementation
    return [
      {
        id: '1',
        customerName: 'Smith Property',
        nextCheckDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        currentWeek: 3
      }
    ];
  }

  async getWeeklySummary(userId: string): Promise<any> {
    // Mock implementation
    return {
      positives: 5,
      negatives: 1,
      complaints: 0,
      resprays: 2,
      trapChecks: 8,
      newCustomers: 3,
      revenue: 2450.00
    };
  }

  async updateUser(id: string, updates: Partial<UpsertUser>): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  // Database Connection operations
  async getDatabaseConnections(userId: string): Promise<DatabaseConnection[]> {
    return await db.select()
      .from(databaseConnections)
      .where(eq(databaseConnections.userId, userId))
      .orderBy(desc(databaseConnections.createdAt));
  }

  async getDatabaseConnection(id: string): Promise<DatabaseConnection | undefined> {
    const [connection] = await db.select()
      .from(databaseConnections)
      .where(eq(databaseConnections.id, id));
    return connection;
  }

  async createDatabaseConnection(connection: InsertDatabaseConnection): Promise<DatabaseConnection> {
    const [newConnection] = await db.insert(databaseConnections)
      .values(connection)
      .returning();
    return newConnection;
  }

  async updateDatabaseConnection(id: string, connection: Partial<InsertDatabaseConnection>): Promise<DatabaseConnection> {
    const [updatedConnection] = await db.update(databaseConnections)
      .set({ ...connection, updatedAt: new Date() })
      .where(eq(databaseConnections.id, id))
      .returning();
    return updatedConnection;
  }

  async deleteDatabaseConnection(id: string): Promise<void> {
    await db.delete(databaseConnections)
      .where(eq(databaseConnections.id, id));
  }

  // Pending Approvals operations
  async getPendingApprovals(): Promise<PendingApproval[]> {
    return await db.select().from(pendingApprovals).orderBy(desc(pendingApprovals.submitDate));
  }

  async createPendingApproval(approval: InsertPendingApproval): Promise<PendingApproval> {
    const [newApproval] = await db.insert(pendingApprovals).values(approval).returning();
    return newApproval;
  }

  async approvePendingApproval(id: string, approvedBy: string): Promise<PendingApproval> {
    const [approval] = await db
      .update(pendingApprovals)
      .set({
        approved: true,
        approvedBy,
        approvedDate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(pendingApprovals.id, id))
      .returning();
    return approval;
  }

  async denyPendingApproval(id: string, approvedBy: string, reason: string): Promise<PendingApproval> {
    const [approval] = await db
      .update(pendingApprovals)
      .set({
        approved: false,
        approvedBy,
        approvedDate: new Date(),
        denyReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(pendingApprovals.id, id))
      .returning();
    return approval;
  }

  async updatePendingApproval(id: string, data: Partial<InsertPendingApproval>): Promise<PendingApproval> {
    const [approval] = await db
      .update(pendingApprovals)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(pendingApprovals.id, id))
      .returning();
    return approval;
  }

  // Weekly Payroll operations
  async createWeeklyPayroll(payroll: InsertWeeklyPayroll): Promise<WeeklyPayroll> {
    const [newPayroll] = await db.insert(weeklyPayroll).values(payroll).returning();
    return newPayroll;
  }

  async getWeeklyPayrollByEmployee(employeeId: string, weekEndingDate: Date): Promise<WeeklyPayroll | undefined> {
    const [payroll] = await db
      .select()
      .from(weeklyPayroll)
      .where(and(eq(weeklyPayroll.employeeId, employeeId), eq(weeklyPayroll.weekEndingDate, weekEndingDate)));
    return payroll;
  }

  // Email Notifications operations
  async createEmailNotification(notification: InsertEmailNotification): Promise<EmailNotification> {
    const [newNotification] = await db.insert(emailNotifications).values(notification).returning();
    return newNotification;
  }

  async getPendingEmailNotifications(): Promise<EmailNotification[]> {
    return await db
      .select()
      .from(emailNotifications)
      .where(eq(emailNotifications.status, 'pending'))
      .orderBy(emailNotifications.createdAt);
  }

  // Helper method to create sample approval data
  async createSampleApprovalData(): Promise<void> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    const sampleApprovals = [
      {
        id: 'approval-001',
        formType: 'Weekly Payroll',
        submittedBy: 'Spencer Reiser',
        submittedByEmail: 'spencer@marinpestcontrol.com',
        submitDate: yesterday,
        weekEndingDate: yesterday,
        totalAmount: '2,840.00',
        data: {
          employeeId: 'emp-001',
          totalHours: 71,
          regularHours: 40,
          overtimeHours: 31,
          hourlyRate: 40,
          clockEntries: [
            { date: '2025-01-13', clockIn: '7:00 AM', clockOut: '5:30 PM', hours: 9.5 },
            { date: '2025-01-14', clockIn: '7:15 AM', clockOut: '6:00 PM', hours: 10.75 },
            { date: '2025-01-15', clockIn: '8:00 AM', clockOut: '4:30 PM', hours: 8.5 },
            { date: '2025-01-16', clockIn: '7:00 AM', clockOut: '5:15 PM', hours: 10.25 },
            { date: '2025-01-17', clockIn: '7:30 AM', clockOut: '8:45 PM', hours: 13.25 }
          ]
        },
        approved: null,
        approvedBy: null,
        approvedDate: null,
        denyReason: null,
        createdAt: yesterday,
        updatedAt: yesterday
      },
      {
        id: 'approval-002',
        formType: 'Hours & Materials',
        submittedBy: 'Boden Haines',
        submittedByEmail: 'boden@marinpestcontrol.com',
        submitDate: now,
        weekEndingDate: null,
        totalAmount: '485.50',
        data: {
          customerName: 'Johnson Residence',
          customerEmail: 'mjohnson@email.com',
          customerPhone: '(415) 555-0123',
          customerAddress: '123 Oak Street, Mill Valley, CA',
          serviceType: 'Rodent Control',
          hoursWorked: 4.5,
          hourlyRate: 65,
          materialsUsed: [
            { name: 'Snap Traps (6-pack)', quantity: 2, cost: 24.00 },
            { name: 'Bait Stations', quantity: 4, cost: 48.00 },
            { name: 'Exclusion Materials', quantity: 1, cost: 121.00 }
          ],
          laborCost: 292.50,
          materialsCost: 193.00,
          description: 'Comprehensive rodent control with exclusion work in attic and basement areas'
        },
        approved: null,
        approvedBy: null,
        approvedDate: null,
        denyReason: null,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'approval-003',
        formType: 'Calendar Appointment',
        submittedBy: 'Jorge Sisneros',
        submittedByEmail: 'jorge@marinpestcontrol.com',
        submitDate: twoDaysAgo,
        weekEndingDate: null,
        totalAmount: null,
        data: {
          eventId: 'cal-event-789',
          customerName: 'Wilson Property',
          eventTitle: 'Emergency Wasp Removal',
          scheduledDate: '2025-01-20',
          scheduledTime: '2:00 PM - 4:00 PM',
          serviceType: 'Wasp/Hornet Removal',
          urgency: 'High',
          notes: 'Large wasp nest discovered near front entrance, requires immediate attention'
        },
        approved: null,
        approvedBy: null,
        approvedDate: null,
        denyReason: null,
        createdAt: twoDaysAgo,
        updatedAt: twoDaysAgo
      }
    ];

    for (const approval of sampleApprovals) {
      try {
        await this.createPendingApproval(approval);
        console.log(`Created sample approval: ${approval.id}`);
      } catch (error) {
        console.log(`Sample approval ${approval.id} may already exist`);
      }
    }
  }

  // Test database connection
  async testConnection(): Promise<{ tablesCount: number; usersCount: number; customersCount: number }> {
    try {
      const { sql } = await import('drizzle-orm');
      
      // Test basic query
      const tablesResult = await db.execute(sql`
        SELECT count(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      
      const usersResult = await db.select({ count: sql<number>`count(*)` }).from(users);
      const customersResult = await db.select({ count: sql<number>`count(*)` }).from(customers);
      
      return {
        tablesCount: Number(tablesResult.rows[0]?.count || 0),
        usersCount: Number(usersResult[0]?.count || 0),
        customersCount: Number(customersResult[0]?.count || 0)
      };
    } catch (error) {
      console.error('Database test connection failed:', error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();
