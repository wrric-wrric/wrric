// components/ProfileForm.tsx
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  User,
  MapPin,
  Building,
  Award,
  Link,
  Plus,
  X,
  Calendar,
  Phone,
  Globe,
  Mail,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { Profile, profileTypes, genderOptions } from "@/types/profile";

interface ProfileFormProps {
  initialProfile?: Profile | null;
  onSubmit: (data: FormData) => Promise<void>;
  submitButtonText: string;
  isUpdating: boolean;
}

export default function ProfileForm({
  initialProfile = null,
  onSubmit,
  submitButtonText,
  isUpdating,
}: ProfileFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    display_name: initialProfile?.display_name || "",
    first_name: initialProfile?.first_name || "",
    last_name: initialProfile?.last_name || "",
    date_of_birth: initialProfile?.date_of_birth || "",
    gender: initialProfile?.gender || "",
    phone: initialProfile?.phone || "",
    website: initialProfile?.website || "",

    type: initialProfile?.type || "lab",
    title: initialProfile?.title || "",
    organization: initialProfile?.organization || "",
    bio: initialProfile?.bio || "",

    city: initialProfile?.location?.city || "",
    country: initialProfile?.location?.country || "",

    twitter: initialProfile?.social_links?.twitter || "",
    linkedin: initialProfile?.social_links?.linkedin || "",

    expertise: initialProfile?.expertise || [] as string[],
  });

  const [newExpertise, setNewExpertise] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(initialProfile?.profile_image || "");

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImagePreview(ev.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const triggerFileInput = () => fileInputRef.current?.click();

  const addExpertise = () => {
    if (newExpertise.trim() && !formData.expertise.includes(newExpertise.trim())) {
      setFormData((prev) => ({
        ...prev,
        expertise: [...prev.expertise, newExpertise.trim()],
      }));
      setNewExpertise("");
    }
  };

  const removeExpertise = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      expertise: prev.expertise.filter((_, i) => i !== index),
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addExpertise();
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = new FormData();

    // Required
    data.append("profile_type", formData.type);

    // Personal fields
    if (formData.display_name) data.append("display_name", formData.display_name);
    if (formData.first_name) data.append("first_name", formData.first_name);
    if (formData.last_name) data.append("last_name", formData.last_name);
    if (formData.date_of_birth) data.append("date_of_birth", formData.date_of_birth);
    if (formData.gender) data.append("gender", formData.gender);
    if (formData.phone) data.append("phone", formData.phone);
    if (formData.website) data.append("website", formData.website);

    // Role fields
    if (formData.title) data.append("title", formData.title);
    if (formData.organization) data.append("organization", formData.organization);
    if (formData.bio) data.append("bio", formData.bio);

    // Structured JSON fields
    data.append(
      "location",
      JSON.stringify({
        city: formData.city || "",
        country: formData.country || "",
      })
    );
    data.append(
      "social_links",
      JSON.stringify({
        twitter: formData.twitter || "",
        linkedin: formData.linkedin || "",
      })
    );
    data.append("expertise", JSON.stringify(formData.expertise));

    // Image
    if (file) data.append("profile_image", file);

    await onSubmit(data);
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-8">
      {/* Profile Image */}
      <div className="rounded-xl p-6 bg-white dark:bg-gray-900 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <User className="w-5 h-5" />
          Profile Image
        </h2>
        <div className="flex items-center gap-6">
          <div className="relative">
            <div
              onClick={triggerFileInput}
              className="w-32 h-32 rounded-full border-4 border-dashed flex items-center justify-center cursor-pointer overflow-hidden transition-all hover:scale-105 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800"
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 opacity-50" />
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
          <div>
            <p className="text-sm opacity-70 mb-3">Recommended: 400×400px, JPG/PNG</p>
            <button
              type="button"
              onClick={triggerFileInput}
              className="flex items-center gap-2 px-5 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            >
              <Upload className="w-4 h-4" />
              Change Photo
            </button>
          </div>
        </div>
      </div>

      {/* Personal Information */}
      <div className="rounded-xl p-6 bg-white dark:bg-gray-900 shadow-sm">
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Personal Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">Display Name</label>
            <input
              name="display_name"
              value={formData.display_name}
              onChange={handleInputChange}
              placeholder="How others will see you"
              className="w-full p-3 rounded-lg border transition-colors border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-[#00FB75]"
            />
          </div>
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">First Name</label>
              <input
                name="first_name"
                value={formData.first_name}
                onChange={handleInputChange}
                placeholder="John"
                className="w-full p-3 rounded-lg border transition-colors border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-[#00FB75]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Last Name</label>
              <input
                name="last_name"
                value={formData.last_name}
                onChange={handleInputChange}
                placeholder="Doe"
                className="w-full p-3 rounded-lg border transition-colors border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-[#00FB75]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Date of Birth
            </label>
            <input
              type="date"
              name="date_of_birth"
              value={formData.date_of_birth}
              onChange={handleInputChange}
              className="w-full p-3 rounded-lg border transition-colors border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-[#00FB75]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Gender</label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleInputChange}
              className="w-full p-3 rounded-lg border transition-colors border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-[#00FB75]"
            >
              {genderOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Phone
            </label>
            <input
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="+233 123 456 789"
              className="w-full p-3 rounded-lg border transition-colors border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-[#00FB75]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Personal Website
            </label>
            <input
              name="website"
              value={formData.website}
              onChange={handleInputChange}
              placeholder="https://mysite.com"
              className="w-full p-3 rounded-lg border transition-colors border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-[#00FB75]"
            />
          </div>
        </div>
      </div>

      {/* Professional Information */}
      <div className="rounded-xl p-6 bg-white dark:bg-gray-900 shadow-sm">
        <h2 className="text-xl font-semibold mb-6">Professional Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">Profile Type</label>
            <select
              name="type"
              value={formData.type}
              onChange={handleInputChange}
              className="w-full p-3 rounded-lg border transition-colors border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-[#00FB75]"
            >
              {profileTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.icon} {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Title / Role</label>
            <input
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="e.g., Professor, CEO, Principal Investigator"
              className="w-full p-3 rounded-lg border transition-colors border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-[#00FB75]"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <Building className="w-4 h-4" />
              Organization
            </label>
            <input
              name="organization"
              value={formData.organization}
              onChange={handleInputChange}
              placeholder="e.g., Harvard University, Acme Biotech"
              className="w-full p-3 rounded-lg border transition-colors border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-[#00FB75]"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2">Professional Bio</label>
            <textarea
              name="bio"
              value={formData.bio}
              onChange={handleInputChange}
              rows={5}
              placeholder="Describe your research, work, achievements, and interests..."
              className="w-full p-3 rounded-lg border resize-none transition-colors border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-[#00FB75]"
            />
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="rounded-xl p-6 bg-white dark:bg-gray-900 shadow-sm">
        <h2 className="text-xl font-semibold mb-5 flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Location
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">City</label>
            <input
              name="city"
              value={formData.city}
              onChange={handleInputChange}
              placeholder="Accra"
              className="w-full p-3 rounded-lg border transition-colors border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-[#00FB75]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Country</label>
            <input
              name="country"
              value={formData.country}
              onChange={handleInputChange}
              placeholder="Ghana"
              className="w-full p-3 rounded-lg border transition-colors border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-[#00FB75]"
            />
          </div>
        </div>
      </div>

      {/* Social Links */}
      <div className="rounded-xl p-6 bg-white dark:bg-gray-900 shadow-sm">
        <h2 className="text-xl font-semibold mb-5 flex items-center gap-2">
          <Link className="w-5 h-5" />
          Social & Professional Links
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">Twitter</label>
            <input
              name="twitter"
              value={formData.twitter}
              onChange={handleInputChange}
              placeholder="https://twitter.com/username"
              className="w-full p-3 rounded-lg border transition-colors border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-[#00FB75]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">LinkedIn</label>
            <input
              name="linkedin"
              value={formData.linkedin}
              onChange={handleInputChange}
              placeholder="https://linkedin.com/in/username"
              className="w-full p-3 rounded-lg border transition-colors border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-[#00FB75]"
            />
          </div>
        </div>
      </div>

      {/* Expertise */}
      <div className="rounded-xl p-6 bg-white dark:bg-gray-900 shadow-sm">
        <h2 className="text-xl font-semibold mb-5 flex items-center gap-2">
          <Award className="w-5 h-5" />
          Expertise & Skills
        </h2>
        <div className="space-y-4">
          <div className="flex gap-3">
            <input
              value={newExpertise}
              onChange={(e) => setNewExpertise(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="e.g., CRISPR, Synthetic Biology, Venture Capital"
              className="flex-1 p-3 rounded-lg border transition-colors border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-[#00FB75]"
            />
            <button
              type="button"
              onClick={addExpertise}
              className="px-5 py-3 rounded-lg transition-colors bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {formData.expertise.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {formData.expertise.map((skill, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-gray-200 dark:bg-gray-700"
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() => removeExpertise(i)}
                    className="p-1 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4 pt-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 py-4 rounded-lg border font-medium border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isUpdating}
          className="flex-1 bg-[#00FB75] hover:bg-green-400 text-black font-semibold py-4 rounded-lg disabled:opacity-70 flex items-center justify-center gap-3 transition"
        >
          {isUpdating ? (
            <>
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              Updating...
            </>
          ) : (
            submitButtonText
          )}
        </button>
      </div>
    </form>
  );
}