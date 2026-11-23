import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, FolderOpen, Globe, Monitor, Terminal, X } from 'lucide-react';
import { isSafeHttpUrl } from '../lib/searchHelpers';

interface DesktopLauncherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type LauncherMode = 'exact' | 'web';

const EXACT_USER_PROJECT_DIR = 'C:\\Users\\dell\\3D Objects\\google';
const EXACT_USER_PORT = '30';
const EXACT_USER_SITE_URL = 'http:/google.1.:30';

function sanitizeBatchValue(raw: string): string {
  return raw.replace(/[\r\n"&|<>^!]/g, '').trim();
}

function sanitizePort(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const num = Number(digits);
  if (!digits || !Number.isInteger(num) || num < 1 || num > 65535) {
    return EXACT_USER_PORT;
  }
  return String(num);
}

export const DesktopLauncherModal: React.FC<DesktopLauncherModalProps> = ({
  isOpen,
  onClose,
}) => {
  const defaultOrigin =
    typeof window !== 'undefined' && isSafeHttpUrl(window.location.origin)
      ? window.location.origin
      : 'http://localhost:3000';

  const [mode, setMode] = useState<LauncherMode>('exact');
  const [projectDir, setProjectDir] = useState(EXACT_USER_PROJECT_DIR);
  const [port, setPort] = useState(EXACT_USER_PORT);
  const [localSiteUrl, setLocalSiteUrl] = useState(EXACT_USER_SITE_URL);
  const [webSiteUrl, setWebSiteUrl] = useState(defaultOrigin);
  const [copied, setCopied] = useState(false);

  const safeProjectDir = useMemo(() => {
    const cleaned = sanitizeBatchValue(projectDir);
    return cleaned || EXACT_USER_PROJECT_DIR;
  }, [projectDir]);

  const safePort = useMemo(() => sanitizePort(port), [port]);

  const safeLocalSiteUrl = useMemo(() => {
    const cleaned = sanitizeBatchValue(localSiteUrl);
    return cleaned || EXACT_USER_SITE_URL;
  }, [localSiteUrl]);

  const safeWebSiteUrl = useMemo(() => {
    const cleaned = sanitizeBatchValue(webSiteUrl);
    return isSafeHttpUrl(cleaned) ? cleaned : defaultOrigin;
  }, [webSiteUrl, defaultOrigin]);

  const batchScript = useMemo(() => {
    if (mode === 'web') {
      return [
        '@echo off',
        'setlocal',
        'title NOVA Web Launcher',
        'color 0A',
        'cls',
        '',
        `set "SITE_URL=${safeWebSiteUrl}"`,
        '',
        'echo ================================================',
        'echo          Starting NOVA Web App',
        'echo ================================================',
        'echo.',
        'echo Opening Microsoft Edge...',
        'if exist "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" (',
        '  start "NOVA" "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%SITE_URL%" --window-size=1280,800 --title="NOVA"',
        ') else if exist "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" (',
        '  start "NOVA" "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%SITE_URL%" --window-size=1280,800 --title="NOVA"',
        ') else (',
        '  start "NOVA" msedge --app="%SITE_URL%" --window-size=1280,800 --title="NOVA"',
        ')',
        '',
        'echo.',
        'echo [SUCCESS] NOVA is running at %SITE_URL%',
        'endlocal',
        'exit /b 0',
      ].join('\r\n');
    }

    return [
      '@echo off',
      'setlocal',
      `title NOVA Web Launcher - Port ${safePort}`,
      'color 0A',
      'cls',
      '',
      `set "PROJECT_DIR=${safeProjectDir}"`,
      `set "PORT=${safePort}"`,
      `set "SITE_URL=${safeLocalSiteUrl}"`,
      '',
      'echo ================================================',
      'echo          Starting NOVA on port %PORT%',
      'echo ================================================',
      'echo.',
      '',
      'if not exist "%PROJECT_DIR%\\package.json" (',
      '  echo [ERROR] package.json was not found.',
      '  pause',
      '  exit /b 1',
      ')',
      '',
      'where npm >nul 2>&1',
      'if errorlevel 1 (',
      '  echo [ERROR] Node.js/npm is not installed or is not in PATH.',
      '  pause',
      '  exit /b 1',
      ')',
      '',
      'echo [1/2] Starting npm start on port %PORT%...',
      'start "NOVA server" /min /d "%PROJECT_DIR%" cmd /c npm start',
      '',
      'echo [2/2] Waiting for the website...',
      'timeout /t 4 /nobreak >nul',
      '',
      'echo Opening Microsoft Edge...',
      'if exist "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" (',
      '  start "NOVA" "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%SITE_URL%" --window-size=1280,800 --title="NOVA"',
      ') else if exist "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" (',
      '  start "NOVA" "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%SITE_URL%" --window-size=1280,800 --title="NOVA"',
      ') else (',
      '  start "NOVA" msedge --app="%SITE_URL%" --window-size=1280,800 --title="NOVA"',
      ')',
      '',
      'echo.',
      'echo [SUCCESS] NOVA is running at %SITE_URL%',
      'endlocal',
      'exit /b 0',
    ].join('\r\n');
  }, [mode, safeProjectDir, safePort, safeLocalSiteUrl, safeWebSiteUrl]);

  if (!isOpen) return null;

  const handleDownload = () => {
    const blob = new Blob([batchScript + '\r\n'], { type: 'application/x-bat;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = mode === 'exact' ? 'NOVA-Launcher.bat' : 'NOVA-Web-Launcher.bat';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(batchScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-label="تنزيل مشغّل نوفا لسطح المكتب"
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-[#202124] text-[#202124] dark:text-[#e8eaed] rounded-3xl border border-[#dadce0] dark:border-[#3c4043] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e8eaed] dark:border-[#3c4043] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#e8f0fe] dark:bg-[#283142] text-[#1a73e8] dark:text-[#8ab4f8] flex items-center justify-center shrink-0">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                تنزيل مشغّل نوفا (.bat)
              </h2>
              <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6]">
                نفس ملف التشغيل المطلوب لتشغيل خادم نوفا وفتحه في نافذة Microsoft Edge
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-2 rounded-full text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-[#303134] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Mode Selector */}
          <div
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            role="radiogroup"
            aria-label="نوع ملف التشغيل"
          >
            <button
              type="button"
              onClick={() => setMode('exact')}
              className={`p-4 rounded-2xl border text-right transition-colors cursor-pointer ${
                mode === 'exact'
                  ? 'border-[#1a73e8] dark:border-[#8ab4f8] bg-[#f1f6fe] dark:bg-[#242c3a]'
                  : 'border-[#dadce0] dark:border-[#3c4043] hover:bg-[#f8f9fa] dark:hover:bg-[#28292c]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Terminal className="w-4 h-4 text-[#34A853]" />
                <span className="text-sm font-bold">ملف التشغيل الأصلي (npm start + Edge)</span>
              </div>
              <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] leading-relaxed">
                مطابق للملف المرفق مع إمكانية تعديل المسار والمنفذ والرابط أو استخدام القيم كما هي.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setMode('web')}
              className={`p-4 rounded-2xl border text-right transition-colors cursor-pointer ${
                mode === 'web'
                  ? 'border-[#1a73e8] dark:border-[#8ab4f8] bg-[#f1f6fe] dark:bg-[#242c3a]'
                  : 'border-[#dadce0] dark:border-[#3c4043] hover:bg-[#f8f9fa] dark:hover:bg-[#28292c]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Globe className="w-4 h-4 text-[#1a73e8] dark:text-[#8ab4f8]" />
                <span className="text-sm font-bold">فتح رابط الويب مباشرة</span>
              </div>
              <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] leading-relaxed">
                يفتح رابط نوفا الحالي في Microsoft Edge بوضع التطبيق دون الحاجة لـ npm.
              </p>
            </button>
          </div>

          {/* Options */}
          {mode === 'exact' ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-[#5f6368] dark:text-[#9aa0a6] mb-1.5">
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>PROJECT_DIR</span>
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={projectDir}
                  onChange={(e) => setProjectDir(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#dadce0] dark:border-[#5f6368] bg-white dark:bg-[#28292c] text-xs sm:text-sm focus:outline-none focus:border-[#1a73e8]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#5f6368] dark:text-[#9aa0a6] mb-1.5">
                  PORT
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#dadce0] dark:border-[#5f6368] bg-white dark:bg-[#28292c] text-xs sm:text-sm font-mono tabular-nums focus:outline-none focus:border-[#1a73e8]"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-[#5f6368] dark:text-[#9aa0a6] mb-1.5">
                  SITE_URL
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={localSiteUrl}
                  onChange={(e) => setLocalSiteUrl(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#dadce0] dark:border-[#5f6368] bg-white dark:bg-[#28292c] text-xs sm:text-sm focus:outline-none focus:border-[#1a73e8]"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-[#5f6368] dark:text-[#9aa0a6] mb-1.5">
                رابط موقع نوفا (SITE_URL)
              </label>
              <input
                type="url"
                dir="ltr"
                value={webSiteUrl}
                onChange={(e) => setWebSiteUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#dadce0] dark:border-[#5f6368] bg-white dark:bg-[#28292c] text-xs sm:text-sm focus:outline-none focus:border-[#1a73e8]"
              />
            </div>
          )}

          {/* Code Preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#5f6368] dark:text-[#9aa0a6]">
                محتوى الملف (.bat)
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1a73e8] dark:text-[#8ab4f8] hover:underline cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'تم النسخ' : 'نسخ الكود'}</span>
              </button>
            </div>
            <pre
              dir="ltr"
              className="p-4 rounded-2xl bg-[#18191c] text-[#a5f3bc] text-xs font-mono leading-relaxed overflow-x-auto max-h-60 border border-[#3c4043]"
            >
              {batchScript}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#e8eaed] dark:border-[#3c4043] bg-[#f8f9fa] dark:bg-[#28292c] flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6]">
            سيتم تنزيل الملف بصيغة .bat جاهزاً للتشغيل على Windows.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-medium text-[#5f6368] dark:text-[#bdc1c6] hover:bg-[#e8eaed] dark:hover:bg-[#3c4043] cursor-pointer"
            >
              إغلاق
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-medium bg-[#1a73e8] text-white hover:bg-[#1557b0] transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>تنزيل ملف التشغيل (.bat)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
