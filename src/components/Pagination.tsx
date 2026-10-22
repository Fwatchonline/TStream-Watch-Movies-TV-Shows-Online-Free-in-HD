import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className = ''
}) => {
  // If only 1 page, don't show pagination controls
  if (totalPages <= 1) return null;

  const safeCurrent = Math.max(1, Math.min(currentPage, totalPages));

  // Generate page numbers with intelligent ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const delta = 2; // How many pages around current to show

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= safeCurrent - delta && i <= safeCurrent + delta)
      ) {
        pages.push(i);
      } else if (
        (i === safeCurrent - delta - 1 && i > 1) ||
        (i === safeCurrent + delta + 1 && i < totalPages)
      ) {
        pages.push('...');
      }
    }

    // Filter consecutive duplicate ellipsis
    return pages.filter((page, index) => {
      if (page === '...' && pages[index - 1] === '...') return false;
      return true;
    });
  };

  const pageNumbers = getPageNumbers();

  const handlePageClick = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== safeCurrent) {
      onPageChange(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <nav
      aria-label="Catalogue pagination"
      className={`flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 my-8 ${className}`}
    >
      {/* First Page button for wide screens */}
      <button
        onClick={() => handlePageClick(1)}
        disabled={safeCurrent <= 1}
        className="hidden sm:inline-flex items-center justify-center h-10 px-2.5 rounded-lg border border-white/10 bg-[#141418] text-slate-300 hover:text-white hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs font-medium"
        title="First Page"
      >
        <ChevronsLeft className="w-4 h-4" />
      </button>

      {/* Previous Page */}
      <button
        onClick={() => handlePageClick(safeCurrent - 1)}
        disabled={safeCurrent <= 1}
        className="inline-flex items-center justify-center h-10 px-3 sm:px-4 rounded-lg border border-white/10 bg-[#141418] text-slate-300 hover:text-white hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs font-semibold gap-1"
        aria-label="Previous Page"
      >
        <ChevronLeft className="w-4 h-4" />
        <span className="hidden sm:inline">Previous</span>
      </button>

      {/* Numbered Page Buttons */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        {pageNumbers.map((page, idx) => {
          if (page === '...') {
            return (
              <span
                key={`ellipsis-${idx}`}
                className="w-8 sm:w-10 h-10 flex items-center justify-center text-xs text-slate-500 font-mono select-none"
              >
                ...
              </span>
            );
          }

          const pageNum = Number(page);
          const isActive = pageNum === safeCurrent;

          return (
            <button
              key={`page-${pageNum}`}
              onClick={() => handlePageClick(pageNum)}
              aria-current={isActive ? 'page' : undefined}
              className={`w-9 sm:w-10 h-10 rounded-lg text-xs font-bold transition-all duration-150 tabular-nums cursor-pointer ${
                isActive
                  ? 'bg-[#F5C400] text-black font-extrabold shadow-lg shadow-amber-500/20 scale-105'
                  : 'bg-[#29292D] border border-[#3A3A40] text-[#A6A6AC] hover:text-white hover:border-[#F5C400]'
              }`}
            >
              {pageNum}
            </button>
          );
        })}
      </div>

      {/* Next Page */}
      <button
        onClick={() => handlePageClick(safeCurrent + 1)}
        disabled={safeCurrent >= totalPages}
        className="inline-flex items-center justify-center h-10 px-3 sm:px-4 rounded-lg border border-white/10 bg-[#141418] text-slate-300 hover:text-white hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs font-semibold gap-1"
        aria-label="Next Page"
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Last Page button for wide screens */}
      <button
        onClick={() => handlePageClick(totalPages)}
        disabled={safeCurrent >= totalPages}
        className="hidden sm:inline-flex items-center justify-center h-10 px-2.5 rounded-lg border border-white/10 bg-[#141418] text-slate-300 hover:text-white hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs font-medium"
        title="Last Page"
      >
        <ChevronsRight className="w-4 h-4" />
      </button>

      {/* Page count indicator */}
      <div className="w-full sm:w-auto text-center mt-2 sm:mt-0 sm:ml-3 text-[11px] text-slate-500 font-medium tabular-nums">
        Page {safeCurrent} of {totalPages}
      </div>
    </nav>
  );
};
