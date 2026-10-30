'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { Mic, PhoneCall, MessageSquare, ClipboardCheck } from 'lucide-react';

interface TabItem {
  href: string;
  labelKey: 'tabVoice' | 'tabIvr' | 'tabSms' | 'tabEligibility';
  icon: React.ElementType;
  badge?: string;
}

const TABS: TabItem[] = [
  { href: '/voice', labelKey: 'tabVoice', icon: Mic, badge: 'Voice' },
  { href: '/ivr', labelKey: 'tabIvr', icon: PhoneCall, badge: 'Toll-Free' },
  { href: '/sms', labelKey: 'tabSms', icon: MessageSquare, badge: 'Offline' },
  { href: '/eligibility', labelKey: 'tabEligibility', icon: ClipboardCheck, badge: 'Rules' },
];

export function TabBar() {
  const pathname = usePathname();
  const { t } = useApp();

  return (
    <>
      {/* Desktop Top Tab Bar */}
      <div className="hidden md:block border-b border-amber-200/50 bg-amber-100/40">
        <div className="mx-auto flex max-w-7xl items-center px-6">
          <nav className="flex space-x-2" aria-label="Tabs">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = pathname === tab.href || (pathname === '/' && tab.href === '/voice');
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
                    isActive
                      ? 'border-emerald-600 text-emerald-900 bg-white/70 shadow-xs'
                      : 'border-transparent text-amber-900/70 hover:text-emerald-800 hover:border-amber-300'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-600' : 'text-amber-700'}`} />
                  <span>{t[tab.labelKey]}</span>
                  {tab.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                        isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-200/50 text-amber-800'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mobile Fixed Bottom Tab Bar (Touch targets >= 48px) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-amber-200 bg-amber-50/98 backdrop-blur-md shadow-lg"
        aria-label="Mobile Navigation"
      >
        <div className="grid grid-cols-4 h-16 max-w-md mx-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname === tab.href || (pathname === '/' && tab.href === '/voice');
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center justify-center min-h-[48px] px-1 text-center transition-all ${
                  isActive
                    ? 'text-emerald-800 font-bold bg-emerald-100/50'
                    : 'text-amber-900/70 hover:text-amber-950 font-medium'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <div className={`p-1 rounded-full ${isActive ? 'bg-emerald-600 text-white' : ''}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[11px] mt-0.5 leading-tight line-clamp-1">
                  {t[tab.labelKey].split(' ')[0]}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
