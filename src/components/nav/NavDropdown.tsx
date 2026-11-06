import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, LucideIcon } from 'lucide-react';

interface NavDropdownProps {
  label: string;
  icon?: LucideIcon;
  badge?: string;
  badgeColor?: string;
  isActive?: boolean;
  align?: 'left' | 'right' | 'center';
  widthClass?: string;
  onLabelClick?: () => void;
  children: (close: () => void) => React.ReactNode;
}

export const NavDropdown: React.FC<NavDropdownProps> = ({
  label,
  icon: Icon,
  badge,
  badgeColor = 'bg-red-600 text-white',
  isActive = false,
  align = 'left',
  widthClass = 'w-64',
  onLabelClick,
  children
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsOpen(true);
    }, 120);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(prev => !prev);
  };

  const closeDropdown = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(false);
  };

  // Close on Click Outside or Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDropdown();
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const alignmentClass =
    align === 'center'
      ? 'left-1/2 -translate-x-1/2'
      : align === 'right'
      ? 'right-0'
      : 'left-0';

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative select-none"
    >
      {/* Trigger Pill */}
      <div
        className={`flex items-center rounded-lg text-xs font-semibold tracking-tight transition-all duration-200 ${
          isOpen || isActive
            ? 'text-[#F5C400] bg-[#303036]/80 border border-[#F5C400]/40 shadow-sm'
            : 'text-[#E5E5EA] hover:text-[#F5C400] hover:bg-[#303036]/40 border border-transparent'
        }`}
      >
        <button
          type="button"
          onClick={(e) => {
            if (onLabelClick) {
              closeDropdown();
              onLabelClick();
            } else {
              handleToggle(e);
            }
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer text-inherit focus:outline-none"
        >
          {Icon && <Icon className="w-3.5 h-3.5 text-[#F5C400] shrink-0" />}
          <span>{label}</span>

          {badge && (
            <span className={`px-1.5 py-0.2 rounded-full text-[8px] font-black uppercase tracking-wider ${badgeColor}`}>
              {badge}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={isOpen}
          aria-haspopup="true"
          aria-label={`Toggle ${label} menu`}
          className="pr-2 py-1.5 pl-0.5 text-[#8E8E93] hover:text-[#F5C400] transition-colors cursor-pointer focus:outline-none"
        >
          <ChevronDown
            className={`w-3 h-3 transition-transform duration-200 shrink-0 ${
              isOpen ? 'rotate-180 text-[#F5C400]' : ''
            }`}
          />
        </button>
      </div>

      {/* Dropdown Container */}
      {isOpen && (
        <div
          className={`absolute top-full mt-2 ${alignmentClass} ${widthClass} z-50 rounded-2xl bg-[#1e1e24] border border-[#3A3A40] shadow-[0_20px_50px_rgba(0,0,0,0.85)] p-2 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/40`}
        >
          {children(closeDropdown)}
        </div>
      )}
    </div>
  );
};
