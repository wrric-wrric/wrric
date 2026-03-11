"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { useSidebar } from "@/hooks/sideBarProvider";
import toast from "react-hot-toast";
import {
  Building, MapPin, Globe, Mail, User, ArrowLeft, Plus, X, Upload,
  FlaskConical, Target, Award, Check, Loader2, AlertCircle,
  Shield, Zap, Activity, Info, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { clsx } from "clsx";
import ProfileSelect from "@/components/ProfileSelect";

type ImageUpload = { id: string; file: File; preview: string; isUploading?: boolean; uploadError?: boolean; };

function ImageUploadPreview({ files, onRemove }: { files: ImageUpload[]; onRemove: (id: string) => void; }) {
  if (files.length === 0) return null;
  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Asset Queue ({files.length}/10)</h4>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {files.map((file) => (
          <div key={file.id} className="relative group aspect-video">
            <div className="w-full h-full rounded-2xl overflow-hidden border border-white/5 bg-white/[0.02]">
              <img src={file.preview} alt={file.file.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
              {file.isUploading && <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}
              {file.uploadError && <div className="absolute inset-0 flex items-center justify-center bg-red-500/80 backdrop-blur-sm"><AlertCircle className="w-6 h-6 text-white" /></div>}
            </div>
            <Button variant="ghost" size="icon" onClick={() => onRemove(file.id)} className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-red-500 text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600">
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateLabPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const partnerId = searchParams.get("partner_id");
  const { setLoadSession } = useSidebar();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageFiles, setImageFiles] = useState<ImageUpload[]>([]);
  const [uploadedImageIds, setUploadedImageIds] = useState<string[]>([]);
  const [partnerName, setPartnerName] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    university: "", research_abstract: "", website: "", url: "",
    department_name: "", department_faculty: "", department_focus: "",
    location_city: "", location_country: "", location_address: "",
    point_of_contact_name: "", point_of_contact_email: "", point_of_contact_phone: "", point_of_contact_position: "",
    scopes: "", lab_equipment_items: "", lab_equipment_description: "",
    climate_tech_focus: "", climate_impact_metrics_description: "", climate_impact_metrics_targets: "",
  });

  useEffect(() => {
    setMounted(true);
    setLoadSession(() => { });
    if (partnerId) {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      fetch(`/api/partners/${partnerId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        .then(r => r.ok ? r.json() : null)
        .then(p => { if (p) setPartnerName(p.name); })
        .catch(() => { });
    }
    return () => setLoadSession(() => { });
  }, [setLoadSession, partnerId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newImages: ImageUpload[] = files.map((file) => ({ id: Math.random().toString(36).substring(7), file, preview: URL.createObjectURL(file) }));
    setImageFiles((prev) => [...prev, ...newImages].slice(0, 10));
    e.target.value = "";
  };

  const removeImage = (id: string) => {
    setImageFiles((prev) => {
      const image = prev.find((img) => img.id === id);
      if (image) URL.revokeObjectURL(image.preview);
      return prev.filter((img) => img.id !== id);
    });
    setUploadedImageIds((prev) => prev.filter((imgId) => imgId !== id));
  };

  const uploadImages = async (): Promise<string[]> => {
    const uploadPromises = imageFiles
      .filter((img) => !uploadedImageIds.includes(img.id))
      .map(async (img) => {
        const formDataImg = new FormData();
        formDataImg.append("file", img.file);
        try {
          const token = localStorage.getItem("token") || sessionStorage.getItem("token");
          const response = await fetch("/api/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formDataImg });
          if (!response.ok) throw new Error();
          const data = await response.json();
          setUploadedImageIds((prev) => [...prev, img.id]);
          return data.id;
        } catch {
          setImageFiles((prev) => prev.map((p) => p.id === img.id ? { ...p, uploadError: true } : p));
          return null;
        }
      });
    const results = await Promise.all(uploadPromises);
    return results.filter((id): id is string => id !== null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfileId) { toast.error("Entity Unidentified: Identity Profile Required"); return; }
    if (!formData.university) { toast.error("Entity Name Missing: Required Field"); return; }

    setCreating(true);
    try {
      setUploading(true);
      const uploadedIds = await uploadImages();
      setUploading(false);
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const data = new FormData();
      data.append("profile_id", selectedProfileId);
      data.append("university", formData.university);
      data.append("research_abstract", formData.research_abstract);
      data.append("website", formData.website);
      data.append("url", formData.url);
      data.append("department_name", formData.department_name);
      data.append("department_faculty", formData.department_faculty);
      data.append("department_focus", formData.department_focus);
      data.append("location_city", formData.location_city);
      data.append("location_country", formData.location_country);
      data.append("location_address", formData.location_address);
      data.append("point_of_contact_name", formData.point_of_contact_name);
      data.append("point_of_contact_email", formData.point_of_contact_email);
      data.append("point_of_contact_phone", formData.point_of_contact_phone);
      data.append("point_of_contact_position", formData.point_of_contact_position);
      data.append("scopes", formData.scopes);
      data.append("lab_equipment_items", formData.lab_equipment_items);
      data.append("lab_equipment_description", formData.lab_equipment_description);
      data.append("climate_tech_focus", formData.climate_tech_focus);
      data.append("climate_impact_metrics_description", formData.climate_impact_metrics_description);
      data.append("climate_impact_metrics_targets", formData.climate_impact_metrics_targets);
      data.append("image_ids", JSON.stringify(uploadedIds));

      const response = await fetch("/api/user-labs", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: data
      });

      if (!response.ok) throw new Error();
      const createdLab = await response.json();

      if (partnerId && createdLab.id) {
        try {
          await fetch(`/api/partners/${partnerId}/labs/${createdLab.id}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
          toast.success("Entity Integrated: Lab assigned to network");
          router.push(`/partners/${partnerId}/manage`);
          return;
        } catch {
          toast.success("Entity Initialized: Network assignment pending");
        }
      } else {
        toast.success("Entity Registered Successfully");
      }
      router.push("/user-labs");
    } catch {
      toast.error("Initialization Failed: Check network uplink");
    } finally {
      setCreating(false);
      setUploading(false);
    }
  };

  if (!mounted) return null;

  const isSubmitting = creating || uploading;
  const labelClass = "text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-2 block px-1";

  return (
    <div className="h-full flex flex-col bg-[#050505]">
      <header className="sticky top-0 z-50 backdrop-blur-3xl border-b border-white/5 bg-black/40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()} disabled={isSubmitting} className="rounded-xl hover:bg-white/5">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="h-8 w-[1px] bg-white/10" />
            <div>
              <h1 className="text-sm font-black uppercase tracking-widest text-white">Initialize New Entity</h1>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Lab Registration Protocol</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.back()} disabled={isSubmitting} className="text-[10px] font-black uppercase tracking-widest hover:text-white/60">
              Abort
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="h-10 bg-primary text-black hover:bg-primary/90 rounded-xl px-6 font-black shadow-[0_0_20px_rgba(0,251,117,0.2)]">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              <span className="text-[10px] uppercase tracking-widest">{isSubmitting ? "Processing..." : "Initialise Entity"}</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-12 pb-32 space-y-12">
          {partnerId && (
            <div className="p-6 rounded-3xl bg-primary/5 border border-primary/20 flex items-center gap-6 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-50" />
              <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center text-primary relative z-10">
                <Shield className="w-8 h-8" />
              </div>
              <div className="relative z-10">
                <h3 className="text-xs font-black uppercase tracking-widest text-primary mb-1">Network Uplink Active</h3>
                <p className="text-sm font-bold text-white/80">Registering Lab for <span className="text-primary font-black underline decoration-primary/30 underline-offset-4">{partnerName || 'Target Organization'}</span></p>
              </div>
            </div>
          )}

          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-primary">
                <User className="w-4 h-4" />
              </div>
              <h2 className="text-xs font-black uppercase tracking-widest text-white">Identity Authorization</h2>
            </div>
            <Card className="border-white/5 bg-white/[0.02] backdrop-blur-3xl overflow-hidden">
              <CardContent className="p-8">
                <ProfileSelect onProfileSelect={setSelectedProfileId} selectedProfileId={selectedProfileId} disabled={isSubmitting} />
              </CardContent>
            </Card>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-primary">
                <Building className="w-4 h-4" />
              </div>
              <h2 className="text-xs font-black uppercase tracking-widest text-white">Entity Intelligence</h2>
            </div>
            <Card className="border-white/5 bg-white/[0.02] backdrop-blur-3xl">
              <CardContent className="p-8 space-y-8">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="md:col-span-2 space-y-2">
                    <label className={labelClass}>Institutional Descriptor *</label>
                    <Input name="university" value={formData.university} onChange={handleInputChange} placeholder="e.g. ADVANCED RESEARCH FACILITY" className="h-14 bg-white/5 border-white/10 rounded-2xl focus:border-primary/50 text-base font-bold tracking-tight uppercase" required />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Domain Node (Website)</label>
                    <Input name="website" value={formData.website} onChange={handleInputChange} placeholder="https://..." className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 text-sm font-medium" />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Remote Portal URL</label>
                    <Input name="url" value={formData.url} onChange={handleInputChange} placeholder="https://..." className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 text-sm font-medium" />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className={labelClass}>Mission parameters (Abstract)</label>
                    <textarea name="research_abstract" value={formData.research_abstract} onChange={handleInputChange} placeholder="EXECUTE MISSION OVERVIEW..." rows={4} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:border-primary/50 transition-all resize-none" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <div className="grid lg:grid-cols-2 gap-12">
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-primary">
                  <FlaskConical className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-black uppercase tracking-widest text-white">Departmental Grid</h2>
              </div>
              <Card className="border-white/5 bg-white/[0.02] backdrop-blur-3xl">
                <CardContent className="p-8 space-y-6">
                  <div className="space-y-2">
                    <label className={labelClass}>Department Alias</label>
                    <Input name="department_name" value={formData.department_name} onChange={handleInputChange} placeholder="E.G. QUANTUM COMPUTING" className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 text-sm font-bold uppercase" />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Faculty Classification</label>
                    <Input name="department_faculty" value={formData.department_faculty} onChange={handleInputChange} placeholder="E.G. ENGINEERING" className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 text-sm font-bold uppercase" />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Core Focal Point</label>
                    <Input name="department_focus" value={formData.department_focus} onChange={handleInputChange} placeholder="E.G. NEURAL NETWORKS" className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 text-sm font-bold uppercase" />
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-primary">
                  <MapPin className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-black uppercase tracking-widest text-white">Geospatial Data</h2>
              </div>
              <Card className="border-white/5 bg-white/[0.02] backdrop-blur-3xl">
                <CardContent className="p-8 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className={labelClass}>City Node</label>
                      <Input name="location_city" value={formData.location_city} onChange={handleInputChange} placeholder="ACCRA" className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 text-sm font-bold uppercase" />
                    </div>
                    <div className="space-y-2">
                      <label className={labelClass}>Sovereign Code</label>
                      <Input name="location_country" value={formData.location_country} onChange={handleInputChange} placeholder="GHANA" className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 text-sm font-bold uppercase" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Physical Coordinates</label>
                    <Input name="location_address" value={formData.location_address} onChange={handleInputChange} placeholder="SECTOR 7G..." className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 text-sm font-medium" />
                  </div>
                </CardContent>
              </Card>
            </section>
          </div>

          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-primary">
                <Sparkles className="w-4 h-4" />
              </div>
              <h2 className="text-xs font-black uppercase tracking-widest text-white">Capability Stack</h2>
            </div>
            <Card className="border-white/5 bg-white/[0.02] backdrop-blur-3xl">
              <CardContent className="p-8 space-y-8">
                <div className="space-y-2">
                  <label className={labelClass}>Strategic Scopes (Comma Separated)</label>
                  <Input name="scopes" value={formData.scopes} onChange={handleInputChange} placeholder="BLOCKCHAIN, IOT, BIOTECH..." className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 text-sm font-bold uppercase placeholder:opacity-30" />
                </div>
                <Separator className="bg-white/5" />
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className={labelClass}>Critical Hardware (Inventory)</label>
                    <Input name="lab_equipment_items" value={formData.lab_equipment_items} onChange={handleInputChange} placeholder="QUANTUM PROCESSORS, SPECTROMETERS..." className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 text-sm font-bold uppercase" />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Climate Alignment Vectors</label>
                    <Input name="climate_tech_focus" value={formData.climate_tech_focus} onChange={handleInputChange} placeholder="DECARBONIZATION, CIRCULARITY..." className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 text-sm font-bold uppercase" />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className={labelClass}>Impact Projections & Targets</label>
                    <textarea name="climate_impact_metrics_description" value={formData.climate_impact_metrics_description} onChange={handleInputChange} placeholder="DOCUMENT IMPACT METRICS..." rows={3} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:border-primary/50 transition-all resize-none" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-primary">
                <Upload className="w-4 h-4" />
              </div>
              <h2 className="text-xs font-black uppercase tracking-widest text-white">Visual Intelligence</h2>
            </div>
            <Card className="border-white/5 bg-white/[0.02] backdrop-blur-3xl">
              <CardContent className="p-8">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-white/10 rounded-3xl p-12 text-center cursor-pointer hover:border-primary/40 hover:bg-white/[0.02] transition-all group"
                >
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-primary mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-white mb-2">Initialize Asset Transfer</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">PNG, JPG, WEBP • MAX 10MB • UP TO 10 ASSETS</p>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" />
                <ImageUploadPreview files={imageFiles} onRemove={removeImage} />
              </CardContent>
            </Card>
          </section>
        </div>
      </div>

      <div className="sticky bottom-0 z-50 p-6 backdrop-blur-3xl border-t border-white/5 bg-black/40">
        <div className="max-w-5xl mx-auto flex gap-4">
          <Button variant="outline" onClick={() => router.back()} disabled={isSubmitting} className="h-14 flex-1 border-white/10 bg-white/5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:border-white/20">
            Cancel Registration
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="h-14 flex-[2] bg-primary text-black hover:bg-primary/90 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-[0_0_30px_rgba(0,251,117,0.3)]">
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Plus className="w-5 h-5 mr-3" />}
            {creating ? "Finalizing Registry..." : "Finalize Entity Initialization"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CreateLabPage() {
  return (
    <Suspense fallback={
      <div className="h-full flex flex-col items-center justify-center p-20 space-y-4 bg-black">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 animate-pulse">Establishing Secure Uplink...</p>
      </div>
    }>
      <CreateLabPageContent />
    </Suspense>
  );
}
