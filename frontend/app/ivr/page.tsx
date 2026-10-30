'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { ivrSimulate } from '@/lib/api';
import { IvrStep, LanguageCode, Category } from '@/lib/types';
import {
  Phone,
  PhoneOff,
  PhoneCall,
  Volume2,
  VolumeX,
  Sparkles,
  RotateCcw,
  Code,
  Copy,
  Check,
  CheckCircle2,
  Signal,
  Battery,
  ExternalLink,
  FileCheck,
  AlertTriangle,
  Mic,
  Send,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const TOLL_FREE_NUMBER = '1800-180-1551';

// Keypad Configuration with sub-labels
const KEYPAD_BUTTONS = [
  { digit: '1', sub: 'हिन्दी / योजना', letters: '' },
  { digit: '2', sub: 'मराठी / कृषि', letters: 'ABC' },
  { digit: '3', sub: 'தமிழ் / आरोग्य', letters: 'DEF' },
  { digit: '4', sub: 'English / शिक्षा', letters: 'GHI' },
  { digit: '5', sub: '', letters: 'JKL' },
  { digit: '6', sub: '', letters: 'MNO' },
  { digit: '7', sub: '', letters: 'PQRS' },
  { digit: '8', sub: '', letters: 'TUV' },
  { digit: '9', sub: '', letters: 'WXYZ' },
  { digit: '*', sub: '', letters: '' },
  { digit: '0', sub: '+', letters: '' },
  { digit: '#', sub: '', letters: '' },
];

const GOLDEN_IVR_QUERIES = [
  {
    id: 'g1',
    label: 'PM-KISAN (Hindi / Schemes)',
    query: 'पीएम किसान योजना के लिए कौन पात्र है?',
    lang: 'hi-IN' as LanguageCode,
    category: 'schemes' as Category,
  },
  {
    id: 'g2',
    label: 'Cotton Bollworm (Marathi / Agri)',
    query: 'कपाशीवरील बोंडअळी कशी रोखावी?',
    lang: 'mr-IN' as LanguageCode,
    category: 'agri' as Category,
  },
  {
    id: 'g3',
    label: 'Wheat Rust (Hindi / Agri)',
    query: 'गेहूं में पीला रतुआ लग गया है क्या करें?',
    lang: 'hi-IN' as LanguageCode,
    category: 'agri' as Category,
  },
  {
    id: 'g4',
    label: 'Pregnancy Danger Signs (Tamil / Health)',
    query: 'கர்ப்ப காலத்தில் என்னென்ன ஆபத்தான அறிகுறிகள்?',
    lang: 'ta-IN' as LanguageCode,
    category: 'health' as Category,
  },
  {
    id: 'g5',
    label: 'JSY Assistance (Tamil / Health)',
    query: 'ஜனனி சுரக்ஷா யோஜனா திட்டத்தில் எவ்வளவு பணம் கிடைக்கும்?',
    lang: 'ta-IN' as LanguageCode,
    category: 'health' as Category,
  },
  {
    id: 'g7',
    label: 'NSP Scholarship (Hindi / Education)',
    query: 'नेशनल स्कॉलरशिप पोर्टल पर आवेदन कैसे करें?',
    lang: 'hi-IN' as LanguageCode,
    category: 'education' as Category,
  },
  {
    id: 's1',
    label: 'Snake Bite Emergency (Hindi / Emergency)',
    query: 'सांप ने काट लिया है क्या करूं?',
    lang: 'hi-IN' as LanguageCode,
    category: 'health' as Category,
  },
];

// Dual-Tone Multi-Frequency (DTMF) Synthesizer using Web Audio API
function playDtmfTone(digit: string) {
  if (typeof window === 'undefined') return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    const freqs: Record<string, [number, number]> = {
      '1': [697, 1209],
      '2': [697, 1336],
      '3': [697, 1477],
      '4': [770, 1209],
      '5': [770, 1336],
      '6': [770, 1477],
      '7': [852, 1209],
      '8': [852, 1336],
      '9': [852, 1477],
      '*': [941, 1209],
      '0': [941, 1336],
      '#': [941, 1477],
    };

    const pair = freqs[digit];
    if (!pair) return;

    const [f1, f2] = pair;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.frequency.value = f1;
    osc2.frequency.value = f2;
    gain.gain.value = 0.12;

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();

    setTimeout(() => {
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.05);
      setTimeout(() => {
        osc1.stop();
        osc2.stop();
        ctx.close();
      }, 60);
    }, 130);
  } catch {
    // Non-fatal if audio context is blocked
  }
}

