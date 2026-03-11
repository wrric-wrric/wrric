"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Building, Globe, Users, FlaskConical, ExternalLink, Settings } from "lucide-react";
import type { Partner } from "@/lib/types";
import FollowButton from "@/components/Lab/FollowButton";

interface PartnerLab {
  id: string;
  university: string;
  research_abstract: string;
  website: string | null;
  location: Record<string, string>;
  scopes: string[];
  entity_type: string;
  images: { id: string; url: string; caption: string; is_primary: boolean }[];
}

export default function PartnerStorefrontPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [labs, setLabs] = useState<PartnerLab[]>([]);
  const [activeTab, setActiveTab] = useState<"labs" | "about">("labs");
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const getCookie = (name: string): string | null => {
      if (typeof document === "undefined") return null;
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
      return null;
    };
    setIsAuthenticated(!!getCookie("user_id"));
    
    // Get user ID from localStorage
    const userId = typeof window !== "undefined" ? localStorage.getItem("user_id") : null;
    setCurrentUserId(userId);
  }, []);

  const fetchPartner = useCallback(async () => {
    if (!slug || slug === 'undefined') return;
    setLoading(true);
    try {
      const res = await fetch(`/api/partners/${slug}`);
      if (res.ok) {
        const p = await res.json();
        setPartner(p);
        // Fetch labs (public for approved partners)
        const labsRes = await fetch(`/api/partners/${p.id}/labs`);
        if (labsRes.ok) {
          const labsData = await labsRes.json();
          setLabs(labsData.items || []);
        }
      }
    } catch (error) {
      console.error("Failed to fetch partner:", error);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (slug && slug !== 'undefined') fetchPartner();
  }, [slug, fetchPartner]);
  
  // Check if user can manage this partner
  useEffect(() => {
    if (!partner || !currentUserId) {
      setCanManage(false);
      return;
    }
    
    // Check if user is the owner
    if (partner.owner?.id === currentUserId) {
      setCanManage(true);
      return;
    }
    
    // Check if user is a member with editor/owner role
    const checkMembership = async () => {
      try {
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        if (!token) {
          setCanManage(false);
          return;
        }
        
        const res = await fetch(`/api/partners/${partner.id}/members`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (res.ok) {
          const members = await res.json();
          const userMember = members.find((m: any) => m.user_id === currentUserId);
          setCanManage(userMember && (userMember.role === "owner" || userMember.role === "editor"));
        } else {
          setCanManage(false);
        }
      } catch {
        setCanManage(false);
      }
    };
    
    checkMembership();
  }, [partner, currentUserId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  if (!partner) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Partner not found</div>;

  return (
    <div className="min-h-screen bg-background">
      {/* Banner */}
      <div className="h-48 bg-gradient-to-r from-[#00FB75]/20 to-[#00FB75]/5 relative">
        {partner.banner_url && (
          <img src={partner.banner_url} alt="Banner" className="w-full h-full object-cover" />
        )}
      </div>

      <div className="max-w-5xl mx-auto px-6 -mt-16">
        {/* Header */}
        <div className="flex items-end gap-6 mb-8">
          <div className="w-24 h-24 rounded-xl bg-card border-4 border-background flex items-center justify-center overflow-hidden">
            {partner.logo_url ? (
              <img src={partner.logo_url} alt={partner.name} className="w-full h-full object-cover" />
            ) : (
              <Building className="w-10 h-10 text-[#00FB75]" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{partner.name}</h1>
              {partner.is_verified && (
                <span className="text-xs bg-[#00FB75] text-black px-2 py-0.5 rounded-full font-medium">Verified</span>
              )}
            </div>
            {partner.country && <p className="text-muted-foreground mt-1">{partner.country}{partner.region ? `, ${partner.region}` : ""}</p>}
          </div>
          <div className="flex items-center gap-3">
            <FollowButton
              targetType="partner"
              targetId={partner.id}
              isAuthenticated={isAuthenticated}
              onAuthRequired={() => router.push(`/auth/login?redirect=/partners/${slug}`)}
              size="sm"
            />
            {canManage && (
              <button
                onClick={() => router.push(`/partners/${slug}/manage`)}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-accent transition-colors"
              >
                <Settings className="w-4 h-4" />
                Manage
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6 mb-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{partner.member_count} member{partner.member_count !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <FlaskConical className="w-4 h-4" />
            <span>{partner.lab_count} lab{partner.lab_count !== 1 ? "s" : ""}</span>
          </div>
          {partner.website && (
            <a href={partner.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#00FB75] hover:underline">
              <Globe className="w-4 h-4" />
              Website
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Sector Tags */}
        {partner.sector_focus.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {partner.sector_focus.map((s) => (
              <span key={s} className="text-sm px-3 py-1 bg-[#00FB75]/10 text-[#00FB75] rounded-full">{s}</span>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b">
          <button
            onClick={() => setActiveTab("labs")}
            className={`pb-3 px-1 font-medium flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "labs" ? "border-[#00FB75] text-[#00FB75]" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FlaskConical className="w-4 h-4" /> Labs ({labs.length})
          </button>
          <button
            onClick={() => setActiveTab("about")}
            className={`pb-3 px-1 font-medium flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "about" ? "border-[#00FB75] text-[#00FB75]" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            About
          </button>
        </div>

        {/* Labs Tab */}
        {activeTab === "labs" && (
          <div className="space-y-4">
            {labs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No labs associated with this partner yet.</div>
            ) : (
              labs.map((lab) => (
                <div
                  key={lab.id}
                  onClick={() => router.push(`/labs/${lab.id}`)}
                  className="border rounded-xl p-5 hover:border-[#00FB75] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <FlaskConical className="w-5 h-5 text-[#00FB75]" />
                    <h3 className="font-semibold text-lg">{lab.university || "Unnamed Lab"}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{lab.research_abstract || "No description"}</p>
                  <div className="flex flex-wrap gap-2">
                    {(lab.scopes || []).slice(0, 4).map((s) => (
                      <span key={s} className="text-xs px-2 py-0.5 bg-[#00FB75]/10 text-[#00FB75] rounded-full">{s}</span>
                    ))}
                    {lab.location?.country && <span className="text-xs text-muted-foreground">{lab.location.country}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* About Tab */}
        {activeTab === "about" && (
          <>
            <div className="border rounded-xl p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">About</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">{partner.description || "No description provided."}</p>
            </div>

            {Object.keys(partner.social_links).length > 0 && (
              <div className="border rounded-xl p-6">
                <h2 className="text-xl font-semibold mb-4">Social Links</h2>
                <div className="flex flex-wrap gap-4">
                  {Object.entries(partner.social_links).map(([key, url]) => (
                    <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#00FB75] hover:underline capitalize">
                      <ExternalLink className="w-4 h-4" />
                      {key}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
