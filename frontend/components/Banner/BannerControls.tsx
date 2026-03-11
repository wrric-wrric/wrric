import { ChevronLeft, ChevronRight } from 'lucide-react';

interface BannerControlsProps {
  count: number;
  currentIndex: number;
  onDotClick: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
  isDark: boolean;
}

export default function BannerControls({
  count,
  currentIndex,
  onDotClick,
  onPrev,
  onNext,
  isDark,
}: BannerControlsProps) {
  if (count <= 1) return null;

  return (
    <div className="flex items-center gap-3">
      {/* Previous Button */}
      <button
        onClick={onPrev}
        className={`p-1.5 rounded-full transition-colors ${
          isDark
            ? 'bg-gray-800 hover:bg-gray-700'
            : 'bg-gray-100 hover:bg-gray-200'
        }`}
        aria-label="Previous slide"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Dots */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: count }).map((_, index) => (
          <button
            key={index}
            onClick={() => onDotClick(index)}
            className={`w-1.5 h-1.5 rounded-full transition-all ${
              index === currentIndex
                ? 'bg-[#00FB75] w-6'
                : isDark
                ? 'bg-gray-700 hover:bg-gray-600'
                : 'bg-gray-300 hover:bg-gray-400'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Next Button */}
      <button
        onClick={onNext}
        className={`p-1.5 rounded-full transition-colors ${
          isDark
            ? 'bg-gray-800 hover:bg-gray-700'
            : 'bg-gray-100 hover:bg-gray-200'
        }`}
        aria-label="Next slide"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}