"use client";

import { useState, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import { useRouter, useParams } from "next/navigation";
import {
  Calendar,
  MapPin,
  Globe,
  Users,
  Upload,
  X,
  Save,
  Eye,
  AlertCircle,
  Trash2,
  ExternalLink,
  Copy,
  Clock,
  Building,
  Award,
  ChevronLeft,
  Tag,
  Star,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Event, EventCategory } from "@/types/events";
import toast from "react-hot-toast";

export default function EditEventPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [event, setEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState<any>(null);
  const [featuredImage, setFeaturedImage] = useState<File | null>(null);
  const [bannerImage, setBannerImage] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewBanner, setPreviewBanner] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const getAuthHeaders = (): Record<string, string> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const timezones = [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "Asia/Tokyo",
    "Australia/Sydney",
    "UTC",
  ];

  const fetchEvent = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/events/${id}`, { headers: getAuthHeaders() });
      if (!response.ok) throw new Error("Failed to fetch event");

      const data = await response.json();
      setEvent(data);
      setFormData({
        title: data.title,
        description: data.description,
        short_description: data.short_description,
        event_datetime: new Date(data.event_datetime)
          .toISOString()
          .slice(0, 16),
        timezone: data.timezone,
        location_type: data.location_type,
        physical_location: data.physical_location || "",
        virtual_link: data.virtual_link || "",
        registration_url: data.registration_url || "",
        is_featured: data.is_featured,
        priority: data.priority,
        categories: data.categories.map((c: any) => c.id),
      });

      if (data.featured_image_url) setPreviewImage(data.featured_image_url);
      if (data.banner_image_url) setPreviewBanner(data.banner_image_url);
    } catch (error) {
      console.error("Error fetching event:", error);
      toast.error("Failed to load event");
      router.push("/admin/events");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/categories");
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  }, []);

  useEffect(() => {
    fetchEvent();
    fetchCategories();
  }, [fetchEvent, fetchCategories]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleImageUpload = (file: File, type: "featured" | "banner") => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      // 10MB limit
      toast.error("Image size should be less than 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === "featured") {
        setFeaturedImage(file);
        setPreviewImage(reader.result as string);
      } else {
        setBannerImage(file);
        setPreviewBanner(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (type: "featured" | "banner") => {
    if (type === "featured") {
      setFeaturedImage(null);
      setPreviewImage(null);
      handleInputChange("featured_image_url", null);
    } else {
      setBannerImage(null);
      setPreviewBanner(null);
      handleInputChange("banner_image_url", null);
    }
  };

  const validateForm = (): boolean => {
    if (!formData) return false;

    const newErrors: Record<string, string> = {};

    if (!formData.title?.trim()) newErrors.title = "Title is required";
    if (!formData.description?.trim())
      newErrors.description = "Description is required";
    if (!formData.short_description?.trim())
      newErrors.short_description = "Short description is required";
    if (formData.short_description?.length > 150)
      newErrors.short_description = "Max 150 characters";
    if (!formData.event_datetime)
      newErrors.event_datetime = "Date and time is required";

    const eventDate = new Date(formData.event_datetime);
    if (eventDate <= new Date())
      newErrors.event_datetime = "Event must be in the future";

    if (
      formData.location_type === "physical" &&
      !formData.physical_location?.trim()
    ) {
      newErrors.physical_location =
        "Physical location is required for physical events";
    }

    if (
      (formData.location_type === "virtual" ||
        formData.location_type === "hybrid") &&
      !formData.virtual_link?.trim()
    ) {
      newErrors.virtual_link =
        "Virtual link is required for virtual/hybrid events";
    }

    // URL validation
    if (formData.virtual_link && !formData.virtual_link.startsWith("http")) {
      newErrors.virtual_link =
        "Virtual link must start with http:// or https://";
    }

    if (
      formData.registration_url &&
      !formData.registration_url.startsWith("http")
    ) {
      newErrors.registration_url =
        "Registration URL must start with http:// or https://";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (publish: boolean = false) => {
    if (!formData || !validateForm()) {
      toast.error("Please fix the errors in the form");
      return;
    }

    setSaving(true);
    try {
      const formDataToSend = new FormData();

      // Append form data (only changed fields)
      Object.entries(formData).forEach(([key, value]) => {
        if (key === "categories" && Array.isArray(value)) {
          formDataToSend.append("categories", JSON.stringify(value));
        } else if (value !== null && value !== undefined) {
          formDataToSend.append(key, value.toString());
        }
      });

      // Append images if new ones are selected
      if (featuredImage) {
        formDataToSend.append("featured_image", featuredImage);
      }
      if (bannerImage) {
        formDataToSend.append("banner_image", bannerImage);
      }

      const response = await fetch(`/api/admin/events/${id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: formDataToSend,
      });

      if (!response.ok) {
        const errorData = await response.json();
        let errorMessage = "Failed to update event";

        if (errorData.detail) {
          if (Array.isArray(errorData.detail)) {
            // FastAPI validation errors
            errorMessage = errorData.detail.map((err: any) => `${err.loc[err.loc.length - 1]}: ${err.msg}`).join(", ");
          } else if (typeof errorData.detail === "string") {
            errorMessage = errorData.detail;
          }
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      toast.success(
        publish ? "Event updated and published!" : "Event updated successfully",
      );

      if (publish && !event?.is_published) {
        setTimeout(() => router.push("/admin/events"), 1000);
      } else {
        // Refresh the event data
        fetchEvent();
      }
    } catch (error: any) {
      console.error("Update event error:", error);
      toast.error(error.message || "Failed to update event");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this event? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/events/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error("Failed to delete event");
      }

      toast.success("Event deleted successfully");
      router.push("/admin/events");
    } catch (error) {
      console.error("Delete event error:", error);
      toast.error("Failed to delete event");
    }
  };

  const handlePublishToggle = async () => {
    if (!event) return;

    try {
      const action = event.is_published ? "unpublish" : "publish";
      const response = await fetch(`/api/admin/events/${id}/${action}`, {
        method: "POST",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `Failed to ${action} event`);
      }

      toast.success(`Event ${action}ed successfully`);
      fetchEvent(); // Refresh event data
    } catch (error: any) {
      console.error("Publish toggle error:", error);
      toast.error(error.message || "Failed to update event status");
    }
  };

  const copyEventLink = () => {
    if (!event) return;

    const link = `${window.location.origin}/events/${event.slug}`;
    navigator.clipboard.writeText(link);
    toast.success("Event link copied to clipboard!");
  };

  const handleCategoryToggle = (categoryId: string) => {
    const current = formData?.categories || [];
    const updated = current.includes(categoryId)
      ? current.filter((id: string) => id !== categoryId)
      : [...current, categoryId];

    handleInputChange("categories", updated);
  };

  if (loading || !formData || !event) {
    return (
      <div
        className="h-full flex items-center justify-center"
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00FB75] mx-auto mb-4"></div>
          <p
            className={
              isDark ? "dark:text-white text-gray-900" : "text-gray-900"
            }
          >
            Loading event...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`h-full overflow-y-auto ${isDark ? "dark:text-white text-gray-900" : "text-gray-900"}`}
    >
      {/* Header */}
      <div
        className={`border-b ${isDark ? "border-gray-800" : "border-gray-200"}`}
      >
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <div className="flex items-center gap-4 mb-2">
                <button
                  onClick={() => router.back()}
                  className={`p-3 rounded-xl transition-colors ${isDark ? "hover:bg-gray-800" : "hover:bg-gray-100"
                    }`}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h1 className="text-4xl font-bold">Edit Event</h1>
                <div
                  className={`px-3 py-1 rounded-full text-sm font-medium ${event.is_published
                    ? "bg-green-500/20 text-green-600 dark:text-green-400 flex items-center gap-1"
                    : "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 flex items-center gap-1"
                    }`}
                >
                  {event.is_published ? (
                    <>
                      <CheckCircle className="w-3 h-3" />
                      Published
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3" />
                      Draft
                    </>
                  )}
                </div>
                {event.is_featured && (
                  <div className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    Featured
                  </div>
                )}
              </div>
              <p className="text-lg opacity-70">{event.title}</p>
            </div>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={copyEventLink}
                className={`px-4 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${isDark
                  ? "bg-gray-800 hover:bg-gray-700"
                  : "bg-gray-100 hover:bg-gray-200"
                  }`}
              >
                <Copy className="w-5 h-5" />
                Copy Link
              </button>
              <a
                href={`/events/${event.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`px-4 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${isDark
                  ? "bg-gray-800 hover:bg-gray-700"
                  : "bg-gray-100 hover:bg-gray-200"
                  }`}
              >
                <ExternalLink className="w-5 h-5" />
                View Live
              </a>
              <button
                onClick={handlePublishToggle}
                className={`px-4 py-3 rounded-xl font-bold transition-all ${event.is_published
                  ? "bg-yellow-500 hover:bg-yellow-600 text-black"
                  : "bg-green-500 hover:bg-green-600 dark:text-white text-gray-900"
                  }`}
              >
                {event.is_published ? "Unpublish" : "Publish"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Form */}
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column - Form */}
            <div className="lg:col-span-2">
              <div
                className={`rounded-2xl p-8 mb-8 ${isDark ? "bg-gray-900" : "bg-white border border-gray-200"
                  }`}
              >
                <h2 className="text-2xl font-bold mb-6">Event Details</h2>

                {/* Title */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-3">
                    Event Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleInputChange("title", e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#00FB75] focus:border-transparent ${errors.title
                      ? "border-red-500"
                      : isDark
                        ? "bg-gray-800 border-gray-700"
                        : "bg-white border-gray-300"
                      }`}
                    placeholder="Enter event title"
                  />
                  {errors.title && (
                    <p className="mt-2 text-sm text-red-500 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {errors.title}
                    </p>
                  )}
                </div>

                {/* Short Description */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-3">
                    Short Description * (Max 150 characters)
                    <span className="text-xs opacity-70 ml-2">
                      {formData.short_description?.length || 0}/150
                    </span>
                  </label>
                  <textarea
                    value={formData.short_description}
                    onChange={(e) =>
                      handleInputChange("short_description", e.target.value)
                    }
                    maxLength={150}
                    rows={3}
                    className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#00FB75] focus:border-transparent ${errors.short_description
                      ? "border-red-500"
                      : isDark
                        ? "bg-gray-800 border-gray-700"
                        : "bg-white border-gray-300"
                      }`}
                    placeholder="Brief description for cards and banners"
                  />
                  {errors.short_description && (
                    <p className="mt-2 text-sm text-red-500 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {errors.short_description}
                    </p>
                  )}
                </div>

                {/* Full Description */}
                <div className="mb-8">
                  <label className="block text-sm font-medium mb-3">
                    Full Description *
                  </label>
                  <div
                    className={`border rounded-xl overflow-y-auto ${isDark ? "border-gray-700" : "border-gray-300"
                      }`}
                  >
                    <div
                      className={`flex border-b ${isDark
                        ? "border-gray-700 bg-gray-800"
                        : "border-gray-300 bg-gray-100"
                        }`}
                    >
                      <button className="px-4 py-2 text-sm font-medium border-r border-gray-700 dark:border-gray-700">
                        Edit
                      </button>
                      <button className="px-4 py-2 text-sm font-medium opacity-70">
                        Preview
                      </button>
                    </div>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        handleInputChange("description", e.target.value)
                      }
                      rows={10}
                      className={`w-full px-4 py-4 focus:outline-none ${isDark ? "bg-gray-800" : "bg-white"
                        }`}
                      placeholder="Describe your event in detail..."
                    />
                  </div>
                  {errors.description && (
                    <p className="mt-2 text-sm text-red-500 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {errors.description}
                    </p>
                  )}
                </div>

                {/* Date, Time & Timezone */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  <div>
                    <label className="block text-sm font-medium mb-3">
                      Date & Time *
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.event_datetime}
                      onChange={(e) =>
                        handleInputChange("event_datetime", e.target.value)
                      }
                      className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#00FB75] focus:border-transparent ${errors.event_datetime
                        ? "border-red-500"
                        : isDark
                          ? "bg-gray-800 border-gray-700"
                          : "bg-white border-gray-300"
                        }`}
                    />
                    {errors.event_datetime && (
                      <p className="mt-2 text-sm text-red-500 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {errors.event_datetime}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-3">
                      Timezone *
                    </label>
                    <select
                      value={formData.timezone}
                      onChange={(e) =>
                        handleInputChange("timezone", e.target.value)
                      }
                      className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#00FB75] focus:border-transparent ${isDark
                        ? "bg-gray-800 border-gray-700"
                        : "bg-white border-gray-300"
                        }`}
                    >
                      {timezones.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Location Type */}
                <div className="mb-8">
                  <label className="block text-sm font-medium mb-3">
                    Location Type *
                  </label>
                  <div className="flex gap-4">
                    {(["physical", "virtual", "hybrid"] as const).map(
                      (type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() =>
                            handleInputChange("location_type", type)
                          }
                          className={`flex-1 flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all ${formData.location_type === type
                            ? "border-[#00FB75] bg-[#00FB75]/10"
                            : isDark
                              ? "border-gray-700 hover:border-gray-600"
                              : "border-gray-300 hover:border-gray-400"
                            }`}
                        >
                          {type === "physical" && (
                            <MapPin className="w-8 h-8" />
                          )}
                          {type === "virtual" && <Globe className="w-8 h-8" />}
                          {type === "hybrid" && <Users className="w-8 h-8" />}
                          <span className="font-medium capitalize">{type}</span>
                        </button>
                      ),
                    )}
                  </div>
                </div>

                {/* Location Details */}
                {formData.location_type === "physical" ||
                  formData.location_type === "hybrid" ? (
                  <div className="mb-6">
                    <label className="block text-sm font-medium mb-3">
                      Physical Location *
                    </label>
                    <input
                      type="text"
                      value={formData.physical_location}
                      onChange={(e) =>
                        handleInputChange("physical_location", e.target.value)
                      }
                      className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#00FB75] focus:border-transparent ${errors.physical_location
                        ? "border-red-500"
                        : isDark
                          ? "bg-gray-800 border-gray-700"
                          : "bg-white border-gray-300"
                        }`}
                      placeholder="Enter venue address"
                    />
                    {errors.physical_location && (
                      <p className="mt-2 text-sm text-red-500 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {errors.physical_location}
                      </p>
                    )}
                  </div>
                ) : null}

                {/* Virtual Link */}
                {(formData.location_type === "virtual" ||
                  formData.location_type === "hybrid") && (
                    <div className="mb-6">
                      <label className="block text-sm font-medium mb-3">
                        Virtual Link *
                      </label>
                      <input
                        type="url"
                        value={formData.virtual_link}
                        onChange={(e) =>
                          handleInputChange("virtual_link", e.target.value)
                        }
                        className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#00FB75] focus:border-transparent ${errors.virtual_link
                          ? "border-red-500"
                          : isDark
                            ? "bg-gray-800 border-gray-700"
                            : "bg-white border-gray-300"
                          }`}
                        placeholder="https://meet.google.com/..."
                      />
                      {errors.virtual_link && (
                        <p className="mt-2 text-sm text-red-500 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          {errors.virtual_link}
                        </p>
                      )}
                    </div>
                  )}

                {/* Registration URL */}
                <div className="mb-8">
                  <label className="block text-sm font-medium mb-3">
                    Registration URL
                  </label>
                  <input
                    type="url"
                    value={formData.registration_url}
                    onChange={(e) =>
                      handleInputChange("registration_url", e.target.value)
                    }
                    className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#00FB75] focus:border-transparent ${errors.registration_url
                      ? "border-red-500"
                      : isDark
                        ? "bg-gray-800 border-gray-700"
                        : "bg-white border-gray-300"
                      }`}
                    placeholder="https://eventbrite.com/..."
                  />
                  {errors.registration_url && (
                    <p className="mt-2 text-sm text-red-500 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {errors.registration_url}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Settings, Preview & Actions */}
            <div className="space-y-8">
              {/* Featured Settings */}
              <div
                className={`rounded-2xl p-6 ${isDark ? "bg-gray-900" : "bg-white border border-gray-200"
                  }`}
              >
                <h3 className="text-lg font-bold mb-4">Event Settings</h3>

                {/* Featured Toggle */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="font-medium">Featured Event</div>
                    <div className="text-sm opacity-70">
                      Highlight on homepage
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleInputChange("is_featured", !formData.is_featured)
                    }
                    className={`w-12 h-6 rounded-full transition-colors ${formData.is_featured
                      ? "bg-[#00FB75] justify-end"
                      : isDark
                        ? "bg-gray-700 justify-start"
                        : "bg-gray-300 justify-start"
                      } flex items-center p-1`}
                  >
                    <div className="w-4 h-4 rounded-full bg-white"></div>
                  </button>
                </div>

                {/* Priority */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-3">
                    Priority (0-100)
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={formData.priority}
                      onChange={(e) =>
                        handleInputChange("priority", parseInt(e.target.value))
                      }
                      className="flex-1"
                    />
                    <span className="font-bold">{formData.priority}</span>
                  </div>
                  <div className="text-xs opacity-70 mt-2">
                    Higher priority events appear first in listings
                  </div>
                </div>

                {/* Categories */}
                <div>
                  <label className="block text-sm font-medium mb-3">
                    Categories
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {categories.map((category) => (
                      <label
                        key={category.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <input
                          type="checkbox"
                          checked={formData.categories?.includes(category.id)}
                          onChange={() => handleCategoryToggle(category.id)}
                          className="w-5 h-5 rounded"
                        />
                        <span className="flex-1">{category.name}</span>
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: category.color_code }}
                        />
                      </label>
                    ))}
                  </div>
                  {categories.length === 0 && (
                    <p className="text-sm opacity-70 italic">
                      No categories available. Create some first.
                    </p>
                  )}
                </div>
              </div>

              {/* Featured Image */}
              <div
                className={`rounded-2xl p-6 ${isDark ? "bg-gray-900" : "bg-white border border-gray-200"
                  }`}
              >
                <h3 className="text-lg font-bold mb-4">Featured Image</h3>
                <div
                  className={`border-2 border-dashed rounded-xl p-6 text-center ${isDark ? "border-gray-700" : "border-gray-300"
                    }`}
                >
                  {previewImage ? (
                    <div className="relative">
                      <img
                        src={previewImage}
                        alt="Preview"
                        className="w-full h-48 object-cover rounded-lg mb-4"
                      />
                      <button
                        onClick={() => removeImage("featured")}
                        className="absolute top-2 right-2 p-2 bg-black/50 rounded-full hover:bg-black/70"
                      >
                        <X className="w-4 h-4 dark:text-white text-gray-900" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 mx-auto mb-4 opacity-40" />
                      <p className="mb-2">Upload featured image</p>
                      <p className="text-sm opacity-70 mb-4">
                        Recommended: 1200x630px
                      </p>
                    </>
                  )}
                  <input
                    type="file"
                    id="featured-image"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleImageUpload(e.target.files[0], "featured");
                      }
                    }}
                  />
                  <label
                    htmlFor="featured-image"
                    className={`inline-block px-4 py-2 rounded-xl cursor-pointer transition-all ${isDark
                      ? "bg-gray-800 hover:bg-gray-700"
                      : "bg-gray-100 hover:bg-gray-200"
                      }`}
                  >
                    {previewImage ? "Change Image" : "Choose Image"}
                  </label>
                </div>
                <p className="text-sm opacity-70 mt-4">
                  Appears on event cards and detail pages
                </p>
              </div>

              {/* Banner Image */}
              <div
                className={`rounded-2xl p-6 ${isDark ? "bg-gray-900" : "bg-white border border-gray-200"
                  }`}
              >
                <h3 className="text-lg font-bold mb-4">Banner Image</h3>
                <div
                  className={`border-2 border-dashed rounded-xl p-6 text-center ${isDark ? "border-gray-700" : "border-gray-300"
                    }`}
                >
                  {previewBanner ? (
                    <div className="relative">
                      <img
                        src={previewBanner}
                        alt="Banner Preview"
                        className="w-full h-32 object-cover rounded-lg mb-4"
                      />
                      <button
                        onClick={() => removeImage("banner")}
                        className="absolute top-2 right-2 p-2 bg-black/50 rounded-full hover:bg-black/70"
                      >
                        <X className="w-4 h-4 dark:text-white text-gray-900" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 mx-auto mb-4 opacity-40" />
                      <p className="mb-2">Upload banner image</p>
                      <p className="text-sm opacity-70 mb-4">
                        Recommended: 1920x400px
                      </p>
                    </>
                  )}
                  <input
                    type="file"
                    id="banner-image"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleImageUpload(e.target.files[0], "banner");
                      }
                    }}
                  />
                  <label
                    htmlFor="banner-image"
                    className={`inline-block px-4 py-2 rounded-xl cursor-pointer transition-all ${isDark
                      ? "bg-gray-800 hover:bg-gray-700"
                      : "bg-gray-100 hover:bg-gray-200"
                      }`}
                  >
                    {previewBanner ? "Change Banner" : "Choose Banner"}
                  </label>
                </div>
                <p className="text-sm opacity-70 mt-4">
                  Banner appears in homepage slider and event banners
                </p>
              </div>

              {/* Danger Zone */}
              <div
                className={`rounded-2xl p-6 border-2 border-red-500/20 ${isDark ? "bg-gray-900" : "bg-white"
                  }`}
              >
                <h3 className="text-lg font-bold mb-4 text-red-500 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Danger Zone
                </h3>
                <div className="space-y-4">
                  <div className="text-sm opacity-70">
                    These actions are irreversible. Please be certain.
                  </div>

                  <button
                    onClick={handleDelete}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold dark:text-white text-gray-900 bg-red-500 hover:bg-red-600 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                    Delete Event
                  </button>

                  {event.is_published && (
                    <button
                      onClick={handlePublishToggle}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-black bg-yellow-500 hover:bg-yellow-600 transition-colors"
                    >
                      <Eye className="w-5 h-5" />
                      Unpublish Event
                    </button>
                  )}
                </div>
              </div>

              {/* Save Actions */}
              <div
                className={`rounded-2xl p-6 ${isDark ? "bg-gray-900" : "bg-white border border-gray-200"
                  }`}
              >
                <h3 className="text-lg font-bold mb-4">Save Changes</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => handleSubmit(false)}
                    disabled={saving}
                    className={`w-full px-6 py-3 rounded-xl font-bold transition-all ${isDark
                      ? "bg-gray-800 hover:bg-gray-700"
                      : "bg-gray-100 hover:bg-gray-200"
                      } ${saving ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {saving ? "Saving..." : "Save as Draft"}
                  </button>

                  {!event.is_published && (
                    <button
                      onClick={() => handleSubmit(true)}
                      disabled={saving}
                      className={`w-full px-6 py-3 rounded-xl font-bold transition-all hover:scale-105 bg-[#00FB75] text-black hover:bg-green-400 ${saving ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                    >
                      {saving ? "Publishing..." : "Update & Publish"}
                    </button>
                  )}

                  <button
                    onClick={() => router.push("/admin/events")}
                    className="w-full px-6 py-3 rounded-xl font-medium text-center opacity-70 hover:opacity-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {/* Event Metadata */}
              <div
                className={`rounded-2xl p-6 ${isDark ? "bg-gray-900" : "bg-white border border-gray-200"
                  }`}
              >
                <h3 className="text-lg font-bold mb-4">Event Metadata</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="opacity-70">Created</span>
                    <span>
                      {new Date(event.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">Last Updated</span>
                    <span>
                      {event.updated_at
                        ? new Date(event.updated_at).toLocaleDateString()
                        : "Never"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">Published</span>
                    <span>
                      {event.published_at
                        ? new Date(event.published_at).toLocaleDateString()
                        : "Never"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">Event ID</span>
                    <span className="font-mono text-sm">
                      {event.id.substring(0, 8)}...
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">Slug</span>
                    <span className="font-mono text-sm truncate">
                      {event.slug}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">Status</span>
                    <span
                      className={`font-medium ${event.is_published
                        ? "text-green-500 dark:text-green-400"
                        : "text-yellow-500 dark:text-yellow-400"
                        }`}
                    >
                      {event.is_published ? "Published" : "Draft"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Container */}
      <div className="fixed bottom-6 right-6 z-50">
        {/* Toast notifications will appear here via react-hot-toast */}
      </div>
    </div>
  );
}
