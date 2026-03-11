"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building, ArrowLeft, Upload, X, Image as ImageIcon } from "lucide-react";
import toast from "react-hot-toast";
import Image from "next/image";

function NewPartnerPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  const [form, setForm] = useState({
    name: "",
    description: "",
    website: "",
    contact_email: "",
    sector_focus: "",
    country: "",
    region: "",
    social_links: { linkedin: "", twitter: "" },
  });

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setForm((prev) => ({ ...prev, contact_email: emailParam }));
    }
  }, [searchParams]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      // Recommend max 1MB for reliable uploads, allow up to 2MB
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Image must be less than 2MB. Please compress or resize your image.");
        return;
      }
      if (file.size > 1 * 1024 * 1024) {
        toast("Large file detected. Upload may be slow.", { icon: "⚠️" });
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setLogoPreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview("");
    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Partner name is required");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!token) {
        toast.error("Please log in first");
        router.push("/auth/login?redirect=/partners/new");
        return;
      }

      const body = {
        name: form.name,
        description: form.description,
        website: form.website || undefined,
        contact_email: form.contact_email || undefined,
        sector_focus: form.sector_focus ? form.sector_focus.split(",").map((s) => s.trim()).filter(Boolean) : [],
        country: form.country || undefined,
        region: form.region || undefined,
        social_links: Object.fromEntries(
          Object.entries(form.social_links).filter(([, v]) => v)
        ),
      };

      // Create partner first
      const res = await fetch("/api/partners", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const partner = await res.json();
        let logoUploadSuccess = true;
        
        // Upload logo if provided (with timeout)
        if (logoFile && partner.id) {
          setUploadingLogo(true);
          try {
            const formData = new FormData();
            formData.append("file", logoFile);
            
            // Create AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
            
            const logoRes = await fetch(`/api/partners/${partner.id}/logo`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
              },
              body: formData,
              signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (!logoRes.ok) {
              logoUploadSuccess = false;
              console.error("Logo upload failed:", await logoRes.text());
            }
          } catch (uploadError: any) {
            logoUploadSuccess = false;
            if (uploadError.name === 'AbortError') {
              console.error("Logo upload timed out");
            } else {
              console.error("Logo upload error:", uploadError);
            }
          }
          setUploadingLogo(false);
        }
        
        // Show success message
        if (logoUploadSuccess) {
          toast.success("Partner application submitted! It will be reviewed by an admin shortly.");
        } else {
          toast.success("Partner application submitted! Logo upload failed - you can add it later from the manage page.");
        }
        router.push("/partners");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Failed to submit application");
      }
    } catch (error) {
      console.error("Partner creation error:", error);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
      setUploadingLogo(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex items-center gap-3 mb-8">
          <Building className="w-8 h-8 text-[#00FB75]" />
          <h1 className="text-3xl font-bold">Apply as Partner</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Logo Upload */}
          <div className="border rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold">Organization Logo</h2>
            <p className="text-sm text-muted-foreground">Upload your organization&apos;s logo (recommended: 200x200px, max 5MB)</p>
            
            <div className="flex items-center gap-4">
              {logoPreview ? (
                <div className="relative">
                  <div className="w-24 h-24 rounded-lg overflow-hidden border bg-muted">
                    <Image
                      src={logoPreview}
                      alt="Logo preview"
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => logoInputRef.current?.click()}
                  className="w-24 h-24 rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center cursor-pointer hover:border-[#00FB75] hover:bg-[#00FB75]/5 transition-colors"
                >
                  <ImageIcon className="w-8 h-8 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground mt-1">Add Logo</span>
                </div>
              )}
              
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
              />
              
              {!logoPreview && (
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="px-4 py-2 border rounded-lg hover:bg-muted transition-colors flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Choose File
                </button>
              )}
            </div>
          </div>

          {/* Basic Info */}
          <div className="border rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold">Basic Information</h2>
            <div>
              <label className="block text-sm font-medium mb-1">Organization Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-[#00FB75] focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-[#00FB75] focus:outline-none"
              />
            </div>
          </div>

          {/* Contact */}
          <div className="border rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold">Contact Information</h2>
            <div>
              <label className="block text-sm font-medium mb-1">Website</label>
              <input
                type="url"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-[#00FB75] focus:outline-none"
                placeholder="https://"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contact Email</label>
              <input
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-[#00FB75] focus:outline-none"
              />
            </div>
          </div>

          {/* Sector & Location */}
          <div className="border rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold">Sector & Location</h2>
            <div>
              <label className="block text-sm font-medium mb-1">Sector Focus (comma separated)</label>
              <input
                type="text"
                value={form.sector_focus}
                onChange={(e) => setForm({ ...form, sector_focus: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-[#00FB75] focus:outline-none"
                placeholder="climate, biotech, energy"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Country</label>
                <input
                  type="text"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-[#00FB75] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Region</label>
                <input
                  type="text"
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-[#00FB75] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Social Links */}
          <div className="border rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold">Social Links</h2>
            <div>
              <label className="block text-sm font-medium mb-1">LinkedIn</label>
              <input
                type="url"
                value={form.social_links.linkedin}
                onChange={(e) => setForm({ ...form, social_links: { ...form.social_links, linkedin: e.target.value } })}
                className="w-full px-4 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-[#00FB75] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Twitter / X</label>
              <input
                type="url"
                value={form.social_links.twitter}
                onChange={(e) => setForm({ ...form, social_links: { ...form.social_links, twitter: e.target.value } })}
                className="w-full px-4 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-[#00FB75] focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || uploadingLogo}
            className="w-full py-3 bg-[#00FB75] text-black font-semibold rounded-lg hover:bg-[#00e065] transition-colors disabled:opacity-50"
          >
            {uploadingLogo ? "Uploading Logo..." : loading ? "Submitting..." : "Submit Application"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function NewPartnerPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Loading...</div>
      </div>
    }>
      <NewPartnerPageContent />
    </Suspense>
  );
}