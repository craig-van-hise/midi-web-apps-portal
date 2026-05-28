import React from 'react';

export const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center font-sans">
      {/* Backdrop overlay */}
      <div 
        className="absolute inset-0 bg-black/30 rounded-lg backdrop-blur-xs cursor-default" 
        onClick={onClose} 
        data-testid="modal-overlay"
      />
      {/* Modal Container */}
      <div className="relative w-[340px] bg-white rounded-lg shadow-xl p-4 border border-neutral-100 flex flex-col gap-3 text-left z-50">
        <div className="flex justify-between items-center pb-1.5 border-b border-neutral-150">
          <span className="text-[12px] font-bold text-gray-500 uppercase tracking-wider">{title}</span>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 font-bold text-lg leading-none cursor-pointer"
            aria-label="Close settings"
            data-testid="modal-close-button"
          >
            &times;
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {children}
        </div>
      </div>
    </div>
  );
};
