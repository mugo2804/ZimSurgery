import type { Permission } from '@/lib/rbac';

export type NavItem = { href: string; label: string; icon: string; perm?: Permission };

export const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { href: '/queue', label: 'Waiting room', icon: 'Users', perm: 'queue:read' },
  { href: '/appointments', label: 'Appointments', icon: 'CalendarDays', perm: 'appointments:read' },
  { href: '/patients', label: 'Patients', icon: 'Contact', perm: 'patients:read' },
  { href: '/labs', label: 'Lab results', icon: 'FlaskConical', perm: 'clinical:read' },
  { href: '/billing', label: 'Billing', icon: 'Receipt', perm: 'billing:read' },
  { href: '/cashup', label: 'Cash-up', icon: 'Wallet', perm: 'cashup:view' },
  { href: '/claims', label: 'Medical aid claims', icon: 'FileStack', perm: 'claims:manage' },
  { href: '/messages', label: 'Messages & recalls', icon: 'MessageCircle', perm: 'messages:send' },
  { href: '/stock', label: 'Stock', icon: 'Package', perm: 'stock:read' },
  { href: '/reports', label: 'Reports', icon: 'BarChart3', perm: 'reports:view' },
  { href: '/admin', label: 'Administration', icon: 'Settings', perm: 'admin:users' },
  { href: '/admin/audit', label: 'Audit log', icon: 'ShieldCheck', perm: 'audit:view' },
];
