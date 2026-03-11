"use client";

import { FlaskConical } from "lucide-react";
import LabCard from "./LabCard";
import { LabProfile } from "../../lib/types";

interface LabsGridProps {
  displayData: LabProfile[];
  isDark: boolean;
  clearSearch: () => void;
  selectedLabs?: string[];
  setSelectedLabs?: (labs: string[]) => void;
  setShowInquiryModal?: (show: boolean) => void;
  setSingleLabId?: (id: string | null) => void;
  isAuthenticated: boolean;
  setIsAuthPromptOpen?: (open: boolean) => void;
  setAuthAction?: (action: string) => void;
}

export default function LabsGrid({
  displayData,
  isDark,
  clearSearch,
  selectedLabs,
  setSelectedLabs,
  setShowInquiryModal,
  setSingleLabId,
  isAuthenticated,
  setIsAuthPromptOpen,
  setAuthAction,
}: LabsGridProps) {
  return (
    <section className="w-full mx-auto px-4 py-4">
      {displayData.length === 0 ? (
        <div className={`flex flex-col items-center justify-center h-48 text-center ${
          isDark ? "text-gray-500" : "text-gray-400"
        }`}>
          <FlaskConical className="w-12 h-12 mb-3" />
          <p className="text-sm">No labs found</p>
          <button
            onClick={clearSearch}
            className="mt-2 text-[#00FB75] hover:underline text-sm"
          >
            Browse all labs
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
          {displayData.map((lab) => (
            <LabCard
              key={lab.id}
              lab={lab}
              isDark={isDark}
              selectedLabs={selectedLabs}
              setSelectedLabs={setSelectedLabs}
              setShowInquiryModal={setShowInquiryModal || (() => {})}
              setSingleLabId={setSingleLabId || (() => {})}
              isAuthenticated={isAuthenticated}
              setIsAuthPromptOpen={setIsAuthPromptOpen}
              setAuthAction={setAuthAction}
              likeCount={(lab as any).like_count || 0}
              commentCount={(lab as any).comment_count || 0}
              shareCount={(lab as any).share_count || 0}
            />
          ))}
        </div>
      )}
    </section>
  );
}