import { Switch, Route, Router as WouterRouter } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/layout/layout";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import TimeTracking from "@/pages/time-tracking";
import MarinJobForm from "@/pages/marin-job-form";
import HoursAndMaterialsForm from "@/pages/hours-materials-form";

import Clock from "@/pages/clock";
import Invoices from "@/pages/invoices";
import Customers from "@/pages/customers";
import EmployeeSchedule from "@/pages/employee-schedule";
import Products from "@/pages/products";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import Workflows from "@/pages/workflows";
import EmployeeDashboard from "@/pages/employee-dashboard";
import Employees from "@/pages/employees";
import DataImport from "@/pages/data-import";
import CollaborationDashboard from "@/pages/collaboration";
import ProductivityDashboard from "@/pages/productivity-dashboard";
import TeamDashboard from "@/pages/team-dashboard";
import PendingApprovals from "@/pages/pending-approvals";
import SyncSchedulerPage from "@/pages/sync-scheduler";
import PunchClockLogsPage from "@/pages/punch-clock-logs";
import { Suspense } from "react";
import { RefreshCw } from "lucide-react";
import { RouterErrorBoundary } from "@/components/router/error-boundary";
import RouteGuard from "@/components/router/route-guard";

// Loading component
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

// Simplified authentication wrapper
function AuthenticatedApp() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  // Skip landing page for development
  return <Router />;
}

// Protected route wrapper
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <Layout>
      <Suspense fallback={<LoadingScreen />}>
        <Component />
      </Suspense>
    </Layout>
  );
}

// Enhanced router with proper route definitions
function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading screen while checking authentication
  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <WouterRouter>
      <Switch>
        {/* Public routes */}
        <Route path="/login">
          {() => isAuthenticated ? <Dashboard /> : <Landing />}
        </Route>

        {/* Protected routes */}
        <Route path="/">
          {() => <ProtectedRoute component={TeamDashboard} />}
        </Route>
        
        <Route path="/dashboard">
          {() => <ProtectedRoute component={Dashboard} />}
        </Route>
        
        <Route path="/time-tracking">
          {() => <ProtectedRoute component={TimeTracking} />}
        </Route>
        
        <Route path="/marin-job-form">
          {() => <ProtectedRoute component={MarinJobForm} />}
        </Route>
        
        <Route path="/hours-materials">
          {() => <ProtectedRoute component={HoursAndMaterialsForm} />}
        </Route>
        

        
        <Route path="/clock">
          {() => <ProtectedRoute component={Clock} />}
        </Route>
        
        <Route path="/invoices">
          {() => <ProtectedRoute component={Invoices} />}
        </Route>
        
        <Route path="/customers">
          {() => <ProtectedRoute component={Customers} />}
        </Route>
        
        
        <Route path="/employee-schedule">
          {() => <ProtectedRoute component={EmployeeSchedule} />}
        </Route>
        
        <Route path="/products">
          {() => <ProtectedRoute component={Products} />}
        </Route>
        
        <Route path="/reports">
          {() => <ProtectedRoute component={Reports} />}
        </Route>
        
        <Route path="/settings">
          {() => <ProtectedRoute component={Settings} />}
        </Route>
        
        <Route path="/workflows">
          {() => <ProtectedRoute component={Workflows} />}
        </Route>
        
        <Route path="/employee-dashboard">
          {() => <ProtectedRoute component={EmployeeDashboard} />}
        </Route>
        
        <Route path="/employees">
          {() => <ProtectedRoute component={Employees} />}
        </Route>
        
        <Route path="/collaboration">
          {() => <ProtectedRoute component={CollaborationDashboard} />}
        </Route>
        
        <Route path="/productivity">
          {() => <ProtectedRoute component={ProductivityDashboard} />}
        </Route>
        
        <Route path="/team-dashboard">
          {() => <ProtectedRoute component={TeamDashboard} />}
        </Route>
        
        <Route path="/data-import">
          {() => <ProtectedRoute component={DataImport} />}
        </Route>
        
        <Route path="/sync-scheduler">
          {() => <ProtectedRoute component={SyncSchedulerPage} />}
        </Route>
        
        <Route path="/punch-clock-logs">
          {() => <ProtectedRoute component={PunchClockLogsPage} />}
        </Route>
        
        
        <Route path="/pending-approvals">
          {() => <ProtectedRoute component={PendingApprovals} />}
        </Route>

        {/* Integration callback routes */}
        <Route path="/integrations">
          {() => <ProtectedRoute component={Settings} />}
        </Route>

        {/* 404 fallback */}
        <Route>
          {() => isAuthenticated ? <ProtectedRoute component={NotFound} /> : <Landing />}
        </Route>
      </Switch>
    </WouterRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthenticatedApp />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
