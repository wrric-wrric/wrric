"use client";

import { useState } from "react";
import { LabProfile } from "@/lib/types";
import { MapPin, Globe, ChevronDown, ChevronUp, X, ChevronRight, CheckCircle } from "lucide-react";
import Link from "next/link";
import { MapPartner } from "./page";

interface LabListProps {
  labs: LabProfile[];
  selectedLab: LabProfile | null;
  onLabSelect: (lab: LabProfile) => void;
  hoveredLab: LabProfile | null;
  onLabHover: (lab: LabProfile | null) => void;
  labsWithoutLocation: LabProfile[];
  isDark: boolean;
  onClose?: () => void;
  partners?: MapPartner[];
  selectedPartner?: MapPartner | null;
  onPartnerSelect?: (partner: MapPartner | null) => void;
}

export default function LabList({
  labs,
  selectedLab,
  onLabSelect,
  hoveredLab,
  onLabHover,
  labsWithoutLocation,
  isDark,
  onClose,
  partners = [],
  selectedPartner,
  onPartnerSelect,
}: LabListProps) {
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  const [showAllWithoutLocation, setShowAllWithoutLocation] = useState(false);
  const [activeTab, setActiveTab] = useState<"labs" | "partners">("labs");

  const groupedLabs = labs.reduce((acc: Record<string, LabProfile[]>, lab) => {
    const country = lab.location?.country || "Unknown";
    if (!acc[country]) acc[country] = [];
    acc[country].push(lab);
    return acc;
  }, {});

  const sortedGroups = Object.entries(groupedLabs).sort((a, b) => b[1].length - a[1].length);

  const groupedPartners = partners.reduce((acc: Record<string, MapPartner[]>, p) => {
    const country = p.country || "Unknown";
    if (!acc[country]) acc[country] = [];
    acc[country].push(p);
    return acc;
  }, {});

  const sortedPartnerGroups = Object.entries(groupedPartners).sort((a, b) => b[1].length - a[1].length);

  const handleLabClick = (lab: LabProfile) => {
    onLabSelect(lab);
  };

  if (labs.length === 0 && partners.length === 0) {
    return (
      <div className={`w-80 border-l flex flex-col ${isDark ? "bg-[#0A0A0A] border-gray-800" : "bg-white border-gray-200"}`}>
        <div className={`p-4 border-b ${isDark ? "border-gray-800" : "border-gray-200"}`}>
          <h2 className="font-semibold">Labs</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className={`text-sm text-center ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            No labs found
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full md:w-80 flex-shrink-0 border-l flex flex-col overflow-hidden ${isDark ? "bg-[#0A0A0A] border-gray-800" : "bg-white border-gray-200"} h-full`}>
      {/* Tab bar */}
      <div className={`flex border-b ${isDark ? "border-gray-800" : "border-gray-200"}`}>
        <button
          onClick={() => setActiveTab("labs")}
          className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
            activeTab === "labs"
              ? isDark ? "text-[#00FB75] border-b-2 border-[#00FB75]" : "text-green-600 border-b-2 border-green-600"
              : isDark ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"
          }`}
        >
          Labs ({labs.length})
        </button>
        <button
          onClick={() => setActiveTab("partners")}
          className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
            activeTab === "partners"
              ? isDark ? "text-amber-400 border-b-2 border-amber-400" : "text-amber-600 border-b-2 border-amber-600"
              : isDark ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"
          }`}
        >
          Partners ({partners.length})
        </button>
        <div className="flex items-center px-1">
          {(selectedLab || selectedPartner) && (
            <button
              onClick={() => {
                onLabSelect(null as any);
                onPartnerSelect?.(null);
              }}
              className={`p-1 rounded transition-colors ${isDark ? "hover:bg-gray-800" : "hover:bg-gray-100"}`}
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className={`p-1 rounded transition-colors md:hidden ${isDark ? "hover:bg-gray-800" : "hover:bg-gray-100"}`}
              title="Close"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Selected lab detail */}
        {activeTab === "labs" && selectedLab && (
          <div className={`p-4 border-b ${isDark ? "border-gray-800 bg-[#00FB75]/5" : "border-gray-200 bg-green-50"}`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#00FB75]/20`}>
                <MapPin className="w-5 h-5 text-[#00FB75]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`font-semibold truncate ${isDark ? "text-white" : "text-gray-900"}`}>
                  {selectedLab.university || "Research Lab"}
                </h3>
                <p className={`text-sm truncate ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  {selectedLab.location?.city}, {selectedLab.location?.country}
                </p>
                <div className="flex gap-2 mt-3">
                  <Link
                    href={`/labs/${selectedLab.id}`}
                    className="flex-1 py-1.5 px-3 rounded text-sm font-medium text-center transition-colors bg-[#00FB75] text-black hover:bg-green-400"
                  >
                    View Details
                  </Link>
                  {selectedLab.website && (
                    <a
                      href={selectedLab.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`p-1.5 rounded transition-colors ${isDark ? "bg-gray-800 hover:bg-gray-700" : "bg-gray-100 hover:bg-gray-200"}`}
                    >
                      <Globe className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Selected partner detail */}
        {activeTab === "partners" && selectedPartner && (
          <div className={`p-4 border-b ${isDark ? "border-gray-800 bg-amber-500/5" : "border-gray-200 bg-amber-50"}`}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-500/20">
                <span className="w-4 h-4 rotate-45 bg-amber-500 block" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className={`font-semibold truncate ${isDark ? "text-white" : "text-gray-900"}`}>
                    {selectedPartner.name}
                  </h3>
                  {selectedPartner.is_verified && (
                    <CheckCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  )}
                </div>
                <p className={`text-sm truncate ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  {selectedPartner.country}{selectedPartner.organization_type ? ` · ${selectedPartner.organization_type}` : ""}
                </p>
                {selectedPartner.lab_count > 0 && (
                  <p className={`text-xs mt-0.5 ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                    {selectedPartner.lab_count} lab{selectedPartner.lab_count !== 1 ? "s" : ""}
                  </p>
                )}
                <div className="flex gap-2 mt-3">
                  <Link
                    href={`/partners/${selectedPartner.slug}`}
                    className="flex-1 py-1.5 px-3 rounded text-sm font-medium text-center transition-colors bg-amber-500 text-black hover:bg-amber-400"
                  >
                    View Partner
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Labs tab content */}
        {activeTab === "labs" && (
          <div className="p-2">
            {sortedGroups.map(([country, countryLabs]) => (
              <div key={country} className="mb-2">
                <button
                  onClick={() => setExpandedCountry(expandedCountry === country ? null : country)}
                  className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors ${
                    isDark ? "hover:bg-gray-800" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`font-medium text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
                      {country}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-500"
                    }`}>
                      {countryLabs.length}
                    </span>
                  </div>
                  {expandedCountry === country ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {expandedCountry === country && (
                  <div className="ml-2 space-y-1 border-l-2 pl-3 mt-1">
                    {countryLabs.map((lab) => (
                      <button
                        key={lab.id}
                        onClick={() => handleLabClick(lab)}
                        onMouseEnter={() => onLabHover(lab)}
                        onMouseLeave={() => onLabHover(null)}
                        className={`w-full text-left p-2.5 rounded-lg transition-all ${
                          selectedLab?.id === lab.id
                            ? isDark ? "bg-[#00FB75]/10 border-[#00FB75]" : "bg-[#00FB75]/10 border-green-500"
                            : isDark ? "hover:bg-gray-800" : "hover:bg-gray-50"
                        } border border-transparent`}
                      >
                        <div className={`font-medium text-sm truncate ${
                          selectedLab?.id === lab.id
                            ? "text-[#00FB75]"
                            : isDark ? "text-white" : "text-gray-900"
                        }`}>
                          {lab.university || "Research Lab"}
                        </div>
                        <div className={`text-xs truncate mt-0.5 ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                          {lab.location?.city}
                        </div>
                        {lab.scopes && lab.scopes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {lab.scopes.slice(0, 2).map((scope) => (
                              <span
                                key={scope}
                                className={`text-xs px-1.5 py-0.5 rounded-full ${
                                  isDark
                                    ? "bg-gray-800 text-gray-400"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {scope}
                              </span>
                            ))}
                            {lab.scopes.length > 2 && (
                              <span className={`text-xs ${isDark ? "text-gray-600" : "text-gray-400"}`}>
                                +{lab.scopes.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {labsWithoutLocation.length > 0 && (
              <div className="mt-4 pt-4 border-t border-dashed">
                <button
                  onClick={() => setShowAllWithoutLocation(!showAllWithoutLocation)}
                  className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors ${
                    isDark ? "hover:bg-gray-800" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className={`font-medium text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                      Without location
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      isDark ? "bg-gray-800 text-gray-500" : "bg-gray-100 text-gray-500"
                    }`}>
                      {labsWithoutLocation.length}
                    </span>
                  </div>
                  {showAllWithoutLocation ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {showAllWithoutLocation && (
                  <div className="ml-2 space-y-1 border-l-2 pl-3 mt-1">
                    {labsWithoutLocation.map((lab) => (
                      <button
                        key={lab.id}
                        onClick={() => handleLabClick(lab)}
                        className={`w-full text-left p-2.5 rounded-lg transition-colors ${
                          isDark ? "hover:bg-gray-800" : "hover:bg-gray-50"
                        }`}
                      >
                        <div className={`font-medium text-sm truncate ${
                          isDark ? "text-gray-300" : "text-gray-700"
                        }`}>
                          {lab.university || "Unnamed Lab"}
                        </div>
                        {lab.scopes && lab.scopes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {lab.scopes.slice(0, 2).map((scope) => (
                              <span
                                key={scope}
                                className={`text-xs px-1.5 py-0.5 rounded-full ${
                                  isDark
                                    ? "bg-gray-800 text-gray-400"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {scope}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Partners tab content */}
        {activeTab === "partners" && (
          <div className="p-2">
            {sortedPartnerGroups.length === 0 && (
              <div className="flex items-center justify-center py-8">
                <p className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>No partners on map</p>
              </div>
            )}
            {sortedPartnerGroups.map(([country, countryPartners]) => (
              <div key={country} className="mb-2">
                <button
                  onClick={() => setExpandedCountry(expandedCountry === `p-${country}` ? null : `p-${country}`)}
                  className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors ${
                    isDark ? "hover:bg-gray-800" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`font-medium text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
                      {country}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-500"
                    }`}>
                      {countryPartners.length}
                    </span>
                  </div>
                  {expandedCountry === `p-${country}` ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {expandedCountry === `p-${country}` && (
                  <div className="ml-2 space-y-1 border-l-2 border-amber-500/30 pl-3 mt-1">
                    {countryPartners.map((partner) => (
                      <button
                        key={partner.id}
                        onClick={() => onPartnerSelect?.(partner)}
                        className={`w-full text-left p-2.5 rounded-lg transition-all ${
                          selectedPartner?.id === partner.id
                            ? isDark ? "bg-amber-500/10 border-amber-500" : "bg-amber-500/10 border-amber-500"
                            : isDark ? "hover:bg-gray-800" : "hover:bg-gray-50"
                        } border border-transparent`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`font-medium text-sm truncate ${
                            selectedPartner?.id === partner.id
                              ? "text-amber-400"
                              : isDark ? "text-white" : "text-gray-900"
                          }`}>
                            {partner.name}
                          </span>
                          {partner.is_verified && (
                            <CheckCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          )}
                        </div>
                        {partner.organization_type && (
                          <div className={`text-xs mt-0.5 ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                            {partner.organization_type}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {partner.sector_focus.slice(0, 2).map((sector) => (
                            <span
                              key={sector}
                              className={`text-xs px-1.5 py-0.5 rounded-full ${
                                isDark ? "bg-amber-900/30 text-amber-400" : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {sector}
                            </span>
                          ))}
                          {partner.lab_count > 0 && (
                            <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                              {partner.lab_count} lab{partner.lab_count !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
