'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { voiceChat, chat } from '@/lib/api';
import { AnswerData, VoiceAnswerData, Category, LanguageCode } from '@/lib/types';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Phone,
  ExternalLink,
  FileCheck,
  Check,
  Copy,
  Send,
  Clock,
  Layers,
  Tractor,
  GraduationCap,
  Building2,
  AlertTriangle,
  HeartPulse,
  Radio,
  CheckCircle2,
} from 'lucide-react';

interface TurnRecord {
  id: string;
  timestamp: string;
  userQuery: string;
  category: Category | null;
  answer: AnswerData | VoiceAnswerData;
}

const GOLDEN_DEMO_CHIPS: Array<{
  id: string;
  scenario: string;
  label: string;
  query: string;
  languageCode: LanguageCode;
  category: Category;
  tag: string;
  isEmergency?: boolean;
}> = [
  {
    id: 'g1',
    scenario: 'G1',
    label: 'PM-KISAN Eligibility',
    query: 'पीएम किसान योजना के लिए कौन पात्र है?',
    languageCode: 'hi-IN',
    category: 'schemes',
    tag: 'Ramesh (Farmer)',
  },
  {
    id: 'g2',
    scenario: 'G2',
    label: 'Cotton Pink Bollworm IPM',
    query: 'कपाशीवरील बोंडअळी कशी रोखावी?',
    languageCode: 'mr-IN',
    category: 'agri',
    tag: 'Tukaram (Marathi)',
  },
  {
    id: 'g3',
    scenario: 'G3',
    label: 'Wheat Yellow Rust Treatment',
    query: 'गेहूं में पीला रतुआ लग गया है क्या करें?',
    languageCode: 'hi-IN',
    category: 'agri',
    tag: 'Ramesh (Agri)',
  },
  {
    id: 'g4',
    scenario: 'G4',
    label: 'Pregnancy Danger Signs',
    query: 'கர்ப்ப காலத்தில் என்னென்ன ஆபத்தான அறிகுறிகள்?',
    languageCode: 'ta-IN',
    category: 'health',
    tag: 'Kavitha (ASHA)',
  },
  {
    id: 'g5',
    scenario: 'G5',
    label: 'JSY Cash Benefit',
    query: 'ஜனனி சுரக்ஷா யோஜனா திட்டத்தில் எவ்வளவு பணம் கிடைக்கும்?',
    languageCode: 'ta-IN',
    category: 'health',
    tag: 'Kavitha (Maternal)',
  },
  {
    id: 'g7',
    scenario: 'G7',
    label: 'National Scholarship NSP',
    query: 'नेशनल स्कॉलरशिप पोर्टल पर आवेदन कैसे करें?',
    languageCode: 'hi-IN',
    category: 'education',
    tag: 'Priya (Student)',
  },
  {
    id: 's1',
    scenario: 'S1',
    label: 'Snake Bite Emergency',
    query: 'सांप ने काट लिया है क्या करूं?',
    languageCode: 'hi-IN',
    category: 'health',
    tag: 'Safety Guardrail',
    isEmergency: true,
  },
];

const CATEGORIES: Array<{ id: Category; labelKey: string; icon: React.ElementType }> = [
  { id: 'schemes', labelKey: 'catSchemes', icon: Building2 },
  { id: 'agri', labelKey: 'catAgri', icon: Tractor },
  { id: 'health', labelKey: 'catHealth', icon: HeartPulse },
  { id: 'education', labelKey: 'catEducation', icon: GraduationCap },
];

