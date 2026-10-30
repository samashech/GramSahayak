"use client";

import { useLanguage } from "@/components/providers/language-provider";

import { Logo } from "./logo";

const PHOTO_CREDIT = {
  author: "gailhampshire",
  license: "CC BY 2.0",
  sourceUrl: "https://commons.wikimedia.org/wiki/File:Cutting_the_rice_-_Flickr_-_gailhampshire.jpg",
  licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
};

export function SiteFooter() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <Logo label={t.common.homeLabel} />
          <p className="mt-1 text-base font-semibold text-primary">{t.common.tagline}</p>
        </div>
        <div className="text-sm text-muted-foreground md:text-right">
          <p>© 2026 GramSathi. {t.footer.rights}</p>
          <p className="mt-1">
            {t.footer.photoCredit}:{" "}
            <a
              href={PHOTO_CREDIT.sourceUrl}
              className="inline-block py-1 underline underline-offset-2 hover:text-primary-dark"
              target="_blank"
              rel="noopener noreferrer"
            >
              {PHOTO_CREDIT.author}
            </a>{" "}
            /{" "}
            <a
              href={PHOTO_CREDIT.licenseUrl}
              className="inline-block py-1 underline underline-offset-2 hover:text-primary-dark"
              target="_blank"
              rel="noopener noreferrer"
            >
              {PHOTO_CREDIT.license}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
