"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSidebar } from "@/hooks/sideBarProvider";
import toast from "react-hot-toast";
import {
  Building, MapPin, Globe, Mail, User, ArrowLeft, Plus, X, Upload,
  FlaskConical, Target, Award, Check, Edit3, Loader2, AlertCircle,
  Shield, Zap, Activity, Info, Sparkles, Image as ImageIcon, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import ProfileSelect from "@/components/ProfileSelect";
import { clsx } from "clsx";

interface Lab {
  id: string;
  university: string;
  research_abstract: string;
  location: { city?: string; country?: string; address?: string; };
  department: { name?: string; faculty?: string; };
  point_of_contact: { name?: string; email?: string; phone?: string; position?: string; };
  scopes: string[];
  lab_equipment: { items?: string[]; description?: string; };
  climate_tech_focus: string[];
  climate_impact_metrics: { description?: string; targets?: string[]; };
  website?: string;
  images: Array<{ id: string; url: string; caption?: string; is_primary: boolean; }>;
}

type ImageTile = {
  id: string;
  url: string;
  objectKey: string;
  caption?: string;
  is_primary: boolean;
  isUploading?: boolean;
  uploadError?: boolean;
};

function InlineCaption({ image, onSave }: { image: ImageTile; onSave: (caption: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(image.caption ?? "");

  useEffect(() => { setValue(image.caption ?? ""); }, [image.caption]);

  if (editing) {
    return (
      <div className="p-3 bg-black/60 backdrop-blur-md border-t border-white/5 space-y-3">
        <Input
          className="h-10 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 text-xs font-medium"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Describe this asset..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') { onSave(value); setEditing(false); }
            if (e.key === 'Escape') { setValue(image.caption ?? ""); setEditing(false); }
          }}
          autoFocus
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={() => { onSave(value); setEditing(false); }} className="flex-1 bg-primary text-black h-8 rounded-lg text-[10px] font-black uppercase tracking-widest">
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setValue(image.caption ?? ""); setEditing(false); }} className="flex-1 h-8 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-white/5">
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border-t border-white/5 bg-black/20">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/90 truncate">
            {image.caption || "Untitled Asset"}
          </p>
          {!image.caption && <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mt-1">Ready for metadata</p>}
        </div>
        <Button variant="ghost" size="icon" onClick={() => setEditing(true)} className="h-7 w-7 rounded-lg hover:bg-white/5 text-primary">
          <Edit3 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function ImageUploadPreview({ files, onRemove }: {
  files: Array<{ id: string; file: File; preview: string }>;
  onRemove: (id: string) => void;
}) {
  if (files.length === 0) return null;

  return (
    <div className="mt-8 space-y-4">
      <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60 px-1">Upload Queue ({files.length})</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {files.map((file) => (
          <div key={file.id} className="relative group aspect-video">
            <div className="w-full h-full rounded-2xl overflow-hidden border border-white/10 bg-white/[0.02]">
              <img src={file.preview} alt={file.file.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
              <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-[8px] font-black uppercase tracking-widest text-white truncate">{file.file.name}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onRemove(file.id)} className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-red-500 text-white shadow-xl opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600">
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Main Component
export default function EditLabPage() {
  const { labId } = useParams();
  const router = useRouter();
  const { setLoadSession } = useSidebar();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageKeys, setImageKeys] = useState<{ [id: string]: string }>({}); // Store object keys

  const [formData, setFormData] = useState({
    university: "",
    research_abstract: "",
    location: { city: "", country: "", address: "" },
    department: { name: "", faculty: "" },
    point_of_contact: { name: "", email: "", phone: "", position: "" },
    scopes: [] as string[],
    lab_equipment: { items: [] as string[], description: "" },
    climate_tech_focus: [] as string[],
    climate_impact_metrics: { description: "", targets: [] as string[] },
    website: "",
    images: [] as ImageTile[]
  });

  const [selectedFiles, setSelectedFiles] = useState<Array<{ id: string; file: File; preview: string }>>([]);
  const [newScope, setNewScope] = useState("");
  const [newEquipment, setNewEquipment] = useState("");
  const [newFocus, setNewFocus] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");

  // Fix hydration
  useEffect(() => {
    setMounted(true);
    setLoadSession(() => { });
    return () => setLoadSession(() => { });
  }, [setLoadSession]);

  // Fetch lab data
  useEffect(() => {
    const fetchLabAndImages = async () => {
      try {
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        const response = await fetch(`/api/user-labs/${labId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        setFormData(prev => ({
          ...prev,
          university: data.university || "",
          research_abstract: data.research_abstract || "",
          location: data.location || { city: "", country: "", address: "" },
          department: data.department || { name: "", faculty: "" },
          point_of_contact: data.point_of_contact || { name: "", email: "", phone: "", position: "" },
          scopes: data.scopes || [],
          lab_equipment: data.lab_equipment || { items: [], description: "" },
          climate_tech_focus: data.climate_tech_focus || [],
          climate_impact_metrics: data.climate_impact_metrics || { description: "", targets: [] },
          website: data.website || "",
          images: (data.images || []).map((i: any) => ({
            id: String(i.id),
            url: i.url, // Presigned URL for display
            objectKey: i.url.split("?")[0].split("/").slice(-3).join("/"), // Extract object key
            caption: i.caption,
            is_primary: Boolean(i.is_primary)
          }))
        }));

        // Initialize selectedProfileId from lab data
        setSelectedProfileId(data.profile_id || "");

        // Initialize imageKeys from data.images
        setImageKeys((data.images || []).reduce((acc: { [id: string]: string }, i: any) => ({
          ...acc,
          [String(i.id)]: i.url.split("?")[0].split("/").slice(-3).join("/")
        }), {}));
      } catch (error) {
        console.error("Fetch lab error:", error);
        toast.error("Failed to load lab data");
        router.push("/user-labs");
      } finally {
        setLoading(false);
      }
    };
    fetchLabAndImages();
  }, [labId, router]);

  // Fetch images (for display refresh)
  const fetchImages = async () => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!token) return;

      const resp = await fetch(`/api/user-labs/${labId}/images`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!resp.ok) {
        console.warn("Failed to fetch images:", resp.status);
        return;
      }

      const imgs = await resp.json();
      setFormData(prev => ({
        ...prev,
        images: imgs.map((i: any) => ({
          id: String(i.id),
          url: i.url, // Presigned URL for display
          objectKey: imageKeys[String(i.id)] || i.url.split("?")[0].split("/").slice(-3).join("/"), // Preserve or extract object key
          caption: i.caption,
          is_primary: Boolean(i.is_primary)
        }))
      }));
    } catch (err) {
      console.error("fetchImages error:", err);
    }
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);

    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      // Prepare form data with object keys
      const submitData = {
        ...formData,
        profile_id: selectedProfileId || null,
        images: formData.images.map(img => ({
          id: img.id,
          url: imageKeys[img.id] || img.objectKey, // Use object key
          caption: img.caption,
          is_primary: img.is_primary
        }))
      };

      const response = await fetch(`/api/user-labs/${labId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);

        // Handle profile-related errors
        if (errorData?.detail?.includes("Profile not found or not owned by user")) {
          toast.error("Please select a valid profile to associate with this lab.");
          setUpdating(false);
          return;
        }

        throw new Error(errorData?.detail || `HTTP ${response.status}`);
      }

      toast.success("Lab updated successfully!");
      router.push("/user-labs");
    } catch (error) {
      console.error("Update lab error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update lab");
    } finally {
      setUpdating(false);
    }
  };

  // Input change handler
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...((prev as any)[parent] ?? {}),
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // File selection handler
  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: Array<{ id: string; file: File; preview: string }> = [];

    Array.from(files).forEach((file, index) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error(`"${file.name}" is not an image file`);
        return;
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`"${file.name}" is too large (max 5MB)`);
        return;
      }

      const id = `local-${Date.now()}-${index}`;
      const reader = new FileReader();

      reader.onload = (ev) => {
        setSelectedFiles(prev => [...prev, { id, file, preview: String(ev.target?.result) }]);
      };
      reader.readAsDataURL(file);
      newFiles.push({ id, file, preview: '' });
    });

    if (newFiles.length > 0) {
      toast.success(`Added ${newFiles.length} image(s) to upload queue`);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Remove selected file
  const removeSelectedFile = (id: string) => {
    setSelectedFiles(prev => prev.filter(file => file.id !== id));
  };

  // Upload files
  const uploadSelectedFiles = async () => {
    if (selectedFiles.length === 0) {
      toast("Please select files to upload first");
      return;
    }

    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) {
      toast.error("Authentication required for upload");
      return;
    }

    setUploading(true);

    // Add optimistic placeholders
    const placeholders: ImageTile[] = selectedFiles.map(s => ({
      id: s.id,
      url: s.preview,
      objectKey: s.preview, // Temporary
      caption: "",
      is_primary: false,
      isUploading: true
    }));

    setFormData(prev => ({ ...prev, images: [...prev.images, ...placeholders] }));

    const formData = new FormData();
    selectedFiles.forEach(s => {
      formData.append("files", s.file);
    });

    try {
      const resp = await fetch(`/api/user-labs/${labId}/images`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        throw new Error(err?.detail || "Upload failed");
      }

      const createdImages = await resp.json();

      if (!Array.isArray(createdImages)) {
        throw new Error("Unexpected upload response");
      }

      // Update imageKeys and formData
      const newImageKeys = createdImages.reduce((acc: { [id: string]: string }, ci: any) => ({
        ...acc,
        [String(ci.id)]: ci.url // Object key from POST /images
      }), {});

      setImageKeys(prev => ({ ...prev, ...newImageKeys }));

      setFormData(prev => {
        const filtered = prev.images.filter(i => !i.id.startsWith("local-"));
        const mapped = createdImages.map((ci: any) => ({
          id: String(ci.id),
          url: ci.url, // Presigned URL will be updated by fetchImages
          objectKey: ci.url, // Object key
          caption: ci.caption,
          is_primary: Boolean(ci.is_primary)
        }));
        return { ...prev, images: [...filtered, ...mapped] };
      });

      toast.success(`Successfully uploaded ${createdImages.length} image(s)`);
      setSelectedFiles([]);

    } catch (err) {
      console.error("Upload exception:", err);
      toast.error(err instanceof Error ? err.message : "Image upload failed");

      // Mark placeholders as errored
      setFormData(prev => ({
        ...prev,
        images: prev.images.map(img =>
          img.id.startsWith("local-") ? { ...img, isUploading: false, uploadError: true } : img
        )
      }));
    } finally {
      setUploading(false);
      await fetchImages(); // Sync display URLs
    }
  };

  // Set primary image
  const setPrimary = async (imageId: string) => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) return toast.error("Authentication required");

    try {
      const resp = await fetch(`/api/user-labs/${labId}/images/${imageId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ is_primary: true })
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        throw new Error(err?.detail || "Failed to set primary");
      }

      await fetchImages();
      toast.success("Primary image updated");
    } catch (err) {
      console.error("setPrimary error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to set primary image");
    }
  };

  // Save caption
  const saveCaption = async (imageId: string, caption: string) => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) return toast.error("Authentication required");

    try {
      // Optimistic update
      setFormData(prev => ({
        ...prev,
        images: prev.images.map(img => img.id === imageId ? { ...img, caption } : img)
      }));

      const resp = await fetch(`/api/user-labs/${labId}/images/${imageId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ caption })
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        throw new Error(err?.detail || "Failed to save caption");
      }

      toast.success("Caption saved");
    } catch (err) {
      console.error("saveCaption error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to save caption");
      await fetchImages(); // Revert
    }
  };

  // Delete image
  const deleteImage = async (imageId: string) => {
    if (!confirm("Are you sure you want to delete this image? This action cannot be undone.")) return;

    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) return toast.error("Authentication required");

    try {
      const resp = await fetch(`/api/user-labs/${labId}/images/${imageId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        throw new Error(err?.detail || "Failed to delete image");
      }

      setFormData(prev => ({
        ...prev,
        images: prev.images.filter(i => i.id !== imageId)
      }));
      setImageKeys(prev => {
        const { [imageId]: _, ...rest } = prev;
        return rest;
      });

      toast.success("Image deleted");
    } catch (err) {
      console.error("deleteImage error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to delete image");
    }
  };

  // Array helpers
  const addScope = () => {
    if (newScope.trim() && !formData.scopes.includes(newScope.trim())) {
      setFormData(prev => ({
        ...prev,
        scopes: [...prev.scopes, newScope.trim()]
      }));
      setNewScope("");
    }
  };

  const removeScope = (index: number) => {
    setFormData(prev => ({
      ...prev,
      scopes: prev.scopes.filter((_, i) => i !== index)
    }));
  };

  const addEquipment = () => {
    if (newEquipment.trim() && !formData.lab_equipment.items.includes(newEquipment.trim())) {
      setFormData(prev => ({
        ...prev,
        lab_equipment: {
          ...prev.lab_equipment,
          items: [...prev.lab_equipment.items, newEquipment.trim()]
        }
      }));
      setNewEquipment("");
    }
  };

  const removeEquipment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      lab_equipment: {
        ...prev.lab_equipment,
        items: prev.lab_equipment.items.filter((_, i) => i !== index)
      }
    }));
  };

  const addFocus = () => {
    if (newFocus.trim() && !formData.climate_tech_focus.includes(newFocus.trim())) {
      setFormData(prev => ({
        ...prev,
        climate_tech_focus: [...prev.climate_tech_focus, newFocus.trim()]
      }));
      setNewFocus("");
    }
  };

  const removeFocus = (index: number) => {
    setFormData(prev => ({
      ...prev,
      climate_tech_focus: prev.climate_tech_focus.filter((_, i) => i !== index)
    }));
  };

  const addTarget = () => {
    if (newTarget.trim() && !formData.climate_impact_metrics.targets.includes(newTarget.trim())) {
      setFormData(prev => ({
        ...prev,
        climate_impact_metrics: {
          ...prev.climate_impact_metrics,
          targets: [...prev.climate_impact_metrics.targets, newTarget.trim()]
        }
      }));
      setNewTarget("");
    }
  };

  const removeTarget = (index: number) => {
    setFormData(prev => ({
      ...prev,
      climate_impact_metrics: {
        ...prev.climate_impact_metrics,
        targets: prev.climate_impact_metrics.targets.filter((_, i) => i !== index)
      }
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent, callback: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      callback();
    }
  };

  // Get primary image for preview
  const getPrimaryImage = () => {
    return formData.images.find(img => img.is_primary) || formData.images[0];
  };

  if (!mounted || loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-20 space-y-4 bg-black">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 animate-pulse">Establishing Secure Uplink...</p>
      </div>
    );
  }

  const labelClass = "text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-2 block px-1";

  return (
    <div className="h-full flex flex-col bg-[#050505]">
      <header className="sticky top-0 z-50 backdrop-blur-3xl border-b border-white/5 bg-black/40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()} disabled={updating} className="rounded-xl hover:bg-white/5">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="h-8 w-[1px] bg-white/10" />
            <div>
              <h1 className="text-sm font-black uppercase tracking-widest text-white">Update Entity Configuration</h1>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Lab Modification Protocol</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.back()} disabled={updating} className="text-[10px] font-black uppercase tracking-widest hover:text-white/60">
              Abort
            </Button>
            <Button onClick={handleSubmit} disabled={updating} className="h-10 bg-primary text-black hover:bg-primary/90 rounded-xl px-6 font-black shadow-[0_0_20px_rgba(0,251,117,0.2)]">
              {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              <span className="text-[10px] uppercase tracking-widest">{updating ? "Synchronizing..." : "Commit Update"}</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-12 pb-32 space-y-12">
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-primary">
                <User className="w-4 h-4" />
              </div>
              <h2 className="text-xs font-black uppercase tracking-widest text-white">Identity Authorization</h2>
            </div>
            <Card className="border-white/5 bg-white/[0.02] backdrop-blur-3xl overflow-hidden">
              <CardContent className="p-8">
                <ProfileSelect onProfileSelect={setSelectedProfileId} selectedProfileId={selectedProfileId} disabled={updating} />
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
                    <Input name="department.name" value={formData.department.name} onChange={handleInputChange} placeholder="E.G. QUANTUM COMPUTING" className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 text-sm font-bold uppercase" />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Faculty Classification</label>
                    <Input name="department.faculty" value={formData.department.faculty} onChange={handleInputChange} placeholder="E.G. ENGINEERING" className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 text-sm font-bold uppercase" />
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
                      <Input name="location.city" value={formData.location.city} onChange={handleInputChange} placeholder="ACCRA" className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 text-sm font-bold uppercase" />
                    </div>
                    <div className="space-y-2">
                      <label className={labelClass}>Sovereign Code</label>
                      <Input name="location.country" value={formData.location.country} onChange={handleInputChange} placeholder="GHANA" className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 text-sm font-bold uppercase" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Physical Coordinates</label>
                    <Input name="location.address" value={formData.location.address} onChange={handleInputChange} placeholder="SECTOR 7G..." className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 text-sm font-medium" />
                  </div>
                </CardContent>
              </Card>
            </section>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-primary">
                  <Target className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-black uppercase tracking-widest text-white">Research Focus Areas</h2>
              </div>
              <Card className="border-white/5 bg-white/[0.02] backdrop-blur-3xl">
                <CardContent className="p-8 space-y-6">
                  <div className="flex gap-4">
                    <Input value={newScope} onChange={(e) => setNewScope(e.target.value)} onKeyPress={(e) => handleKeyPress(e, addScope)} placeholder="NEW SCOPE..." className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 text-xs font-bold uppercase" />
                    <Button type="button" onClick={addScope} className="h-12 w-12 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-primary">
                      <Plus className="w-5 h-5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.scopes.map((scope, index) => (
                      <Badge key={index} variant="secondary" className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-all rounded-lg px-3 py-1.5 flex items-center gap-2 group">
                        <span className="text-[10px] font-black uppercase tracking-widest">{scope}</span>
                        <button type="button" onClick={() => removeScope(index)} className="hover:text-white transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-primary">
                  <Award className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-black uppercase tracking-widest text-white">Strategic Alignment</h2>
              </div>
              <Card className="border-white/5 bg-white/[0.02] backdrop-blur-3xl">
                <CardContent className="p-8 space-y-6">
                  <div className="flex gap-4">
                    <Input value={newFocus} onChange={(e) => setNewFocus(e.target.value)} onKeyPress={(e) => handleKeyPress(e, addFocus)} placeholder="NEW TECH FOCUS..." className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 text-xs font-bold uppercase" />
                    <Button type="button" onClick={addFocus} className="h-12 w-12 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-primary">
                      <Plus className="w-5 h-5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.climate_tech_focus.map((focus, index) => (
                      <Badge key={index} variant="secondary" className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-all rounded-lg px-3 py-1.5 flex items-center gap-2 group">
                        <Zap className="w-3 h-3" />
                        <span className="text-[10px] font-black uppercase tracking-widest">{focus}</span>
                        <button type="button" onClick={() => removeFocus(index)} className="hover:text-white transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>
          </div>

          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-primary">
                <User className="w-4 h-4" />
              </div>
              <h2 className="text-xs font-black uppercase tracking-widest text-white">Liaison Configuration</h2>
            </div>
            <Card className="border-white/5 bg-white/[0.02] backdrop-blur-3xl">
              <CardContent className="p-8">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className={labelClass}>Authorized Personnel Name</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                        <Input name="point_of_contact.name" value={formData.point_of_contact.name} onChange={handleInputChange} placeholder="FULL NAME" className="h-12 bg-white/5 border-white/10 rounded-xl pl-12 focus:border-primary/50 text-sm font-bold uppercase" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className={labelClass}>Operational Rank (Position)</label>
                      <Input name="point_of_contact.position" value={formData.point_of_contact.position} onChange={handleInputChange} placeholder="E.G. CHIEF SCIENTIST" className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 text-sm font-bold uppercase" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className={labelClass}>Comms Channel (Email)</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                        <Input name="point_of_contact.email" value={formData.point_of_contact.email} onChange={handleInputChange} placeholder="SECURE@NODE.LOC" className="h-12 bg-white/5 border-white/10 rounded-xl pl-12 focus:border-primary/50 text-sm font-medium" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className={labelClass}>Secure Line (Phone)</label>
                      <Input name="point_of_contact.phone" value={formData.point_of_contact.phone} onChange={handleInputChange} placeholder="+XXX XXX XXXX" className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 text-sm font-medium" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-primary">
                <Shield className="w-4 h-4" />
              </div>
              <h2 className="text-xs font-black uppercase tracking-widest text-white">Lab Hardware Profile</h2>
            </div>
            <Card className="border-white/5 bg-white/[0.02] backdrop-blur-3xl">
              <CardContent className="p-8 space-y-8">
                <div className="space-y-2">
                  <label className={labelClass}>Operational Description</label>
                  <textarea name="lab_equipment.description" value={formData.lab_equipment.description} onChange={handleInputChange} placeholder="DESCRIBE FACILITY CAPABILITIES..." rows={3} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:border-primary/50 transition-all resize-none" />
                </div>
                <div className="space-y-4">
                  <label className={labelClass}>Asset Inventory</label>
                  <div className="flex gap-4">
                    <Input value={newEquipment} onChange={(e) => setNewEquipment(e.target.value)} onKeyPress={(e) => handleKeyPress(e, addEquipment)} placeholder="IDENTIFY NEW ASSET..." className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 text-xs font-bold uppercase" />
                    <Button type="button" onClick={addEquipment} className="h-12 w-12 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-primary">
                      <Plus className="w-5 h-5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.lab_equipment?.items?.map((item, index) => (
                      <Badge key={index} variant="outline" className="border-white/10 bg-white/5 text-white/70 hover:text-white transition-all rounded-lg px-3 py-1.5 flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest">{item}</span>
                        <button type="button" onClick={() => removeEquipment(index)} className="hover:text-red-400">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-primary">
                <Activity className="w-4 h-4" />
              </div>
              <h2 className="text-xs font-black uppercase tracking-widest text-white">Impact Telemetry</h2>
            </div>
            <Card className="border-white/5 bg-white/[0.02] backdrop-blur-3xl">
              <CardContent className="p-8 space-y-8">
                <div className="space-y-2">
                  <label className={labelClass}>Environmental Contribution Mapping</label>
                  <textarea name="climate_impact_metrics.description" value={formData.climate_impact_metrics.description} onChange={handleInputChange} placeholder="DEFINE IMPACT LOGIC..." rows={3} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:border-primary/50 transition-all resize-none" />
                </div>
                <div className="space-y-4">
                  <label className={labelClass}>Target Projections</label>
                  <div className="flex gap-4">
                    <Input value={newTarget} onChange={(e) => setNewTarget(e.target.value)} onKeyPress={(e) => handleKeyPress(e, addTarget)} placeholder="ESTABLISH NEW TARGET..." className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-primary/50 text-xs font-bold uppercase" />
                    <Button type="button" onClick={addTarget} className="h-12 w-12 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-primary">
                      <Plus className="w-5 h-5" />
                    </Button>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    {formData.climate_impact_metrics?.targets?.map((target, index) => (
                      <div key={index} className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02] group hover:border-primary/20 transition-all">
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/80">{target}</span>
                        <Button variant="ghost" size="icon" onClick={() => removeTarget(index)} className="h-8 w-8 rounded-lg hover:bg-red-500/10 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-primary">
                <ImageIcon className="w-4 h-4" />
              </div>
              <h2 className="text-xs font-black uppercase tracking-widest text-white">Asset Repository</h2>
            </div>
            <Card className="border-white/5 bg-white/[0.02] backdrop-blur-3xl">
              <CardContent className="p-8 space-y-12">
                <div className="flex border-2 border-dashed border-white/5 rounded-3xl p-12 bg-white/[0.01] hover:bg-white/[0.02] hover:border-primary/20 transition-all group items-center justify-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto text-primary group-hover:scale-110 transition-transform">
                      <Upload className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-white">Upload New Intelligence</p>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mt-1">JPG, PNG, WEBP • MAX 5MB</p>
                    </div>
                    <Button variant="outline" className="h-10 border-white/10 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest px-6">Select Files</Button>
                  </div>
                  <input ref={fileInputRef} type="file" onChange={handleFileSelection} className="hidden" accept="image/*" multiple />
                </div>

                <ImageUploadPreview files={selectedFiles} onRemove={removeSelectedFile} />

                {selectedFiles.length > 0 && (
                  <Button onClick={uploadSelectedFiles} disabled={uploading} className="w-full h-14 bg-primary text-black hover:bg-primary/90 rounded-2xl font-black uppercase tracking-widest text-xs">
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Shield className="w-5 h-5 mr-3" />}
                    {uploading ? "Uploading Assets..." : `Commit ${selectedFiles.length} Assets to Repository`}
                  </Button>
                )}

                {formData.images.length > 0 && (
                  <div className="space-y-6">
                    <Separator className="bg-white/5" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60 px-1">Registered Assets ({formData.images.length})</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {formData.images.map((image) => (
                        <Card key={image.id} className={clsx("border-white/5 bg-white/[0.02] overflow-hidden group transition-all duration-500", image.is_primary && "ring-2 ring-primary/40 border-primary/20")}>
                          <div className="aspect-video relative overflow-hidden bg-black/40">
                            <Image src={image.url} alt={image.caption || "Satellite capture"} fill className="object-cover transition-transform duration-700 group-hover:scale-110 opacity-60 group-hover:opacity-100" />
                            <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button size="icon" variant="ghost" onClick={() => setPrimary(image.id)} disabled={image.is_primary || image.isUploading} className={clsx("h-8 w-8 rounded-lg", image.is_primary ? "bg-primary text-black" : "bg-black/60 text-white hover:bg-primary hover:text-black")}>
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => deleteImage(image.id)} disabled={image.isUploading} className="h-8 w-8 rounded-lg bg-red-500/80 text-white hover:bg-red-600">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            {image.is_primary && (
                              <div className="absolute top-3 left-3 px-2 py-1 bg-primary text-[8px] font-black uppercase tracking-widest text-black rounded-md">Primary Asset</div>
                            )}
                            {image.isUploading && (
                              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                              </div>
                            )}
                          </div>
                          <InlineCaption image={image} onSave={(caption) => saveCaption(image.id, caption)} />
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <footer className="pt-12 flex gap-4">
            <Button variant="ghost" onClick={() => router.back()} disabled={updating} className="flex-1 h-14 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/5 hover:bg-white/5">
              Abort Modification
            </Button>
            <Button onClick={handleSubmit} disabled={updating || loading} className="flex-[2] h-14 bg-primary text-black hover:bg-primary/90 rounded-2xl font-black uppercase tracking-widest text-xs shadow-[0_0_30px_rgba(0,251,117,0.15)]">
              {updating ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Check className="w-5 h-5 mr-3" />}
              {updating ? "Synchronizing Data..." : "Finalize Config Update"}
            </Button>
          </footer>
        </div>
      </div>
    </div>
  );
}
