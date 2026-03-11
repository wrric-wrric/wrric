"use client";

interface FilterButtonsProps {
  filterType: string;
  setFilterType: (value: string) => void;
  isDark: boolean;
}

export default function FilterButtons({ filterType, setFilterType, isDark }: FilterButtonsProps) {
  const filters = [
    { value: "all", label: "All Labs" },
    { value: "pending", label: "AI Discovered" },
    { value: "completed", label: "Verified Labs" },
  ];

  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-opacity-50">
      {filters.map((filter) => (
        <button
          key={filter.value}
          onClick={() => setFilterType(filter.value)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
            filterType === filter.value
              ? isDark
                ? "bg-[#00FB75] text-black"
                : "bg-[#00FB75] text-black"
              : isDark
              ? "text-gray-400 hover:text-white hover:bg-gray-800"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
