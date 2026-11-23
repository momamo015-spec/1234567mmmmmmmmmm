import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  ClipboardPaste,
  Eraser,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  X,
} from 'lucide-react';
import { EngineMode, GoogleApiConfig } from '../types';

interface ApiConfigModalProps {
  isOpen: boolean;
  config: GoogleApiConfig;
  engineMode: EngineMode;
  onChangeEngine: (mode: EngineMode) => void;
  onClose: () => void;
  onSaveConfig: (newConfig: GoogleApiConfig) => void;
  onClearConfig: () => void;
}

export const ApiConfigModal: React.FC<ApiConfigModalProps> = ({
  isOpen,
  config,
  engineMode,
  onChangeEngine,
  onClose,
  onSaveConfig,
  onClearConfig,
}) => {
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [preferredLang, setPreferredLang] = useState<'auto' | 'ar' | 'en'>(
    config.preferredLang || 'auto'
  );
  const [showKey, setShowKey] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setApiKey(config.apiKey);
      setPreferredLang(config.preferredLang || 'auto');
      setStatusMessage(null);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setApiKey(text.trim());
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'تعذر الوصول إلى الحافظة تلقائياً؛ يرجى اللصق يدوياً داخل الحقل.',
      });
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig({
      apiKey: apiKey.trim(),
      preferredLang,
    });
    setStatusMessage({
      type: 'success',
      text: 'تم حفظ الإعدادات بنجاح! محرك البحث يعمل مباشرة بدون الحاجة إلى معرف محرك البحث.',
    });
  };

  const handleClear = () => {
    setApiKey('');
    setPreferredLang('auto');
    onClearConfig();
    setStatusMessage({
      type: 'success',
      text: 'تم مسح المفتاح وإعادة ضبط الإعدادات الافتراضية.',
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-modal-title"
    >
      <div className="w-full max-w-lg bg-white dark:bg-[#202124] rounded-3xl border border-[#dadce0] dark:border-[#3c4043] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#e8eaed] dark:border-[#3c4043]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#e6f4ea] dark:bg-[#1e3524] text-[#34A853] flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="api-modal-title"
                className="text-lg font-bold text-[#202124] dark:text-[#e8eaed]"
              >
                إعدادات محرك بحث نوفا (NOVA)
              </h2>
              <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6]">
                يعمل مباشرةً عبر الدمج التلقائي بدون الحاجة إلى Search Engine ID
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-2 rounded-full text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-[#303134] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto">
          <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#e6f4ea] dark:bg-[#1e3524] text-[#137333] dark:text-[#81c995] text-xs leading-relaxed">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              المحرك جاهز ونشط للبحث في الويب والصور والأخبار والفيديو وGoogle Drive مباشرة دون أي معرف إضافي.
            </span>
          </div>

          {/* Engine Mode Selection */}
          <div>
            <label className="block text-sm font-semibold text-[#202124] dark:text-[#e8eaed] mb-2">
              وضع المحرك الافتراضي
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(
                [
                  { id: 'hybrid', label: 'الوضع المدمج' },
                  { id: 'google', label: 'Google الذكي' },
                  { id: 'duckduckgo', label: 'DuckDuckGo' },
                ] as { id: EngineMode; label: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChangeEngine(m.id)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                    engineMode === m.id
                      ? 'border-[#1a73e8] dark:border-[#8ab4f8] bg-[#e8f0fe] dark:bg-[#283142] text-[#1a73e8] dark:text-[#8ab4f8]'
                      : 'border-[#dadce0] dark:border-[#5f6368] text-[#5f6368] dark:text-[#bdc1c6] hover:bg-[#f8f9fa] dark:hover:bg-[#303134]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Language Preference */}
          <div>
            <label className="block text-sm font-semibold text-[#202124] dark:text-[#e8eaed] mb-2">
              لغة نتائج البحث المفضلة
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'auto', label: 'تلقائي حسب النص' },
                  { id: 'ar', label: 'العربية' },
                  { id: 'en', label: 'الإنجليزية' },
                ] as { id: 'auto' | 'ar' | 'en'; label: string }[]
              ).map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setPreferredLang(l.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                    preferredLang === l.id
                      ? 'border-[#1a73e8] dark:border-[#8ab4f8] bg-[#e8f0fe] dark:bg-[#283142] text-[#1a73e8] dark:text-[#8ab4f8]'
                      : 'border-[#dadce0] dark:border-[#5f6368] text-[#5f6368] dark:text-[#bdc1c6] hover:bg-[#f8f9fa] dark:hover:bg-[#303134]'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Google API Key (NO cx required) */}
          <div>
            <label className="block text-sm font-semibold text-[#202124] dark:text-[#e8eaed] mb-1.5">
              مفتاح Google API (اختياري)
            </label>
            <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] mb-2">
              حقل اختياري فقط — لا يتطلب إدخال أي معرف محرك بحث.
            </p>
            <div className="relative flex items-center">
              <KeyRound className="w-4 h-4 text-[#9aa0a6] absolute right-3.5 pointer-events-none" />
              <input
                type={showKey ? 'text' : 'password'}
                dir="ltr"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy... (اختياري)"
                className="w-full pr-10 pl-24 py-2.5 rounded-2xl border border-[#dadce0] dark:border-[#5f6368] bg-[#f8f9fa] dark:bg-[#303134] text-sm text-[#202124] dark:text-[#e8eaed] focus:outline-none focus:border-[#1a73e8] dark:focus:border-[#8ab4f8]"
              />
              <div className="absolute left-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePaste}
                  title="لصق"
                  className="p-1.5 rounded-lg text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#e8eaed] dark:hover:bg-[#3c4043] cursor-pointer"
                >
                  <ClipboardPaste className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  title={showKey ? 'إخفاء' : 'إظهار'}
                  className="p-1.5 rounded-lg text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#e8eaed] dark:hover:bg-[#3c4043] cursor-pointer"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                {apiKey && (
                  <button
                    type="button"
                    onClick={() => setApiKey('')}
                    title="مسح الحقل"
                    className="p-1.5 rounded-lg text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#e8eaed] dark:hover:bg-[#3c4043] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {statusMessage && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl text-xs leading-relaxed bg-[#e6f4ea] dark:bg-[#1e3524] text-[#137333] dark:text-[#81c995]">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium text-[#d93025] dark:text-[#f28b82] hover:bg-[#fce8e6] dark:hover:bg-[#3c1e1e] transition-colors cursor-pointer"
            >
              <Eraser className="w-4 h-4" />
              <span>إعادة الضبط</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full text-sm font-medium text-[#5f6368] dark:text-[#bdc1c6] hover:bg-[#f1f3f4] dark:hover:bg-[#303134] transition-colors cursor-pointer"
              >
                إغلاق
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-full text-sm font-medium bg-[#1a73e8] hover:bg-[#1557b0] dark:bg-[#8ab4f8] dark:hover:bg-[#aecbfa] text-white dark:text-[#202124] transition-colors cursor-pointer"
              >
                حفظ الإعدادات
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