// Telephone Beep Tone before speech
function playTelephoneBeep() {
  if (typeof window === 'undefined') return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    setTimeout(() => {
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.08);
      setTimeout(() => {
        osc.stop();
        ctx.close();
      }, 80);
    }, 320);
  } catch {
    // ignore
  }
}

export default function IvrPage() {
  const { t, languageCode, activePreset } = useApp();

  const callerPhone = activePreset?.phone || '+919829011111';

  // Call status states: 'idle' | 'calling' | 'connected' | 'ended'
  const [callState, setCallState] = useState<'idle' | 'calling' | 'connected' | 'ended'>('idle');
  const [callDuration, setCallDuration] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState<IvrStep | null>(null);
  const [sessionLang, setSessionLang] = useState<LanguageCode>(languageCode);
  const [sessionCategory, setSessionCategory] = useState<Category | null>(null);

  // Audio & TTS states
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [activeDigit, setActiveDigit] = useState<string | null>(null);

  // Speech & Text input in Stage 3
  const [speechInputText, setSpeechInputText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // CloudTalk Webhook Log History & Drawer
  const [webhookLogs, setWebhookLogs] = useState<Array<IvrStep['webhookLog']>>([]);
  const [showWebhookDrawer, setShowWebhookDrawer] = useState<boolean>(false);
  const [copiedLogIndex, setCopiedLogIndex] = useState<number | null>(null);

  // SMS Notification Toast
  const [showSmsToast, setShowSmsToast] = useState<boolean>(false);
  const [smsToastData, setSmsToastData] = useState<{ text: string; portal: string; help: string } | null>(null);

  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Speak IVR Prompt via Web Speech API
  const speakPrompt = useCallback(
    (text: string, lang: LanguageCode) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window) || isAudioMuted) return;

      window.speechSynthesis.cancel();
      const clean = text.replace(/[*_#`[\]()]/g, '').replace(/https?:\/\/\S+/g, '').trim();
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = lang;
      utterance.rate = 0.92;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [isAudioMuted]
  );

  // Stop speech playback
  const stopSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeech();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [stopSpeech]);

  // Initiate Outbound Call to 1800-180-1551
  const startCall = async () => {
    stopSpeech();
    setCallState('calling');
    setCallDuration(0);
    setWebhookLogs([]);
    setShowSmsToast(false);
    setSmsToastData(null);
    setIsProcessing(true);

    try {
      const step = await ivrSimulate({
        callerPhone,
        stage: 'greeting',
      });

      setCallState('connected');
      setCurrentStep(step);
      setSessionLang(step.session.languageCode || languageCode);
      setSessionCategory(step.session.category);
      if (step.webhookLog) setWebhookLogs([step.webhookLog]);

      // Start call timer
      timerIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);

      // Play greeting prompt
      speakPrompt(step.promptText, step.session.languageCode || 'hi-IN');
    } catch (err) {
      console.error('Failed to start IVR call:', err);
      setCallState('idle');
    } finally {
      setIsProcessing(false);
    }
  };

  // Terminate Call
  const hangUp = async () => {
    stopSpeech();
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    try {
      const step = await ivrSimulate({
        callerPhone,
        stage: 'goodbye',
        languageCode: sessionLang,
      });

      setCurrentStep(step);
      if (step.webhookLog) setWebhookLogs((prev) => [step.webhookLog, ...prev]);
      speakPrompt(step.promptText, sessionLang);
    } catch {
      // ignore
    } finally {
      setCallState('ended');
      setTimeout(() => {
        setCallState('idle');
        setCurrentStep(null);
      }, 3000);
    }
  };

  // Handle DTMF Key Press
  const handleKeypadPress = async (digit: string) => {
    playDtmfTone(digit);
    setActiveDigit(digit);
    setTimeout(() => setActiveDigit(null), 250);

    if (callState !== 'connected' || !currentStep || isProcessing) return;

    // Only process DTMF if inputExpected is 'dtmf'
    if (currentStep.inputExpected !== 'dtmf') return;

    setIsProcessing(true);
    stopSpeech();

    try {
      let nextStage: IvrStep['stage'] = 'category';
      if (currentStep.stage === 'category') nextStage = 'speech';

      const nextStep = await ivrSimulate({
        callerPhone,
        stage: currentStep.stage,
        dtmfDigit: digit,
        languageCode: sessionLang,
      });

      setCurrentStep(nextStep);
      setSessionLang(nextStep.session.languageCode);
      setSessionCategory(nextStep.session.category);
      if (nextStep.webhookLog) setWebhookLogs((prev) => [nextStep.webhookLog, ...prev]);

      if (nextStep.stage === 'speech') {
        playTelephoneBeep();
      }

      speakPrompt(nextStep.promptText, nextStep.session.languageCode);
    } catch (err) {
      console.error('DTMF simulation failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Submit Speech / Query in Stage 3
  const submitSpeechQuery = async (queryText: string) => {
    if (!queryText.trim() || isProcessing) return;

    setIsProcessing(true);
    stopSpeech();

    try {
      const nextStep = await ivrSimulate({
        callerPhone,
        stage: 'speech',
        languageCode: sessionLang,
        text: queryText,
      });

      setCurrentStep(nextStep);
      if (nextStep.webhookLog) setWebhookLogs((prev) => [nextStep.webhookLog, ...prev]);
      setSpeechInputText('');

      // Trigger Slide-in SMS Toast Notification if SMS receipt is attached
      if (nextStep.answer?.smsReceipt) {
        setSmsToastData({
          text: nextStep.answer.smsReceipt.smsReceiptText,
          portal: nextStep.answer.smsReceipt.portalUrl,
          help: nextStep.answer.smsReceipt.helpline,
        });
        setShowSmsToast(true);
      }

      speakPrompt(nextStep.promptText, nextStep.session.languageCode);
    } catch (err) {
      console.error('Speech query failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyWebhookLog = (index: number, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedLogIndex(index);
    setTimeout(() => setCopiedLogIndex(null), 2000);
  };

  return (
    <div className="mx-auto max-w-4xl px-3 py-4 sm:px-6 sm:py-6 text-zinc-900">
      {/* 1. Header & Toll-Free Banner */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/90 text-emerald-800 text-xs font-semibold mb-2 border border-emerald-300">
          <PhoneCall className="h-3.5 w-3.5 text-emerald-700" />
          <span>CloudTalk Toll-Free IVR Service (DEC-06 / B-07)</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900">
          {t.ivrTitle}
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-zinc-600 max-w-xl mx-auto">
          {t.ivrSubtitle} · Hindi (1), Marathi (2), Tamil (3) DTMF Routing.
        </p>
      </div>

      {/* 2. Top Bar Status & Caller Profile */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-zinc-200 text-xs shadow-2xs">
          <Phone className="h-3.5 w-3.5 text-emerald-600" />
          <span className="text-zinc-500">Caller Handset:</span>
          <span className="font-mono font-bold text-zinc-800">{callerPhone}</span>
          {activePreset && (
            <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-1.5 py-0.5 rounded border border-emerald-200">
              {activePreset.name.split(' ')[0]} ({activePreset.languageCode})
            </span>
          )}
        </div>

        {/* Webhook Log Drawer Toggle */}
        <button
          type="button"
          onClick={() => setShowWebhookDrawer((prev) => !prev)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-2xs cursor-pointer ${
            showWebhookDrawer
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
          }`}
        >
          <Code className="h-3.5 w-3.5" />
          <span>{t.webhookLog}</span>
          <span className="bg-zinc-100 text-zinc-700 text-[10px] px-1.5 py-0.2 rounded font-mono">
            {webhookLogs.length}
          </span>
        </button>
      </div>

      {/* 3. Slide-in Top SMS Receipt Notification Banner */}
      {showSmsToast && smsToastData && (
        <div className="mb-6 rounded-2xl border-2 border-emerald-500 bg-emerald-900 text-white p-4 shadow-lg transition-all animate-in slide-in-from-top-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-emerald-700 flex items-center justify-center shrink-0">
                <FileCheck className="h-4 w-4 text-emerald-200" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-200 uppercase tracking-wider">
                    {t.smsReceipt} Dispatched to {callerPhone}
                  </span>
                  <span className="text-[10px] bg-emerald-800 px-1.5 py-0.2 rounded text-emerald-300 font-mono">
                    Verbatim Card (R5)
                  </span>
                </div>
                <p className="mt-1 text-xs text-emerald-100 font-mono leading-relaxed">
                  {smsToastData.text}
                </p>
                <div className="mt-2 flex items-center gap-2 text-[11px]">
                  {smsToastData.portal && (
                    <a
                      href={smsToastData.portal}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-300 hover:underline font-semibold"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span>{t.officialPortal}</span>
                    </a>
                  )}
                  {smsToastData.help && (
                    <span className="text-emerald-300 font-mono">
                      • {t.helpline}: {smsToastData.help}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSmsToast(false)}
              className="text-emerald-300 hover:text-white text-xs font-bold p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 4. Feature Phone Handset Simulator Container */}
      <div className="rounded-3xl border-4 border-zinc-800 bg-zinc-900 p-4 sm:p-6 shadow-2xl max-w-xl mx-auto">
        {/* Handset Top Bar */}
        <div className="flex items-center justify-between text-zinc-400 text-[11px] px-2 pb-3 font-mono border-b border-zinc-800">
          <div className="flex items-center gap-1.5">
            <Signal className="h-3 w-3 text-zinc-300" />
            <span>BSNL 2G</span>
          </div>
          <div className="flex items-center gap-1.5 font-bold text-zinc-200">
            <span>{TOLL_FREE_NUMBER}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>99%</span>
            <Battery className="h-3 w-3 text-emerald-400" />
          </div>
        </div>

        {/* Handset Active Screen */}
        <div className="mt-4 rounded-2xl bg-zinc-950 border border-zinc-800 p-4 min-h-[170px] flex flex-col justify-between text-center relative overflow-hidden">
          {callState === 'idle' && (
            <div className="py-6 flex flex-col items-center justify-center">
              <div className="h-14 w-14 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2">
                <PhoneCall className="h-7 w-7" />
              </div>
              <h3 className="text-white font-bold text-sm sm:text-base">
                1800-180-1551 (Toll-Free)
              </h3>
              <p className="text-zinc-500 text-xs mt-0.5">
                Press Call to connect citizen helpline
              </p>
            </div>
          )}

          {callState === 'calling' && (
            <div className="py-6 flex flex-col items-center justify-center animate-pulse">
              <div className="h-14 w-14 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-2">
                <PhoneCall className="h-7 w-7 animate-spin" />
              </div>
              <h3 className="text-amber-300 font-bold text-sm">कॉल कनेक्ट हो रहा है...</h3>
              <p className="text-zinc-500 text-xs mt-0.5">Connecting CloudTalk Toll-Free...</p>
            </div>
          )}

          {callState === 'connected' && currentStep && (
            <div className="flex flex-col justify-between h-full">
              {/* Call Header */}
              <div className="flex items-center justify-between text-xs text-zinc-400 border-b border-zinc-800/80 pb-2 mb-2">
                <div className="flex items-center gap-1.5 text-emerald-400 font-mono font-bold">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>
                    {Math.floor(callDuration / 60)}:
                    {(callDuration % 60).toString().padStart(2, '0')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                    STAGE: {currentStep.stage}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAudioMuted((prev) => !prev)}
                  className="text-zinc-400 hover:text-white p-1"
                  title={isAudioMuted ? 'Unmute' : 'Mute'}
                >
                  {isAudioMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* Spoken Prompt Display */}
              <div className="my-auto text-left bg-zinc-900/90 rounded-xl p-3 border border-zinc-800/90 shadow-inner">
                <p className="text-xs sm:text-sm text-zinc-100 font-medium leading-relaxed">
                  {currentStep.promptText}
                </p>
                {isSpeaking && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
                    <Volume2 className="h-3 w-3 animate-pulse" />
                    <span>IVR Audio Playing (Web Speech / Sarvam 8kHz)</span>
                  </div>
                )}
              </div>

              {/* Active Stage Helper Hint */}
              <div className="mt-2 text-[11px] text-zinc-400 flex items-center justify-center gap-1">
                {currentStep.stage === 'language' && (
                  <span>👇 Press 1 for Hindi · 2 for Marathi · 3 for Tamil</span>
                )}
                {currentStep.stage === 'category' && (
                  <span>👇 Press 1 for Schemes · 2 for Agri · 3 for Health · 4 for Education</span>
                )}
                {currentStep.stage === 'speech' && (
                  <span className="text-amber-400 font-semibold">🎙️ Speak or click question below</span>
                )}
                {currentStep.stage === 'answer' && (
                  <span className="text-emerald-400 font-semibold">✓ Answer Played · SMS Sent</span>
                )}
              </div>
            </div>
          )}

          {callState === 'ended' && (
            <div className="py-6 flex flex-col items-center justify-center">
              <div className="h-14 w-14 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center mb-2">
                <PhoneOff className="h-7 w-7" />
              </div>
              <h3 className="text-zinc-300 font-bold text-sm">कॉल समाप्त (Call Ended)</h3>
              <p className="text-zinc-500 text-xs mt-0.5">Duration: {callDuration}s</p>
            </div>
          )}
        </div>

        {/* 5. Stage 3 Speech Query Input (Active when stage === 'speech') */}
        {callState === 'connected' && currentStep?.stage === 'speech' && (
          <div className="mt-4 rounded-2xl bg-zinc-800/90 border border-zinc-700 p-3 text-left">
            <div className="flex items-center justify-between text-xs text-zinc-300 font-bold mb-2">
              <span className="flex items-center gap-1.5">
                <Mic className="h-3.5 w-3.5 text-amber-400" />
                <span>अपना सवाल बोलें या लिखें (Ask Question):</span>
              </span>
            </div>

            {/* Quick Golden Chips for IVR */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {GOLDEN_IVR_QUERIES.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => submitSpeechQuery(q.query)}
                  disabled={isProcessing}
                  className="rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white px-2 py-1 text-[11px] font-medium border border-zinc-600 transition-all cursor-pointer disabled:opacity-50"
                >
                  {q.label}
                </button>
              ))}
            </div>

            {/* Custom Typed Query Fallback */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitSpeechQuery(speechInputText);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={speechInputText}
                onChange={(e) => setSpeechInputText(e.target.value)}
                placeholder="उदा. पीएम किसान योजना के नियम..."
                disabled={isProcessing}
                className="flex-1 rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={!speechInputText.trim() || isProcessing}
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 disabled:opacity-40 cursor-pointer"
              >
                <Send className="h-3 w-3" />
                <span>बोलें</span>
              </button>
            </form>
          </div>
        )}

        {/* 6. DTMF Telephone Dialpad */}
        <div className="mt-5 grid grid-cols-3 gap-2.5 sm:gap-3 px-2 sm:px-4">
          {KEYPAD_BUTTONS.map((btn) => {
            const isPressed = activeDigit === btn.digit;
            const isClickable = callState === 'connected' && currentStep?.inputExpected === 'dtmf';

            return (
              <button
                key={btn.digit}
                type="button"
                onClick={() => handleKeypadPress(btn.digit)}
                className={`flex flex-col items-center justify-center h-14 sm:h-16 rounded-2xl border transition-all cursor-pointer select-none active:scale-95 ${
                  isPressed
                    ? 'bg-emerald-500 border-emerald-400 text-white ring-4 ring-emerald-500/40'
                    : isClickable
                    ? 'bg-zinc-800/90 border-zinc-700 text-zinc-100 hover:bg-zinc-700 hover:border-zinc-500'
                    : 'bg-zinc-800/40 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                <span className="font-mono text-xl sm:text-2xl font-bold leading-none">
                  {btn.digit}
                </span>
                {btn.sub ? (
                  <span className="text-[9px] text-emerald-400 font-semibold tracking-tight mt-0.5">
                    {btn.sub}
                  </span>
                ) : btn.letters ? (
                  <span className="text-[9px] text-zinc-500 font-mono tracking-widest mt-0.5">
                    {btn.letters}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* 7. Bottom Call Action Buttons */}
        <div className="mt-5 flex items-center justify-center gap-4 pt-3 border-t border-zinc-800">
          {callState === 'idle' || callState === 'ended' ? (
            <button
              type="button"
              onClick={startCall}
              disabled={isProcessing}
              className="flex items-center gap-2 px-8 py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg hover:shadow-emerald-600/30 transition-all cursor-pointer active:scale-95"
            >
              <Phone className="h-5 w-5" />
              <span>{t.callButton} (1800-180-1551)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={hangUp}
              className="flex items-center gap-2 px-8 py-3.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg hover:shadow-rose-600/30 transition-all cursor-pointer active:scale-95"
            >
              <PhoneOff className="h-5 w-5" />
              <span>{t.hangupButton}</span>
            </button>
          )}
        </div>
      </div>

      {/* 8. CloudTalk Webhook Log Drawer (Judges View) */}
      {showWebhookDrawer && (
        <div className="mt-6 rounded-2xl border border-zinc-300 bg-zinc-900 text-zinc-100 p-4 sm:p-5 shadow-lg">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Code className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">
                {t.webhookLog} — CloudTalk Telephony Webhook Trail
              </h3>
            </div>
            <span className="text-xs text-zinc-400 font-mono">
              Total Events: {webhookLogs.length}
            </span>
          </div>

          {webhookLogs.length === 0 ? (
            <p className="text-xs text-zinc-500 py-4 text-center">
              No webhook events yet. Start an IVR call to inspect HTTP payloads.
            </p>
          ) : (
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {webhookLogs.map((log, idx) => {
                const logJson = JSON.stringify(log, null, 2);
                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs"
                  >
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 border-b border-zinc-800/80 pb-1.5 mb-2">
                      <span className="text-emerald-400 font-bold uppercase">
                        Stage: {log.stage}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyWebhookLog(idx, logJson)}
                        className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      >
                        {copiedLogIndex === idx ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy Payload</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="text-[11px] text-zinc-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {logJson}
                    </pre>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
