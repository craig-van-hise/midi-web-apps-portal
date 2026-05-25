interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div 
        className="absolute inset-0"
        onClick={onClose}
      />
      
      <div
        className="relative z-[100] bg-white dark:bg-[#1a1a1a] rounded-lg p-6 w-full max-w-sm shadow-2xl border border-gray-200 dark:border-gray-800"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold dark:text-white">MIDI Chord Notator</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-bold dark:text-gray-300">by Craig Van Hise</p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              A real-time MIDI notation and visualization tool.
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-white/5">
            <a 
              href="https://www.virtualvirgin.net/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-sm text-[#aa3bff] hover:underline"
            >
              www.virtualvirgin.net
            </a>
            <a 
              href="https://github.com/craig-van-hise" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-sm text-[#aa3bff] hover:underline"
            >
              github.com/craig-van-hise
            </a>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              onClick={onClose}
              className="bg-[#aa3bff] hover:bg-[#9226e6] text-white px-6 py-2 rounded-lg font-bold transition-colors shadow-lg shadow-[#aa3bff]/20"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InfoModal;
