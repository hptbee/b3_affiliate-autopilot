import { NavLink, Outlet } from 'react-router-dom';
import { Calendar, FileText, LayoutDashboard, Settings, Users } from 'lucide-react';
import { cn } from '../lib/utils';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/content', label: 'Content', icon: FileText },
  { to: '/scheduled', label: 'Scheduled', icon: Calendar },
  { to: '/accounts', label: 'Accounts', icon: Users },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Layout() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r border-border bg-card p-4">
        <div className="mb-8 px-2">
          <h1 className="text-xl font-bold">Social Autopilot</h1>
          <p className="text-xs text-muted-foreground">AI Social Automation</p>
        </div>
        <nav className="space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
