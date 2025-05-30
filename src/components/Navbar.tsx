"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DollarSign, PlusCircle, Archive, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Portfolio', icon: TrendingUp },
  { href: '/add-stock', label: 'Add Stock', icon: PlusCircle },
  { href: '/closed-positions', label: 'Closed Positions', icon: Archive },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="bg-card border-b shadow-sm sticky top-0 z-50">
      <nav className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-xl font-headline font-semibold text-primary">
          <DollarSign className="h-7 w-7" />
          <span>StockEdge Lite</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
