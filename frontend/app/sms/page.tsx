'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { smsSimulate } from '@/lib/api';
import { SmsSimulateResult } from '@/lib/types';
import {
  MessageSquare,
  Send,
  Sparkles,
  Phone,
  Signal,
  Battery,
  WifiOff,
  Copy,
  Check,
  Smartphone,
  Info,
  Clock,
  CheckCheck,
} from 'lucide-react';

interface SmsMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  meta?: SmsSimulateResult;
}

const QUICK_KEYWORDS = [
  { code: 'PMKISAN', label: 'PM-KISAN (₹6k/yr)', tag: 'schemes' },
  { code: 'PMFBY', label: 'PMFBY (Crop Insurance)', tag: 'agri' },
  { code: 'KCC', label: 'KCC (Kisan Credit)', tag: 'agri' },
  { code: 'AGRI', label: 'AGRI (Farming Helpline)', tag: 'agri' },
  { code: 'PMJAY', label: 'PM-JAY (Ayushman ₹5L)', tag: 'health' },
  { code: 'JSY', label: 'JSY (Janani Suraksha)', tag: 'health' },
  { code: 'HEALTH', label: 'HEALTH (108 / 102)', tag: 'health' },
  { code: 'SCHOLARSHIP', label: 'SCHOLARSHIP (NSP)', tag: 'education' },
  { code: 'HELP', label: 'HELP (All Keywords)', tag: 'help' },
];

// Helper to determine SMS encoding and calculate segment parts
function calculateSmsSegments(text: string): {
  isUnicode: boolean;
  charCount: number;
  segments: number;
  limitPerSegment: number;
} {
  const charCount = Array.from(text).length;
  // Non-ASCII characters (Devanagari, Tamil, etc.) require UCS-2 Unicode SMS encoding
  const isUnicode = /[^\u0000-\u007F]/.test(text);

  if (isUnicode) {
    const limitPerSegment = 70;
    const segments = Math.max(1, Math.ceil(charCount / 70));
    return { isUnicode, charCount, segments, limitPerSegment };
  } else {
    const limitPerSegment = 160;
    const segments = Math.max(1, Math.ceil(charCount / 160));
    return { isUnicode, charCount, segments, limitPerSegment };
  }
}

