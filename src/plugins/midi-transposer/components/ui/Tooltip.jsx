import React from 'react';

export const Tooltip = ({ content, children }) => {
  return (
    <div className="relative group inline-block w-full">
      {children}
      <div 
        className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block bg-neutral-900 text-white text-[11px] font-normal leading-tight py-1.5 px-2.5 rounded shadow-md z-50 w-[200px] text-center pointer-events-none"
        data-testid="tooltip-content"
      >
        {content}
        {/* Tooltip Arrow */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-neutral-900" />
      </div>
    </div>
  );
};
