import { Link, useLocation } from "wouter";
import { useState } from "react";
import { 
  LayoutDashboard, 
  Clock, 
  Package, 
  FileText, 
  Users, 
  Search,
  Calendar,
  CalendarDays,
  ShoppingCart, 
  BarChart3, 
  Settings,
  LogOut,
  Zap,
  Timer,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import marinLogo from "@assets/IMG_2539_1754017041686.jpg";

// Navigation items for regular employees
const employeeNavigationItems = [
  { path: "/employee-dashboard", label: "Weekly Summary", icon: LayoutDashboard },
  { path: "/time-tracking", label: "Time Tracking", icon: Clock },
  { path: "/clock", label: "Punch Clock", icon: Timer },
  { path: "/marin-job-form", label: "Job Entry Form", icon: FileText },
  { path: "/employee-schedule", label: "My Schedule", icon: Calendar },
  { path: "/customers", label: "Customers", icon: Users },
  { path: "/products", label: "Products", icon: ShoppingCart },
];

// Admin navigation with all features
const adminNavigationItems = [
  { 
    label: "Core Operations", 
    items: [
      { path: "/", label: "Admin Dashboard", icon: LayoutDashboard },
      { path: "/time-tracking", label: "Time Tracking", icon: Clock },
      { path: "/marin-job-form", label: "Job Entry Form", icon: FileText },
      { path: "/invoices", label: "Invoices", icon: FileText },
      { path: "/customers", label: "Customers", icon: Users },
      { path: "/products", label: "Products", icon: ShoppingCart },
    ]
  },
  {
    label: "Employee Management",
    items: [
      { path: "/employees", label: "Employee Directory", icon: Users },
      { path: "/employee-schedule", label: "Employee Schedules", icon: Calendar },
      { path: "/calendar-sync", label: "Calendar Integration", icon: CalendarDays },
    ]
  },
  {
    label: "Administration",
    items: [
      { path: "/reports", label: "Reports", icon: BarChart3 },
      { path: "/settings", label: "Settings", icon: Settings },
      { path: "/workflows", label: "Workflows", icon: Zap },
    ]
  }
];

export default function Navigation() {
  const [location] = useLocation();

  const handleLogout = () => {
    // Handle both password and OAuth logout
    if (window.location.pathname.includes('/api/logout')) {
      // Replit OAuth logout
      window.location.href = '/api/logout';
    } else {
      // Clear session and redirect
      fetch('/api/auth/logout', { method: 'POST' })
        .then(() => window.location.reload())
        .catch(() => window.location.reload());
    }
  };

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <img 
            src={marinLogo} 
            alt="Marin Pest Control" 
            className="w-12 h-12 rounded-lg object-cover"
          />
          <div>
            <h1 className="text-lg font-bold text-foreground">TimeSync Pro</h1>
            <p className="text-sm text-muted-foreground">Marin Pest Control</p>
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path || 
            (item.path !== "/" && location.startsWith(item.path));
          
          return (
            <Link key={item.path} href={item.path}>
              <Button
                variant={isActive ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start space-x-3",
                  isActive 
                    ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Button>
            </Link>
          );
        })}
      </nav>

      {/* Logout Button */}
      <div className="p-4 border-t border-border">
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start space-x-3 text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </Button>
      </div>
    </div>
  );
}