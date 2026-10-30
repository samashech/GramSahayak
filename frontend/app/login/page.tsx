import type { Metadata } from "next";

import { LoginPlaceholder } from "@/components/landing/login-placeholder";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { SkipLink } from "@/components/landing/skip-link";

export const metadata: Metadata = {
  title: "GramSathi — लॉग इन",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        <LoginPlaceholder />
      </main>
      <SiteFooter />
    </div>
  );
}
