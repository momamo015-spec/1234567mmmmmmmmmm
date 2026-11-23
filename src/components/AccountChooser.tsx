import React, { useState } from 'react';
import { Moon, Plus, Sun, Trash2, UserPlus, VenetianMask, ArrowRight } from 'lucide-react';
import { NovaAccount, ThemeMode } from '../types';
import { NovaLogo } from './NovaLogo';

interface AccountChooserProps {
  accounts: NovaAccount[];
  theme: ThemeMode;
  onToggleTheme: () => void;
  onSelectAccount: (account: NovaAccount) => void;
  onCreateAccount: (name: string, email: string, avatarColor: string) => void;
  onRemoveAccount: (accountId: string) => void;
  onContinueGuest: () => void;
  onGoogleSignIn: () => Promise<void>;
  isGoogleSigningIn: boolean;
  googleAuthError: string | null;
}

const AVATAR_COLORS = [
  '#4285F4',
  '#EA4335',
  '#FBBC05',
  '#34A853',
  '#9334E6',
  '#00897B',
];

export const AccountChooser: React.FC<AccountChooserProps> = ({
  accounts,
  theme,
  onToggleTheme,
  onSelectAccount,
  onCreateAccount,
  onRemoveAccount,
  onContinueGuest,
  onGoogleSignIn,
  isGoogleSigningIn,
  googleAuthError,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);
  const [formError, setFormError] = useState('');

  const handleSubmitNewAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      setFormError('يرجى إدخال الاسم الكامل.');
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFormError('يرجى إدخال بريد إلكتروني صحيح.');
      return;
    }
    setFormError('');
    onCreateAccount(trimmedName, trimmedEmail, selectedColor);
    setName('');
    setEmail('');
    setShowAddForm(false);
  };

  const getInitial = (accountName: string) => {
    const clean = accountName.trim();
    return clean ? clean.charAt(0).toUpperCase() : 'ن';
  };

  return (
    <div className="min-h-screen bg-[#F0F4F9] dark:bg-[#0E1117] flex flex-col items-center justify-center p-4 sm:p-6 transition-colors duration-200 relative">
      {/* Top-corner theme toggle */}
      <button
        type="button"
        onClick={onToggleTheme}
        aria-label={theme === 'dark' ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
        className="fixed top-5 left-5 p-2.5 rounded-full bg-white dark:bg-[#1f2024] text-[#444746] dark:text-[#e3e3e3] border border-[#dfe3e8] dark:border-[#3c4043] hover:bg-[#e8eaed] dark:hover:bg-[#2d2f34] transition-colors cursor-pointer shadow-xs"
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      {/* Main Google-style elevated account chooser card */}
      <main className="w-full max-w-[480px] bg-white dark:bg-[#1e1f23] rounded-[28px] shadow-[0_1px_3px_rgba(0,0,0,0.08),0_12px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.45)] border border-[#e3e6eb] dark:border-[#2e3035] overflow-hidden">
        <div className="px-7 pt-9 pb-7 sm:px-10 sm:pt-10 sm:pb-8">
          <div className="flex flex-col items-center text-center mb-7">
            <NovaLogo size="md" />
            <h1 className="mt-5 text-2xl font-bold text-[#1f1f1f] dark:text-[#e8eaed]">
              {showAddForm ? 'إضافة حساب جديد' : 'اختر حساباً'}
            </h1>
            <p className="mt-1.5 text-sm text-[#5f6368] dark:text-[#9aa0a6]">
              للمتابعة إلى محرك بحث نوفا (NOVA)
            </p>
          </div>

          {!showAddForm ? (
            <>
              {/* Official Google Sign-In Option */}
              <div className="mb-5 flex flex-col items-center">
                <button
                  type="button"
                  onClick={onGoogleSignIn}
                  disabled={isGoogleSigningIn}
                  className="gsi-material-button w-full max-w-none!"
                >
                  <div className="gsi-material-button-state" />
                  <div className="gsi-material-button-content-wrapper">
                    <div className="gsi-material-button-icon">
                      <svg
                        version="1.1"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 48 48"
                        style={{ display: 'block' }}
                      >
                        <path
                          fill="#EA4335"
                          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                        />
                        <path
                          fill="#4285F4"
                          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                        />
                        <path
                          fill="#34A853"
                          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                        />
                        <path fill="none" d="M0 0h48v48H0z" />
                      </svg>
                    </div>
                    <span className="gsi-material-button-contents">
                      {isGoogleSigningIn
                        ? 'جاري تسجيل الدخول بحساب Google...'
                        : 'تسجيل الدخول باستخدام Google (مع مزامنة Drive)'}
                    </span>
                  </div>
                </button>
                {googleAuthError && (
                  <p className="mt-2 text-xs text-[#d93025] dark:text-[#f28b82] text-center">
                    {googleAuthError}
                  </p>
                )}
              </div>

              <div className="relative my-4 flex items-center justify-center">
                <div className="w-full border-t border-[#e8eaed] dark:border-[#3c4043]" />
                <span className="px-3 bg-white dark:bg-[#1e1f23] text-xs text-[#5f6368] dark:text-[#9aa0a6] whitespace-nowrap">
                  أو اختر حساباً محفوظاً
                </span>
                <div className="w-full border-t border-[#e8eaed] dark:border-[#3c4043]" />
              </div>

              {/* Saved Accounts List */}
              <div className="divide-y divide-[#eef0f3] dark:divide-[#2e3035] border-y border-[#eef0f3] dark:border-[#2e3035]">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="group flex items-center justify-between gap-3 py-3.5 px-2 -mx-2 rounded-xl hover:bg-[#f5f8fd] dark:hover:bg-[#2a2c31] transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectAccount(acc)}
                      className="flex items-center gap-3.5 flex-1 min-w-0 text-right cursor-pointer focus:outline-none"
                    >
                      {acc.photoURL ? (
                        <img
                          src={acc.photoURL}
                          alt={acc.name}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-full object-cover shrink-0 border border-[#dfe3e8] dark:border-[#3c4043]"
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0"
                          style={{ backgroundColor: acc.avatarColor || '#4285F4' }}
                        >
                          {getInitial(acc.name)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-[#1f1f1f] dark:text-[#e8eaed] truncate">
                            {acc.name}
                          </span>
                          <span aria-hidden="true" className="text-[#9aa0a6]">
                            ·
                          </span>
                          <span className="text-xs font-medium text-[#188038] dark:text-[#81c995] whitespace-nowrap">
                            {acc.statusLabel}
                          </span>
                        </div>
                        <p dir="ltr" className="text-xs text-[#5f6368] dark:text-[#9aa0a6] truncate text-right">
                          {acc.email}
                        </p>
                      </div>
                    </button>

                    {accounts.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveAccount(acc.id);
                        }}
                        title="إزالة الحساب"
                        aria-label={`إزالة حساب ${acc.name}`}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-2 rounded-full text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#d93025] dark:hover:text-[#f28b82] hover:bg-[#fce8e6] dark:hover:bg-[#3c1e1e] transition-all cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}

                {/* Use another account row */}
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="w-full flex items-center gap-3.5 py-3.5 px-2 -mx-2 rounded-xl hover:bg-[#f5f8fd] dark:hover:bg-[#2a2c31] transition-colors cursor-pointer text-right"
                >
                  <div className="w-10 h-10 rounded-full bg-[#eef2f8] dark:bg-[#2d3036] text-[#444746] dark:text-[#e3e3e3] flex items-center justify-center shrink-0">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-[#1f1f1f] dark:text-[#e8eaed]">
                    استخدام حساب آخر
                  </span>
                </button>
              </div>

              {/* Continue as guest */}
              <div className="mt-5 pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={onContinueGuest}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium text-[#5f6368] dark:text-[#bdc1c6] hover:bg-[#f1f3f4] dark:hover:bg-[#2d2f34] transition-colors cursor-pointer"
                >
                  <VenetianMask className="w-4 h-4" />
                  <span>المتابعة كضيف (وضع التصفح الخفي)</span>
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleSubmitNewAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#5f6368] dark:text-[#bdc1c6] mb-1.5">
                  الاسم الكامل
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: أحمد محمد"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#dadce0] dark:border-[#5f6368] bg-white dark:bg-[#2a2c31] text-sm text-[#202124] dark:text-[#e8eaed] focus:outline-none focus:border-[#1a73e8] dark:focus:border-[#8ab4f8]"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5f6368] dark:text-[#bdc1c6] mb-1.5">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#dadce0] dark:border-[#5f6368] bg-white dark:bg-[#2a2c31] text-sm text-[#202124] dark:text-[#e8eaed] text-right focus:outline-none focus:border-[#1a73e8] dark:focus:border-[#8ab4f8]"
                />
              </div>

              <div>
                <span className="block text-xs font-medium text-[#5f6368] dark:text-[#bdc1c6] mb-2">
                  لون الصورة الرمزية
                </span>
                <div className="flex items-center gap-2.5">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedColor(c)}
                      aria-label={`اختيار اللون ${c}`}
                      className={`w-8 h-8 rounded-full transition-transform cursor-pointer ${
                        selectedColor === c
                          ? 'ring-2 ring-offset-2 ring-[#1a73e8] dark:ring-[#8ab4f8] dark:ring-offset-[#1e1f23] scale-110'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {formError && (
                <p className="text-xs text-[#d93025] dark:text-[#f28b82]">{formError}</p>
              )}

              <div className="flex items-center justify-between gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setFormError('');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-[#1a73e8] dark:text-[#8ab4f8] hover:bg-[#f1f6fe] dark:hover:bg-[#283142] transition-colors cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>رجوع</span>
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full text-sm font-medium bg-[#1a73e8] hover:bg-[#1557b0] dark:bg-[#8ab4f8] dark:hover:bg-[#aecbfa] text-white dark:text-[#202124] transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>حفظ والدخول</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </main>

      <footer className="mt-6 text-xs text-[#5f6368] dark:text-[#9aa0a6] flex items-center gap-4">
        <span>NOVA | نوفا للبحث الذكي</span>
        <span aria-hidden="true">·</span>
        <span>الخصوصية والحسابات</span>
      </footer>
    </div>
  );
};
