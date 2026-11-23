import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'حدث خطأ غير متوقع في التطبيق.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('NOVA ErrorBoundary caught:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen flex items-center justify-center bg-[#F0F4F9] dark:bg-[#0E1117] p-6"
        >
          <div className="max-w-md w-full bg-white dark:bg-[#1f2024] rounded-3xl p-8 border border-[#e0e2e7] dark:border-[#3c4043] text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-[#fce8e6] dark:bg-[#3c1e1e] text-[#c5221f] dark:text-[#f28b82] flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-[#202124] dark:text-[#e8eaed] mb-2">
              حدث خطأ غير متوقع
            </h2>
            <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mb-6 leading-relaxed break-words">
              {this.state.errorMessage.startsWith('{')
                ? 'تعذر إتمام عملية مزامنة البيانات السحابية. يمكنك المتابعة أو إعادة المحاولة.'
                : this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white text-sm font-medium transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة تحميل الواجهة</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
