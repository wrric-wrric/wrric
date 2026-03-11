interface SuggestionsSectionProps {
  suggestions: string[];
  handleNewQuery: (query: string) => void;
  isDark: boolean;
}

export default function SuggestionsSection({ suggestions, handleNewQuery, isDark }: SuggestionsSectionProps) {
  if (suggestions.length === 0) return null;

  return (
    <section className="px-4 py-4 border-t">
      <h3 className={`text-sm font-medium mb-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
        Related Searches
      </h3>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => handleNewQuery(suggestion)}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              isDark
                ? "bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </section>
  );
}