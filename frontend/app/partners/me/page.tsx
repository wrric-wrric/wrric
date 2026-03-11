"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building, PlusCircle, Settings, Clock, CheckCircle, XCircle, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

interface Partner {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  status: string;
  is_verified: boolean;
  created_at: string;
}

export default function MyPartnerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchMyPartners = async () => {
      try {
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        if (!token) {
          router.push("/auth/login?redirect=/partners/me");
          return;
        }

        const res = await fetch("/api/partners/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          // Backend returns array of partners
          const partnerList = Array.isArray(data) ? data : (data && data.id ? [data] : []);
          
          // Filter out any invalid entries
          const validPartners = partnerList.filter((p: Partner) => p && p.id);
          
          // If only one partner with a valid slug, redirect to manage page
          if (validPartners.length === 1 && validPartners[0].slug) {
            router.replace(`/partners/${validPartners[0].slug}/manage`);
            return;
          }
          
          setPartners(validPartners);
        } else {
          console.error("Failed to fetch partners, status:", res.status);
          setError(true);
        }
      } catch (error) {
        console.error("Failed to fetch partners:", error);
        setError(true);
        toast.error("Failed to load your partners");
      } finally {
        setLoading(false);
      }
    };

    fetchMyPartners();
  }, [router]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case "rejected":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "approved":
        return "Approved";
      case "pending":
        return "Pending Review";
      case "rejected":
        return "Rejected";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "text-green-500 bg-green-500/10";
      case "pending":
        return "text-yellow-500 bg-yellow-500/10";
      case "rejected":
        return "text-red-500 bg-red-500/10";
      default:
        return "text-muted-foreground bg-muted";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00FB75]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <XCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-muted-foreground mb-6">
            We couldn&apos;t load your partners. Please try again.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#00FB75] text-black rounded-lg font-medium hover:bg-[#00FB75]/90 transition-colors"
            >
              Try Again
            </button>
            <Link
              href="/partners"
              className="inline-flex items-center gap-2 px-6 py-3 border rounded-lg font-medium hover:bg-muted transition-colors"
            >
              Back to Partners
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (partners.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <Building className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h1 className="text-2xl font-bold mb-2">No Partner Organization</h1>
          <p className="text-muted-foreground mb-6">
            You don&apos;t have a partner organization yet. Create one to showcase your labs and grow your team.
          </p>
          <Link
            href="/partners/new"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#00FB75] text-black rounded-lg font-medium hover:bg-[#00FB75]/90 transition-colors"
          >
            <PlusCircle className="w-5 h-5" />
            Create Partner Organization
          </Link>
        </div>
      </div>
    );
  }

  // Show list of partners if more than one
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <button
              onClick={() => router.push("/partners")}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-3"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Partner Directory
            </button>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Building className="w-8 h-8 text-[#00FB75]" />
              My Partners
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage your partner applications and organizations
            </p>
          </div>
          <Link
            href="/partners/new"
            className="flex items-center gap-2 px-4 py-2 bg-[#00FB75] text-black rounded-lg font-medium hover:bg-[#00e065] transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Apply as Partner
          </Link>
        </div>

        {/* Partners List */}
        <div className="space-y-4">
          {partners.map((partner) => (
            <div
              key={partner.id}
              className="border rounded-xl p-5 bg-card hover:border-[#00FB75]/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  {partner.logo_url ? (
                    <img
                      src={partner.logo_url}
                      alt={partner.name}
                      className="w-14 h-14 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-[#00FB75]/10 flex items-center justify-center">
                      <Building className="w-7 h-7 text-[#00FB75]" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-lg">{partner.name}</h3>
                    {partner.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                        {partner.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(partner.status)}`}>
                        {getStatusIcon(partner.status)}
                        {getStatusText(partner.status)}
                      </span>
                      {partner.is_verified && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500">
                          <CheckCircle className="w-3 h-3" />
                          Verified
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Applied {new Date(partner.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {partner.status === "approved" && partner.slug && (
                    <button
                      onClick={() => router.push(`/partners/${partner.slug}`)}
                      className="px-3 py-1.5 text-sm border rounded-lg hover:bg-muted transition-colors"
                    >
                      View Page
                    </button>
                  )}
                  <button
                    onClick={() => router.push(`/partners/${partner.slug || partner.id}/manage`)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[#00FB75] text-black rounded-lg font-medium hover:bg-[#00e065] transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Manage
                  </button>
                </div>
              </div>

              {partner.status === "pending" && (
                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm text-yellow-600 dark:text-yellow-400">
                  Your application is being reviewed by an admin. You&apos;ll be notified once it&apos;s approved.
                </div>
              )}

              {partner.status === "rejected" && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-600 dark:text-red-400">
                  Your application was not approved. You can update your partner profile and resubmit, or contact support for more information.
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
