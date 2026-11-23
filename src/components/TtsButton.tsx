import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Square, Volume2 } from 'lucide-react';

interface TtsButtonProps {
  text: string;
  label?: string;
}

export const TtsButton: React.FC<TtsButtonProps> = ({ text, label = 'استماع' }) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [errorText, setErrorText] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleTogglePlay = async () => {
    setErrorText(null);
    if (status === 'playing' && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setStatus('idle');
      return;
    }

    if (!text.trim()) return;
    setStatus('loading');

    try {
      const response = await fetch('/api/gemini/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 1500), voiceName: 'Kore' }),
      });

      const data = await response.json();
      if (!response.ok || !data.audioBase64) {
        throw new Error(data.error || 'تعذر تشغيل الصوت.');
      }

      const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
      audioRef.current = audio;

      audio.onended = () => setStatus('idle');
      audio.onerror = () => {
        setStatus('idle');
        setErrorText('تعذر تشغيل الملف الصوتي.');
      };

      await audio.play();
      setStatus('playing');
    } catch (error: unknown) {
      setStatus('idle');
      setErrorText(error instanceof Error ? error.message : 'تعذر تحويل النص إلى صوت.');
    }
  };

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleTogglePlay}
        disabled={status === 'loading'}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-[#dadce0] dark:border-[#5f6368] bg-white dark:bg-[#28292c] text-[#1a73e8] dark:text-[#8ab4f8] hover:bg-[#f1f6fe] dark:hover:bg-[#303134] transition-colors cursor-pointer whitespace-nowrap shrink-0"
      >
        {status === 'loading' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : status === 'playing' ? (
          <Square className="w-3.5 h-3.5 fill-current" />
        ) : (
          <Volume2 className="w-3.5 h-3.5" />
        )}
        <span>
          {status === 'loading' ? 'جاري التحويل...' : status === 'playing' ? 'إيقاف الصوت' : label}
        </span>
      </button>
      {errorText && (
        <span className="text-[11px] text-[#d93025] dark:text-[#f28b82]">{errorText}</span>
      )}
    </div>
  );
};
