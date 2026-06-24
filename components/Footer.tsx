import React from 'react';

interface FooterProps {
  className?: string;
}

export const Footer: React.FC<FooterProps> = ({ className = '' }) => {
  const year = new Date().getFullYear();

  return (
    <footer className={`py-4 sm:py-6 border-t border-orange-100/50 ${className}`}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-2">
          <p className="text-xs text-gray-400">
            © {year} 언제갈래? All rights reserved.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-gray-400">
            <span>기획: Jay, Shin</span>
            <span className="hidden sm:inline">•</span>
            <a
              href="mailto:kdshin@freshmilk.kr"
              className="hover:text-orange-500 transition-colors"
            >
              kdshin@freshmilk.kr
            </a>
            <span className="hidden sm:inline">•</span>
            <a
              href="https://forms.gle/MiUa2TrigEMbtbAN8"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-500 hover:text-orange-600 transition-colors underline"
            >
              💬 피드백 보내기
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
