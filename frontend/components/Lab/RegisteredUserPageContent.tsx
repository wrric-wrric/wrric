"use client";

import Header from "./Header";
import StatusBar from "./StatusBar";
import ResultsHeader from "./ResultsHeader";
import LabsGrid from "./LabsGrid";
import SuggestionsSection from "./SuggestionsSection";
import InquiryModal from "./InquiryModal";
import BroadcastInquiryModal from "./BroadcastInquiryModal";
import FeedbackModal from "./FeedbackModal";
import { LabProfile } from "../../lib/types";

interface Session {
  id: string;
  title: string;
  start_time: string;
  queries: { query_text: string; timestamp: string }[];
  entities: LabProfile[];
}

interface RegisteredUserPageContentProps {
  isDark: boolean;
  searchQuery: string;
  isSearching: boolean;
  filterType: string;
  setFilterType: (value: string) => void;
  handleSearchChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSearchSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  clearSearch: () => void;
  onCancelExternal: () => void;
  onSearchInitiate: () => void;
  handleAddLabClick: () => void;
  searchStatus: string;
  searchResults: LabProfile[];
  displayData: LabProfile[];
  selectedType: string;
  setSelectedType: (type: string) => void;
  history: Session[];
  loadSession: (session: Session) => void;
  currentSession: Session | null;
  selectedLabs: string[];
  setSelectedLabs: (labs: string[]) => void;
  showBroadcastModal: boolean;
  setShowBroadcastModal: (show: boolean) => void;
  inquiryText: string;
  setInquiryText: (text: string) => void;
  handleBroadcastSubmit: () => void;
  showFeedbackModal: boolean;
  setShowFeedbackModal: (show: boolean) => void;
  feedbackText: string;
  setFeedbackText: (text: string) => void;
  handleFeedbackSubmit: () => void;
  showInquiryModal: boolean;
  setShowInquiryModal: (show: boolean) => void;
  singleLabId: string | null;
  setSingleLabId: (id: string | null) => void;
  handleInquirySubmit: () => void;
  handleViewLabs: () => void;
  handleLogout: () => void;
  // New filter props
  sortBy: string;
  setSortBy: (value: string) => void;
  countryFilter: string;
  setCountryFilter: (value: string) => void;
  sectorFilter: string;
  setSectorFilter: (value: string) => void;
}

export default function RegisteredUserPageContent({
  isDark,
  searchQuery,
  isSearching,
  filterType,
  setFilterType,
  handleSearchChange,
  handleSearchSubmit,
  clearSearch,
  onCancelExternal,
  onSearchInitiate,
  handleAddLabClick,
  searchStatus,
  searchResults,
  displayData,
  selectedType,
  setSelectedType,
  history,
  loadSession,
  currentSession,
  selectedLabs,
  setSelectedLabs,
  showBroadcastModal,
  setShowBroadcastModal,
  inquiryText,
  setInquiryText,
  handleBroadcastSubmit,
  showFeedbackModal,
  setShowFeedbackModal,
  feedbackText,
  setFeedbackText,
  handleFeedbackSubmit,
  showInquiryModal,
  setShowInquiryModal,
  singleLabId,
  setSingleLabId,
  handleInquirySubmit,
  handleViewLabs,
  handleLogout,
  sortBy,
  setSortBy,
  countryFilter,
  setCountryFilter,
  sectorFilter,
  setSectorFilter,
}: RegisteredUserPageContentProps) {
  const handleNewQuery = (query: string) => {
    handleSearchChange({ target: { value: query } } as React.ChangeEvent<HTMLTextAreaElement>);
    onSearchInitiate();
  };

  return (
    <div className={`h-screen flex flex-col w-full overflow-hidden ${isDark ? "bg-black text-white" : "bg-gray-50 text-gray-900"}`}>
      <Header
        isDark={isDark}
        searchQuery={searchQuery}
        isSearching={isSearching}
        filterType={filterType}
        setFilterType={setFilterType}
        handleSearchChange={handleSearchChange}
        handleSearchSubmit={handleSearchSubmit}
        clearSearch={clearSearch}
        onCancelExternal={onCancelExternal}
        onSearchInitiate={onSearchInitiate}
        handleAddLabClick={handleAddLabClick}
        selectedType={selectedType}
        setSelectedType={setSelectedType}
        handleViewLabs={handleViewLabs}
        handleLogout={handleLogout}
        sortBy={sortBy}
        setSortBy={setSortBy}
        countryFilter={countryFilter}
        setCountryFilter={setCountryFilter}
        sectorFilter={sectorFilter}
        setSectorFilter={setSectorFilter}
      />
      <main className="flex-1 overflow-y-auto w-full h-0 min-h-0">
        {selectedLabs.length > 0 && (
          <div className="px-4 py-2 border-b">
            <div className="flex items-center justify-between">
              <span className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                {selectedLabs.length} selected
              </span>
              <button
                onClick={() => setShowBroadcastModal(true)}
                className="px-3 py-1.5 bg-[#00FB75] text-black font-medium rounded hover:bg-green-400 transition-colors text-sm"
              >
                Send Broadcast Inquiry
              </button>
            </div>
          </div>
        )}
        <StatusBar searchStatus={searchStatus} isDark={isDark} />
        <ResultsHeader
          searchResults={searchResults}
          searchQuery={searchQuery}
          isDark={isDark}
          clearSearch={clearSearch}
        />
        {currentSession && (
          <div className="px-4 py-2 border-b">
            <h3 className="text-sm font-medium mb-1">Session: {currentSession.title}</h3>
          </div>
        )}
        <LabsGrid
          displayData={displayData}
          isDark={isDark}
          clearSearch={clearSearch}
          selectedLabs={selectedLabs}
          setSelectedLabs={setSelectedLabs}
          setShowInquiryModal={setShowInquiryModal}
          setSingleLabId={setSingleLabId}
          isAuthenticated={true}
        />
        <SuggestionsSection
          suggestions={[]}
          handleNewQuery={handleNewQuery}
          isDark={isDark}
        />
      </main>
      <InquiryModal
        showInquiryModal={showInquiryModal}
        setShowInquiryModal={setShowInquiryModal}
        inquiryText={inquiryText}
        setInquiryText={setInquiryText}
        handleInquirySubmit={handleInquirySubmit}
        labId={singleLabId}
      />
      <BroadcastInquiryModal
        showBroadcastModal={showBroadcastModal}
        setShowBroadcastModal={setShowBroadcastModal}
        inquiryText={inquiryText}
        setInquiryText={setInquiryText}
        handleBroadcastSubmit={handleBroadcastSubmit}
        selectedLabs={selectedLabs}
        displayData={displayData}
      />
      <FeedbackModal
        showFeedbackModal={showFeedbackModal}
        setShowFeedbackModal={setShowFeedbackModal}
        feedbackText={feedbackText}
        setFeedbackText={setFeedbackText}
        handleFeedbackSubmit={handleFeedbackSubmit}
      />
    </div>
  );
}