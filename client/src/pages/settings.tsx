import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Settings as SettingsIcon, ExternalLink, Database, FileSpreadsheet, Calendar, AlertCircle, CheckCircle, Plus, Trash2, Terminal, Link2, Activity, BarChart3 } from "lucide-react";
import { SiQuickbooks, SiGoogle, SiPostgresql } from "react-icons/si";
import UnifiedSyncStatus from "@/components/sync/unified-sync-status";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// PostgreSQL Connection Form Schema
const postgresqlFormSchema = z.object({
  name: z.string().min(1, "Connection name is required"),
  host: z.string().min(1, "Host is required"),
  port: z.coerce.number().min(1).max(65535, "Port must be between 1 and 65535").default(5432),
  database: z.string().min(1, "Database name is required"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  ssl: z.boolean().default(false),
  autoSync: z.boolean().default(false),
  syncInterval: z.coerce.number().min(5).max(1440).optional(), // 5 minutes to 24 hours
});

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddDatabase, setShowAddDatabase] = useState(false);
  const [apiResponse, setApiResponse] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Check for QuickBooks connection success in URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('qb_connected') === 'true') {
      const companyId = urlParams.get('company_id');
      toast({
        title: "QuickBooks Connected!",
        description: companyId 
          ? `Successfully connected to QuickBooks (Company ID: ${companyId})`
          : "Successfully connected to QuickBooks",
        variant: "default",
      });
      // Clean up URL
      window.history.replaceState({}, document.title, '/settings');
    }
  }, [toast]);

  // Queries
  const { data: integrations = [], isLoading: integrationsLoading } = useQuery<any[]>({
    queryKey: ["/api/integrations"]
  });

  const { data: databaseConnections = [], isLoading: dbLoading } = useQuery<any[]>({
    queryKey: ["/api/database-connections"]
  });

  const { data: syncStatus } = useQuery<any>({
    queryKey: ["/api/sync/status"],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Helper function to make API calls and show results
  const makeApiCall = async (endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any) => {
    setIsLoading(true);
    setApiResponse('');
    try {
      const response = await apiRequest(endpoint, {
        method,
        body: body ? JSON.stringify(body) : undefined,
        headers: body ? { 'Content-Type': 'application/json' } : undefined
      });
      setApiResponse(JSON.stringify(response, null, 2));
      toast({ title: "API call successful", variant: "default" });
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      setApiResponse(`Error: ${errorMessage}`);
      toast({ title: "API call failed", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // PostgreSQL Form
  const postgresqlForm = useForm({
    resolver: zodResolver(postgresqlFormSchema),
    defaultValues: {
      name: "",
      host: "",
      port: 5432,
      database: "",
      username: "",
      password: "",
      ssl: false,
      autoSync: false,
      syncInterval: 60
    }
  });

  // QuickBooks Mutations
  const syncQuickBooks = useMutation({
    mutationFn: () => apiRequest("/api/integrations/quickbooks/sync", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sync/status"] });
      toast({ title: "QuickBooks sync completed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    }
  });

  const initialDataPull = useMutation({
    mutationFn: () => apiRequest("/api/integrations/quickbooks/initial-sync", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Initial QuickBooks data pull completed", description: "Customers, products, and invoices imported" });
    },
    onError: (error: any) => {
      toast({ title: "Data pull failed", description: error.message, variant: "destructive" });
    }
  });

  // PostgreSQL Database Mutations
  const addDatabaseConnection = useMutation({
    mutationFn: (data: any) => apiRequest("/api/database-connections", { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/database-connections"] });
      postgresqlForm.reset();
      setShowAddDatabase(false);
      toast({ title: "Database connection added successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add database connection", description: error.message, variant: "destructive" });
    }
  });

  const testDatabaseConnection = useMutation({
    mutationFn: (data: any) => apiRequest("/api/database-connections/test", { method: "POST", body: data }),
    onSuccess: () => {
      toast({ title: "Database connection successful", description: "Connection test passed" });
    },
    onError: (error: any) => {
      toast({ title: "Connection test failed", description: error.message, variant: "destructive" });
    }
  });

  const syncDatabase = useMutation({
    mutationFn: (connectionId: string) => apiRequest(`/api/database-connections/${connectionId}/sync`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/database-connections"] });
      toast({ title: "Database sync completed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Database sync failed", description: error.message, variant: "destructive" });
    }
  });

  const toggleDatabaseAutoSync = useMutation({
    mutationFn: ({ connectionId, autoSync, syncInterval }: { connectionId: string, autoSync: boolean, syncInterval?: number }) => 
      apiRequest(`/api/database-connections/${connectionId}/auto-sync`, { 
        method: "POST", 
        body: { autoSync, syncInterval } 
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/database-connections"] });
      toast({ title: "Auto-sync settings updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update auto-sync", description: error.message, variant: "destructive" });
    }
  });

  const deleteDatabaseConnection = useMutation({
    mutationFn: (connectionId: string) => apiRequest(`/api/database-connections/${connectionId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/database-connections"] });
      toast({ title: "Database connection deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete connection", description: error.message, variant: "destructive" });
    }
  });

  // Form handlers
  const onSubmitPostgreSQL = (data: any) => {
    addDatabaseConnection.mutate(data);
  };

  const onTestConnection = () => {
    const data = postgresqlForm.getValues();
    testDatabaseConnection.mutate(data);
  };

  // Get integration status
  const getIntegrationStatus = (provider: string) => {
    const integration = integrations.find((i: any) => i.provider === provider);
    return integration?.isActive ? 'Connected' : 'Not Connected';
  };

  if (integrationsLoading || dbLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <SettingsIcon className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Settings & Integrations</h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-6 h-6 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <SettingsIcon className="w-6 h-6" />
        <h1 className="text-2xl font-bold">Settings & Integrations</h1>
      </div>

      <Tabs defaultValue="integrations" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="database">Database Connections</TabsTrigger>
          <TabsTrigger value="debug">Debug & API</TabsTrigger>
        </TabsList>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          {/* QuickBooks Integration with Step-by-Step Authorization */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <SiQuickbooks className="w-8 h-8 text-blue-600" />
                  <div>
                    <CardTitle>QuickBooks Online Integration</CardTitle>
                    <CardDescription>Complete authorization flow with status indicators</CardDescription>
                  </div>
                </div>
                <Badge variant={getIntegrationStatus('quickbooks') === 'Connected' ? 'default' : 'secondary'}>
                  {getIntegrationStatus('quickbooks')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step-by-Step Authorization Flow */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Authorization Steps</h4>
                
                {/* Step 1: OAuth Configuration */}
                <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">1. OAuth Configuration</p>
                    <p className="text-xs text-muted-foreground">Environment and credentials configured</p>
                  </div>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
                
                {/* Step 2: Authorization Request */}
                <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50">
                  <div className={`w-2 h-2 rounded-full ${getIntegrationStatus('quickbooks') !== 'Not Connected' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">2. Authorization Request</p>
                    <p className="text-xs text-muted-foreground">Redirect to QuickBooks for permission</p>
                  </div>
                  {getIntegrationStatus('quickbooks') !== 'Not Connected' ? 
                    <CheckCircle className="w-4 h-4 text-green-500" /> : 
                    <AlertCircle className="w-4 h-4 text-gray-400" />
                  }
                </div>
                
                {/* Step 3: Callback Processing */}
                <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50">
                  <div className={`w-2 h-2 rounded-full ${getIntegrationStatus('quickbooks') === 'Connected' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">3. Callback Processing</p>
                    <p className="text-xs text-muted-foreground">Exchange authorization code for tokens</p>
                  </div>
                  {getIntegrationStatus('quickbooks') === 'Connected' ? 
                    <CheckCircle className="w-4 h-4 text-green-500" /> : 
                    <AlertCircle className="w-4 h-4 text-gray-400" />
                  }
                </div>
                
                {/* Step 4: Token Management */}
                <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50">
                  <div className={`w-2 h-2 rounded-full ${getIntegrationStatus('quickbooks') === 'Connected' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">4. Token Management</p>
                    <p className="text-xs text-muted-foreground">Access & refresh tokens stored securely</p>
                  </div>
                  {getIntegrationStatus('quickbooks') === 'Connected' ? 
                    <CheckCircle className="w-4 h-4 text-green-500" /> : 
                    <AlertCircle className="w-4 h-4 text-gray-400" />
                  }
                </div>
                
                {/* Step 5: Connection Test */}
                <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50">
                  <div className={`w-2 h-2 rounded-full ${getIntegrationStatus('quickbooks') === 'Connected' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">5. Connection Test</p>
                    <p className="text-xs text-muted-foreground">Verify API access and company info</p>
                  </div>
                  {getIntegrationStatus('quickbooks') === 'Connected' ? 
                    <CheckCircle className="w-4 h-4 text-green-500" /> : 
                    <AlertCircle className="w-4 h-4 text-gray-400" />
                  }
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => {
                      const baseUrl = `${window.location.protocol}//${window.location.host}`;
                      window.location.href = `${baseUrl}/quickbooks/connect`;
                    }}
                    variant="default"
                    size="sm"
                    className="w-full"
                  >
                    <SiQuickbooks className="w-4 h-4 mr-2" />
                    {getIntegrationStatus('quickbooks') === 'Connected' ? 'Re-authorize' : 'Start Authorization'}
                  </Button>
                  
                  {getIntegrationStatus('quickbooks') === 'Connected' && (
                    <Button
                      onClick={() => makeApiCall('/api/quickbooks/test')}
                      variant="outline"
                      size="sm"
                      disabled={isLoading}
                      className="w-full"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Test Connection
                    </Button>
                  )}
                </div>
                
                {getIntegrationStatus('quickbooks') === 'Connected' && (
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={() => makeApiCall('/api/quickbooks/refresh', 'POST')}
                      variant="outline"
                      size="sm"
                      disabled={isLoading}
                      className="w-full"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh Tokens
                    </Button>
                    
                    <Button
                      onClick={() => initialDataPull.mutate()}
                      disabled={initialDataPull.isPending}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <Database className="w-4 h-4 mr-2" />
                      {initialDataPull.isPending ? "Pulling..." : "Pull Data"}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Google Integration */}
          <Card>
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
              <div className="flex items-center space-x-2">
                <SiGoogle className="w-8 h-8 text-blue-500" />
                <div>
                  <CardTitle>Google Workspace</CardTitle>
                  <CardDescription>Calendar, Sheets, and Drive integration</CardDescription>
                </div>
              </div>
              <div className="ml-auto">
                <Badge variant="secondary">Coming Soon</Badge>
              </div>
            </CardHeader>
          </Card>
        </TabsContent>

        {/* Database Connections Tab */}
        <TabsContent value="database" className="space-y-6">
          {/* Database Status & Test Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-green-600" />
                Database Connection Status
              </CardTitle>
              <CardDescription>Test and monitor database connectivity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">Primary Database</p>
                  <p className="text-sm text-muted-foreground">PostgreSQL (Production)</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <Badge variant="default">Connected</Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => makeApiCall('/api/database/test')}
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                  className="w-full"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Test Connection
                </Button>
                
                <Button
                  onClick={() => makeApiCall('/api/database-connections')}
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                  className="w-full"
                >
                  <Activity className="w-4 h-4 mr-2" />
                  Connection Info
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">External Database Connections</h2>
              <p className="text-sm text-muted-foreground">Connect to additional PostgreSQL databases for data synchronization</p>
            </div>
            <Dialog open={showAddDatabase} onOpenChange={setShowAddDatabase}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Connection
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add PostgreSQL Connection</DialogTitle>
                  <DialogDescription>Configure a new PostgreSQL database connection</DialogDescription>
                </DialogHeader>
                <Form {...postgresqlForm}>
                  <form onSubmit={postgresqlForm.handleSubmit(onSubmitPostgreSQL)} className="space-y-4">
                    <FormField
                      control={postgresqlForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Connection Name</FormLabel>
                          <FormControl>
                            <Input placeholder="My Database" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={postgresqlForm.control}
                        name="host"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Host</FormLabel>
                            <FormControl>
                              <Input placeholder="localhost" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={postgresqlForm.control}
                        name="port"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Port</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="5432" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={postgresqlForm.control}
                      name="database"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Database Name</FormLabel>
                          <FormControl>
                            <Input placeholder="mydb" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={postgresqlForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input placeholder="postgres" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={postgresqlForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={postgresqlForm.control}
                      name="ssl"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>SSL Connection</FormLabel>
                            <FormDescription>Use SSL encryption for the connection</FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={postgresqlForm.control}
                      name="autoSync"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Auto Sync</FormLabel>
                            <FormDescription>Enable automatic synchronization</FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    {postgresqlForm.watch("autoSync") && (
                      <FormField
                        control={postgresqlForm.control}
                        name="syncInterval"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sync Interval (minutes)</FormLabel>
                            <FormControl>
                              <Select
                                value={field.value?.toString()}
                                onValueChange={(value) => field.onChange(parseInt(value))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select interval" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="5">5 minutes</SelectItem>
                                  <SelectItem value="15">15 minutes</SelectItem>
                                  <SelectItem value="30">30 minutes</SelectItem>
                                  <SelectItem value="60">1 hour</SelectItem>
                                  <SelectItem value="120">2 hours</SelectItem>
                                  <SelectItem value="360">6 hours</SelectItem>
                                  <SelectItem value="720">12 hours</SelectItem>
                                  <SelectItem value="1440">24 hours</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    <div className="flex justify-between">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={onTestConnection}
                        disabled={testDatabaseConnection.isPending}
                      >
                        {testDatabaseConnection.isPending ? "Testing..." : "Test Connection"}
                      </Button>
                      <Button
                        type="submit"
                        disabled={addDatabaseConnection.isPending}
                      >
                        {addDatabaseConnection.isPending ? "Adding..." : "Add Connection"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Database Connections List */}
          <div className="space-y-4">
            {databaseConnections.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Database className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No database connections</h3>
                    <p className="text-muted-foreground mb-4">Add your first PostgreSQL database connection to start syncing data</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              databaseConnections.map((connection: any) => (
                <Card key={connection.id}>
                  <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                    <div className="flex items-center space-x-2">
                      <SiPostgresql className="w-8 h-8 text-blue-700" />
                      <div>
                        <CardTitle>{connection.name}</CardTitle>
                        <CardDescription>
                          {connection.host}:{connection.port}/{connection.database}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="ml-auto flex items-center space-x-2">
                      <Badge variant={connection.isActive ? 'default' : 'secondary'}>
                        {connection.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      {connection.lastSyncStatus && (
                        <Badge variant={connection.lastSyncStatus === 'success' ? 'default' : 'destructive'}>
                          {connection.lastSyncStatus === 'success' ? 'Synced' : 'Error'}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        {connection.autoSync && (
                          <p className="text-sm text-muted-foreground">
                            Auto-sync every {connection.syncInterval} minutes
                          </p>
                        )}
                        {connection.lastSyncAt && (
                          <p className="text-sm text-muted-foreground">
                            Last sync: {format(new Date(connection.lastSyncAt), 'PPp')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          onClick={() => syncDatabase.mutate(connection.id)}
                          disabled={syncDatabase.isPending}
                          size="sm"
                          variant="outline"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Sync Now
                        </Button>
                        <Switch
                          checked={connection.autoSync}
                          onCheckedChange={(checked) => 
                            toggleDatabaseAutoSync.mutate({
                              connectionId: connection.id,
                              autoSync: checked,
                              syncInterval: connection.syncInterval || 60
                            })
                          }
                        />
                        <Button
                          onClick={() => deleteDatabaseConnection.mutate(connection.id)}
                          size="sm"
                          variant="destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Sync Settings Tab */}

        {/* Debug & API Tab */}
        <TabsContent value="debug" className="space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <Terminal className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Debug & API Endpoints</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* QuickBooks Debug Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SiQuickbooks className="w-5 h-5 text-blue-600" />
                  QuickBooks Debug
                </CardTitle>
                <CardDescription>QuickBooks integration status and debugging tools</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => window.open('/api/integrations/quickbooks/status', '_blank')}
                >
                  <Activity className="w-4 h-4 mr-2" />
                  Connection Status
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => window.open('/api/quickbooks/dev-status', '_blank')}
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Development Status
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => window.open('/api/integrations/quickbooks/debug', '_blank')}
                >
                  <Terminal className="w-4 h-4 mr-2" />
                  Debug Info
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => window.open('/api/quickbooks/test', '_blank')}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Test Connection
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => window.open('/quickbooks/dev-auth', '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Auth Page
                </Button>
              </CardContent>
            </Card>

            {/* System Health Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-green-600" />
                  System Health
                </CardTitle>
                <CardDescription>Database and system health checks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => window.open('/api/database/test', '_blank')}
                >
                  <Database className="w-4 h-4 mr-2" />
                  Database Test
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => window.open('/api/health', '_blank')}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Health Check
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => window.open('/api/version', '_blank')}
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Version Info
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => window.open('/api/auth/user', '_blank')}
                >
                  <Activity className="w-4 h-4 mr-2" />
                  User Info
                </Button>
              </CardContent>
            </Card>


            {/* Data Endpoints Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-orange-600" />
                  Data Endpoints
                </CardTitle>
                <CardDescription>Access raw data endpoints for debugging</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => makeApiCall('/api/customers')}
                  disabled={isLoading}
                >
                  <Database className="w-4 h-4 mr-2" />
                  Customers
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => makeApiCall('/api/products')}
                  disabled={isLoading}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Products
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => makeApiCall('/api/invoices')}
                  disabled={isLoading}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Invoices
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => makeApiCall('/api/activity')}
                  disabled={isLoading}
                >
                  <Activity className="w-4 h-4 mr-2" />
                  Activity Logs
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => makeApiCall('/api/clock/status')}
                  disabled={isLoading}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Clock Status
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => makeApiCall('/api/time-entries')}
                  disabled={isLoading}
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Time Entries
                </Button>
              </CardContent>
            </Card>

            {/* Logs Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-green-600" />
                  Application Logs
                </CardTitle>
                <CardDescription>View colorized application logs and system messages</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => makeApiCall('/api/activity')}
                  disabled={isLoading}
                >
                  <Activity className="w-4 h-4 mr-2" />
                  Activity Logs
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => makeApiCall('/api/logs/recent')}
                  disabled={isLoading}
                >
                  <Terminal className="w-4 h-4 mr-2" />
                  System Logs
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => makeApiCall('/api/logs/errors')}
                  disabled={isLoading}
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Error Logs
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => makeApiCall('/api/logs/quickbooks')}
                  disabled={isLoading}
                >
                  <SiQuickbooks className="w-4 h-4 mr-2" />
                  QB Logs
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-gray-600" />
                Quick Actions & Shell Access
              </CardTitle>
              <CardDescription>Development tools and direct access</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('/?view=shell', '_blank')}
                >
                  <Terminal className="w-4 h-4 mr-2" />
                  Shell
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('/api/quickbooks/initial-auth', '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Initial Auth
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('/', '_blank')}
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  Home
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.origin);
                    toast({ title: "Base URL copied to clipboard" });
                  }}
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  Copy Base URL
                </Button>
              </div>
              
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Server Status:</strong> Running on port 5001 (fallback) • 
                  <strong>Environment:</strong> {process.env.NODE_ENV || 'development'} • 
                  <strong>Base URL:</strong> {window.location.origin}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* API Response Display */}
      {apiResponse && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="w-5 h-5" />
              API Response
              <Button
                variant="outline"
                size="sm"
                onClick={() => setApiResponse('')}
                className="ml-auto"
              >
                Clear
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96 text-sm">
              {apiResponse}
            </pre>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground p-3 rounded-md flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Making API call...
        </div>
      )}
    </div>
  );
}