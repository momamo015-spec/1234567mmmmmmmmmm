import React, { useEffect, useRef, useState } from 'react';
import { Clock, Mic, MicOff, Search, X } from 'lucide-react';
import { SearchHistoryEntry } from '../types';

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: (query: string) => void;
  history: SearchHistoryEntry[];
  compact?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onSubmit,
  history,
  compact = false,
  autoFocus = false,
  placeholder = 'ابحث في نوفا أو اكتب سؤالاً أو عملية حسابية...',
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const filteredSuggestions = history
    .filter((item) => {
      if (!value.trim()) return true;
      return item.query.toLowerCase().includes(value.trim().toLowerCase());
    })
    .slice(0, 6);

  const showDropdown = isFocused && filteredSuggestions.length > 0;

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleVoiceSearch = () => {
    setVoiceError(null);
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance })
        .webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setVoiceError('البحث الصوتي غير مدعوم في هذا المتصفح.');
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = 'ar-SA';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim();
        if (transcript) {
          onChange(transcript);
          onSubmit(transcript);
        }
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
        setVoiceError('تعذر التقاط الصوت. تأكد من منح إذن الميكروفون.');
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      setIsListening(true);
      recognition.start();
    } catch {
      setIsListening(false);
      setVoiceError('تعذر بدء البحث الصوتي.');
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setIsFocused(false);
    onSubmit(value.trim());
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <form
        onSubmit={handleFormSubmit}
        className={`flex items-center w-full bg-white dark:bg-[#303134] border transition-shadow duration-150 ${
          showDropdown
            ? 'rounded-t-[26px] border-[#dfe1e5] dark:border-[#5f6368] shadow-[0_4px_12px_rgba(32,33,36,0.18)]'
            : 'rounded-full border-[#dfe1e5] dark:border-[#5f6368] hover:shadow-[0_1px_6px_rgba(32,33,36,0.22)] focus-within:shadow-[0_1px_6px_rgba(32,33,36,0.25)] dark:hover:bg-[#303134]'
        } ${compact ? 'h-11 px-3.5' : 'h-[50px] px-4 sm:px-5'}`}
      >
        <button
          type="submit"
          aria-label="بحث"
          className="text-[#9aa0a6] hover:text-[#4285F4] transition-colors shrink-0 cursor-pointer ml-3"
        >
          <Search className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
        </button>

        <input
          type="text"
          dir="auto"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-label="مربع بحث نوفا"
          className="flex-1 min-w-0 bg-transparent text-[#202124] dark:text-[#e8eaed] placeholder:text-[#9aa0a6] text-sm sm:text-base focus:outline-none"
        />

        <div className="flex items-center gap-1 shrink-0 mr-1">
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              aria-label="مسح النص"
              className="p-1.5 rounded-full text-[#70757a] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {value && <span className="h-5 w-px bg-[#dfe1e5] dark:bg-[#5f6368] mx-1" />}

          <button
            type="button"
            onClick={handleVoiceSearch}
            title="البحث الصوتي"
            aria-label="البحث الصوتي"
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              isListening
                ? 'bg-[#fce8e6] dark:bg-[#3c1e1e] text-[#ea4335]'
                : 'text-[#4285F4] dark:text-[#8ab4f8] hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043]'
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        </div>
      </form>

      {/* Autocomplete dropdown */}
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-30 bg-white dark:bg-[#303134] border border-t-0 border-[#dfe1e5] dark:border-[#5f6368] rounded-b-[26px] shadow-[0_6px_14px_rgba(32,33,36,0.18)] pb-3 overflow-hidden">
          <div className="border-t border-[#e8eaed] dark:border-[#3c4043] mx-4 mb-1.5" />
          <ul>
            {filteredSuggestions.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(item.query);
                    setIsFocused(false);
                    onSubmit(item.query);
                  }}
                  className="w-full flex items-center gap-3 px-5 py-2 text-sm text-[#202124] dark:text-[#e8eaed] hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043] transition-colors cursor-pointer text-right"
                >
                  <Clock className="w-4 h-4 text-[#9aa0a6] shrink-0" />
                  <span dir="auto" className="truncate flex-1">
                    {item.query}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Voice listening indicator */}
      {isListening && (
        <div className="mt-2 flex items-center justify-center gap-2 text-xs font-medium text-[#ea4335] dark:text-[#f28b82]">
          <Mic className="w-3.5 h-3.5 animate-pulse" />
          <span>تحدث الآن للبحث...</span>
        </div>
      )}

      {voiceError && !isListening && (
        <p className="mt-1.5 text-center text-xs text-[#d93025] dark:text-[#f28b82]">
          {voiceError}
        </p>
      )}
    </div>
  );
};
