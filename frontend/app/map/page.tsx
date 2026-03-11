"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { LabProfile } from "@/lib/types";
import LabList from "./LabList";
import D3LabMap from "./D3LabMap";
import { Search, Layers, List, X, ChevronRight, Building2, Filter, ChevronDown } from "lucide-react";

export interface MapPartner {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  sector_focus: string[];
  organization_type: string | null;
  lab_count: number;
  is_verified: boolean;
}

export default function LabsMapPage() {
  const [labs, setLabs] = useState<LabProfile[]>([]);
  const [partners, setPartners] = useState<MapPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLab, setSelectedLab] = useState<LabProfile | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<MapPartner | null>(null);
  const [hoveredLab, setHoveredLab] = useState<LabProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showPartners, setShowPartners] = useState(true);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const [showLabList, setShowLabList] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showScopeDropdown, setShowScopeDropdown] = useState(false);
  const { theme, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark" || theme === "dark";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [labsRes, partnersRes] = await Promise.all([
        fetch("/api/labs"),
        fetch("/api/partners/map"),
      ]);
      if (!labsRes.ok) throw new Error(`Failed to fetch labs: ${labsRes.status}`);
      const labsData = await labsRes.json();
      setLabs(labsData);

      if (partnersRes.ok) {
        const partnersData = await partnersRes.json();
        setPartners(Array.isArray(partnersData) ? partnersData : []);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const labsWithLocation = useMemo(() =>
    labs.filter(lab => lab.location?.latitude && lab.location?.longitude),
    [labs]
  );

  const labsWithoutLocation = useMemo(() =>
    labs.filter(lab => !lab.location?.latitude || !lab.location?.longitude),
    [labs]
  );

  const isInAfrica = (lat: number, lon: number) => {
    return lat >= -35 && lat <= 38 && lon >= -25 && lon <= 60;
  };

  const labsInAfrica = useMemo(() =>
    labsWithLocation.filter(lab => isInAfrica(lab.location!.latitude!, lab.location!.longitude!)),
    [labsWithLocation]
  );

  const partnersInAfrica = useMemo(() =>
    partners.filter(p => isInAfrica(p.latitude, p.longitude)),
    [partners]
  );

  const uniqueScopes = useMemo(() => {
    const scopesSet = new Set<string>();
    labsInAfrica.forEach(lab => {
      lab.scopes?.forEach(scope => scopesSet.add(scope || "Unspecified"));
    });
    return Array.from(scopesSet).sort();
  }, [labsInAfrica]);

  const filteredLabs = useMemo(() => {
    return labsInAfrica.filter(lab => {
      const matchesSearch =
        lab.university?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lab.department?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lab.location?.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lab.scopes?.some(scope => scope?.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesScope = selectedScopes.length === 0 ||
        lab.scopes?.some(scope => selectedScopes.includes(scope || "Unspecified"));
      return matchesSearch && matchesScope;
    });
  }, [labsInAfrica, searchTerm, selectedScopes]);

  const countryStats = useMemo(() => {
    const countries: Record<string, number> = {};
    labsInAfrica.forEach(lab => {
      const country = lab.location?.country || "Unknown";
      countries[country] = (countries[country] || 0) + 1;
    });
    return Object.entries(countries)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [labsInAfrica]);

  const toggleScope = (scope: string) => {
    setSelectedScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    );
  };

  const handleLabSelect = (lab: LabProfile) => {
    setSelectedLab(lab);
    setSelectedPartner(null);
  };

  const handlePartnerSelect = (partner: MapPartner | null) => {
    setSelectedPartner(partner);
    setSelectedLab(null);
  };

  if (!mounted) {
    return (
      <div className={`h-screen flex items-center justify-center ${isDark ? "bg-black" : "bg-gray-50"}`}>
        <div className="w-8 h-8 border-2 border-[#00FB75] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`h-screen flex items-center justify-center ${isDark ? "bg-black text-white" : "bg-gray-50 text-gray-900"}`}>
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">!</div>
          <h2 className="text-xl font-bold mb-2">Unable to load map</h2>
          <p className={`mb-4 ${isDark ? "text-gray-400" : "text-gray-600"}`}>{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-[#00FB75] text-black font-medium rounded-lg hover:bg-green-400 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col ${isDark ? "bg-black text-white" : "bg-gray-50 text-gray-900"}`}>
      <header className={`flex-shrink-0 border-b px-3 py-2 md:px-4 md:py-3 ${isDark ? "bg-[#0A0A0A] border-gray-800" : "bg-white border-gray-200"}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#00FB75] flex items-center justify-center flex-shrink-0">
              <span className="text-black font-bold text-xs md:text-sm">AF</span>
            </div>
            <div className="hidden md:block">
              <h1 className="font-semibold text-sm md:text-base">Africa Research Map</h1>
              <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                {labsInAfrica.length} labs{partnersInAfrica.length > 0 ? ` · ${partnersInAfrica.length} partners` : ""} across {countryStats.length} countries
              </p>
            </div>
            <div className="md:hidden">
              <h1 className="font-semibold text-sm">Map</h1>
              <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                {labsInAfrica.length} labs{partnersInAfrica.length > 0 ? ` · ${partnersInAfrica.length} partners` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 md:gap-2 flex-1 max-w-[160px] md:max-w-md">
            <div className="relative flex-1 hidden sm:block">
              <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-8 pr-7 py-1.5 md:py-2 rounded-lg text-sm border focus:outline-none focus:border-[#00FB75] transition-colors ${
                  isDark ? "bg-[#121212] border-gray-700 text-white placeholder-gray-500" : "bg-gray-100 border-gray-300 placeholder-gray-400"
                }`}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 text-lg ${isDark ? "text-gray-500 hover:text-white" : "text-gray-400 hover:text-gray-600"}`}
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 md:gap-2">
            {/* Mobile search toggle */}
            <button
              onClick={() => setShowMobileSearch(!showMobileSearch)}
              className={`p-1.5 md:p-2 rounded-lg border transition-colors sm:hidden ${showMobileSearch ? "bg-[#00FB75] text-black border-[#00FB75]" : isDark ? "border-gray-700 hover:border-gray-600" : "border-gray-300 hover:border-gray-400"}`}
              title="Search"
            >
              <Search className="w-4 h-4" />
            </button>
            {partnersInAfrica.length > 0 && (
              <button
                onClick={() => setShowPartners(!showPartners)}
                className={`p-1.5 md:p-2 rounded-lg border transition-colors ${showPartners ? "bg-amber-500 text-black border-amber-500" : isDark ? "border-gray-700 hover:border-gray-600" : "border-gray-300 hover:border-gray-400"}`}
                title="Toggle partners"
              >
                <Building2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={`p-1.5 md:p-2 rounded-lg border transition-colors ${showHeatmap ? "bg-[#00FB75] text-black border-[#00FB75]" : isDark ? "border-gray-700 hover:border-gray-600" : "border-gray-300 hover:border-gray-400"}`}
              title="Toggle heatmap"
            >
              <Layers className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowLabList(!showLabList)}
              className={`p-1.5 md:p-2 rounded-lg border transition-colors ${showLabList ? "bg-[#00FB75] text-black border-[#00FB75]" : isDark ? "border-gray-700 hover:border-gray-600" : "border-gray-300 hover:border-gray-400"} md:hidden`}
              title="Toggle lab list"
            >
              {showLabList ? <X className="w-4 h-4" /> : <List className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile search bar */}
        {showMobileSearch && (
          <div className="mt-2 sm:hidden">
            <div className="relative">
              <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
              <input
                type="text"
                placeholder="Search labs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                className={`w-full pl-8 pr-8 py-2 rounded-lg text-sm border focus:outline-none focus:border-[#00FB75] transition-colors ${
                  isDark ? "bg-[#121212] border-gray-700 text-white placeholder-gray-500" : "bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400"
                }`}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-0.5 ${isDark ? "text-gray-500 hover:text-white" : "text-gray-400 hover:text-gray-600"}`}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Scope filter - Compact design */}
        {uniqueScopes.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            {/* Filter button with dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowScopeDropdown(!showScopeDropdown)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                  selectedScopes.length > 0
                    ? "bg-[#00FB75] text-black border-[#00FB75]"
                    : isDark
                      ? "border-gray-700 text-gray-300 hover:border-gray-500"
                      : "border-gray-300 text-gray-700 hover:border-gray-400"
                }`}
              >
                <Filter className="w-3 h-3" />
                <span>Scopes</span>
                {selectedScopes.length > 0 && (
                  <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${
                    selectedScopes.length > 0 ? "bg-black text-[#00FB75]" : isDark ? "bg-gray-700" : "bg-gray-200"
                  }`}>
                    {selectedScopes.length}
                  </span>
                )}
                <ChevronDown className={`w-3 h-3 transition-transform ${showScopeDropdown ? "rotate-180" : ""}`} />
              </button>

              {/* Dropdown panel */}
              {showScopeDropdown && (
                <>
                  {/* Backdrop to close dropdown */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowScopeDropdown(false)}
                  />
                  <div className={`absolute top-full left-0 mt-1 z-50 min-w-[200px] max-w-[280px] rounded-lg border shadow-lg p-2 ${
                    isDark ? "bg-[#121212] border-gray-700" : "bg-white border-gray-200"
                  }`}>
                    <div className="flex items-center justify-between mb-2 pb-2 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}">
                      <span className={`text-xs font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                        Filter by Scope
                      </span>
                      {selectedScopes.length > 0 && (
                        <button
                          onClick={() => setSelectedScopes([])}
                          className="text-[10px] text-[#00FB75] hover:underline"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-1 max-h-[200px] overflow-y-auto">
                      {uniqueScopes.map(scope => (
                        <button
                          key={scope}
                          onClick={() => toggleScope(scope)}
                          className={`text-xs px-2 py-1.5 rounded text-left truncate transition-colors ${
                            selectedScopes.includes(scope)
                              ? "bg-[#00FB75] text-black"
                              : isDark
                                ? "text-gray-400 hover:bg-gray-800 hover:text-white"
                                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                          }`}
                          title={scope}
                        >
                          {scope}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Quick access chips - Desktop only, show first 4 selected or popular */}
            <div className="hidden md:flex items-center gap-1 flex-1 overflow-hidden">
              {(selectedScopes.length > 0 ? selectedScopes : uniqueScopes).slice(0, 4).map(scope => (
                <button
                  key={scope}
                  onClick={() => toggleScope(scope)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors whitespace-nowrap ${
                    selectedScopes.includes(scope)
                      ? "bg-[#00FB75] text-black border-[#00FB75]"
                      : isDark
                        ? "border-gray-700 text-gray-400 hover:border-gray-500"
                        : "border-gray-300 text-gray-600 hover:border-gray-400"
                  }`}
                >
                  {scope}
                </button>
              ))}
              {uniqueScopes.length > 4 && selectedScopes.length === 0 && (
                <button
                  onClick={() => setShowScopeDropdown(true)}
                  className={`text-xs px-2 py-0.5 rounded-full ${isDark ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"}`}
                >
                  +{uniqueScopes.length - 4} more
                </button>
              )}
            </div>

            {/* Mobile: Show selected scopes as compact badges */}
            {selectedScopes.length > 0 && (
              <div className="flex md:hidden items-center gap-1 flex-1 overflow-x-auto">
                {selectedScopes.slice(0, 2).map(scope => (
                  <span
                    key={scope}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-[#00FB75] text-black whitespace-nowrap"
                  >
                    {scope}
                  </span>
                ))}
                {selectedScopes.length > 2 && (
                  <span className={`text-[10px] ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    +{selectedScopes.length - 2}
                  </span>
                )}
              </div>
            )}

            {/* Clear button when filters active */}
            {selectedScopes.length > 0 && (
              <button
                onClick={() => setSelectedScopes([])}
                className={`text-xs px-2 py-0.5 rounded-full hidden md:block ${isDark ? "text-gray-500 hover:text-white" : "text-gray-400 hover:text-gray-700"}`}
              >
                Clear
              </button>
            )}
          </div>
        )}

        {searchTerm && (
          <div className="mt-1.5 text-xs md:hidden">
            <span className={isDark ? "text-gray-400" : "text-gray-600"}>
              {filteredLabs.length} result{filteredLabs.length !== 1 ? "s" : ""} for &quot;{searchTerm}&quot;
            </span>
          </div>
        )}
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 relative">
          <D3LabMap
            labs={filteredLabs}
            selectedLab={selectedLab}
            onLabSelect={handleLabSelect}
            hoveredLab={hoveredLab}
            onLabHover={setHoveredLab}
            isDark={isDark}
            showHeatmap={showHeatmap}
            partners={showPartners ? partnersInAfrica : []}
            selectedPartner={selectedPartner}
            onPartnerSelect={handlePartnerSelect}
            showPartners={showPartners}
          />

          <div className={`absolute bottom-2 left-2 sm:bottom-3 sm:left-3 rounded-lg border px-2 py-1 sm:px-2.5 sm:py-1.5 ${isDark ? "bg-black/80 border-gray-700" : "bg-white/90 border-gray-300"} backdrop-blur-sm`}>
            <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00FB75]" />
                <span className={isDark ? "text-gray-400" : "text-gray-700"}>
                  {filteredLabs.length} labs
                </span>
              </div>
              {showPartners && partnersInAfrica.length > 0 && (
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rotate-45 bg-amber-500" />
                  <span className={isDark ? "text-gray-400" : "text-gray-700"}>
                    {partnersInAfrica.length} partners
                  </span>
                </div>
              )}
            </div>
          </div>

          {countryStats.length > 0 && (
            <div className={`absolute bottom-2 right-2 sm:bottom-3 sm:right-3 rounded-lg border px-2 py-1 sm:px-2.5 sm:py-1.5 max-w-[140px] md:max-w-xs ${isDark ? "bg-black/80 border-gray-700" : "bg-white/90 border-gray-300"} backdrop-blur-sm hidden sm:block`}>
              <div className={`text-[10px] sm:text-xs font-medium mb-1 sm:mb-1.5 ${isDark ? "text-white" : "text-gray-800"}`}>Top Countries</div>
              <div className="flex flex-wrap gap-1">
                {countryStats.slice(0, 4).map(([country, count]) => (
                  <button
                    key={country}
                    className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full transition-colors ${
                      isDark ? "bg-gray-800 text-gray-300 hover:bg-[#00FB75] hover:text-black" : "bg-gray-200 text-gray-700 hover:bg-[#00FB75] hover:text-black"
                    }`}
                  >
                    {country} ({count})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Desktop Lab List */}
        <div className="hidden md:flex flex-shrink-0">
          <LabList
            labs={filteredLabs}
            selectedLab={selectedLab}
            onLabSelect={handleLabSelect}
            hoveredLab={hoveredLab}
            onLabHover={setHoveredLab}
            labsWithoutLocation={labsWithoutLocation}
            isDark={isDark}
            partners={partnersInAfrica}
            selectedPartner={selectedPartner}
            onPartnerSelect={handlePartnerSelect}
          />
        </div>

        {/* Mobile Lab List Drawer */}
        {showLabList && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setShowLabList(false)}
            />
            <div className={`fixed right-0 top-0 h-full z-50 md:hidden w-80 shadow-xl`}>
              <LabList
                labs={filteredLabs}
                selectedLab={selectedLab}
                onLabSelect={(lab) => {
                  handleLabSelect(lab);
                  setShowLabList(false);
                }}
                hoveredLab={hoveredLab}
                onLabHover={setHoveredLab}
                labsWithoutLocation={labsWithoutLocation}
                isDark={isDark}
                partners={partnersInAfrica}
                selectedPartner={selectedPartner}
                onPartnerSelect={(p) => {
                  handlePartnerSelect(p);
                  setShowLabList(false);
                }}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
