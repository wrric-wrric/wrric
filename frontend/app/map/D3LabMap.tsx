"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import { LabProfile } from "@/lib/types";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { MapPartner } from "./page";

interface D3LabMapProps {
  labs: LabProfile[];
  selectedLab: LabProfile | null;
  onLabSelect: (lab: LabProfile) => void;
  hoveredLab: LabProfile | null;
  onLabHover: (lab: LabProfile | null) => void;
  isDark: boolean;
  showHeatmap?: boolean;
  partners?: MapPartner[];
  selectedPartner?: MapPartner | null;
  onPartnerSelect?: (partner: MapPartner | null) => void;
  showPartners?: boolean;
}

interface AfricaGeoJSON {
  type: string;
  features: any[];
}

export default function D3LabMap({
  labs, selectedLab, onLabSelect, hoveredLab, onLabHover, isDark, showHeatmap,
  partners = [], selectedPartner, onPartnerSelect, showPartners,
}: D3LabMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [africaData, setAfricaData] = useState<AfricaGeoJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uniqueScopes, setUniqueScopes] = useState<string[]>([]);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const initialTransformRef = useRef<d3.ZoomTransform | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [popup, setPopup] = useState<{
    type: "lab" | "partner";
    data: any;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
    // Check if mobile on mount
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const loadAfricaData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/maps/africa.geojson');
        if (!response.ok) throw new Error('Failed to load map data');
        const data = await response.json();
        if (!data.type || !data.features) throw new Error('Invalid map format');
        setAfricaData(data);
      } catch (err) {
        console.error('Error loading map:', err);
        setError('Unable to load map');
      } finally {
        setLoading(false);
      }
    };
    loadAfricaData();
  }, []);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const updateDimensions = () => {
      if (containerRef.current && typeof window !== 'undefined') {
        const { width, height } = containerRef.current.getBoundingClientRect();
        // Use smaller minimums for mobile responsiveness
        const isMobileView = window.innerWidth < 640;
        const minWidth = isMobileView ? 280 : 400;
        const minHeight = isMobileView ? 250 : 300;
        setDimensions({ width: Math.max(width, minWidth), height: Math.max(height, minHeight) });
      }
    };
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateDimensions, 100);
    };
    updateDimensions();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    const scopesSet = new Set<string>();
    labs.forEach(lab => {
      lab.scopes?.forEach(scope => scopesSet.add(scope || ""));
    });
    setUniqueScopes(Array.from(scopesSet).sort());
  }, [labs]);

  // Close popup on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setPopup(null);
      }
    };
    if (popup) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [popup]);

  const createTooltip = useCallback(() => {
    if (tooltipRef.current) tooltipRef.current.remove();
    const tooltip = document.createElement('div');
    tooltip.className = 'map-tooltip';
    tooltip.style.cssText = `
      position: absolute;
      background: ${isDark ? 'rgba(0, 0, 0, 0.95)' : 'rgba(255, 255, 255, 0.98)'};
      color: ${isDark ? 'white' : '#1a1a1a'};
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s;
      border: 1px solid ${isDark ? 'rgba(0, 251, 117, 0.4)' : 'rgba(0, 150, 80, 0.4)'};
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
      max-width: 280px;
    `;
    document.body.appendChild(tooltip);
    tooltipRef.current = tooltip;
    return tooltip;
  }, [isDark]);

  const showTooltip = useCallback((content: string, event: MouseEvent) => {
    const tooltip = tooltipRef.current || createTooltip();
    tooltip.innerHTML = content;
    tooltip.style.opacity = '1';
    tooltip.style.left = `${event.pageX + 12}px`;
    tooltip.style.top = `${event.pageY - 28}px`;
  }, [createTooltip]);

  const hideTooltip = useCallback(() => {
    if (tooltipRef.current) {
      tooltipRef.current.style.opacity = '0';
    }
  }, []);

  useEffect(() => {
    if (!mounted || !svgRef.current || !africaData || loading) return;

    const svg = d3.select(svgRef.current);
    const { width, height } = dimensions;

    svg.selectAll("*").remove();
    svg.attr("shape-rendering", "geometricPrecision");

    const g = svg.append("g");

    const projection = d3.geoMercator();
    if (africaData.features.length > 0) {
      try {
        const bounds = d3.geoBounds(africaData as any);
        const center = d3.geoCentroid(africaData as any);
        projection.center(center as [number, number])
                  .scale(width / (bounds[1][0] - bounds[0][0]) * 70)
                  .translate([width / 2, height / 2]);
      } catch {
        projection.center([18, 2]).scale(width / 5);
      }
    }

    const pathGenerator = d3.geoPath().projection(projection);

    let selectedCountry = null;
    if (selectedLab && selectedLab.location?.longitude && selectedLab.location?.latitude) {
      const coords: [number, number] = [selectedLab.location.longitude, selectedLab.location.latitude];
      selectedCountry = africaData.features.find(feature => d3.geoContains(feature, coords));
    }

    // Light mode colors with better visibility and contrast
    const countryColor = isDark ? "rgba(0, 251, 117, 0.08)" : "rgba(200, 230, 210, 0.9)";
    const countryHoverColor = isDark ? "rgba(0, 251, 117, 0.2)" : "rgba(180, 220, 195, 1)";
    const selectedColor = isDark ? "rgba(0, 251, 117, 0.35)" : "rgba(0, 180, 100, 0.4)";
    const countryStroke = isDark ? "rgba(0, 251, 117, 0.4)" : "rgba(0, 80, 50, 0.7)";

    g.selectAll(".country")
      .data(africaData.features)
      .enter()
      .append("path")
      .attr("class", "country")
      .attr("d", pathGenerator as any)
      .attr("fill", d => d === selectedCountry ? selectedColor : countryColor)
      .attr("stroke", countryStroke)
      .attr("stroke-width", isDark ? 0.5 : 1.5)
      .style("vector-effect", "non-scaling-stroke")
      .on("mouseover", function(event, d) {
        if (d !== selectedCountry) {
          d3.select(this).attr("fill", countryHoverColor);
        }
        const countryName = d.properties?.name || "Unknown";
        showTooltip(`<div class="font-medium">${countryName}</div>`, event);
      })
      .on("mousemove", function(event) {
        if (tooltipRef.current) {
          tooltipRef.current.style.left = `${event.pageX + 12}px`;
          tooltipRef.current.style.top = `${event.pageY - 28}px`;
        }
      })
      .on("mouseout", function(event, d) {
        if (d !== selectedCountry) {
          d3.select(this).attr("fill", countryColor);
        }
        hideTooltip();
      });

    const scopeColors = d3.scaleOrdinal(d3.schemeCategory10).domain(uniqueScopes);

    // Heatmap layer
    if (showHeatmap && labs.length > 0) {
      const heatmapGroup = g.append("g").attr("class", "heatmap");
      labs.forEach(lab => {
        if (lab.location?.longitude && lab.location?.latitude) {
          const [x, y] = projection([lab.location.longitude, lab.location.latitude]) || [0, 0];
          const baseRadius = 25;
          const gradient = heatmapGroup.append("defs")
            .append("radialGradient")
            .attr("id", `heat-${lab.id}`)
            .attr("cx", "50%").attr("cy", "50%").attr("r", "50%");
          gradient.append("stop").attr("offset", "0%")
            .attr("stop-color", scopeColors(lab.scopes?.[0] || "Unknown")).attr("stop-opacity", 0.4);
          gradient.append("stop").attr("offset", "100%")
            .attr("stop-color", scopeColors(lab.scopes?.[0] || "Unknown")).attr("stop-opacity", 0);
          heatmapGroup.append("circle").attr("cx", x).attr("cy", y).attr("r", baseRadius)
            .attr("fill", `url(#heat-${lab.id})`);
        }
      });
    }

    // Lab markers
    const labNodes = g.selectAll(".lab-node")
      .data(labs)
      .enter()
      .append("g")
      .attr("class", "lab-node")
      .attr("transform", d => {
        if (!d.location?.longitude || !d.location?.latitude) return `translate(0, 0)`;
        const [x, y] = projection([d.location.longitude, d.location.latitude]) || [0, 0];
        return `translate(${x}, ${y})`;
      })
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        event.stopPropagation();
        onLabSelect(d);
        // Show popup
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          setPopup({ type: "lab", data: d, x: event.clientX - rect.left, y: event.clientY - rect.top });
        }
      })
      .on("mouseenter", function(event, d) {
        onLabHover(d);
        d3.select(this).select(".lab-point").transition().duration(100).attr("r", isDark ? 6 : 7).attr("stroke-width", 3);
        d3.select(this).select(".lab-glow").transition().duration(100).attr("r", isDark ? 14 : 16).attr("opacity", isDark ? 0.25 : 0.35);
        const content = `
          <div class="font-semibold" style="color: ${isDark ? '#00FB75' : '#008850'}">${d.university || "Research Lab"}</div>
          <div style="color: ${isDark ? '#e5e5e5' : '#374151'}">${d.department?.name || ""}</div>
          <div style="color: ${isDark ? '#a3a3a3' : '#6b7280'}">${d.location?.city || ""}${d.location?.city && d.location?.country ? ", " : ""}${d.location?.country || ""}</div>
          ${d.scopes && d.scopes.length > 0 ? `<div style="color: ${isDark ? '#d1d5db' : '#4b5563'}">${d.scopes.slice(0, 2).join(", ")}</div>` : ""}
        `;
        showTooltip(content, event);
      })
      .on("mousemove", function(event) {
        if (tooltipRef.current) {
          tooltipRef.current.style.left = `${event.pageX + 12}px`;
          tooltipRef.current.style.top = `${event.pageY - 28}px`;
        }
      })
      .on("mouseleave", function(event, d) {
        onLabHover(null);
        if (selectedLab?.id !== d.id) {
          d3.select(this).select(".lab-point").transition().duration(100).attr("r", isDark ? 3 : 4.5).attr("stroke-width", isDark ? 2 : 2.5);
          d3.select(this).select(".lab-glow").transition().duration(100).attr("r", isDark ? 8 : 10).attr("opacity", isDark ? 0.1 : 0.25);
        }
        hideTooltip();
      });

    labNodes.append("circle").attr("class", "lab-glow").attr("r", isDark ? 8 : 10)
      .attr("fill", d => scopeColors(d.scopes?.[0] || "Unknown")).attr("opacity", isDark ? 0.1 : 0.25);

    // In light mode: larger markers with dark stroke and stronger shadow for visibility
    labNodes.append("circle").attr("class", "lab-point").attr("r", isDark ? 3 : 4.5)
      .attr("fill", d => scopeColors(d.scopes?.[0] || "Unknown"))
      .attr("stroke", isDark ? "#fff" : "#1a1a1a")
      .attr("stroke-width", isDark ? 2 : 2.5)
      .style("filter", isDark ? "drop-shadow(0 0 2px rgba(0,0,0,0.5))" : "drop-shadow(0 0 4px rgba(0,0,0,0.4))")
      .style("vector-effect", "non-scaling-stroke");

    if (hoveredLab) {
      labNodes.filter(d => d.id === hoveredLab.id).select(".lab-point").attr("r", isDark ? 6 : 7).attr("stroke-width", 3);
      labNodes.filter(d => d.id === hoveredLab.id).select(".lab-glow").attr("r", isDark ? 14 : 16).attr("opacity", isDark ? 0.25 : 0.35);
    }

    if (selectedLab) {
      const selectedNode = labNodes.filter(d => d.id === selectedLab.id);
      selectedNode.select(".lab-point").attr("r", 5).attr("stroke-width", 3).attr("fill", "#FF4D00");
      selectedNode.select(".lab-glow").attr("r", 14).attr("opacity", 0.35).attr("fill", "#FF4D00");

      if (selectedLab.location?.longitude && selectedLab.location?.latitude) {
        const [x, y] = projection([selectedLab.location.longitude, selectedLab.location.latitude]) || [0, 0];
        const pulseRing = g.append("circle").attr("class", "pulse-ring")
          .attr("cx", x).attr("cy", y).attr("r", 15)
          .attr("fill", "none").attr("stroke", "#FF4D00").attr("stroke-width", 2).attr("opacity", 0.7);
        const pulse = () => {
          pulseRing.transition().duration(2000).ease(d3.easeLinear)
            .attr("r", 30).attr("opacity", 0).remove()
            .on("end", () => { if (selectedLab) pulse(); });
        };
        pulse();
      }
    }

    // Partner markers (diamonds)
    if (showPartners && partners.length > 0) {
      const partnerNodes = g.selectAll(".partner-node")
        .data(partners)
        .enter()
        .append("g")
        .attr("class", "partner-node")
        .attr("transform", d => {
          const [x, y] = projection([d.longitude, d.latitude]) || [0, 0];
          return `translate(${x}, ${y})`;
        })
        .style("cursor", "pointer")
        .on("click", (event, d) => {
          event.stopPropagation();
          onPartnerSelect?.(d);
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            setPopup({ type: "partner", data: d, x: event.clientX - rect.left, y: event.clientY - rect.top });
          }
        })
        .on("mouseenter", function(event, d) {
          d3.select(this).select(".partner-diamond").transition().duration(100)
            .attr("width", 12).attr("height", 12).attr("x", -6).attr("y", -6);
          d3.select(this).select(".partner-glow").transition().duration(100).attr("r", 14).attr("opacity", 0.3);
          const sectors = d.sector_focus?.slice(0, 2).join(", ") || "";
          const content = `
            <div class="font-semibold" style="color: #f59e0b">${d.name}</div>
            <div style="color: ${isDark ? '#a3a3a3' : '#6b7280'}">${d.country || ""}</div>
            ${sectors ? `<div style="color: ${isDark ? '#d1d5db' : '#4b5563'}">${sectors}</div>` : ""}
            ${d.lab_count > 0 ? `<div style="color: ${isDark ? '#9ca3af' : '#6b7280'}">${d.lab_count} lab${d.lab_count !== 1 ? "s" : ""}</div>` : ""}
            ${d.is_verified ? `<div style="color: #f59e0b">&#10003; Verified</div>` : ""}
          `;
          showTooltip(content, event);
        })
        .on("mousemove", function(event) {
          if (tooltipRef.current) {
            tooltipRef.current.style.left = `${event.pageX + 12}px`;
            tooltipRef.current.style.top = `${event.pageY - 28}px`;
          }
        })
        .on("mouseleave", function() {
          d3.select(this).select(".partner-diamond").transition().duration(100)
            .attr("width", 8).attr("height", 8).attr("x", -4).attr("y", -4);
          d3.select(this).select(".partner-glow").transition().duration(100).attr("r", 10).attr("opacity", 0.15);
          hideTooltip();
        });

      partnerNodes.append("circle").attr("class", "partner-glow")
        .attr("r", 10).attr("fill", "#f59e0b").attr("opacity", 0.15);

      partnerNodes.append("rect").attr("class", "partner-diamond")
        .attr("width", 8).attr("height", 8).attr("x", -4).attr("y", -4)
        .attr("rx", 1)
        .attr("fill", "#f59e0b").attr("stroke", "#fff").attr("stroke-width", 1.5)
        .attr("transform", "rotate(45)")
        .style("filter", isDark ? "drop-shadow(0 0 3px rgba(245,158,11,0.5))" : "drop-shadow(0 0 2px rgba(255,255,255,0.8))");

      // Selected partner highlight
      if (selectedPartner) {
        const selNode = partnerNodes.filter(d => d.id === selectedPartner.id);
        selNode.select(".partner-diamond").attr("width", 12).attr("height", 12).attr("x", -6).attr("y", -6)
          .attr("fill", "#FF4D00").attr("stroke-width", 2);
        selNode.select(".partner-glow").attr("r", 16).attr("opacity", 0.4).attr("fill", "#FF4D00");

        const [px, py] = projection([selectedPartner.longitude, selectedPartner.latitude]) || [0, 0];
        const pPulse = g.append("circle").attr("cx", px).attr("cy", py).attr("r", 15)
          .attr("fill", "none").attr("stroke", "#FF4D00").attr("stroke-width", 2).attr("opacity", 0.7);
        const doPulse = () => {
          pPulse.transition().duration(2000).ease(d3.easeLinear)
            .attr("r", 30).attr("opacity", 0).remove()
            .on("end", () => { if (selectedPartner) doPulse(); });
        };
        doPulse();
      }
    }

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 10])
      .on("zoom", (event) => { g.attr("transform", event.transform); });
    zoomRef.current = zoom;
    svg.call(zoom as any);

    if (africaData.features.length > 0) {
      try {
        const [[x0, y0], [x1, y1]] = pathGenerator.bounds(africaData as any);
        const dx = x1 - x0;
        const dy = y1 - y0;
        const x = (x0 + x1) / 2;
        const y = (y0 + y1) / 2;
        const scale = 0.85 / Math.max(dx / width, dy / height);
        const translate = [width / 2 - scale * x, height / 2 - scale * y];
        const initialTransform = d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale);
        initialTransformRef.current = initialTransform;
        svg.transition().duration(800).call(zoom.transform as any, initialTransform);
      } catch {
        console.warn('Could not fit bounds');
      }
    }

    return () => { hideTooltip(); };
  }, [africaData, dimensions, labs, selectedLab, hoveredLab, showHeatmap, uniqueScopes, isDark, mounted, loading, onLabSelect, onLabHover, createTooltip, showTooltip, hideTooltip, partners, selectedPartner, onPartnerSelect, showPartners]);

  const handleZoomIn = () => {
    if (svgRef.current && zoomRef.current) d3.select(svgRef.current).transition().call(zoomRef.current.scaleBy, 1.4);
  };
  const handleZoomOut = () => {
    if (svgRef.current && zoomRef.current) d3.select(svgRef.current).transition().call(zoomRef.current.scaleBy, 1 / 1.4);
  };
  const handleReset = () => {
    if (svgRef.current && zoomRef.current && initialTransformRef.current) {
      d3.select(svgRef.current).transition().duration(600).call(zoomRef.current.transform, initialTransformRef.current);
    }
  };

  // Zoom to selected lab
  useEffect(() => {
    if (!selectedLab || !svgRef.current || !zoomRef.current || !africaData) return;
    if (!selectedLab.location?.longitude || !selectedLab.location?.latitude) return;
    const svg = d3.select(svgRef.current);
    const { width, height } = dimensions;
    const projection = d3.geoMercator();
    if (africaData.features.length > 0) {
      try {
        const bounds = d3.geoBounds(africaData as any);
        const center = d3.geoCentroid(africaData as any);
        projection.center(center as [number, number])
                  .scale(width / (bounds[1][0] - bounds[0][0]) * 70)
                  .translate([width / 2, height / 2]);
      } catch { projection.center([18, 2]).scale(width / 5); }
    }
    const projected = projection([selectedLab.location.longitude, selectedLab.location.latitude]);
    if (projected) {
      const [x, y] = projected;
      svg.transition().duration(1000).ease(d3.easeCubicOut)
        .call(zoomRef.current.translateTo, x, y)
        .call(zoomRef.current.scaleTo, 4);
    }
  }, [selectedLab, africaData, dimensions]);

  // Zoom to selected partner
  useEffect(() => {
    if (!selectedPartner || !svgRef.current || !zoomRef.current || !africaData) return;
    const svg = d3.select(svgRef.current);
    const { width, height } = dimensions;
    const projection = d3.geoMercator();
    if (africaData.features.length > 0) {
      try {
        const bounds = d3.geoBounds(africaData as any);
        const center = d3.geoCentroid(africaData as any);
        projection.center(center as [number, number])
                  .scale(width / (bounds[1][0] - bounds[0][0]) * 70)
                  .translate([width / 2, height / 2]);
      } catch { projection.center([18, 2]).scale(width / 5); }
    }
    const projected = projection([selectedPartner.longitude, selectedPartner.latitude]);
    if (projected) {
      const [x, y] = projected;
      svg.transition().duration(1000).ease(d3.easeCubicOut)
        .call(zoomRef.current.translateTo, x, y)
        .call(zoomRef.current.scaleTo, 4);
    }
  }, [selectedPartner, africaData, dimensions]);

  useEffect(() => {
    return () => { if (tooltipRef.current) tooltipRef.current.remove(); };
  }, []);

  if (!mounted) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-700 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`h-full w-full rounded-xl border flex items-center justify-center ${isDark ? "bg-[#0A0A0A] border-gray-800" : "bg-gray-100 border-gray-200"}`}>
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-[#00FB75] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>Loading map...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`h-full w-full rounded-xl border flex items-center justify-center ${isDark ? "bg-[#0A0A0A] border-gray-800" : "bg-gray-100 border-gray-200"}`}>
        <div className="text-center">
          <div className="text-red-400 text-3xl mb-2">!</div>
          <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`h-full w-full rounded-lg sm:rounded-xl border relative overflow-hidden ${isDark ? "bg-[#0A0A0A] border-gray-800" : "bg-[#e8f4ec] border-gray-400"}`}>
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="w-full h-full touch-pan-x touch-pan-y" />

      {/* Zoom controls */}
      <div className={`absolute top-2 right-2 sm:top-3 sm:right-3 flex flex-col gap-1 sm:gap-1.5 rounded-lg p-1 sm:p-1.5 border ${isDark ? "bg-black/80 border-gray-700" : "bg-white/90 border-gray-300"} backdrop-blur-sm shadow-sm`}>
        <button onClick={handleZoomIn} className={`p-1 sm:p-1.5 rounded transition-colors ${isDark ? "hover:bg-gray-800" : "hover:bg-gray-200"}`} title="Zoom in">
          <ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
        <button onClick={handleZoomOut} className={`p-1 sm:p-1.5 rounded transition-colors ${isDark ? "hover:bg-gray-800" : "hover:bg-gray-200"}`} title="Zoom out">
          <ZoomOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
        <button onClick={handleReset} className={`p-1 sm:p-1.5 rounded transition-colors ${isDark ? "hover:bg-gray-800" : "hover:bg-gray-200"}`} title="Reset view">
          <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
      </div>

      {/* Interactive legend - hidden on very small screens */}
      {(uniqueScopes.length > 0 || (showPartners && partners.length > 0)) && (
        <div className={`absolute top-2 left-2 sm:top-3 sm:left-3 rounded-lg border px-2 py-1.5 sm:px-3 sm:py-2 max-w-[120px] sm:max-w-none ${isDark ? "bg-black/80 border-gray-700" : "bg-white/90 border-gray-300"} backdrop-blur-sm shadow-sm hidden sm:block`}>
          <div className={`text-[10px] sm:text-xs font-medium mb-1.5 sm:mb-2 ${isDark ? "text-white" : "text-gray-800"}`}>Legend</div>
          <div className="flex flex-wrap gap-1 sm:gap-1.5">
            {uniqueScopes.slice(0, isMobile ? 3 : 5).map((scope, i) => (
              <div key={scope} className="flex items-center gap-1">
                <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shadow-sm flex-shrink-0" style={{ backgroundColor: d3.schemeCategory10[i % 10] }} />
                <span className={`text-[10px] sm:text-xs truncate max-w-[60px] sm:max-w-none ${isDark ? "text-gray-400" : "text-gray-700"}`}>{scope}</span>
              </div>
            ))}
            {showPartners && partners.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rotate-45 bg-amber-500 shadow-sm flex-shrink-0" style={{ display: "inline-block" }} />
                <span className={`text-[10px] sm:text-xs ${isDark ? "text-gray-400" : "text-gray-700"}`}>Partner</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail popup */}
      {popup && (
        <div
          ref={popupRef}
          className={`absolute z-50 rounded-xl border shadow-xl p-3 sm:p-4 w-56 sm:w-64 ${isDark ? "bg-[#0A0A0A] border-gray-700 text-white" : "bg-white border-gray-200 text-gray-900"}`}
          style={{
            left: Math.max(8, Math.min(popup.x + 16, dimensions.width - (isMobile ? 240 : 280))),
            top: Math.max(8, Math.min(popup.y - 20, dimensions.height - 180)),
          }}
        >
          <button
            onClick={() => setPopup(null)}
            className={`absolute top-2 right-2 p-1 rounded-full transition-colors ${isDark ? "hover:bg-gray-800" : "hover:bg-gray-100"}`}
          >
            <span className="text-xs">&#10005;</span>
          </button>
          {popup.type === "lab" && (() => {
            const lab = popup.data as LabProfile;
            return (
              <>
                <h3 className="font-semibold text-sm pr-6">{lab.university || "Research Lab"}</h3>
                {lab.department?.name && (
                  <p className={`text-xs mt-0.5 ${isDark ? "text-gray-400" : "text-gray-600"}`}>{lab.department.name}</p>
                )}
                <p className={`text-xs mt-1 ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                  {lab.location?.city}{lab.location?.city && lab.location?.country ? ", " : ""}{lab.location?.country}
                </p>
                {lab.scopes && lab.scopes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {lab.scopes.slice(0, 3).map(s => (
                      <span key={s} className={`text-xs px-1.5 py-0.5 rounded-full ${isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-600"}`}>{s}</span>
                    ))}
                  </div>
                )}
                <a
                  href={`/labs/${lab.id}`}
                  className="block mt-3 text-xs font-medium text-center py-1.5 rounded-lg bg-[#00FB75] text-black hover:bg-green-400 transition-colors"
                >
                  View Lab &rarr;
                </a>
              </>
            );
          })()}
          {popup.type === "partner" && (() => {
            const p = popup.data as MapPartner;
            return (
              <>
                <div className="flex items-center gap-1.5 pr-6">
                  <h3 className="font-semibold text-sm">{p.name}</h3>
                  {p.is_verified && <span className="text-amber-500 text-xs">&#10003;</span>}
                </div>
                <p className={`text-xs mt-0.5 ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                  {p.country}{p.organization_type ? ` · ${p.organization_type}` : ""}
                </p>
                {p.sector_focus.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {p.sector_focus.slice(0, 3).map(s => (
                      <span key={s} className={`text-xs px-1.5 py-0.5 rounded-full ${isDark ? "bg-amber-900/30 text-amber-400" : "bg-amber-100 text-amber-700"}`}>{s}</span>
                    ))}
                  </div>
                )}
                {p.lab_count > 0 && (
                  <p className={`text-xs mt-1.5 ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                    {p.lab_count} lab{p.lab_count !== 1 ? "s" : ""}
                  </p>
                )}
                <a
                  href={`/partners/${p.slug}`}
                  className="block mt-3 text-xs font-medium text-center py-1.5 rounded-lg bg-amber-500 text-black hover:bg-amber-400 transition-colors"
                >
                  View Partner &rarr;
                </a>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
