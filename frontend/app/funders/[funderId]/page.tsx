"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useSidebar } from "@/hooks/sideBarProvider";
import toast from "react-hot-toast";
import { Building, Globe, Mail, Phone, DollarSign, MapPin, Target, History, ArrowLeft } from "lucide-react";

interface Funder {
  id: string;
  name: string;
  website: string;
  contact: Record<string, any>;
  profile: string;
  org_type: string;
  regions: string[];
  thematic_focus: string[];
  min_ticket: number | null;
  max_ticket: number | null;
  investment_history: any[];
  created_at: string;
}

export default function FunderPage() {
  const { funderId } = useParams();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const { setLoadSession } = useSidebar();
  
  const [mounted, setMounted] = useState(false);
  const [funder, setFunder] = useState<Funder | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFunder, setIsFunder] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const isDark = mounted ? resolvedTheme === "dark" : false;

  // Fix hydration
  useEffect(() => {
    setMounted(true);
    setLoadSession(() => {});
    return () => setLoadSession(() => {});
  }, [setLoadSession]);

  useEffect(() => {
    const checkFunderProfile = async () => {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!token) {
        toast.error("Please log in to access this page.");
        router.push(`/auth/login?redirect=/funders/${funderId}`);
        return;
      }

      try {
        const response = await fetch("/api/profiles", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const profiles = await response.json();
          const hasFunderProfile = profiles.some((profile: any) => profile.type === "funder");
          setIsFunder(hasFunderProfile);
          if (!hasFunderProfile) {
            toast.error("You must have a funder profile to view this page.");
            router.push("/profiles");
          }
        } else {
          toast.error("Failed to verify profile.");
          router.push(`/auth/login?redirect=/funders/${funderId}`);
        }
      } catch (error) {
        console.error("Check profile error:", error);
        toast.error("Failed to verify profile.");
        router.push(`/auth/login?redirect=/funders/${funderId}`);
      } finally {
        setCheckingAuth(false);
      }
    };
    checkFunderProfile();
  }, [router, funderId]);

  useEffect(() => {
    if (!isFunder || checkingAuth) return;

    const fetchFunder = async () => {
      try {
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        const response = await fetch(`/api/funders/${funderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        setFunder(data);
      } catch (error) {
        console.error("Fetch funder error:", error);
        toast.error("Failed to load funder");
        router.push("/profiles");
      } finally {
        setLoading(false);
      }
    };
    fetchFunder();
  }, [funderId, router, isFunder, checkingAuth]);

  if (!mounted || checkingAuth || loading) {
    return (
      <div className={`min-h-screen ${isDark ? "bg-black" : "bg-gray-50"}`}>
        <div className="container mx-auto px-6 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
              <div className="space-y-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-20 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isFunder) {
    return null;
  }

  if (!funder) {
    return (
      <div className={`min-h-screen ${isDark ? "bg-black text-white" : "bg-gray-50 text-gray-900"}`}>
        <div className="container mx-auto px-6 py-8">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-lg opacity-70">Funder not found.</p>
          </div>
        </div>
      </div>
    );
  }

  const orgTypeLabels: Record<string, string> = {
    vc: "Venture Capital",
    angel: "Angel Investor", 
    gov: "Government Fund",
    foundation: "Foundation",
    corporate: "Corporate VC"
  };

  return (
    <div className={`min-h-screen overflow-y-auto ${isDark ? "bg-black text-white" : "bg-gray-50 text-gray-900"}`}>
      {/* Header */}
      <div className={`border-b ${isDark ? "border-gray-800" : "border-gray-200"}`}>
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className={`p-2 rounded-lg transition-colors ${
                isDark ? "hover:bg-gray-800" : "hover:bg-gray-100"
              }`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">Funder Details</h1>
              <p className="text-sm opacity-70">View organization information</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Basic Information */}
          <div className={`rounded-xl p-6 ${isDark ? "bg-gray-900" : "bg-white shadow-sm"}`}>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Building className="w-5 h-5" />
              Basic Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">Organization Name</label>
                <p className={`p-3 rounded-lg ${isDark ? "bg-gray-800" : "bg-gray-50"}`}>
                  {funder.name}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Organization Type</label>
                <p className={`p-3 rounded-lg ${isDark ? "bg-gray-800" : "bg-gray-50"}`}>
                  {orgTypeLabels[funder.org_type] || funder.org_type}
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Website
                </label>
                {funder.website ? (
                  <a
                    href={funder.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`p-3 rounded-lg block transition-colors ${
                      isDark 
                        ? "bg-gray-800 text-[#00FB75] hover:text-green-400" 
                        : "bg-gray-50 text-[#00FB75] hover:text-green-600"
                    }`}
                  >
                    {funder.website}
                  </a>
                ) : (
                  <p className={`p-3 rounded-lg ${isDark ? "bg-gray-800 opacity-50" : "bg-gray-50 opacity-50"}`}>
                    No website provided
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className={`rounded-xl p-6 ${isDark ? "bg-gray-900" : "bg-white shadow-sm"}`}>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Contact Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                {funder.contact?.email ? (
                  <div className={`p-3 rounded-lg ${isDark ? "bg-gray-800" : "bg-gray-50"}`}>
                    {funder.contact.email}
                  </div>
                ) : (
                  <p className={`p-3 rounded-lg ${isDark ? "bg-gray-800 opacity-50" : "bg-gray-50 opacity-50"}`}>
                    No email provided
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone
                </label>
                {funder.contact?.phone ? (
                  <div className={`p-3 rounded-lg ${isDark ? "bg-gray-800" : "bg-gray-50"}`}>
                    {funder.contact.phone}
                  </div>
                ) : (
                  <p className={`p-3 rounded-lg ${isDark ? "bg-gray-800 opacity-50" : "bg-gray-50 opacity-50"}`}>
                    No phone provided
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Organization Profile */}
          <div className={`rounded-xl p-6 ${isDark ? "bg-gray-900" : "bg-white shadow-sm"}`}>
            <h2 className="text-lg font-semibold mb-4">Organization Profile</h2>
            {funder.profile ? (
              <p className={`p-4 rounded-lg whitespace-pre-wrap ${isDark ? "bg-gray-800" : "bg-gray-50"}`}>
                {funder.profile}
              </p>
            ) : (
              <p className={`p-4 rounded-lg opacity-50 ${isDark ? "bg-gray-800" : "bg-gray-50"}`}>
                No profile description provided
              </p>
            )}
          </div>

          {/* Investment Regions */}
          <div className={`rounded-xl p-6 ${isDark ? "bg-gray-900" : "bg-white shadow-sm"}`}>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Investment Regions
            </h2>
            {funder.regions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {funder.regions.map((region, index) => (
                  <div
                    key={index}
                    className={`px-3 py-2 rounded-full ${
                      isDark ? "bg-gray-700" : "bg-gray-200"
                    }`}
                  >
                    <span className="text-sm">{region}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`p-3 rounded-lg opacity-50 ${isDark ? "bg-gray-800" : "bg-gray-50"}`}>
                No regions specified
              </p>
            )}
          </div>

          {/* Thematic Focus */}
          <div className={`rounded-xl p-6 ${isDark ? "bg-gray-900" : "bg-white shadow-sm"}`}>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target className="w-5 h-5" />
              Thematic Focus
            </h2>
            {funder.thematic_focus.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {funder.thematic_focus.map((focus, index) => (
                  <div
                    key={index}
                    className={`px-3 py-2 rounded-full ${
                      isDark ? "bg-gray-700" : "bg-gray-200"
                    }`}
                  >
                    <span className="text-sm">{focus}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`p-3 rounded-lg opacity-50 ${isDark ? "bg-gray-800" : "bg-gray-50"}`}>
                No focus areas specified
              </p>
            )}
          </div>

          {/* Investment Range */}
          <div className={`rounded-xl p-6 ${isDark ? "bg-gray-900" : "bg-white shadow-sm"}`}>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Investment Range
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Minimum Ticket Size ($)</label>
                {funder.min_ticket ? (
                  <p className={`p-3 rounded-lg ${isDark ? "bg-gray-800" : "bg-gray-50"}`}>
                    ${funder.min_ticket.toLocaleString()}
                  </p>
                ) : (
                  <p className={`p-3 rounded-lg opacity-50 ${isDark ? "bg-gray-800" : "bg-gray-50"}`}>
                    Not specified
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Maximum Ticket Size ($)</label>
                {funder.max_ticket ? (
                  <p className={`p-3 rounded-lg ${isDark ? "bg-gray-800" : "bg-gray-50"}`}>
                    ${funder.max_ticket.toLocaleString()}
                  </p>
                ) : (
                  <p className={`p-3 rounded-lg opacity-50 ${isDark ? "bg-gray-800" : "bg-gray-50"}`}>
                    Not specified
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Investment History */}
          <div className={`rounded-xl p-6 ${isDark ? "bg-gray-900" : "bg-white shadow-sm"}`}>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <History className="w-5 h-5" />
              Investment History
            </h2>
            {funder.investment_history.length > 0 ? (
              <div className="space-y-3">
                {funder.investment_history.map((investment, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg ${
                      isDark ? "bg-gray-800" : "bg-gray-50"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{investment.company}</h3>
                        <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                          ${investment.amount?.toLocaleString()} • {investment.year}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`p-4 rounded-lg opacity-50 ${isDark ? "bg-gray-800" : "bg-gray-50"}`}>
                No investment history available
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}