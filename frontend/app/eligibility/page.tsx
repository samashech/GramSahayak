'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { checkEligibility } from '@/lib/api';
import {
  Profile,
  EligibilityResult,
  SchemeView,
  IneligibleSchemeReason,
  Occupation,
  SocialCategory,
  Gender,
} from '@/lib/types';
import {
  ShieldCheck,
  Sparkles,
  Tractor,
  Briefcase,
  GraduationCap,
  Home,
  User,
  Users,
  Plus,
  Minus,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Phone,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  FileCheck,
  CheckSquare,
  Square,
  ArrowRight,
} from 'lucide-react';

const OCCUPATIONS: Array<{ id: Occupation; label: Record<string, string>; icon: React.ElementType }> = [
  {
    id: 'farmer',
    label: { 'hi-IN': 'किसान', 'mr-IN': 'शेतकरी', 'ta-IN': 'விவசாயி', 'en-IN': 'Farmer' },
    icon: Tractor,
  },
  {
    id: 'agri_labourer',
    label: { 'hi-IN': 'खेतिहर मजदूर', 'mr-IN': 'शेतमजूर', 'ta-IN': 'விவசாய கூலி', 'en-IN': 'Agri Labourer' },
    icon: Briefcase,
  },
  {
    id: 'daily_wage',
    label: { 'hi-IN': 'दिहाड़ी मजदूर', 'mr-IN': 'रोजंदार मजूर', 'ta-IN': 'தினக்கூலி', 'en-IN': 'Daily Wage' },
    icon: Users,
  },
  {
    id: 'student',
    label: { 'hi-IN': 'विद्यार्थी', 'mr-IN': 'विद्यार्थी', 'ta-IN': 'மாணவர்', 'en-IN': 'Student' },
    icon: GraduationCap,
  },
  {
    id: 'homemaker',
    label: { 'hi-IN': 'गृहणी', 'mr-IN': 'गृहिणी', 'ta-IN': 'இல்லத்தரசி', 'en-IN': 'Homemaker' },
    icon: Home,
  },
  {
    id: 'other',
    label: { 'hi-IN': 'अन्य', 'mr-IN': 'इतर', 'ta-IN': 'பிற', 'en-IN': 'Other' },
    icon: User,
  },
];

const GENDERS: Array<{ id: Gender; label: Record<string, string> }> = [
  { id: 'male', label: { 'hi-IN': 'पुरुष', 'mr-IN': 'पुरुष', 'ta-IN': 'ஆண்', 'en-IN': 'Male' } },
  { id: 'female', label: { 'hi-IN': 'महिला', 'mr-IN': 'महिला', 'ta-IN': 'பெண்', 'en-IN': 'Female' } },
  { id: 'other', label: { 'hi-IN': 'अन्य', 'mr-IN': 'इतर', 'ta-IN': 'பிற', 'en-IN': 'Other' } },
];

const SOCIAL_CATEGORIES: Array<{ id: SocialCategory; label: string }> = [
  { id: 'general', label: 'General / सामान्य' },
  { id: 'obc', label: 'OBC / पिछड़ा वर्ग' },
  { id: 'sc', label: 'SC / अ.जा.' },
  { id: 'st', label: 'ST / अ.ज.जा.' },
];

