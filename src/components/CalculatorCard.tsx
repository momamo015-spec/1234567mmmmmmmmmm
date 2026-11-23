import React, { useEffect, useState } from 'react';
import { Calculator } from 'lucide-react';
import { evaluateMathQuery } from '../lib/searchHelpers';

interface CalculatorCardProps {
  initialExpression?: string;
  initialResult?: string;
}

const KEYS = [
  ['(', ')', '%', 'C'],
  ['7', '8', '9', '/'],
  ['4', '5', '6', '*'],
  ['1', '2', '3', '-'],
  ['0', '.', '=', '+'],
];

export const CalculatorCard: React.FC<CalculatorCardProps> = ({
  initialExpression = '',
  initialResult = '',
}) => {
  const [expr, setExpr] = useState(initialExpression);
  const [display, setDisplay] = useState(initialResult || '0');

  useEffect(() => {
    if (initialExpression) {
      setExpr(initialExpression);
      setDisplay(initialResult || '0');
    }
  }, [initialExpression, initialResult]);

  const handlePress = (key: string) => {
    if (key === 'C') {
      setExpr('');
      setDisplay('0');
      return;
    }
    if (key === '=') {
      const evaluated = evaluateMathQuery(expr);
      if (evaluated) {
        setDisplay(evaluated.result);
      } else {
        setDisplay('خطأ');
      }
      return;
    }
    const next = expr + key;
    setExpr(next);
    const live = evaluateMathQuery(next);
    if (live) {
      setDisplay(live.result);
    }
  };

  return (
    <div className="mb-6 rounded-2xl border border-[#dadce0] dark:border-[#3c4043] bg-white dark:bg-[#28292c] p-5 max-w-md">
      <div className="flex items-center justify-between mb-3 text-xs text-[#5f6368] dark:text-[#9aa0a6]">
        <div className="flex items-center gap-2 font-medium">
          <Calculator className="w-4 h-4 text-[#1a73e8] dark:text-[#8ab4f8]" />
          <span>الآلة الحاسبة الفورية</span>
        </div>
      </div>

      <div
        dir="ltr"
        className="rounded-xl border border-[#e8eaed] dark:border-[#3c4043] bg-[#f8f9fa] dark:bg-[#202124] px-4 py-3 mb-3 text-right"
      >
        <div className="text-xs font-mono tabular-nums text-[#5f6368] dark:text-[#9aa0a6] min-h-[18px] truncate">
          {expr || ' '}
        </div>
        <div className="text-2xl font-mono font-semibold tabular-nums text-[#202124] dark:text-[#e8eaed] mt-0.5 truncate">
          {display}
        </div>
      </div>

      <div dir="ltr" className="grid grid-cols-4 gap-2">
        {KEYS.flat().map((k) => {
          const isEquals = k === '=';
          const isOp = ['/', '*', '-', '+', '(', ')', '%', 'C'].includes(k);
          return (
            <button
              key={k}
              type="button"
              onClick={() => handlePress(k)}
              className={`h-10 rounded-xl font-mono tabular-nums text-sm font-semibold transition-colors cursor-pointer ${
                isEquals
                  ? 'bg-[#1a73e8] hover:bg-[#1557b0] dark:bg-[#8ab4f8] dark:hover:bg-[#aecbfa] text-white dark:text-[#202124]'
                  : isOp
                    ? 'bg-[#e8eaed] hover:bg-[#dadce0] dark:bg-[#3c4043] dark:hover:bg-[#4b4f53] text-[#202124] dark:text-[#e8eaed]'
                    : 'bg-[#f1f3f4] hover:bg-[#e8eaed] dark:bg-[#303134] dark:hover:bg-[#3c4043] text-[#202124] dark:text-[#e8eaed]'
              }`}
            >
              {k}
            </button>
          );
        })}
      </div>
    </div>
  );
};
