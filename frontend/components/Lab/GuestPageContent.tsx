"use client";

import Script from "next/script";
import GuestPopup from "./GuestPopup";
import Header from "./Header";
import StatusBar from "./StatusBar";
import ResultsHeader from "./ResultsHeader";
import LabsGrid from "./LabsGrid";
import { LabProfile } from "../../lib/types";

interface GuestPageContentProps {
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
  showGuestPopup: boolean;
  setShowGuestPopup: (value: boolean) => void;
  recaptchaToken: string;
  recaptchaError: string;
  searchStatus: string;
  searchResults: LabProfile[];
  displayData: LabProfile[];
  selectedType: string;
  setSelectedType: (type: string) => void;
  setIsAuthPromptOpen: (open: boolean) => void;
  setAuthAction: (action: string) => void;
  // New filter props
  sortBy: string;
  setSortBy: (value: string) => void;
  countryFilter: string;
  setCountryFilter: (value: string) => void;
  sectorFilter: string;
  setSectorFilter: (value: string) => void;
}

export default function GuestPageContent({
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
  showGuestPopup,
  setShowGuestPopup,
  recaptchaToken,
  recaptchaError,
  searchStatus,
  searchResults,
  displayData,
  selectedType,
  setSelectedType,
  setIsAuthPromptOpen,
  setAuthAction,
  sortBy,
  setSortBy,
  countryFilter,
  setCountryFilter,
  sectorFilter,
  setSectorFilter,
}: GuestPageContentProps) {
  return (
    <>
      <GuestPopup
        isDark={isDark}
        showGuestPopup={showGuestPopup}
        setShowGuestPopup={setShowGuestPopup}
        recaptchaToken={recaptchaToken}
        recaptchaError={recaptchaError}
      />
      <Script src="https://www.google.com/recaptcha/api.js" strategy="afterInteractive" />
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
          handleViewLabs={() => {}}
          handleLogout={() => {}}
          sortBy={sortBy}
          setSortBy={setSortBy}
          countryFilter={countryFilter}
          setCountryFilter={setCountryFilter}
          sectorFilter={sectorFilter}
          setSectorFilter={setSectorFilter}
        />
        <main className="flex-1 overflow-y-auto w-full h-0 min-h-0">
          <StatusBar searchStatus={searchStatus} isDark={isDark} />
          <ResultsHeader
            searchResults={searchResults}
            searchQuery={searchQuery}
            isDark={isDark}
            clearSearch={clearSearch}
          />
          <LabsGrid
            displayData={displayData}
            isDark={isDark}
            clearSearch={clearSearch}
            setShowInquiryModal={() => {}}
            setSingleLabId={() => {}}
            isAuthenticated={false}
            setIsAuthPromptOpen={setIsAuthPromptOpen}
            setAuthAction={setAuthAction}
          />
        </main>
      </div>
      <Script id="recaptcha-callback" strategy="afterInteractive">{`
        window.onRecaptchaSuccess = function(token) {
          const event = new CustomEvent('recaptcha-success', { detail: token });
          window.dispatchEvent(event);
        };
      `}</Script>
      <Script id="recaptcha-listener" strategy="afterInteractive">{`
        window.addEventListener('recaptcha-success', function(e) {
          if (e.detail) {
            const reactSetToken = (window as any).__setRecaptchaToken;
            if (typeof reactSetToken === 'function') reactSetToken(e.detail);
          }
        });
      `}</Script>
    </>
  );
}