'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, Users, CalendarDays, Contact, FlaskConical, Receipt, Wallet, FileStack, MessageCircle, Package,
  BarChart3, Settings, ShieldCheck, Menu, X, type LucideIcon,
} from 'lucide-react';
import { NAV } from './nav';
import { can, type Role } from '@/lib/rbac';

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, Users, CalendarDays, Contact, FlaskConical, Receipt, Wallet, FileStack, MessageCircle, Package, BarChart3, Settings, ShieldCheck,
};

export function Sidebar({ role, practiceName }: { role: Role; practiceName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((i) => !i.perm || can(role, i.perm));
  // Longest matching prefix wins, so /admin/audit doesn't also highlight /admin
  const active = items.filter((i) => pathname === i.href || pathname.startsWith(i.href + '/')).sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <>
      <button className="btn btn-ghost no-print fixed left-2 top-2 z-40 lg:hidden" onClick={() => setOpen(!open)} aria-label="Toggle menu">
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      <aside
        className={`no-print fixed inset-y-0 left-0 z-30 w-60 shrink-0 border-r border-line bg-ink text-white transition-transform lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="border-b border-white/10 px-4 py-4 pl-14 lg:pl-4">
          <p className="text-sm font-black tracking-wide">ZimMedPractice</p>
          <p className="truncate text-xs text-white/60">{practiceName}</p>
        </div>
        <nav className="space-y-0.5 p-2" aria-label="Main">
          {items.map((item) => {
            const Icon = ICONS[item.icon];
            const isActive = item.href === active;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-brand text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
              >
                {Icon && <Icon size={17} aria-hidden />}
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