// Helper to format currency in INR
function formatINR(amount: number): string {
  if (amount >= 100000) {
    const lakhs = amount / 100000;
    return `₹${lakhs.toLocaleString('en-IN', { maximumFractionDigits: 1 })} लाख`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
}

export default function EligibilityPage() {
  const { t, languageCode } = useApp();

  // Form State
  const [profile, setProfile] = useState<Partial<Profile>>({
    role: 'farmer',
    language: languageCode,
    occupation: 'farmer',
    land_hectares: 1.0,
    bpl: true,
    age: 35,
    gender: 'female',
    pregnant: false,
    annual_income: 90000,
    social_category: 'obc',
  });

  // UI & Response States
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EligibilityResult | null>(null);
  const [showIneligible, setShowIneligible] = useState<boolean>(false);
  const [tickedDocs, setTickedDocs] = useState<Record<string, Record<string, boolean>>>({});
  const [copiedSchemeId, setCopiedSchemeId] = useState<string | null>(null);

  // Quick fill profiles
  const handleQuickFillG6 = () => {
    setProfile({
      role: 'panchayat',
      language: languageCode,
      occupation: 'farmer',
      land_hectares: 1.0,
      bpl: true,
      age: 35,
      gender: 'female',
      pregnant: false,
      annual_income: 90000,
      social_category: 'obc',
    });
  };

  const handleQuickFillRamesh = () => {
    setProfile({
      role: 'farmer',
      language: languageCode,
      occupation: 'farmer',
      land_hectares: 1.2,
      bpl: true,
      age: 45,
      gender: 'male',
      pregnant: false,
      annual_income: 90000,
      social_category: 'obc',
    });
  };

  // Toggle document checklist item
  const toggleDoc = (schemeId: string, docName: string) => {
    setTickedDocs((prev) => {
      const schemeDocs = prev[schemeId] || {};
      return {
        ...prev,
        [schemeId]: {
          ...schemeDocs,
          [docName]: !schemeDocs[docName],
        },
      };
    });
  };

  // Copy SMS Text
  const handleCopySms = async (schemeId: string, smsText: string) => {
    try {
      await navigator.clipboard.writeText(smsText);
      setCopiedSchemeId(schemeId);
      setTimeout(() => setCopiedSchemeId(null), 2500);
    } catch {
      // Fallback
    }
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await checkEligibility({
        profile: {
          ...profile,
          language: languageCode,
        },
        languageCode,
      });
      setResult(data);
    } catch (err: unknown) {
      console.error('Eligibility check error:', err);
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setLoading(false);
    }
  };

  const isPregnancyEligible =
    profile.gender === 'female' &&
    profile.age !== undefined &&
    profile.age >= 15 &&
    profile.age <= 49;

  return (
    <div className="mx-auto max-w-4xl px-3 py-4 sm:px-6 sm:py-6 text-zinc-900">
      {/* Page Title & Mission */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/90 text-emerald-800 text-xs font-semibold mb-2 border border-emerald-300">
          <ShieldCheck className="h-4 w-4 text-emerald-700" />
          <span>Rule R4: Deterministic Scheme Verification</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900">
          {t.eligibilityTitle}
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-zinc-600 max-w-xl mx-auto">
          {t.eligibilitySubtitle}
        </p>
      </div>

      {/* Prominent Truth Banner */}
      <div className="mb-6 rounded-xl border border-amber-300/80 bg-amber-50/90 p-3.5 shadow-xs flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed font-medium">
          <span className="font-bold underline decoration-amber-500">{t.rulesNotice}</span>{' '}
          Income, landholding, age, and pregnancy limits are matched mathematically against official scheme rules.
        </div>
      </div>

      {/* Quick-Fill Chips */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-zinc-600 flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
          Quick Test Profiles:
        </span>
        <button
          type="button"
          onClick={handleQuickFillG6}
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 transition-all flex items-center gap-1.5 shadow-xs"
        >
          <span>🎯 G6 Golden Profile (Sunita / Panchayat)</span>
        </button>
        <button
          type="button"
          onClick={handleQuickFillRamesh}
          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-all flex items-center gap-1.5 shadow-xs"
        >
          <span>🌾 Ramesh Farmer Family (1.2 ha, BPL)</span>
        </button>
      </div>

      {/* Form Card */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-amber-200/90 bg-white p-4 sm:p-6 shadow-sm mb-8 space-y-6"
      >
        {/* 1. Occupation */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-2">
            1. {t.occupation}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {OCCUPATIONS.map((occ) => {
              const Icon = occ.icon;
              const isSelected = profile.occupation === occ.id;
              const localizedLabel = occ.label[languageCode] || occ.label['en-IN'];
              return (
                <button
                  key={occ.id}
                  type="button"
                  onClick={() => setProfile((p) => ({ ...p, occupation: occ.id }))}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all min-h-[48px] ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 font-bold ring-2 ring-emerald-500/30'
                      : 'border-zinc-200 bg-zinc-50/50 hover:bg-zinc-100 text-zinc-700'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isSelected ? 'text-emerald-700' : 'text-zinc-500'}`} />
                  <span className="text-xs sm:text-sm">{localizedLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Land & BPL Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Land in Hectares */}
          <div className="rounded-xl border border-zinc-200 p-3.5 bg-zinc-50/40">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-2">
              2. {t.landHectares}
            </label>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  setProfile((p) => ({
                    ...p,
                    land_hectares: Math.max(0, Number(((p.land_hectares || 0) - 0.5).toFixed(1))),
                  }))
                }
                className="h-10 w-10 rounded-lg border border-zinc-300 bg-white flex items-center justify-center font-bold text-zinc-700 hover:bg-zinc-100 shadow-xs"
                aria-label="Decrease Land"
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="text-center">
                <span className="text-xl font-black text-emerald-900">{profile.land_hectares ?? 0}</span>
                <span className="text-xs text-zinc-500 ml-1">ha</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setProfile((p) => ({
                    ...p,
                    land_hectares: Number(((p.land_hectares || 0) + 0.5).toFixed(1)),
                  }))
                }
                className="h-10 w-10 rounded-lg border border-zinc-300 bg-white flex items-center justify-center font-bold text-zinc-700 hover:bg-zinc-100 shadow-xs"
                aria-label="Increase Land"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[11px] text-zinc-400 mt-2 text-center">
              (0.5 ha increments · 0 = landless labourer)
            </p>
          </div>

          {/* BPL Card Toggle */}
          <div className="rounded-xl border border-zinc-200 p-3.5 bg-zinc-50/40 flex flex-col justify-between">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-2">
              3. {t.bplCard}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setProfile((p) => ({ ...p, bpl: true }))}
                className={`py-2 px-3 rounded-lg border font-bold text-xs sm:text-sm min-h-[44px] transition-all ${
                  profile.bpl === true
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                    : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                ✓ {t.yes}
              </button>
              <button
                type="button"
                onClick={() => setProfile((p) => ({ ...p, bpl: false }))}
                className={`py-2 px-3 rounded-lg border font-bold text-xs sm:text-sm min-h-[44px] transition-all ${
                  profile.bpl === false
                    ? 'border-zinc-800 bg-zinc-800 text-white shadow-xs'
                    : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                ✗ {t.no}
              </button>
            </div>
            <p className="text-[11px] text-zinc-400 mt-2 text-center">
              Ration card or SECC list status
            </p>
          </div>
        </div>

        {/* 3. Age & Gender Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Age Stepper */}
          <div className="rounded-xl border border-zinc-200 p-3.5 bg-zinc-50/40">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-2">
              4. {t.age}
            </label>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setProfile((p) => ({ ...p, age: Math.max(1, (p.age || 18) - 1) }))}
                className="h-10 w-10 rounded-lg border border-zinc-300 bg-white flex items-center justify-center font-bold text-zinc-700 hover:bg-zinc-100 shadow-xs"
                aria-label="Decrease Age"
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="text-center">
                <span className="text-xl font-black text-emerald-900">{profile.age ?? 18}</span>
                <span className="text-xs text-zinc-500 ml-1">years</span>
              </div>
              <button
                type="button"
                onClick={() => setProfile((p) => ({ ...p, age: Math.min(100, (p.age || 18) + 1) }))}
                className="h-10 w-10 rounded-lg border border-zinc-300 bg-white flex items-center justify-center font-bold text-zinc-700 hover:bg-zinc-100 shadow-xs"
                aria-label="Increase Age"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Gender Buttons */}
          <div className="rounded-xl border border-zinc-200 p-3.5 bg-zinc-50/40">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-2">
              5. {t.gender}
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {GENDERS.map((g) => {
                const isSelected = profile.gender === g.id;
                const label = g.label[languageCode] || g.label['en-IN'];
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      const willBeFemale = g.id === 'female';
                      setProfile((p) => ({
                        ...p,
                        gender: g.id,
                        pregnant: willBeFemale ? p.pregnant : false,
                      }));
                    }}
                    className={`py-2 px-1 rounded-lg border font-semibold text-xs min-h-[44px] transition-all text-center ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold ring-2 ring-emerald-500/20'
                        : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 4. Conditional Pregnancy Toggle (Only if Female & Age 15-49) */}
        {isPregnancyEligible && (
          <div className="rounded-xl border border-pink-200 bg-pink-50/60 p-4 transition-all animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-pink-900 block">
                  6. {t.pregnant}
                </span>
                <span className="text-xs text-pink-700">
                  Required for JSY and PMMVY maternal cash benefit screening
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setProfile((p) => ({ ...p, pregnant: true }))}
                  className={`py-1.5 px-4 rounded-lg font-bold text-xs min-h-[38px] transition-all ${
                    profile.pregnant === true
                      ? 'bg-pink-600 text-white shadow-xs'
                      : 'border border-pink-300 bg-white text-pink-900 hover:bg-pink-100'
                  }`}
                >
                  ✓ {t.yes}
                </button>
                <button
                  type="button"
                  onClick={() => setProfile((p) => ({ ...p, pregnant: false }))}
                  className={`py-1.5 px-4 rounded-lg font-bold text-xs min-h-[38px] transition-all ${
                    profile.pregnant === false
                      ? 'bg-zinc-800 text-white shadow-xs'
                      : 'border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  ✗ {t.no}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. Annual Income Slider */}
        <div className="rounded-xl border border-zinc-200 p-4 bg-zinc-50/40">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-600">
              {isPregnancyEligible ? '7' : '6'}. {t.annualIncome}
            </label>
            <span className="text-sm sm:text-base font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
              {formatINR(profile.annual_income || 0)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="600000"
            step="10000"
            value={profile.annual_income || 0}
            onChange={(e) => setProfile((p) => ({ ...p, annual_income: Number(e.target.value) }))}
            className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-emerald-600 focus:outline-none"
            aria-label={t.annualIncome}
          />
          <div className="flex justify-between text-[10px] text-zinc-400 mt-1 font-mono">
            <span>₹0</span>
            <span>₹1.5 Lakh</span>
            <span>₹3.0 Lakh</span>
            <span>₹6.0 Lakh+</span>
          </div>
        </div>

        {/* 6. Social Category */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-2">
            {isPregnancyEligible ? '8' : '7'}. {t.socialCategory}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SOCIAL_CATEGORIES.map((sc) => {
              const isSelected = profile.social_category === sc.id;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => setProfile((p) => ({ ...p, social_category: sc.id }))}
                  className={`py-2 px-2 rounded-xl border text-center transition-all min-h-[44px] text-xs font-medium ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold ring-2 ring-emerald-500/20'
                      : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700'
                  }`}
                >
                  {sc.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-sm sm:text-base shadow-md focus:outline-none focus:ring-4 focus:ring-emerald-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 min-h-[52px]"
          >
            {loading ? (
              <>
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{t.processing}</span>
              </>
            ) : (
              <>
                <span>{t.checkEligibility}</span>
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Error State */}
      {error && (
        <div className="mb-6 rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-900 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <div className="text-xs sm:text-sm font-medium">
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !result && (
        <div className="space-y-4 mb-8">
          <div className="h-20 bg-zinc-200/80 rounded-2xl animate-pulse" />
          <div className="h-44 bg-zinc-200/60 rounded-2xl animate-pulse" />
          <div className="h-44 bg-zinc-200/60 rounded-2xl animate-pulse" />
        </div>
      )}

      {/* Results View */}
      {result && (
        <div className="space-y-6">
          {/* Summary Banner */}
          <div className="rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50/80 p-4 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                <h2 className="text-lg sm:text-xl font-extrabold text-emerald-950">
                  {t.eligibleHeader}
                </h2>
              </div>
              <span className="rounded-full bg-emerald-600 text-white px-3 py-1 text-xs sm:text-sm font-black shadow-xs">
                {result.totalMatched} {t.totalMatched}
              </span>
            </div>

            {result.recommendedAction && (
              <p className="mt-2 text-xs sm:text-sm text-emerald-900 leading-relaxed font-medium bg-white/70 p-3 rounded-xl border border-emerald-200/60">
                <strong>{t.recommendedAction}:</strong> {result.recommendedAction}
              </p>
            )}
          </div>

          {/* Eligible Schemes List */}
          {result.eligibleSchemes.length > 0 ? (
            <div className="space-y-4">
              {result.eligibleSchemes.map((scheme: SchemeView) => {
                const isCopied = copiedSchemeId === scheme.id;
                const schemeTickedDocs = tickedDocs[scheme.id] || {};

                return (
                  <div
                    key={scheme.id}
                    className="rounded-2xl border border-emerald-200 bg-white p-4 sm:p-5 shadow-sm transition-all hover:border-emerald-300"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                            {scheme.code}
                          </span>
                          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">
                            {scheme.category}
                          </span>
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-zinc-900 mt-1">
                          {scheme.name}
                        </h3>
                      </div>

                      {/* Helpline tap-to-call */}
                      {scheme.helpline && (
                        <a
                          href={`tel:${scheme.helpline}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 font-bold text-xs hover:bg-emerald-100 transition-all shrink-0 min-h-[36px]"
                        >
                          <Phone className="h-3.5 w-3.5 text-emerald-700" />
                          <span>{scheme.helpline}</span>
                        </a>
                      )}
                    </div>

                    {/* Benefit Line */}
                    <div className="mb-3 rounded-xl bg-amber-50/70 p-3 border border-amber-200/60">
                      <p className="text-xs sm:text-sm text-amber-950 font-medium">
                        <strong className="text-amber-900">लाभ (Benefit):</strong> {scheme.benefits}
                      </p>
                    </div>

                    {/* Documents Required Checklist */}
                    {scheme.documents && scheme.documents.length > 0 && (
                      <div className="mb-4">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-600 block mb-2 flex items-center gap-1.5">
                          <FileCheck className="h-3.5 w-3.5 text-emerald-700" />
                          {t.documents} (Tick to check off):
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {scheme.documents.map((doc: string) => {
                            const isTicked = schemeTickedDocs[doc] || false;
                            return (
                              <button
                                key={doc}
                                type="button"
                                onClick={() => toggleDoc(scheme.id, doc)}
                                className={`flex items-center gap-2 p-2 rounded-lg text-left text-xs transition-all border ${
                                  isTicked
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-medium'
                                    : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                                }`}
                              >
                                {isTicked ? (
                                  <CheckSquare className="h-4 w-4 text-emerald-600 shrink-0" />
                                ) : (
                                  <Square className="h-4 w-4 text-zinc-400 shrink-0" />
                                )}
                                <span className={isTicked ? 'line-through text-emerald-800' : ''}>
                                  {doc}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Bottom Action Footer */}
                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-zinc-100 flex-wrap">
                      {/* Portal Link */}
                      {scheme.portalUrl && (
                        <a
                          href={scheme.portalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
                        >
                          <span>{t.officialPortal}</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}

                      {/* Copy SMS Summary Button */}
                      {scheme.smsSummary && (
                        <button
                          type="button"
                          onClick={() => handleCopySms(scheme.id, scheme.smsSummary)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 font-semibold text-xs transition-all shadow-2xs"
                        >
                          {isCopied ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                              <span className="text-emerald-700 font-bold">{t.copied}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5 text-zinc-500" />
                              <span>{t.copySms}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-center text-zinc-600">
              <p className="text-sm font-medium">कोई सीधी योजना नहीं मिली। कृपया जानकारी अपडेट करके पुनः जांचें।</p>
            </div>
          )}

          {/* Ineligible Schemes (Collapsible) */}
          {result.ineligibleSchemes && result.ineligibleSchemes.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-xs">
              <button
                type="button"
                onClick={() => setShowIneligible((prev) => !prev)}
                className="w-full flex items-center justify-between text-left focus:outline-none min-h-[44px]"
              >
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-rose-500" />
                  <span className="font-bold text-sm sm:text-base text-zinc-800">
                    {t.ineligibleHeader} ({result.ineligibleSchemes.length})
                  </span>
                </div>
                {showIneligible ? (
                  <ChevronUp className="h-5 w-5 text-zinc-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-zinc-500" />
                )}
              </button>

              {showIneligible && (
                <div className="mt-4 space-y-3 pt-3 border-t border-zinc-100">
                  {result.ineligibleSchemes.map((item: IneligibleSchemeReason, idx: number) => (
                    <div
                      key={item.scheme.id || idx}
                      className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-xs sm:text-sm text-zinc-800">
                          {item.scheme.name}
                        </span>
                        <span className="font-mono text-[10px] text-zinc-500 bg-zinc-200 px-1.5 py-0.5 rounded">
                          {item.scheme.code}
                        </span>
                      </div>
                      <p className="text-xs text-rose-700 font-medium">
                        <strong>कारण (Reason):</strong> {item.reason}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
