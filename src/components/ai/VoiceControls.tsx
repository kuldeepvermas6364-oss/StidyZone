import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import type { AiLanguageMode } from '../../types/ai';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionCtor(): SpeechCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechCtor;
    webkitSpeechRecognition?: SpeechCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface VoiceMicButtonProps {
  languageMode: AiLanguageMode;
  disabled?: boolean;
  onTranscript: (text: string) => void;
}

export const VoiceMicButton: React.FC<VoiceMicButtonProps> = ({
  languageMode,
  disabled,
  onTranscript,
}) => {
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionInstance | null>(null);
  const supported = getSpeechRecognitionCtor() !== null;

  useEffect(() => {
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        // Ignore cleanup stop errors
      }
    };
  }, []);

  const toggleMic = () => {
    setNotice(null);
    if (listening && recRef.current) {
      recRef.current.stop();
      setListening(false);
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setNotice(
        languageMode === 'hi'
          ? 'इस ब्राउज़र में वॉइस इनपुट उपलब्ध नहीं है — कृपया अपना प्रश्न नीचे टाइप करें।'
          : 'Voice input is unavailable in this browser — type your question in the text box.'
      );
      return;
    }

    try {
      const rec = new Ctor();
      rec.lang = languageMode === 'hi' ? 'hi-IN' : 'en-IN';
      rec.interimResults = false;
      rec.continuous = false;

      rec.onresult = (event) => {
        const pieces: string[] = [];
        for (let i = 0; i < event.results.length; i += 1) {
          const item = event.results[i]?.[0]?.transcript;
          if (item) pieces.push(item.trim());
        }
        const joined = pieces.join(' ').trim();
        if (joined) onTranscript(joined);
      };

      rec.onerror = (ev) => {
        setListening(false);
        if (ev.error === 'not-allowed') {
          setNotice(
            languageMode === 'hi'
              ? 'माइक्रोफ़ोन अनुमति अस्वीकृत हुई — कृपया टाइप करके पूछें।'
              : 'Microphone permission denied — you can continue typing your question below.'
          );
        } else {
          setNotice(
            languageMode === 'hi'
              ? 'वॉइस कैप्चर पूरा नहीं हो सका — कृपया पुनः प्रयास करें या टाइप करें।'
              : 'Could not capture voice cleanly — retry or type your question.'
          );
        }
      };

      rec.onend = () => {
        setListening(false);
      };

      recRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
      setNotice('Voice recognition failed to initialize.');
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={toggleMic}
        disabled={disabled}
        aria-pressed={listening}
        aria-label={
          listening
            ? 'Stop voice input'
            : supported
            ? 'Start voice input'
            : 'Voice input unavailable (text fallback active)'
        }
        title={
          supported
            ? listening
              ? 'Stop listening'
              : `Voice input (${languageMode === 'hi' ? 'Hindi' : 'English'})`
            : 'Voice recognition unavailable in this browser — use text input'
        }
        className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
          listening
            ? 'border-red-500 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-950/50 dark:text-red-300'
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
        } disabled:opacity-50`}
      >
        {listening ? (
          <MicOff className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
        ) : (
          <Mic className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        )}
        <span className="hidden sm:inline">
          {listening ? 'Stop Mic' : supported ? 'Voice' : 'Text Only'}
        </span>
      </button>

      {notice && (
        <span
          role="status"
          className="ml-2 text-[11px] font-medium text-amber-700 dark:text-amber-300"
        >
          {notice}
        </span>
      )}
    </div>
  );
};

export interface ReadAloudButtonProps {
  text: string;
  languageMode: AiLanguageMode;
}

export const ReadAloudButton: React.FC<ReadAloudButtonProps> = ({ text, languageMode }) => {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    return () => {
      if (supported && speaking) {
        window.speechSynthesis.cancel();
      }
    };
  }, [supported, speaking]);

  if (!supported) return null;

  const handleToggle = () => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const plainText = text
      .replace(/```[\s\S]*?```/g, ' Code block omitted. ')
      .replace(/\$\$[\s\S]*?\$\$/g, ' mathematical formula ')
      .replace(/\$[^$]+\$/g, ' expression ')
      .replace(/[#*_>`]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1200);

    if (!plainText) return;
    const utter = new SpeechSynthesisUtterance(plainText);
    utter.lang = languageMode === 'hi' ? 'hi-IN' : 'en-IN';
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utter);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-pressed={speaking}
      aria-label={speaking ? 'Stop reading aloud' : 'Read answer aloud'}
      className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
    >
      {speaking ? (
        <VolumeX className="h-3 w-3 text-red-600" aria-hidden="true" />
      ) : (
        <Volume2 className="h-3 w-3 text-blue-600 dark:text-blue-400" aria-hidden="true" />
      )}
      <span>{speaking ? 'Stop' : 'Listen'}</span>
    </button>
  );
};
