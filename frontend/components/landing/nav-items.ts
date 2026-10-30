import type { Dictionary } from "@/lib/i18n/translations";

export interface NavItem {
  href: string;
  labelKey: keyof Dictionary["nav"];
}

/** In-page navigation shared by the desktop header and the mobile menu. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/#services", labelKey: "services" },
  { href: "/#how-it-works", labelKey: "howItWorks" },
  { href: "/#languages", labelKey: "languages" },
  { href: "/#low-bandwidth", labelKey: "lowBandwidth" },
];

export const LOGIN_HREF = "/login";