export default function VoicePage() {
  const { t, languageCode, setLanguageCode, role, activePreset, sessionId } = useApp();

  // Selection states
  const [selectedCategory, setSelectedCategory] = useState<Category | null>('schemes');
  const [typedQuery, setTypedQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTurn, setActiveTurn] = useState<TurnRecord | null>(null);
  const [history, setHistory] = useState<TurnRecord[]>([]);

  // Recording states
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [speechHint, setSpeechHint] = useState<string>('');
  const [micError, setMicError] = useState<string | null>(null);

  // Audio Playback states
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [copiedReceipt, setCopiedReceipt] = useState<boolean>(false);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speechRecognitionRef = useRef<any>(null);
  const currentAudioElemRef = useRef<HTMLAudioElement | null>(null);

  // Stop TTS or Audio playback
  const stopAudio = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (currentAudioElemRef.current) {
      currentAudioElemRef.current.pause();
      currentAudioElemRef.current.currentTime = 0;
      currentAudioElemRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudio();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, [stopAudio]);

  // Play audio from Answer (Sarvam WAV base64 or Browser TTS)
  const playAnswerAudio = useCallback(
    (answer: AnswerData | VoiceAnswerData, speed: number = playbackSpeed) => {
      stopAudio();

      const voiceData = answer as VoiceAnswerData;
      if (voiceData.audioBase64) {
        try {
          const audio = new Audio('data:audio/wav;base64,' + voiceData.audioBase64);
          audio.playbackRate = speed;
          currentAudioElemRef.current = audio;

          audio.onplay = () => setIsPlaying(true);
          audio.onended = () => {
            setIsPlaying(false);
            currentAudioElemRef.current = null;
          };
          audio.onerror = () => {
            setIsPlaying(false);
            currentAudioElemRef.current = null;
          };

          audio.play();
          return;
        } catch (err) {
          console.warn('Base64 audio playback failed, falling back to Web Speech TTS:', err);
        }
      }

      // Browser speechSynthesis fallback
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        // Strip markdown asterisks or links
        const cleanText = answer.answerText
          .replace(/[*_#`[\]()]/g, '')
          .replace(/https?:\/\/\S+/g, '')
          .trim();

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = answer.languageCode || languageCode;
        utterance.rate = speed;

        utterance.onstart = () => setIsPlaying(true);
        utterance.onend = () => setIsPlaying(false);
        utterance.onerror = () => setIsPlaying(false);

        window.speechSynthesis.speak(utterance);
      }
    },
    [languageCode, playbackSpeed, stopAudio]
  );

  // Submit Voice / Text query
  const executeQuery = async (queryText: string, audioBlob?: Blob, hint?: string) => {
    if ((!queryText.trim() && !audioBlob) || isLoading) return;
    setIsLoading(true);
    stopAudio();

    try {
      let answer: AnswerData | VoiceAnswerData;
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (audioBlob) {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'voice-query.webm');
        formData.append('role', role);
        if (selectedCategory) formData.append('category', selectedCategory);
        formData.append('languageCode', languageCode);
        if (hint) formData.append('transcriptHint', hint);
        if (sessionId) formData.append('sessionId', sessionId);

        answer = await voiceChat(formData);
      } else {
        answer = await chat({
          queryText,
          languageCode,
          category: selectedCategory,
          role,
          sessionId,
        });
      }

      const displayedQuery =
        (answer as VoiceAnswerData).transcript || queryText || hint || 'ध्वनि प्रश्न (Voice Query)';

      const turn: TurnRecord = {
        id: 'turn-' + Date.now(),
        timestamp: timeStr,
        userQuery: displayedQuery,
        category: selectedCategory,
        answer,
      };

      setActiveTurn(turn);
      setHistory((prev) => [turn, ...prev]);
      setTypedQuery('');

      // Auto-play TTS
      playAnswerAudio(answer);
    } catch (err) {
      console.error('Query execution error:', err);
      alert(t.error);
    } finally {
      setIsLoading(false);
    }
  };

  // Start Mic Recording
  const startRecording = async () => {
    setMicError(null);
    setSpeechHint('');
    stopAudio();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicError('आपका ब्राउज़र माइक्रोफ़ोन सपोर्ट नहीं करता (Microphone not supported)');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const tracks = stream.getTracks();
        tracks.forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      // Start duration timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      // Optional Web Speech API Recognition for live transcript hint
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        try {
          const rec = new SpeechRec();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = languageCode;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rec.onresult = (ev: any) => {
            let interim = '';
            for (let i = ev.resultIndex; i < ev.results.length; ++i) {
              interim += ev.results[i][0].transcript;
            }
            if (interim) setSpeechHint(interim);
          };

          rec.onerror = () => {
            // Non-fatal recognition fallback
          };

          rec.start();
          speechRecognitionRef.current = rec;
        } catch {
          // ignore recognition init errors
        }
      }
    } catch (err: unknown) {
      console.warn('Microphone permission denied or unavailable:', err);
      setMicError('कृपया माइक्रोफ़ोन अनुमति दें (Please allow microphone access)');
      setIsRecording(false);
    }
  };

  // Stop Recording and Dispatch Audio
  const stopRecordingAndSend = () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // ignore
      }
    }

    const currentHint = speechHint;

    mediaRecorderRef.current.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      setIsRecording(false);
      executeQuery('', audioBlob, currentHint);
    };

    mediaRecorderRef.current.stop();
  };

  // Cancel Recording
  const cancelRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsRecording(false);
    setSpeechHint('');
    audioChunksRef.current = [];
  };

  // Quick Golden Demo Chip Handler
  const handleGoldenChip = (chip: (typeof GOLDEN_DEMO_CHIPS)[0]) => {
    setSelectedCategory(chip.category);
    if (languageCode !== chip.languageCode) {
      setLanguageCode(chip.languageCode);
    }
    executeQuery(chip.query);
  };

  // Copy SMS Receipt Text
  const handleCopyReceipt = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedReceipt(true);
    setTimeout(() => setCopiedReceipt(false), 2000);
  };

  return (
    <div className="mx-auto max-w-4xl px-3 py-4 sm:px-6 sm:py-6 text-zinc-900">
      {/* 1. Active Persona Banner */}
      {activePreset && (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-3 sm:p-4 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              {activePreset.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs sm:text-sm text-emerald-950">
                  {activePreset.name}
                </span>
                <span className="text-[10px] bg-emerald-200/70 text-emerald-900 font-semibold px-2 py-0.5 rounded-full">
                  {t[activePreset.role] || activePreset.role}
                </span>
              </div>
              <p className="text-[11px] text-emerald-800 line-clamp-1">{activePreset.description}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="font-mono text-xs font-semibold text-emerald-900 bg-white px-2.5 py-1 rounded-lg border border-emerald-300 shadow-2xs">
              {activePreset.phone}
            </span>
          </div>
        </div>
      )}

      {/* 2. Main Title Header */}
      <div className="text-center mb-5">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900">
          {t.tabVoice} — {t.appName}
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-zinc-600 max-w-xl mx-auto">
          {t.appSubtitle} · <span className="font-semibold text-emerald-700">3-Sentence Spoken Verification</span>
        </p>
      </div>

      {/* 3. Rural Domain Categories */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-emerald-600" />
            <span>विषय चुनें (Select Domain):</span>
          </span>
          {selectedCategory && (
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className="text-[11px] text-zinc-500 hover:text-zinc-800 underline"
            >
              सभी (Show All)
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(isSelected ? null : cat.id)}
                className={`flex items-center gap-2.5 p-3 rounded-2xl border text-left transition-all ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold shadow-xs ring-2 ring-emerald-500/20'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                <div
                  className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-xs font-medium leading-tight">
                  {t[cat.labelKey as keyof typeof t] || cat.id}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Giant Voice Mic & Speech Hub */}
      <div className="rounded-3xl border-2 border-emerald-200/80 bg-gradient-to-b from-white to-emerald-50/40 p-6 sm:p-8 shadow-sm text-center mb-6">
        {micError && (
          <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-900 text-xs border border-amber-300">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
            <span>{micError}</span>
          </div>
        )}

        {/* Dynamic States: Recording vs Idle vs Processing */}
        {isRecording ? (
          <div className="flex flex-col items-center">
            {/* Pulsing Recording Ring */}
            <div className="relative mb-4 flex items-center justify-center">
              <div className="absolute h-32 w-32 rounded-full bg-rose-500/20 animate-ping" />
              <div className="h-24 w-24 rounded-full bg-rose-600 flex items-center justify-center text-white shadow-lg z-10">
                <Radio className="h-10 w-10 animate-pulse" />
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono text-base font-bold text-rose-700 mb-1">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-600 animate-pulse" />
              <span>
                {Math.floor(recordingSeconds / 60)}:
                {(recordingSeconds % 60).toString().padStart(2, '0')}
              </span>
            </div>

            <p className="text-xs font-semibold text-zinc-700 mb-2">
              {t.listening} (Listening... Speak your question)
            </p>

            {speechHint && (
              <div className="max-w-md bg-white px-3 py-1.5 rounded-xl border border-zinc-200 text-xs text-zinc-800 italic mb-4 shadow-2xs">
                &ldquo;{speechHint}&rdquo;
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={stopRecordingAndSend}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                <Check className="h-4 w-4" />
                <span>{t.stopRecording}</span>
              </button>
              <button
                type="button"
                onClick={cancelRecording}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-zinc-200 hover:bg-zinc-300 text-zinc-800 font-semibold text-xs transition-all cursor-pointer"
              >
                <MicOff className="h-4 w-4" />
                <span>{t.cancelRecording}</span>
              </button>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center py-6">
            <div className="h-20 w-20 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
              <Clock className="h-10 w-10 text-amber-600 animate-spin" />
            </div>
            <h3 className="text-base font-bold text-zinc-900">{t.processing}</h3>
            <p className="text-xs text-zinc-500 mt-1">
              Sarvam STT · Chroma RAG · Groq LLM · Sarvam TTS
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            {/* Press and Speak Button */}
            <button
              type="button"
              onClick={startRecording}
              className="group relative mb-4 flex items-center justify-center focus:outline-none cursor-pointer"
              aria-label={t.pressAndSpeak}
            >
              <div className="h-28 w-28 rounded-full bg-emerald-500/15 group-hover:scale-105 group-hover:bg-emerald-500/25 transition-all flex items-center justify-center">
                <div className="h-20 w-20 rounded-full bg-emerald-600 group-hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg transition-transform">
                  <Mic className="h-9 w-9 group-hover:scale-110 transition-transform" />
                </div>
              </div>
            </button>

            <h2 className="text-base sm:text-lg font-extrabold text-zinc-900">
              {t.pressAndSpeak}
            </h2>
            <p className="text-xs text-zinc-600 mt-0.5">
              बोलकर सवाल पूछें (Ask your question by speaking)
            </p>
          </div>
        )}

        {/* Fallback Text Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            executeQuery(typedQuery);
          }}
          className="mt-6 pt-5 border-t border-zinc-200/80 flex items-center gap-2 max-w-xl mx-auto"
        >
          <input
            type="text"
            value={typedQuery}
            onChange={(e) => setTypedQuery(e.target.value)}
            placeholder={t.textPlaceholder}
            disabled={isLoading || isRecording}
            className="flex-1 rounded-2xl bg-white border border-zinc-300 px-4 py-2.5 text-xs sm:text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 min-h-[44px]"
          />
          <button
            type="submit"
            disabled={!typedQuery.trim() || isLoading || isRecording}
            className="h-11 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-40 transition-all shrink-0 cursor-pointer"
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">{t.send}</span>
          </button>
        </form>
      </div>

      {/* 5. Judge Quick-Demo Golden Chips (G1-G5, G7, S1) */}
      <div className="mb-6 rounded-2xl border border-amber-200/90 bg-amber-50/60 p-4 shadow-2xs">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-700" />
            <span>{t.quickQuestions}:</span>
          </span>
          <span className="text-[10px] text-amber-800 font-semibold">1-Tap Live Test</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {GOLDEN_DEMO_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => handleGoldenChip(chip)}
              disabled={isLoading || isRecording}
              className={`p-2.5 rounded-xl border text-left transition-all disabled:opacity-50 cursor-pointer shadow-2xs flex flex-col justify-between ${
                chip.isEmergency
                  ? 'border-rose-300 bg-rose-50/90 hover:bg-rose-100 text-rose-950 ring-1 ring-rose-400'
                  : 'border-amber-200/80 bg-white hover:bg-amber-100/70 text-zinc-900'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                    chip.isEmergency ? 'bg-rose-600 text-white' : 'bg-emerald-100 text-emerald-900'
                  }`}
                >
                  {chip.scenario}
                </span>
                <span className="text-[10px] text-zinc-500 font-medium">{chip.tag}</span>
              </div>
              <p className="text-xs font-bold line-clamp-1">{chip.label}</p>
              <p className="text-[11px] text-zinc-600 line-clamp-1 mt-0.5 italic">
                &ldquo;{chip.query}&rdquo;
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* 6. Active Answer & Emergency Safety Banner */}
      {activeTurn && (
        <div className="space-y-4 mb-8">
          {/* S1 Emergency Safety Banner */}
          {activeTurn.answer.safety?.flagged && (
            <div className="rounded-3xl border-2 border-rose-500 bg-rose-50 p-4 sm:p-5 text-rose-950 shadow-md animate-pulse">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-extrabold text-rose-900">
                    {t.safetyAlert}
                  </h3>
                  <p className="text-xs sm:text-sm text-rose-800 mt-1 font-medium">
                    तत्काल 108 / 102 डायल करें या नजदीकी प्राथमिक स्वास्थ्य केंद्र (PHC) जाएं। घाव को काटें या बांधें नहीं।
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <a
                      href="tel:108"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition-all"
                    >
                      <Phone className="h-4 w-4" />
                      <span>{t.emergencyCall} (108 Ambulance)</span>
                    </a>
                    <a
                      href="tel:102"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-rose-300 text-rose-900 font-bold text-xs hover:bg-rose-100 transition-all"
                    >
                      <span>102 (Pregnancy/Child)</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* User Query Bubble */}
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-tr-none bg-emerald-700 text-white p-3.5 shadow-sm text-xs sm:text-sm leading-relaxed">
              <div className="flex items-center justify-between text-[10px] text-emerald-200 mb-1">
                <span>आप (You)</span>
                <span>{activeTurn.timestamp}</span>
              </div>
              <p className="font-medium">{activeTurn.userQuery}</p>
            </div>
          </div>

          {/* Assistant Spoken Response Card */}
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-sm">
            {/* Audio Controls Bar */}
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-zinc-100 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (isPlaying) {
                      stopAudio();
                    } else {
                      playAnswerAudio(activeTurn.answer);
                    }
                  }}
                  className={`h-9 px-3 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                    isPlaying
                      ? 'bg-rose-600 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="h-3.5 w-3.5" />
                      <span>विराम (Pause)</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" />
                      <span>{t.listenAudio}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => playAnswerAudio(activeTurn.answer)}
                  className="h-9 w-9 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 flex items-center justify-center text-zinc-600 transition-all cursor-pointer"
                  title="फिर से सुनें (Replay)"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>

                {/* Speed toggle for elderly clarity */}
                <button
                  type="button"
                  onClick={() => {
                    const newSpeed = playbackSpeed === 1.0 ? 0.85 : 1.0;
                    setPlaybackSpeed(newSpeed);
                    if (isPlaying) playAnswerAudio(activeTurn.answer, newSpeed);
                  }}
                  className="px-2 py-1 rounded-lg border border-zinc-200 text-[10px] font-mono font-bold text-zinc-700 bg-zinc-50"
                  title="बोलने की गति (Speech Speed)"
                >
                  {playbackSpeed}x
                </button>
              </div>

              {/* RAG & Source Badges */}
              <div className="flex items-center gap-1.5 text-[10px] font-semibold">
                <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-mono">
                  {activeTurn.answer.latencyMs}ms
                </span>
                <span className="bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full uppercase">
                  {activeTurn.answer.source}
                </span>
                <span className="bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-full font-mono">
                  {activeTurn.answer.languageCode}
                </span>
              </div>
            </div>

            {/* Answer Spoken Text */}
            <div className="text-sm sm:text-base leading-relaxed text-zinc-900 font-normal">
              {activeTurn.answer.answerText}
            </div>

            {/* SMS Receipt / Official Portal Card (Rule R5) */}
            {activeTurn.answer.smsReceipt && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <FileCheck className="h-4 w-4 text-emerald-700" />
                    <span>{t.smsReceipt}:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyReceipt(activeTurn.answer.smsReceipt!.smsReceiptText)}
                    className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedReceipt ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span>{t.copied}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>{t.copySms}</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-xs text-zinc-800 leading-relaxed font-mono bg-white p-2.5 rounded-xl border border-emerald-200/80">
                  {activeTurn.answer.smsReceipt.smsReceiptText}
                </p>

                {/* Scheme Action Links & Helplines */}
                <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-emerald-200/60">
                  {activeTurn.answer.smsReceipt.portalUrl && (
                    <a
                      href={activeTurn.answer.smsReceipt.portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-xs font-bold text-emerald-900 hover:bg-emerald-100 transition-all shadow-2xs"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-emerald-700" />
                      <span>{t.officialPortal}</span>
                    </a>
                  )}

                  {activeTurn.answer.smsReceipt.helpline && (
                    <a
                      href={`tel:${activeTurn.answer.smsReceipt.helpline.replace(/[^0-9]/g, '')}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition-all shadow-2xs"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      <span>
                        {t.helpline}: {activeTurn.answer.smsReceipt.helpline}
                      </span>
                    </a>
                  )}
                </div>

                {/* Required Documents Checklist */}
                {activeTurn.answer.smsReceipt.documents &&
                  activeTurn.answer.smsReceipt.documents.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-emerald-200/60">
                      <span className="text-[11px] font-bold text-emerald-950 block mb-1">
                        {t.documents}:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {activeTurn.answer.smsReceipt.documents.map((doc, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 text-[11px] bg-white px-2 py-0.5 rounded-lg border border-emerald-200 text-zinc-700"
                          >
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            <span>{doc}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. Previous Conversation History */}
      {history.length > 1 && (
        <div className="mt-8 pt-6 border-t border-zinc-200">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
            हालिया प्रश्न (Recent Questions in Session)
          </h3>
          <div className="space-y-2">
            {history.slice(1).map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setActiveTurn(item);
                  playAnswerAudio(item.answer);
                }}
                className="p-3 rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50 flex items-center justify-between text-xs cursor-pointer transition-all shadow-2xs"
              >
                <div className="flex items-center gap-2">
                  <Volume2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="font-semibold text-zinc-800 line-clamp-1">
                    {item.userQuery}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-400 shrink-0 font-mono">
                  {item.timestamp}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
