"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "next-themes";
import { useSidebar } from "@/hooks/sideBarProvider";
import toast from "react-hot-toast";
import { Upload, User, MapPin, Building, Award, Link, ArrowLeft, Plus, X, Calendar, Phone, Globe, Mail } from "lucide-react";
import { clsx } from "clsx";

interface Profile {
  id: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  phone?: string | null;
  website?: string | null;
  type: string;
  title: string | null;
  organization: string | null;
  bio: string;
  location: Record<string, any>;
  social_links: Record<string, any>;
  expertise: string[];
  profile_image?: string | null;
  created_at: string;
}

export default function EditProfilePage() {
  const { profileId } = useParams();
  const router = useRouter();
  const { theme, resolvedTheme } = useTheme();
  const { setLoadSession } = useSidebar();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    display_name: "", first_name: "", last_name: "", date_of_birth: "", gender: "", phone: "", website: "",
    type: "lab", title: "", organization: "", bio: "",
    city: "", country: "",
    twitter: "", linkedin: "",
    expertise: [] as string[],
  });
  const [newExpertise, setNewExpertise] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const isDark = mounted ? resolvedTheme === "dark" : false;

  const profileTypes = [
    { value: "lab", label: "Research Lab" },
    { value: "participant", label: "Hackathon Participant" },
    { value: "entrepreneur", label: "Entrepreneur" },
    { value: "academic", label: "Academic" },
    { value: "funder", label: "Funder" },
    { value: "partner", label: "Partner" },
  ];

  useEffect(() => {
    setMounted(true);
    setLoadSession(() => {});
    return () => setLoadSession(() => {});
  }, [setLoadSession]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("token") || sessionStorage.getItem("token") || "";
        const response = await fetch(`/api/profiles/${profileId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Failed to fetch profile");
        const profile: Profile = await response.json();
        setFormData({
          display_name: profile.display_name || "", first_name: profile.first_name || "", last_name: profile.last_name || "",
          date_of_birth: profile.date_of_birth || "", gender: profile.gender || "", phone: profile.phone || "", website: profile.website || "",
          type: profile.type, title: profile.title || "", organization: profile.organization || "", bio: profile.bio || "",
          city: profile.location?.city || "", country: profile.location?.country || "",
          twitter: profile.social_links?.twitter || "", linkedin: profile.social_links?.linkedin || "",
          expertise: profile.expertise || [],
        });
        setImagePreview(profile.profile_image || "");
      } catch (error) {
        console.error("Fetch profile error:", error);
        toast.error("Failed to load profile");
        router.push("/profiles");
      } finally {
        setLoading(false);
      }
    };
    if (profileId) fetchProfile();
  }, [profileId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    const data = new FormData();
    if (formData.display_name) data.append("display_name", formData.display_name);
    if (formData.first_name) data.append("first_name", formData.first_name);
    if (formData.last_name) data.append("last_name", formData.last_name);
    if (formData.date_of_birth) data.append("date_of_birth", formData.date_of_birth);
    if (formData.gender) data.append("gender", formData.gender);
    if (formData.phone) data.append("phone", formData.phone);
    if (formData.website) data.append("website", formData.website);
    data.append("title", formData.title);
    data.append("organization", formData.organization);
    data.append("bio", formData.bio);
    data.append("location", JSON.stringify({ city: formData.city || "", country: formData.country || "" }));
    data.append("social_links", JSON.stringify({ twitter: formData.twitter || "", linkedin: formData.linkedin || "" }));
    data.append("expertise", JSON.stringify(formData.expertise));
    if (file) data.append("profile_image", file);

    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token") || "";
      const response = await fetch(`/api/profiles/${profileId}`, { method: "PUT", body: data, headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Failed to update");
      toast.success("Profile updated successfully!");
      router.push("/profiles");
    } catch (error) {
      console.error("Update error:", error);
      toast.error("Failed to update profile. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(selectedFile);
    }
  };

  const triggerFileInput = () => fileInputRef.current?.click();
  const addExpertise = () => {
    if (newExpertise.trim() && !formData.expertise.includes(newExpertise.trim())) {
      setFormData((prev) => ({ ...prev, expertise: [...prev.expertise, newExpertise.trim()] }));
      setNewExpertise("");
    }
  };
  const removeExpertise = (index: number) => setFormData((prev) => ({ ...prev, expertise: prev.expertise.filter((_, i) => i !== index) }));
  const handleKeyPress = (e: React.KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); addExpertise(); } };

  if (!mounted || loading) {
    return (
      <div className={clsx("h-full flex items-center justify-center", isDark ? "bg-[#0A0A0A]" : "bg-gray-50")}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-[#00FB75] border-t-transparent rounded-full animate-spin" />
          <p className={isDark ? "text-gray-400" : "text-gray-600"}>Loading...</p>
        </div>
      </div>
    );
  }

  const inputClass = clsx("w-full p-2.5 sm:p-3 rounded-lg border transition-colors text-sm", isDark ? "bg-[#1A1A1A] border-gray-700 text-white focus:border-[#00FB75]" : "bg-white border-gray-300 text-gray-900 focus:border-[#00FB75]");
  const labelClass = "block text-sm font-medium mb-1.5";
  const sectionClass = clsx("rounded-xl sm:rounded-2xl p-4 sm:p-6", isDark ? "bg-[#111] border border-gray-800" : "bg-white border border-gray-200 shadow-sm");
  const sectionTitleClass = "text-lg font-semibold mb-4 flex items-center gap-2";

  return (
    <div className={clsx("h-full flex flex-col", isDark ? "bg-[#0A0A0A] text-white" : "bg-gray-50 text-gray-900")}>
      <header className={clsx("sticky top-0 z-40 backdrop-blur-md border-b flex-shrink-0", isDark ? "bg-[#0A0A0A]/95 border-gray-800" : "bg-white/95 border-gray-200")}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <button onClick={() => router.back()} className={clsx("p-1.5 sm:p-2 rounded-lg transition-colors", isDark ? "hover:bg-gray-800" : "hover:bg-gray-100")}>
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="hidden sm:block">
                <h1 className="font-semibold">Edit Profile</h1>
                <p className={clsx("text-xs", isDark ? "text-gray-500" : "text-gray-500")}>Update your information</p>
              </div>
            </div>
            <button onClick={handleSubmit} disabled={updating} className={clsx("px-4 sm:px-5 py-1.5 sm:py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2", updating ? "opacity-50 cursor-not-allowed" : "bg-[#00FB75] text-black hover:bg-green-400")}>
              {updating ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-24 sm:pb-8 space-y-4 sm:space-y-6">
          <div className={sectionClass}>
            <h2 className={clsx(sectionTitleClass, isDark ? "text-white" : "text-gray-900")}><User className="w-5 h-5 text-[#00FB75]" />Profile Image</h2>
            <div className="flex items-center gap-4 sm:gap-6">
              <div onClick={triggerFileInput} className={clsx("w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-dashed cursor-pointer overflow-hidden transition-all hover:scale-105", isDark ? "border-gray-600 hover:border-gray-400 bg-gray-800" : "border-gray-300 hover:border-gray-400 bg-gray-100")}>
                {imagePreview ? <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" /> : <User className={clsx("w-8 h-8 sm:w-10 sm:h-10 mx-auto mt-6 sm:mt-8", isDark ? "text-gray-600" : "text-gray-400")} />}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              <div>
                <p className={clsx("text-xs mb-2", isDark ? "text-gray-500" : "text-gray-500")}>Recommended: 400×400px, JPG/PNG</p>
                <button type="button" onClick={triggerFileInput} className={clsx("px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2", isDark ? "bg-gray-800 hover:bg-gray-700 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700")}>
                  <Upload className="w-4 h-4" />Change Photo
                </button>
              </div>
            </div>
          </div>

          <div className={sectionClass}>
            <h2 className={clsx(sectionTitleClass, isDark ? "text-white" : "text-gray-900")}><User className="w-5 h-5 text-[#00FB75]" />Personal Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={labelClass}>Display Name</label><input name="display_name" value={formData.display_name} onChange={handleInputChange} placeholder="How others see you" className={inputClass} /></div>
              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className={labelClass}>First Name</label><input name="first_name" value={formData.first_name} onChange={handleInputChange} placeholder="John" className={inputClass} /></div>
                <div><label className={labelClass}>Last Name</label><input name="last_name" value={formData.last_name} onChange={handleInputChange} placeholder="Doe" className={inputClass} /></div>
              </div>
              <div><label className={labelClass}>Date of Birth</label><input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleInputChange} className={inputClass} /></div>
              <div><label className={labelClass}>Gender</label><select name="gender" value={formData.gender} onChange={handleInputChange} className={inputClass}><option value="">Select gender</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option></select></div>
              <div><label className={labelClass}><Phone className="w-4 h-4 inline mr-1" />Phone</label><input name="phone" value={formData.phone} onChange={handleInputChange} placeholder="+1 234 567 8900" className={inputClass} /></div>
              <div><label className={labelClass}><Globe className="w-4 h-4 inline mr-1" />Website</label><input name="website" value={formData.website} onChange={handleInputChange} placeholder="https://yourwebsite.com" className={inputClass} /></div>
            </div>
          </div>

          <div className={sectionClass}>
            <h2 className={clsx(sectionTitleClass, isDark ? "text-white" : "text-gray-900")}><Building className="w-5 h-5 text-[#00FB75]" />Professional Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={labelClass}>Profile Type</label><select name="type" value={formData.type} onChange={handleInputChange} className={inputClass}>{profileTypes.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}</select></div>
              <div><label className={labelClass}>Title</label><input name="title" value={formData.title} onChange={handleInputChange} placeholder="e.g., Senior Researcher" className={inputClass} /></div>
              <div className="sm:col-span-2"><label className={labelClass}>Organization</label><input name="organization" value={formData.organization} onChange={handleInputChange} placeholder="e.g., MIT Media Lab" className={inputClass} /></div>
              <div className="sm:col-span-2"><label className={labelClass}>Bio</label><textarea name="bio" value={formData.bio} onChange={handleInputChange} placeholder="Tell us about yourself..." rows={4} className={inputClass} /></div>
            </div>
          </div>

          <div className={sectionClass}>
            <h2 className={clsx(sectionTitleClass, isDark ? "text-white" : "text-gray-900")}><MapPin className="w-5 h-5 text-[#00FB75]" />Location</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={labelClass}>City</label><input name="city" value={formData.city} onChange={handleInputChange} placeholder="e.g., Cambridge" className={inputClass} /></div>
              <div><label className={labelClass}>Country</label><input name="country" value={formData.country} onChange={handleInputChange} placeholder="e.g., United States" className={inputClass} /></div>
            </div>
          </div>

          <div className={sectionClass}>
            <h2 className={clsx(sectionTitleClass, isDark ? "text-white" : "text-gray-900")}><Award className="w-5 h-5 text-[#00FB75]" />Expertise</h2>
            <div className="flex gap-2 mb-3">
              <input value={newExpertise} onChange={(e) => setNewExpertise(e.target.value)} onKeyPress={handleKeyPress} placeholder="Add expertise (press Enter)" className={clsx("flex-1", inputClass)} />
              <button type="button" onClick={addExpertise} className="px-4 py-2 bg-[#00FB75] text-black rounded-lg font-medium hover:bg-green-400"><Plus className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.expertise.map((skill, index) => (<span key={index} className={clsx("px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1", isDark ? "bg-[#00FB75]/10 text-[#00FB75]" : "bg-green-100 text-green-700")}>{skill}<button type="button" onClick={() => removeExpertise(index)} className="hover:text-red-500"><X className="w-3 h-3" /></button></span>))}
            </div>
          </div>

          <div className={sectionClass}>
            <h2 className={clsx(sectionTitleClass, isDark ? "text-white" : "text-gray-900")}><Link className="w-5 h-5 text-[#00FB75]" />Social Links</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={labelClass}>Twitter</label><input name="twitter" value={formData.twitter} onChange={handleInputChange} placeholder="https://twitter.com/username" className={inputClass} /></div>
              <div><label className={labelClass}>LinkedIn</label><input name="linkedin" value={formData.linkedin} onChange={handleInputChange} placeholder="https://linkedin.com/in/username" className={inputClass} /></div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => router.back()} className={clsx("flex-1 py-2.5 sm:py-3 rounded-lg text-sm font-medium transition-colors", isDark ? "bg-gray-800 hover:bg-gray-700 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700")}>Cancel</button>
            <button type="submit" disabled={updating} className={clsx("flex-1 py-2.5 sm:py-3 rounded-lg text-sm font-medium transition-colors", updating ? "opacity-50 cursor-not-allowed bg-[#00FB75] text-black" : "bg-[#00FB75] text-black hover:bg-green-400")}>{updating ? "Saving..." : "Save Changes"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
