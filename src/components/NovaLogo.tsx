import React from 'react';

interface NovaLogoProps {
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  showArabicSubtitle?: boolean;
}

export const NovaLogo: React.FC<NovaLogoProps> = ({
  size = 'lg',
  onClick,
  showArabicSubtitle = true,
}) => {
  const letters = [
    { char: 'N', color: 'text-[#4285F4]' },
    { char: 'O', color: 'text-[#EA4335]' },
    { char: 'V', color: 'text-[#FBBC05]' },
    { char: 'A', color: 'text-[#34A853]' },
  ];

  const sizeClasses = {
    sm: 'text-2xl tracking-tight',
    md: 'text-4xl tracking-tight',
    lg: 'text-6xl sm:text-7xl tracking-tight',
  }[size];

  const subSizeClasses = {
    sm: 'text-xs font-semibold',
    md: 'text-sm font-semibold',
    lg: 'text-lg sm:text-xl font-bold',
  }[size];

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`inline-flex items-baseline gap-2.5 select-none ${
        onClick ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4285F4] rounded-lg px-1' : ''
      }`}
      aria-label="NOVA | نوفا"
    >
      <span dir="ltr" className={`font-display font-bold leading-none ${sizeClasses}`}>
        {letters.map((l, idx) => (
          <span key={idx} className={l.color}>
            {l.char}
          </span>
        ))}
      </span>
      {showArabicSubtitle && (
        <span
          className={`font-display ${subSizeClasses} text-[#5f6368] dark:text-[#bdc1c6] whitespace-nowrap`}
        >
          نوفا
        </span>
      )}
    </Wrapper>
  );
};
