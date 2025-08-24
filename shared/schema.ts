import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  decimal,
  integer,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  phone: varchar("phone"),
  address: text("address"),
  role: varchar("role").default('employee'), // 'admin', 'manager', 'employee'
  employeeId: varchar("employee_id"),
  department: varchar("department"),
  hireDate: timestamp("hire_date"),
  payRate: decimal("pay_rate", { precision: 10, scale: 2 }),
  disciplines: text("disciplines").array(),
  isActive: boolean("is_active").default(true),
  passwordHash: varchar("password_hash"), // For password login
  googleCalendarId: varchar("google_calendar_id"), // For calendar sync
  // NextAuth Google OAuth fields
  googleId: varchar("google_id"),
  googleAccessToken: text("google_access_token"),
  googleRefreshToken: text("google_refresh_token"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// NextAuth accounts table for OAuth providers
export const accounts = pgTable("accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar("type").notNull(),
  provider: varchar("provider").notNull(),
  providerAccountId: varchar("provider_account_id").notNull(),
  refreshToken: text("refresh_token"),
  accessToken: text("access_token"),
  expiresAt: integer("expires_at"),
  tokenType: varchar("token_type"),
  scope: varchar("scope"),
  idToken: text("id_token"),
  sessionState: varchar("session_state"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// NextAuth verification tokens
export const verificationTokens = pgTable("verification_tokens", {
  identifier: varchar("identifier").notNull(),
  token: varchar("token").notNull(),
  expires: timestamp("expires").notNull(),
}, (table) => [
  index("verification_tokens_identifier_idx").on(table.identifier),
  index("verification_tokens_token_idx").on(table.token)
]);

// Employee schedules table
export const employeeSchedules = pgTable("employee_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => users.id),
  title: varchar("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  location: varchar("location"),
  customerId: varchar("customer_id").references(() => customers.id),
  projectName: varchar("project_name"),
  status: varchar("status").default('scheduled'), // 'scheduled', 'in_progress', 'completed', 'cancelled'
  googleEventId: varchar("google_event_id"), // For Google Calendar sync
  syncStatus: varchar("sync_status").default('pending'),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Task assignments table
export const taskAssignments = pgTable("task_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignedTo: varchar("assigned_to").notNull().references(() => users.id),
  assignedBy: varchar("assigned_by").notNull().references(() => users.id),
  customerId: varchar("customer_id").references(() => customers.id),
  title: varchar("title").notNull(),
  description: text("description"),
  priority: varchar("priority").default('medium'), // 'low', 'medium', 'high', 'urgent'
  status: varchar("status").default('assigned'), // 'assigned', 'in_progress', 'completed', 'cancelled'
  dueDate: timestamp("due_date"),
  estimatedHours: decimal("estimated_hours", { precision: 5, scale: 2 }),
  actualHours: decimal("actual_hours", { precision: 5, scale: 2 }),
  scheduleId: varchar("schedule_id").references(() => employeeSchedules.id),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Hours and Materials form submissions
export const hoursAndMaterials = pgTable("hours_and_materials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submittedBy: varchar("submitted_by").notNull().references(() => users.id),
  customerId: varchar("customer_id").references(() => customers.id),
  customerName: varchar("customer_name").notNull(),
  customerAddress: text("customer_address"),
  customerPhone: varchar("customer_phone"),
  customerEmail: varchar("customer_email"),
  jobDescription: text("job_description"),
  workDate: timestamp("work_date").notNull(),
  status: varchar("status").default('pending'), // 'pending', 'approved', 'rejected', 'invoiced'
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  invoiceId: varchar("invoice_id"), // QuickBooks invoice ID
  totalHours: decimal("total_hours", { precision: 8, scale: 2 }),
  totalMaterialsCost: decimal("total_materials_cost", { precision: 10, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
  googleDriveFolderId: varchar("google_drive_folder_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Hours entries for H&M forms
export const hoursEntries = pgTable("hours_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  hmFormId: varchar("hm_form_id").notNull().references(() => hoursAndMaterials.id, { onDelete: 'cascade' }),
  serviceId: varchar("service_id").references(() => products.id),
  serviceName: varchar("service_name").notNull(),
  hours: decimal("hours", { precision: 5, scale: 2 }).notNull(),
  rate: decimal("rate", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Materials entries for H&M forms
export const materialsEntries = pgTable("materials_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  hmFormId: varchar("hm_form_id").notNull().references(() => hoursAndMaterials.id, { onDelete: 'cascade' }),
  productId: varchar("product_id").references(() => products.id),
  productName: varchar("product_name").notNull(),
  quantity: decimal("quantity", { precision: 8, scale: 2 }).notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Photo uploads for H&M forms
export const formPhotos = pgTable("form_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  hmFormId: varchar("hm_form_id").notNull().references(() => hoursAndMaterials.id, { onDelete: 'cascade' }),
  photoType: varchar("photo_type").notNull(), // 'before', 'after', 'materials', 'other'
  fileName: varchar("file_name").notNull(),
  googleDriveFileId: varchar("google_drive_file_id"),
  googleDriveUrl: text("google_drive_url"),
  description: text("description"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

// Google Drive integration tracking
export const googleDriveFolders = pgTable("google_drive_folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => customers.id),
  customerName: varchar("customer_name").notNull(),
  customerAddress: text("customer_address"),
  folderId: varchar("folder_id").notNull().unique(),
  folderName: varchar("folder_name").notNull(),
  folderUrl: text("folder_url"),
  photosFolderId: varchar("photos_folder_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User presence tracking for real-time collaboration
export const userPresence = pgTable("user_presence", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  status: varchar("status").notNull().default('offline'), // 'online', 'away', 'busy', 'offline'
  currentPage: varchar("current_page"), // Current page/route user is viewing
  currentActivity: varchar("current_activity"), // What they're working on
  currentCustomer: varchar("current_customer").references(() => customers.id), // Customer they're working with
  lastSeen: timestamp("last_seen").defaultNow(),
  sessionId: varchar("session_id"), // WebSocket session identifier
  deviceInfo: text("device_info"), // Browser/device information
  isTyping: boolean("is_typing").default(false), // Real-time typing indicator
  typingIn: varchar("typing_in"), // Which form/field they're typing in
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Collaboration activity log for team awareness
export const collaborationActivity = pgTable("collaboration_activity", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  activityType: varchar("activity_type").notNull(), // 'page_view', 'form_edit', 'customer_view', 'task_start', 'task_complete'
  activityData: jsonb("activity_data"), // Additional context data
  resourceId: varchar("resource_id"), // ID of customer, task, etc. being worked on
  resourceType: varchar("resource_type"), // 'customer', 'task', 'invoice', 'schedule'
  description: text("description"), // Human-readable activity description
  duration: integer("duration"), // Time spent on activity (seconds)
  createdAt: timestamp("created_at").defaultNow(),
});

// Customers table
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // Nullable for system-wide customers
  quickbooksId: varchar("quickbooks_id").unique(),
  name: text("name").notNull(),
  email: varchar("email"),
  phone: varchar("phone"),
  address: text("address"),
  city: varchar("city"),
  state: varchar("state"),
  zipCode: varchar("zip_code"),
  country: varchar("country"),
  companyName: varchar("company_name"),
  website: varchar("website"),
  taxId: varchar("tax_id"),
  notes: text("notes"), // General notes synced with QuickBooks
  isActive: boolean("is_active").default(true),
  syncStatus: varchar("sync_status").default('pending'), // 'pending', 'synced', 'error'
  syncError: text("sync_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Customer notes table for detailed note history
export const customerNotes = pgTable("customer_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  isPrivate: boolean("is_private").default(false), // Private notes don't sync to QB
  quickbooksNoteId: varchar("quickbooks_note_id"), // For QB sync tracking
  syncStatus: varchar("sync_status").default('pending'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Products/Services table
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // Nullable for system-wide products
  quickbooksId: varchar("quickbooks_id").unique(),
  name: text("name").notNull(),
  description: text("description"),
  type: varchar("type").notNull(), // 'product', 'service', or 'material'
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  qtyOnHand: integer("qty_on_hand"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Invoices table
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  quickbooksId: varchar("quickbooks_id").unique(),
  invoiceNumber: varchar("invoice_number").notNull(),
  invoiceDate: timestamp("invoice_date").notNull(),
  dueDate: timestamp("due_date"),
  status: varchar("status").notNull().default('draft'), // 'draft', 'sent', 'paid', 'overdue', 'cancelled'
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default('0'),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  syncStatus: varchar("sync_status").default('pending'), // 'pending', 'synced', 'error'
  syncError: text("sync_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Invoice items table
export const invoiceItems = pgTable("invoice_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id),
  productId: varchar("product_id").references(() => products.id),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Integration settings table
export const integrations = pgTable("integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  provider: varchar("provider").notNull(), // 'quickbooks', 'jotform', 'google', 'postgresql'
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  companyId: varchar("company_id"), // For QuickBooks
  realmId: varchar("realm_id"), // For QuickBooks
  settings: jsonb("settings"),
  isActive: boolean("is_active").default(true),
  lastSyncAt: timestamp("last_sync_at"),
  expiresAt: timestamp("expires_at"), // Token expiration time
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Unique constraint on userId and provider combination
  uniqueIndex("unique_user_provider").on(table.userId, table.provider)
]);

// Database connections table for external PostgreSQL databases
export const databaseConnections = pgTable("database_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: varchar("name").notNull(),
  host: varchar("host").notNull(),
  port: integer("port").notNull().default(5432),
  database: varchar("database").notNull(),
  username: varchar("username").notNull(),
  password: text("password").notNull(), // Encrypted in production
  ssl: boolean("ssl").default(false),
  isActive: boolean("is_active").default(true),
  syncInterval: integer("sync_interval"), // minutes (null = manual only)
  autoSync: boolean("auto_sync").default(false),
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncStatus: varchar("last_sync_status"), // 'success', 'error', 'in_progress'
  lastSyncError: text("last_sync_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Employee notes table for date-stamped notes
export const employeeNotes = pgTable("employee_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => users.id),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  content: text("content").notNull(),
  category: varchar("category"), // 'performance', 'disciplinary', 'general', etc.
  isPrivate: boolean("is_private").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Rodent trapping program tracking
export const trappingPrograms = pgTable("trapping_programs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  programType: varchar("program_type").notNull(), // 'rodent_trapping'
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  totalWeeks: integer("total_weeks").notNull(),
  weeksRemaining: integer("weeks_remaining").notNull(),
  lastCheckDate: timestamp("last_check_date"),
  nextCheckDate: timestamp("next_check_date").notNull(),
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Weekly summary tracking for dashboard
export const weeklySummaries = pgTable("weekly_summaries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  weekStartDate: timestamp("week_start_date").notNull(),
  weekEndDate: timestamp("week_end_date").notNull(),
  positives: integer("positives").default(0),
  negatives: integer("negatives").default(0),
  complaints: integer("complaints").default(0),
  resprays: integer("resprays").default(0),
  trapChecks: integer("trap_checks").default(0),
  newCustomers: integer("new_customers").default(0),
  revenue: decimal("revenue", { precision: 10, scale: 2 }).default('0'),
  notes: text("notes"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Sync logs table for tracking all sync operations
export const syncLogs = pgTable("sync_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  integrationId: varchar("integration_id").notNull().references(() => integrations.id),
  operation: varchar("operation").notNull(), // 'push', 'pull', 'webhook'
  entityType: varchar("entity_type").notNull(), // 'customer', 'product', 'invoice', 'timesheet'
  entityId: varchar("entity_id"),
  externalId: varchar("external_id"), // ID from external system
  status: varchar("status").notNull(), // 'success', 'error', 'pending'
  direction: varchar("direction").notNull(), // 'inbound', 'outbound', 'bidirectional'
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"), // Additional sync data
  createdAt: timestamp("created_at").defaultNow(),
});

// Mapping table for external system IDs
export const externalMappings = pgTable("external_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  provider: varchar("provider").notNull(),
  entityType: varchar("entity_type").notNull(),
  internalId: varchar("internal_id").notNull(),
  externalId: varchar("external_id").notNull(),
  lastSyncAt: timestamp("last_sync_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Time entries table
export const timeEntries = pgTable("time_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  customerId: varchar("customer_id").references(() => customers.id),
  projectName: varchar("project_name"),
  description: text("description").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  hours: decimal("hours", { precision: 5, scale: 2 }),
  billable: boolean("billable").default(true),
  status: varchar("status").notNull().default('draft'), // 'draft', 'submitted', 'approved', 'invoiced'
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Material entries table  
export const materialEntries = pgTable("material_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  customerId: varchar("customer_id").references(() => customers.id),
  projectName: varchar("project_name"),
  itemName: varchar("item_name").notNull(),
  description: text("description"),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }).notNull(),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull(),
  supplier: varchar("supplier"),
  receiptNumber: varchar("receipt_number"),
  purchaseDate: timestamp("purchase_date"),
  status: varchar("status").notNull().default('draft'), // 'draft', 'submitted', 'approved', 'invoiced'
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Clock entries for simple clock in/out functionality with calendar integration
export const clockEntries = pgTable("clock_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  customerId: varchar("customer_id").references(() => customers.id),
  punchType: varchar("punch_type").notNull(), // 'in', 'out', 'break_in', 'break_out', 'lunch_in', 'lunch_out'
  punchTime: timestamp("punch_time").notNull(),
  location: text("location"), // GPS coordinates as JSON
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"), // To detect mobile vs desktop
  notes: text("notes").default("Notes for your punchclock..."),
  nextDuty: varchar("next_duty"), // Next assigned duty description
  requiresAdjustment: boolean("requires_adjustment").default(false),
  adjustmentRequested: boolean("adjustment_requested").default(false),
  adjustmentEmailSent: boolean("adjustment_email_sent").default(false),
  adjustmentReason: text("adjustment_reason"),
  originalPunchTime: timestamp("original_punch_time"), // Store original before adjustments
  adjustedBy: varchar("adjusted_by").references(() => users.id),
  adjustedAt: timestamp("adjusted_at"),
  adminFlags: text("admin_flags").array(), // 'suspicious', 'overtime', 'no_calendar_event', 'weekend', 'after_hours'
  calendarEventId: varchar("calendar_event_id"), // Google Calendar event ID
  paired: boolean("paired").default(false), // Whether this punch has been paired with an opposite punch
  dailyTotalHours: decimal("daily_total_hours", { precision: 5, scale: 2 }), // Updated when punch is completed
  weeklyTotalHours: decimal("weekly_total_hours", { precision: 5, scale: 2 }), // Updated when punch is completed
  payStatus: varchar("pay_status").default('pending'), // 'pending', 'approved', 'paid', 'void', 'flagged'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Invoice line items for timesheet entries (products and services)
export const timesheetLineItems = pgTable("timesheet_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timeEntryId: varchar("time_entry_id").notNull().references(() => timeEntries.id),
  type: varchar("type", { length: 20 }).notNull(), // product, service
  quickbooksItemId: varchar("quickbooks_item_id"),
  itemName: varchar("item_name").notNull(),
  description: text("description"),
  quantity: decimal("quantity", { precision: 10, scale: 2 }),
  hours: decimal("hours", { precision: 5, scale: 2 }),
  rate: decimal("rate", { precision: 10, scale: 2 }),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Activity log table
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type").notNull(), // 'time_submitted', 'material_submitted', 'invoice_created', etc.
  description: text("description").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Workflow triggers table
export const workflowTriggers = pgTable("workflow_triggers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  triggerType: varchar("trigger_type").notNull(), // 'form_submission', 'time_entry', 'status_change', 'schedule_event'
  triggerEvent: varchar("trigger_event").notNull(), // 'job_form_submit', 'material_submit', 'clock_in', 'clock_out', etc.
  conditions: jsonb("conditions"), // Conditions that must be met
  actions: jsonb("actions").notNull(), // Actions to execute
  priority: integer("priority").default(100), // Lower numbers = higher priority
  retryCount: integer("retry_count").default(3),
  isTemplate: boolean("is_template").default(false), // For creating reusable templates
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Workflow executions table
export const workflowExecutions = pgTable("workflow_executions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  triggerId: varchar("trigger_id").notNull().references(() => workflowTriggers.id),
  status: varchar("status").default('pending'), // 'pending', 'running', 'completed', 'failed', 'retrying'
  triggerData: jsonb("trigger_data").notNull(), // Data that triggered the workflow
  executionResults: jsonb("execution_results"), // Results of each action
  errorMessage: text("error_message"),
  attemptNumber: integer("attempt_number").default(1),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Workflow action templates table
export const workflowActionTemplates = pgTable("workflow_action_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  category: varchar("category").notNull(), // 'notification', 'integration', 'data_processing', 'scheduling'
  actionType: varchar("action_type").notNull(), // 'send_email', 'create_schedule', 'sync_quickbooks', etc.
  description: text("description"),
  configSchema: jsonb("config_schema").notNull(), // JSON schema for configuration
  defaultConfig: jsonb("default_config"), // Default configuration values
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  customers: many(customers),
  products: many(products),
  invoices: many(invoices),
  integrations: many(integrations),
  activityLogs: many(activityLogs),
  timeEntries: many(timeEntries),
  materialEntries: many(materialEntries),
  clockEntries: many(clockEntries),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  user: one(users, {
    fields: [customers.userId],
    references: [users.id],
  }),
  invoices: many(invoices),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  user: one(users, {
    fields: [products.userId],
    references: [users.id],
  }),
  invoiceItems: many(invoiceItems),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  user: one(users, {
    fields: [invoices.userId],
    references: [users.id],
  }),
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  items: many(invoiceItems),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
  product: one(products, {
    fields: [invoiceItems.productId],
    references: [products.id],
  }),
}));

export const integrationsRelations = relations(integrations, ({ one }) => ({
  user: one(users, {
    fields: [integrations.userId],
    references: [users.id],
  }),
}));

// Hours and Materials relations
export const hoursAndMaterialsRelations = relations(hoursAndMaterials, ({ one, many }) => ({
  submittedBy: one(users, {
    fields: [hoursAndMaterials.submittedBy],
    references: [users.id],
  }),
  customer: one(customers, {
    fields: [hoursAndMaterials.customerId],
    references: [customers.id],
  }),
  approver: one(users, {
    fields: [hoursAndMaterials.approvedBy],
    references: [users.id],
  }),
  hoursEntries: many(hoursEntries),
  materialsEntries: many(materialsEntries),
  photos: many(formPhotos),
}));

export const hoursEntriesRelations = relations(hoursEntries, ({ one }) => ({
  hmForm: one(hoursAndMaterials, {
    fields: [hoursEntries.hmFormId],
    references: [hoursAndMaterials.id],
  }),
  service: one(products, {
    fields: [hoursEntries.serviceId],
    references: [products.id],
  }),
}));

export const materialsEntriesRelations = relations(materialsEntries, ({ one }) => ({
  hmForm: one(hoursAndMaterials, {
    fields: [materialsEntries.hmFormId],
    references: [hoursAndMaterials.id],
  }),
  product: one(products, {
    fields: [materialsEntries.productId],
    references: [products.id],
  }),
}));

export const formPhotosRelations = relations(formPhotos, ({ one }) => ({
  hmForm: one(hoursAndMaterials, {
    fields: [formPhotos.hmFormId],
    references: [hoursAndMaterials.id],
  }),
}));

export const googleDriveFoldersRelations = relations(googleDriveFolders, ({ one }) => ({
  customer: one(customers, {
    fields: [googleDriveFolders.customerId],
    references: [customers.id],
  }),
}));

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  user: one(users, {
    fields: [timeEntries.userId],
    references: [users.id],
  }),
  customer: one(customers, {
    fields: [timeEntries.customerId],
    references: [customers.id],
  }),
}));

export const materialEntriesRelations = relations(materialEntries, ({ one }) => ({
  user: one(users, {
    fields: [materialEntries.userId],
    references: [users.id],
  }),
  customer: one(customers, {
    fields: [materialEntries.customerId],
    references: [customers.id],
  }),
}));

export const clockEntriesRelations = relations(clockEntries, ({ one }) => ({
  user: one(users, {
    fields: [clockEntries.userId],
    references: [users.id],
  }),
}));

export const timesheetLineItemsRelations = relations(timesheetLineItems, ({ one }) => ({
  timeEntry: one(timeEntries, {
    fields: [timesheetLineItems.timeEntryId],
    references: [timeEntries.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export const workflowTriggersRelations = relations(workflowTriggers, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [workflowTriggers.createdBy],
    references: [users.id],
  }),
  executions: many(workflowExecutions),
}));

export const workflowExecutionsRelations = relations(workflowExecutions, ({ one }) => ({
  trigger: one(workflowTriggers, {
    fields: [workflowExecutions.triggerId],
    references: [workflowTriggers.id],
  }),
}));

// Insert schemas
export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInvoiceItemSchema = createInsertSchema(invoiceItems).omit({
  id: true,
  createdAt: true,
});

export const insertIntegrationSchema = createInsertSchema(integrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMaterialEntrySchema = createInsertSchema(materialEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});

export const insertWorkflowTriggerSchema = createInsertSchema(workflowTriggers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkflowExecutionSchema = createInsertSchema(workflowExecutions).omit({
  id: true,
  createdAt: true,
});

export const insertWorkflowActionTemplateSchema = createInsertSchema(workflowActionTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Pending Approvals tables
export const pendingApprovals = pgTable("pending_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type").notNull(), // 'payroll', 'hours_materials', 'calendar_appointment'
  submittedBy: varchar("submitted_by").notNull(),
  submittedByEmail: varchar("submitted_by_email"),
  submitDate: timestamp("submit_date").defaultNow().notNull(),
  formType: varchar("form_type").notNull(),
  suspicious: boolean("suspicious").default(false).notNull(),
  approved: boolean("approved"), // null = pending, true = approved, false = denied
  approvedBy: varchar("approved_by"),
  approvedDate: timestamp("approved_date"),
  denyReason: text("deny_reason"),
  data: jsonb("data").notNull(), // Store form data as JSON
  weekEndingDate: timestamp("week_ending_date"),
  customerName: varchar("customer_name"),
  totalAmount: decimal("total_amount"),
  eventDate: timestamp("event_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type PendingApproval = typeof pendingApprovals.$inferSelect;
export type InsertPendingApproval = typeof pendingApprovals.$inferInsert;

// Weekly Payroll Summary table
export const weeklyPayroll = pgTable("weekly_payroll", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => users.id),
  employeeName: varchar("employee_name").notNull(),
  weekEndingDate: timestamp("week_ending_date").notNull(),
  totalHours: decimal("total_hours").notNull(),
  regularHours: decimal("regular_hours").notNull(),
  overtimeHours: decimal("overtime_hours").default('0').notNull(),
  hourlyRate: decimal("hourly_rate").notNull(),
  totalPay: decimal("total_pay").notNull(),
  clockEntries: jsonb("clock_entries").notNull(), // Array of clock entry IDs
  approved: boolean("approved").default(false),
  approvedBy: varchar("approved_by"),
  approvedDate: timestamp("approved_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type WeeklyPayroll = typeof weeklyPayroll.$inferSelect;
export type InsertWeeklyPayroll = typeof weeklyPayroll.$inferInsert;

// Email notifications log
export const emailNotifications = pgTable("email_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recipientEmail: varchar("recipient_email").notNull(),
  subject: varchar("subject").notNull(),
  body: text("body").notNull(),
  type: varchar("type").notNull(), // 'approval_denied', 'payroll_reminder', etc.
  status: varchar("status").default('pending').notNull(), // 'pending', 'sent', 'failed'
  relatedApprovalId: varchar("related_approval_id").references(() => pendingApprovals.id),
  sentAt: timestamp("sent_at"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type EmailNotification = typeof emailNotifications.$inferSelect;
export type InsertEmailNotification = typeof emailNotifications.$inferInsert;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;
export type Integration = typeof integrations.$inferSelect;
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type InsertMaterialEntry = z.infer<typeof insertMaterialEntrySchema>;
export type MaterialEntry = typeof materialEntries.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

// New types for clock entries and timesheet line items
export type InsertClockEntry = typeof clockEntries.$inferInsert;
export type ClockEntry = typeof clockEntries.$inferSelect;
export type InsertTimesheetLineItem = typeof timesheetLineItems.$inferInsert;
export type TimesheetLineItem = typeof timesheetLineItems.$inferSelect;

// Sync and mapping types
export type InsertSyncLog = typeof syncLogs.$inferInsert;
export type SyncLog = typeof syncLogs.$inferSelect;
export type InsertExternalMapping = typeof externalMappings.$inferInsert;
export type ExternalMapping = typeof externalMappings.$inferSelect;

// Customer notes types
export type InsertCustomerNote = typeof customerNotes.$inferInsert;

// Database connection types
export type DatabaseConnection = typeof databaseConnections.$inferSelect;
export type InsertDatabaseConnection = typeof databaseConnections.$inferInsert;
export type CustomerNote = typeof customerNotes.$inferSelect;

// Employee note types
export type EmployeeNote = typeof employeeNotes.$inferSelect;
export type InsertEmployeeNote = typeof employeeNotes.$inferInsert;

// Trapping program types
export type TrappingProgram = typeof trappingPrograms.$inferSelect;
export type InsertTrappingProgram = typeof trappingPrograms.$inferInsert;

// Weekly summary types
export type WeeklySummary = typeof weeklySummaries.$inferSelect;
export type InsertWeeklySummary = typeof weeklySummaries.$inferInsert;

// Employee schedule types
export type InsertEmployeeSchedule = typeof employeeSchedules.$inferInsert;
export type EmployeeSchedule = typeof employeeSchedules.$inferSelect;

// Task assignment types
export type InsertTaskAssignment = typeof taskAssignments.$inferInsert;
export type TaskAssignment = typeof taskAssignments.$inferSelect;

// Workflow types
export type InsertWorkflowTrigger = z.infer<typeof insertWorkflowTriggerSchema>;
export type WorkflowTrigger = typeof workflowTriggers.$inferSelect;
export type InsertWorkflowExecution = z.infer<typeof insertWorkflowExecutionSchema>;
export type WorkflowExecution = typeof workflowExecutions.$inferSelect;
export type InsertWorkflowActionTemplate = z.infer<typeof insertWorkflowActionTemplateSchema>;
export type WorkflowActionTemplate = typeof workflowActionTemplates.$inferSelect;

// Job photos table
export const jobPhotos = pgTable("job_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timeEntryId: varchar("time_entry_id").references(() => timeEntries.id),
  materialEntryId: varchar("material_entry_id").references(() => materialEntries.id),
  clockEntryId: varchar("clock_entry_id").references(() => clockEntries.id),
  scheduleId: varchar("schedule_id").references(() => employeeSchedules.id),
  customerId: varchar("customer_id").references(() => customers.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  filename: varchar("filename").notNull(),
  originalName: varchar("original_name").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: varchar("mime_type").notNull(),
  photoType: varchar("photo_type").notNull(), // 'before', 'after', 'progress', 'completed', 'materials'
  description: text("description"),
  location: varchar("location"),
  gpsCoordinates: varchar("gps_coordinates"), // lat,lng format
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Job photo types
export type InsertJobPhoto = typeof jobPhotos.$inferInsert;
export type JobPhoto = typeof jobPhotos.$inferSelect;

// Zod schemas for presence and collaboration
export const insertUserPresenceSchema = createInsertSchema(userPresence);
export const insertCollaborationActivitySchema = createInsertSchema(collaborationActivity);

// Presence and collaboration types
export type InsertUserPresence = typeof userPresence.$inferInsert;
export type UserPresence = typeof userPresence.$inferSelect;
export type InsertCollaborationActivity = typeof collaborationActivity.$inferInsert;
export type CollaborationActivity = typeof collaborationActivity.$inferSelect;