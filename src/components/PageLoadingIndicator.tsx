import React from 'react';

interface PageLoadingIndicatorProps {
  label?: string;
  minHeight?: string;
}

export const PageLoadingIndicator: React.FC<PageLoadingIndicatorProps> = ({
  label = 'Loading...',
  minHeight = 'min-h-[50vh]'
}) => {
  return (
    <div className={`w-full ${minHeight} flex flex-col items-center justify-center p-8 text-center select-none`}>
      <div className="relative w-9 h-9 mb-3">
        {/* Subtle ambient glow */}
        <div className="absolute inset-0 rounded-full bg-[#F5C400]/20 blur-md pointer-events-none" />
        {/* Clean spinner ring */}
        <div className="w-full h-full border-2 border-[#3A3A40] border-t-[#F5C400] rounded-full animate-spin" />
      </div>
      <p className="text-xs text-[#A6A6AC] font-medium tracking-wide">
        {label}
      </p>
    </div>
  );
};