export default function SmsPage() {
  const { t, languageCode, activePreset } = useApp();

  const userPhone = activePreset?.phone || '+919999900000';
  const gatewayNumber = '18001801551';

  // Thread Messages State
  const [messages, setMessages] = useState<SmsMessage[]>([
    {
      id: 'welcome-1',
      sender: 'assistant',
      text: 'ग्राम सहायक ऑफ़लाइन एसएमएस सेवा में आपका स्वागत है। योजना की जानकारी के लिए PMKISAN, PMFBY, KCC, PMJAY, JSY, SCHOLARSHIP या HELP लिखकर भेजें।',
      timestamp: '10:00 AM',
      meta: {
        replyText: '',
        charCount: 147,
        matchedSchemeId: null,
        mode: 'help',
        delivery: 'simulated',
      },
    },
  ]);

  const [inputBody, setInputBody] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [showRawSms, setShowRawSms] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of thread
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSend = async (textToSend?: string) => {
    const body = (textToSend || inputBody).trim();
    if (!body || isSending) return;

    const userMsgId = 'user-' + Date.now();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. Append User Message
    const userMsg: SmsMessage = {
      id: userMsgId,
      sender: 'user',
      text: body,
      timestamp: timeStr,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputBody('');
    setIsSending(true);

    try {
      // 2. Call POST /api/sms-simulate
      const res = await smsSimulate({
        fromPhone: userPhone,
        body,
        languageCode,
      });

      // 3. Append Assistant Message (<300ms keyword response)
      const assistantMsg: SmsMessage = {
        id: 'bot-' + Date.now(),
        sender: 'assistant',
        text: res.replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        meta: res,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      console.error('SMS simulation failed:', err);
      const errorMsg: SmsMessage = {
        id: 'err-' + Date.now(),
        sender: 'assistant',
        text: 'त्रुटि: एसएमएस संदेश भेजने में विफल। कृपया पुनः प्रयास करें।',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        meta: {
          replyText: '',
          charCount: 46,
          matchedSchemeId: null,
          mode: 'help',
          delivery: 'failed',
        },
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickKeyword = (code: string) => {
    handleSend(code);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const lastAssistantMsg = [...messages].reverse().find((m) => m.sender === 'assistant');

  return (
    <div className="mx-auto max-w-4xl px-3 py-4 sm:px-6 sm:py-6 text-zinc-900">
      {/* Header & Feature Phone Context */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/90 text-emerald-800 text-xs font-semibold mb-2 border border-emerald-300">
          <WifiOff className="h-3.5 w-3.5 text-emerald-700" />
          <span>Rule R5: Offline Feature Phone GSM / CDMA SMS</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900">
          {t.smsTitle}
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-zinc-600 max-w-xl mx-auto">
          {t.smsSubtitle} — 160-char GSM &amp; 70-char Unicode standard verified.
        </p>
      </div>

      {/* Simulator Actions Bar */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        {/* Caller Number Status */}
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-zinc-200 text-xs shadow-2xs">
          <Phone className="h-3.5 w-3.5 text-emerald-600" />
          <span className="text-zinc-500">From Phone:</span>
          <span className="font-mono font-bold text-zinc-800">{userPhone}</span>
          {activePreset && (
            <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-1.5 py-0.5 rounded border border-emerald-200">
              {activePreset.name.split(' ')[0]}
            </span>
          )}
        </div>

        {/* Raw SMS Screen Toggle */}
        <button
          type="button"
          onClick={() => setShowRawSms((prev) => !prev)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-2xs ${
            showRawSms
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
          }`}
        >
          <Smartphone className="h-3.5 w-3.5" />
          <span>{t.rawSms}</span>
        </button>
      </div>

      {/* Quick-Tap Keyword Chips */}
      <div className="mb-4 rounded-xl border border-amber-200/90 bg-amber-50/70 p-3 shadow-2xs">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 mb-2">
          <Sparkles className="h-3.5 w-3.5 text-amber-700" />
          <span>{t.quickKeywords} (1-Tap Send):</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_KEYWORDS.map((k) => (
            <button
              key={k.code}
              type="button"
              onClick={() => handleQuickKeyword(k.code)}
              disabled={isSending}
              className="rounded-lg border border-amber-300/80 bg-white px-2.5 py-1 text-xs font-bold text-amber-950 hover:bg-amber-100 hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all shadow-2xs disabled:opacity-50"
            >
              <span className="font-mono text-emerald-800">{k.code}</span>
              <span className="text-[10px] text-zinc-500 font-normal ml-1">({k.label.split(' ')[0]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Retro Raw SMS Screen (When Toggled) */}
      {showRawSms && lastAssistantMsg && (
        <div className="mb-6 rounded-2xl border-4 border-zinc-700 bg-emerald-950 p-4 font-mono text-emerald-300 shadow-inner">
          <div className="flex items-center justify-between text-[11px] border-b border-emerald-800 pb-2 mb-3 text-emerald-400">
            <div className="flex items-center gap-2">
              <span>📶 BSNL 2G</span>
              <span>• MSG 1/1</span>
            </div>
            <span>{lastAssistantMsg.timestamp}</span>
          </div>
          <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-mono">
            {lastAssistantMsg.text}
          </div>
          <div className="mt-3 pt-2 border-t border-emerald-800/80 text-[10px] text-emerald-500 flex justify-between items-center">
            <span>From: {gatewayNumber}</span>
            <span>Chars: {Array.from(lastAssistantMsg.text).length} | Unicode UCS-2</span>
          </div>
        </div>
      )}

      {/* Feature Phone Message Container */}
      <div className="rounded-3xl border-4 border-zinc-800 bg-zinc-900 p-2 sm:p-4 shadow-xl">
        {/* Handset Top Speaker & Status Bar */}
        <div className="flex flex-col items-center justify-center pb-2">
          <div className="h-1.5 w-16 bg-zinc-700 rounded-full mb-2" />
          <div className="w-full flex items-center justify-between text-zinc-400 text-[11px] px-3 font-mono">
            <div className="flex items-center gap-1.5">
              <Signal className="h-3 w-3 text-zinc-300" />
              <span>Jio GSM</span>
            </div>
            <span className="text-zinc-200 font-bold">GramSahayak SMS</span>
            <div className="flex items-center gap-1.5">
              <span>98%</span>
              <Battery className="h-3 w-3 text-emerald-400" />
            </div>
          </div>
        </div>

        {/* Message Thread Screen */}
        <div className="rounded-2xl bg-[#EFEAE2] min-h-[380px] max-h-[480px] overflow-y-auto p-3 sm:p-4 space-y-3.5 border border-zinc-700/60 flex flex-col">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const seg = calculateSmsSegments(msg.text);

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[88%] sm:max-w-[80%] ${
                  isUser ? 'self-end' : 'self-start'
                }`}
              >
                {/* Bubble */}
                <div
                  className={`rounded-2xl p-3 shadow-xs text-xs sm:text-sm leading-relaxed relative ${
                    isUser
                      ? 'bg-emerald-700 text-white rounded-tr-none'
                      : 'bg-white text-zinc-900 rounded-tl-none border border-zinc-200/80'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {/* Bubble Timestamp & Status */}
                  <div
                    className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                      isUser ? 'text-emerald-200' : 'text-zinc-400'
                    }`}
                  >
                    <span>{msg.timestamp}</span>
                    {isUser && <CheckCheck className="h-3 w-3 text-emerald-200" />}
                  </div>
                </div>

                {/* Assistant Message Metadata & Segment Hint */}
                {!isUser && msg.meta && (
                  <div className="mt-1 px-1 flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-600">
                    {/* Character Count & Segment Limit */}
                    <span className="bg-zinc-200/80 px-1.5 py-0.5 rounded font-mono font-medium">
                      {seg.charCount} chars · {seg.segments} {t.parts} ({seg.limitPerSegment}-char{' '}
                      {seg.isUnicode ? 'Unicode' : 'GSM'})
                    </span>

                    {/* Mode Badge */}
                    <span
                      className={`px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ${
                        msg.meta.mode === 'keyword'
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : msg.meta.mode === 'help'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-purple-100 text-purple-900 border border-purple-300'
                      }`}
                    >
                      {msg.meta.mode === 'keyword' ? 'Keyword (R5)' : msg.meta.mode}
                    </span>

                    {/* Delivery Badge */}
                    <span
                      className={`px-1.5 py-0.5 rounded font-semibold ${
                        msg.meta.delivery === 'sent'
                          ? 'bg-emerald-100 text-emerald-800'
                          : msg.meta.delivery === 'simulated'
                          ? 'bg-teal-100 text-teal-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {msg.meta.delivery}
                    </span>

                    {/* Copy Button */}
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.id, msg.text)}
                      className="text-zinc-400 hover:text-zinc-700 p-0.5 transition-colors"
                      title={t.copySms}
                    >
                      {copiedId === msg.id ? (
                        <Check className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Sending State */}
          {isSending && (
            <div className="self-end max-w-[80%] flex flex-col items-end">
              <div className="rounded-2xl rounded-tr-none bg-emerald-700/80 text-white p-3 text-xs flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 animate-spin" />
                <span>भेज रहे हैं (Sending)...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom SMS Input Box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="mt-3 flex items-center gap-2 px-1"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={inputBody}
              onChange={(e) => setInputBody(e.target.value)}
              placeholder={t.smsPlaceholder}
              disabled={isSending}
              className="w-full rounded-2xl bg-zinc-800 border border-zinc-700 px-4 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 pr-12 min-h-[48px]"
            />
            {inputBody.length > 0 && (
              <span className="absolute right-3 top-3 text-[10px] text-zinc-400 font-mono">
                {inputBody.length}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={!inputBody.trim() || isSending}
            className="h-12 w-12 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-40 transition-all shrink-0"
            aria-label={t.send}
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>

      {/* Informational Footer Note */}
      <div className="mt-4 text-center text-xs text-zinc-500 flex items-center justify-center gap-1.5">
        <Info className="h-3.5 w-3.5 text-zinc-400" />
        <span>
          Real feature phone queries operate without 4G/WiFi data via SMS shortcode.
        </span>
      </div>
    </div>
  );
}
