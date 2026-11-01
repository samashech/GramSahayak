'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { Mic, PhoneCall, MessageSquare, ClipboardCheck } from 'lucide-react';
import { SHELL_HIDDEN_ROUTES } from './TopBar';

interface TabItem {
  href: string;
  labelKey: 'tabVoice' | 'tabIvr' | 'tabSms' | 'tabEligibility';
  icon: React.ElementType;
}

const TABS: TabItem[] = [
  { href: '/voice', labelKey: 'tabVoice', icon: Mic },
  { href: '/ivr', labelKey: 'tabIvr', icon: PhoneCall },
  { href: '/sms', labelKey: 'tabSms', icon: MessageSquare },
  { href: '/eligibility', labelKey: 'tabEligibility', icon: ClipboardCheck },
];

// "आवाज़ (Voice)" -> "आवाज़": the tab shows the user's language only.
const shortLabel = (label: string) => label.replace(/\s*\(.*\)\s*$/, '');

export function TabBar() {
  const pathname = usePathname();
  const { t } = useApp();
  if (SHELL_HIDDEN_ROUTES.includes(pathname)) return null;

  return (
    <>
      {/* Desktop tabs */}
      <div className="hidden border-b border-border bg-background md:block">
        <nav className="mx-auto flex h-12 max-w-7xl items-stretch gap-1 px-6" aria-label="Tabs">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-2 border-b-2 px-4 text-sm transition-colors ${
                  isActive
                    ? 'border-primary font-medium text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                <span>{shortLabel(t[tab.labelKey])}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Mobile bottom tabs (touch targets 64 px) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background md:hidden"
        aria-label="Mobile Navigation"
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-4">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center justify-center gap-1 text-xs transition-colors ${
                  isActive ? 'font-medium text-primary-dark' : 'text-muted-foreground'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className={`flex h-7 w-12 items-center justify-center rounded-md ${isActive ? 'bg-accent' : ''}`}>
                  <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="leading-none">{shortLabel(t[tab.labelKey]).split(' ')[0]}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
