import React from 'react';

interface TStreamLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  variant?: 'full' | 'emblem';
}

export const TStreamLogo: React.FC<TStreamLogoProps> = ({
  className = '',
  size = 'md',
  variant = 'full'
}) => {
  const heights = {
    sm: 'h-6',
    md: 'h-8 sm:h-9',
    lg: 'h-10 sm:h-12'
  };

  if (variant === 'emblem') {
    return (
      <img
        src="/icon.png"
        alt="T Stream"
        className={`${heights[size]} w-auto object-contain select-none drop-shadow-md ${className}`}
        loading="eager"
      />
    );
  }

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      <img
        src="/logo.png"
        alt="T Stream — Watch Movies & TV Shows Online Free"
        className={`${heights[size]} w-auto object-contain max-w-[200px] sm:max-w-[240px] drop-shadow-md`}
        loading="eager"
        onError={(e) => {
          // Fallback to local image if root path fails
          (e.currentTarget as HTMLImageElement).src = '/assets/aistudio/tstream-logo-yellow-transparent_1__d41aea4b.png';
        }}
      />
    </div>
  );
};
