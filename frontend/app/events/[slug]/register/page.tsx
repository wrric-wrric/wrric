"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Script from "next/script";
import Image from "next/image";
import { useTheme } from "next-themes";
import {
  Calendar,
  MapPin,
  User,
  Building,
  Mail,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  Users as UsersIcon,
  ChevronDown
} from "lucide-react";
import toast from "react-hot-toast";
import { KENYAN_UNIVERSITIES } from "@/utils/universities";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


interface Event {
  id: string;
  title: string;
  slug: string;
  description: string;
  event_datetime: string;
  timezone: string;
  location_type: "PHYSICAL" | "VIRTUAL" | "HYBRID";
  physical_location?: string;
  virtual_link?: string;
  featured_image_url?: string;
  is_published: boolean;
}

interface RegistrationSuccessData {
  event_title: string;
  user_email: string;
  user_name: string;
  registration_type?: "profile_first" | "anonymous" | string;
  redirect_url?: string;
}

export default function EventRegisterPage() {
  const router = useRouter();
  const params = useParams();
  const { slug } = params;

  const [event, setEvent] = useState<Event | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [formData, setFormData] = useState({
    event_id: "",
    first_name: "",
    last_name: "",
    email: "",
    position: "",
    organization: "",
    participation_type: "attendee" as "attendee" | "jury" | "speaker" | "idea_holder",
    attendance_type: "on_site" as "on_site" | "remote" | "hybrid",
    special_requirements: "",
    create_account: false,
    new_password: "",
    is_anonymous: false,
    university: "",
    project_name: "",
  });

  const [participantType, setParticipantType] = useState<"individual" | "group">("individual");
  const [groupData, setGroupData] = useState({
    group_name: "",
    category: "",
    members: [{ name: "", email: "", university: "" }]
  });

  const [recaptchaToken, setRecaptchaToken] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<RegistrationSuccessData | null>(null);

  // Set mounted state
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch event data
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await fetch(`/api/events/${slug}`);
        if (!response.ok) throw new Error("Event not found");
        const data = await response.json();
        setEvent(data);
        setFormData(prev => ({ ...prev, event_id: data.id }));
      } catch (error) {
        console.error("Failed to fetch event:", error);
        toast.error("Event not found");
        router.push("/events");
      }
    };

    if (mounted) {
      fetchEvent();
      // Check theme from localStorage
      const theme = localStorage.getItem('theme');
      setIsDarkMode(theme === 'dark');
    }
  }, [mounted, slug, router]);

  // Initialize reCAPTCHA callback (same as login page)
  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as any).__setRecaptchaToken = (token: string) => {
      setRecaptchaToken(token);
      setErrors(prev => ({ ...prev, recaptcha: "" }));
    };
  }, []);

  // Wait for reCAPTCHA script to load and render widget (same approach as login page)
  // IMPORTANT: Depends on `event` because the form (and recaptchaRef container) only renders after event loads
  useEffect(() => {
    if (!mounted || !event || typeof window === "undefined" || !recaptchaRef.current) return;

    const renderRecaptcha = (): boolean => {
      if (!window.grecaptcha || !window.grecaptcha.render) {
        console.warn("reCAPTCHA not loaded yet, retrying...");
        return false;
      }

      // Skip if widget already rendered
      if (widgetIdRef.current !== null) {
        return true;
      }

      // Render new widget
      try {
        const siteKey = process.env.NEXT_PUBLIC_SITE_KEY;
        if (!siteKey) {
          console.error("reCAPTCHA site key not configured");
          return false;
        }

        const widgetId = window.grecaptcha.render(recaptchaRef.current!, {
          sitekey: siteKey,
          callback: (token: string) => {
            if ((window as any).__setRecaptchaToken) {
              (window as any).__setRecaptchaToken(token);
            }
          },
          "expired-callback": () => {
            setRecaptchaToken("");
            toast.error("reCAPTCHA expired. Please verify again.");
          },
        });
        widgetIdRef.current = widgetId;
        return true;
      } catch (err) {
        console.error("Error rendering reCAPTCHA:", err);
        return false;
      }
    };

    // Poll for grecaptcha availability (same as login page)
    let attempts = 0;
    const maxAttempts = 20; // Increased attempts since we wait for event first
    const pollInterval = setInterval(() => {
      if (renderRecaptcha() || attempts >= maxAttempts) {
        clearInterval(pollInterval);
      }
      attempts++;
    }, 500);

    return () => {
      clearInterval(pollInterval);
    };
  }, [mounted, event]);

  // Reset reCAPTCHA when needed
  const resetRecaptcha = () => {
    if (widgetIdRef.current !== null && window.grecaptcha) {
      window.grecaptcha.reset(widgetIdRef.current);
      setRecaptchaToken("");
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (widgetIdRef.current !== null && window.grecaptcha) {
        window.grecaptcha.reset(widgetIdRef.current);
      }
    };
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.first_name.trim() && participantType === "individual") {
      newErrors.first_name = "First name is required";
    }
    if (!formData.last_name.trim() && participantType === "individual") {
      newErrors.last_name = "Last name is required";
    }
    if (!formData.email.trim() && participantType === "individual") {
      newErrors.email = "Email is required";
    } else if (participantType === "individual" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email address";
    }

    if (participantType === "group") {
      if (!groupData.group_name.trim()) newErrors.group_name = "Group name is required";
      if (!groupData.category.trim()) newErrors.category = "Category is required";
      if (groupData.members.length === 0) newErrors.members = "At least one member is required";
      groupData.members.forEach((m, i) => {
        if (!m.name.trim()) newErrors[`member_name_${i}`] = "Name required";
        if (!m.email.trim()) newErrors[`member_email_${i}`] = "Email required";
      });
    }

    if (!formData.project_name.trim()) {
      newErrors.project_name = "Project name is required";
    }

    if (formData.create_account && formData.new_password.length < 8) {
      newErrors.new_password = "Password must be at least 8 characters";
    }
    if (!recaptchaToken) {
      newErrors.recaptcha = "Please complete the security verification";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the errors in the form");
      return;
    }

    setLoading(true);

    try {
      const form = new FormData();

      // Basic fields for backend (use first member if group)
      const primaryFirstName = participantType === "group" ? groupData.members[0].name.split(' ')[0] : formData.first_name;
      const primaryLastName = participantType === "group" ? groupData.members[0].name.split(' ').slice(1).join(' ') : formData.last_name;
      const primaryEmail = participantType === "group" ? groupData.members[0].email : formData.email;

      form.append('event_id', formData.event_id);
      form.append('first_name', primaryFirstName);
      form.append('last_name', primaryLastName || "Participant");
      form.append('email', primaryEmail);
      form.append('participation_type', formData.participation_type);
      form.append('attendance_type', formData.attendance_type);
      form.append('special_requirements', formData.special_requirements);
      form.append('create_account', String(formData.create_account));
      form.append('new_password', formData.new_password);
      form.append('is_anonymous', String(formData.is_anonymous));

      // Metadata fields
      const metadata: any = {
        participant_type: participantType,
        project_name: formData.project_name,
        university: formData.university
      };
      if (participantType === "group") {
        metadata.group_name = groupData.group_name;
        metadata.category = groupData.category;
        metadata.members = groupData.members;
      }
      form.append('metadata_', JSON.stringify(metadata));

      // Add reCAPTCHA token
      form.append('recaptcha_token', recaptchaToken);

      const response = await fetch(
        `/api/events/${slug}/register`,
        {
          method: "POST",
          body: form,
        }
      );

      const data = await response.json();

      if (response.ok) {
        // Show success modal instead of immediate redirect
        setSuccessData({
          ...data,
          event_title: event?.title || '',
          user_email: formData.email,
          user_name: `${formData.first_name} ${formData.last_name}`,
        });
        setShowSuccessModal(true);
      } else {
        toast.error(data.detail || "Registration failed");
        resetRecaptcha();
      }
    } catch (error) {
      console.error("Registration error:", error);
      toast.error("An error occurred. Please try again.");
      resetRecaptcha();
    } finally {
      setLoading(false);
    }
  };


  if (!mounted || !event) {
    return (
      <div className="h-full flex flex-col dark:bg-[#0A0A0A] bg-gray-50">
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-6 py-8">
            <div className="max-w-4xl mx-auto">
              <div className="animate-pulse space-y-6">
                <div className="h-8 dark:bg-gray-800 bg-gray-300 rounded w-1/3"></div>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-32 dark:bg-gray-800 bg-gray-300 rounded-xl"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isVirtual = event.location_type === "VIRTUAL";

  return (
    <>
      <Script
        src="https://www.google.com/recaptcha/api.js"
        strategy="afterInteractive"
      />

      <div className="h-full flex flex-col dark:bg-[#0A0A0A] bg-gray-50">
        <header className="sticky top-0 z-40 backdrop-blur-md border-b dark:bg-[#0A0A0A]/80 bg-white/80 dark:border-gray-800 border-gray-200 flex-shrink-0">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 rounded-lg dark:hover:bg-gray-800 hover:bg-gray-200 transition-colors"
                title="Go back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 flex items-center justify-center">
                  <Image
                    src={isDark ? "/assets/logos/logo-white.png" : "/assets/logos/logo-black.png"}
                    alt="WRRIC Logo"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
                <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 mx-1 hidden sm:block" />
              </div>

              <div className="flex-1">
                <h1 className="text-xl font-semibold">Register for Event</h1>
                <p className="text-sm opacity-70">Join {event?.title || 'the event'}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-6 py-8">
            <div className="max-w-4xl mx-auto space-y-6">
              <div className={`rounded-xl p-6 dark:bg-[#1A1A1A] bg-white dark:border-gray-800 border-gray-200`}>
                <div className="flex items-start gap-4">
                  {event.featured_image_url && (
                    <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                      <Image
                        src={event.featured_image_url}
                        alt={event.title}
                        width={96}
                        height={96}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-bold mb-2">{event.title}</h2>
                    <div className="flex flex-wrap gap-4 text-sm opacity-70">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(event.event_datetime).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </div>
                      {event.physical_location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {event.physical_location}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Participation Type Selector */}
                <div className="flex p-1 bg-gray-200 dark:bg-gray-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setParticipantType("individual")}
                    className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${participantType === "individual"
                      ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600"
                      : "text-gray-500 hover:text-gray-400"
                      }`}
                  >
                    Register Individually
                  </button>
                  <button
                    type="button"
                    onClick={() => setParticipantType("group")}
                    className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${participantType === "group"
                      ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600"
                      : "text-gray-500 hover:text-gray-400"
                      }`}
                  >
                    Register as Group
                  </button>
                </div>

                <div className={`rounded-xl p-6 dark:bg-[#1A1A1A] bg-white dark:border-gray-800 border-gray-200`}>
                  <h3 className="text-lg font-semibold mb-4">
                    {participantType === "individual" ? "Personal Information" : "Group Information"}
                  </h3>

                  {participantType === "group" ? (
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Group Name</label>
                          <input
                            value={groupData.group_name}
                            onChange={(e) => setGroupData({ ...groupData, group_name: e.target.value })}
                            placeholder="Team Innovation"
                            className="w-full p-3 rounded-lg dark:bg-gray-800 bg-white dark:border-gray-700 border-gray-300 dark:text-white text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Category</label>
                          <input
                            value={groupData.category}
                            onChange={(e) => setGroupData({ ...groupData, category: e.target.value })}
                            placeholder="Health Tech"
                            className="w-full p-3 rounded-lg dark:bg-gray-800 bg-white dark:border-gray-700 border-gray-300 dark:text-white text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Members</h4>
                          <button
                            type="button"
                            onClick={() => setGroupData({
                              ...groupData,
                              members: [...groupData.members, { name: "", email: "", university: "" }]
                            })}
                            className="text-xs text-blue-600 flex items-center gap-1 hover:underline font-semibold"
                          >
                            <Plus className="w-3 h-3" /> Add Member
                          </button>
                        </div>

                        <div className="space-y-4">
                          {groupData.members.map((member, idx) => (
                            <div key={idx} className={cn(
                              "p-5 rounded-xl border transition-all duration-200",
                              idx === 0
                                ? "bg-blue-50/30 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30 ring-1 ring-blue-500/20"
                                : "bg-white dark:bg-gray-800/40 border-gray-200 dark:border-gray-700"
                            )}>
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                  <div className={cn(
                                    "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold",
                                    idx === 0 ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                                  )}>
                                    {idx + 1}
                                  </div>
                                  <h5 className="font-semibold text-sm">
                                    {idx === 0 ? "Lead Member (Primary Contact)" : `Member ${idx + 1}`}
                                  </h5>
                                </div>
                                {idx > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setGroupData({
                                      ...groupData,
                                      members: groupData.members.filter((_, i) => i !== idx)
                                    })}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>

                              <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Full Name</label>
                                  <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                      value={member.name}
                                      onChange={(e) => {
                                        const m = [...groupData.members];
                                        m[idx].name = e.target.value;
                                        setGroupData({ ...groupData, members: m });
                                      }}
                                      placeholder="Full Name"
                                      className="w-full pl-10 pr-3 py-2.5 text-sm rounded-lg bg-white dark:bg-gray-900 border dark:border-gray-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                      required
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Email Address</label>
                                  <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                      value={member.email}
                                      onChange={(e) => {
                                        const m = [...groupData.members];
                                        m[idx].email = e.target.value;
                                        setGroupData({ ...groupData, members: m });
                                      }}
                                      placeholder="Email"
                                      type="email"
                                      className="w-full pl-10 pr-3 py-2.5 text-sm rounded-lg bg-white dark:bg-gray-900 border dark:border-gray-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                      required
                                    />
                                  </div>
                                </div>
                                <div className="md:col-span-2 space-y-1.5">
                                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">University / Institution</label>
                                  <div className="relative">
                                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <select
                                      value={member.university}
                                      onChange={(e) => {
                                        const m = [...groupData.members];
                                        m[idx].university = e.target.value;
                                        setGroupData({ ...groupData, members: m });
                                      }}
                                      className="w-full pl-10 pr-3 py-2.5 text-sm rounded-lg bg-white dark:bg-gray-900 border dark:border-gray-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none text-sm"
                                      required
                                    >
                                      <option value="">Select University</option>
                                      {KENYAN_UNIVERSITIES.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium flex items-center gap-2">
                            <User className="w-4 h-4 text-blue-600" />
                            First Name
                          </label>
                          <input
                            value={formData.first_name}
                            onChange={(e) =>
                              setFormData({ ...formData, first_name: e.target.value })
                            }
                            type="text"
                            placeholder="John"
                            className="w-full p-3 rounded-lg dark:bg-gray-800 bg-white dark:border-gray-700 border-gray-300 dark:text-white text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Last Name</label>
                          <input
                            value={formData.last_name}
                            onChange={(e) =>
                              setFormData({ ...formData, last_name: e.target.value })
                            }
                            type="text"
                            placeholder="Doe"
                            className="w-full p-3 rounded-lg dark:bg-gray-800 bg-white dark:border-gray-700 border-gray-300 dark:text-white text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <Mail className="w-4 h-4 text-blue-600" />
                          Email Address
                        </label>
                        <input
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value.toLowerCase() })
                          }
                          type="email"
                          placeholder="john@example.com"
                          className="w-full p-3 rounded-lg dark:bg-gray-800 bg-white dark:border-gray-700 border-gray-300 dark:text-white text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Innovation / Project Name</label>
                          <input
                            value={formData.project_name}
                            onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                            placeholder="Project Name"
                            className="w-full p-3 rounded-lg dark:bg-gray-800 bg-white dark:border-gray-700 border-gray-300 dark:text-white text-gray-900 focus:border-blue-500"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">University</label>
                          <select
                            value={formData.university}
                            onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                            className="w-full p-3 rounded-lg dark:bg-gray-800 bg-white dark:border-gray-700 border-gray-300 dark:text-white text-gray-900 focus:border-blue-500"
                            required
                          >
                            <option value="">Select University</option>
                            {KENYAN_UNIVERSITIES.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className={`rounded-xl p-6 dark:bg-[#1A1A1A] bg-white dark:border-gray-800 border-gray-200`}>
                  <h3 className="text-lg font-semibold mb-4">Participation Details</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Participation Type
                      </label>
                      <select
                        value={formData.participation_type}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            participation_type: e.target.value as any,
                          })
                        }
                        className="w-full p-3 rounded-lg dark:bg-gray-800 bg-white dark:border-gray-700 border-gray-300 dark:text-white text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                      >
                        <option value="attendee">Attendee</option>
                        <option value="jury">Jury / Judge</option>
                        <option value="speaker">Speaker</option>
                        <option value="idea_holder">Idea Holder</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-600" />
                        Attendance Type
                      </label>
                      <select
                        value={formData.attendance_type}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            attendance_type: e.target.value as any,
                          })
                        }
                        className="w-full p-3 rounded-lg dark:bg-gray-800 bg-white dark:border-gray-700 border-gray-300 dark:text-white text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                      >
                        {!isVirtual && <option value="on_site">On-site (In Person)</option>}
                        <option value="remote">Remote / Virtual</option>
                        {!isVirtual && <option value="hybrid">Hybrid</option>}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2 mt-4">
                    <label className="text-sm font-medium">
                      Special Requirements
                    </label>
                    <textarea
                      value={formData.special_requirements}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          special_requirements: e.target.value,
                        })
                      }
                      placeholder="Any accessibility needs, dietary requirements, etc."
                      rows={3}
                      className="w-full p-3 rounded-lg dark:bg-gray-800 bg-white dark:border-gray-700 border-gray-300 dark:text-white text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors resize-none"
                    />
                  </div>
                </div>

                <div className={`rounded-xl p-6 dark:bg-[#1A1A1A] bg-white dark:border-gray-800 border-gray-200`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.create_account}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          create_account: e.target.checked,
                        })
                      }
                      className="w-5 h-5 text-blue-600 rounded border-gray-600 focus:ring-blue-600"
                    />
                    <div>
                      <span className="text-sm font-medium block">
                        Create an account to manage my registration
                      </span>
                      <span className="text-xs text-gray-400">
                        Easily manage your events and profile
                      </span>
                    </div>
                  </label>

                  {formData.create_account && (
                    <div className="space-y-2 mt-4 ml-8">
                      <label className="text-sm font-medium">
                        Create Password
                      </label>
                      <input
                        value={formData.new_password}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            new_password: e.target.value,
                          })
                        }
                        type="password"
                        placeholder="Min 8 characters"
                        minLength={8}
                        className="w-full p-3 rounded-lg dark:bg-gray-800 bg-white dark:border-gray-700 border-gray-300 dark:text-white text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                      />
                      {errors.new_password && (
                        <p className="text-red-500 text-xs">
                          {errors.new_password}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className={`rounded-xl p-6 dark:bg-[#1A1A1A] bg-white dark:border-gray-800 border-gray-200`}>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_anonymous}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          is_anonymous: e.target.checked,
                        })
                      }
                      className="w-5 h-5 text-[#00FB75] rounded border-gray-600 focus:ring-[#00FB75] mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-medium block">
                        Register anonymously
                      </span>
                      <span className="text-xs text-gray-400">
                        Your registration will be private and not visible in the attendee list. You won&apos;t receive any emails about this event.
                      </span>
                    </div>
                  </label>
                </div>

                <div className={`rounded-xl p-6 dark:bg-[#1A1A1A] bg-white dark:border-gray-800 border-gray-200`}>
                  <h3 className="text-lg font-semibold mb-4">Security Verification</h3>
                  <div className="flex flex-col items-center">
                    {/* reCAPTCHA container - never hide this div, same as login page */}
                    <div className="flex justify-center my-2">
                      <div
                        ref={recaptchaRef}
                        className="g-recaptcha"
                      />
                    </div>
                    {errors.recaptcha && (
                      <p className="text-red-500 text-xs mt-2">{errors.recaptcha}</p>
                    )}
                    <p className="text-xs dark:text-gray-400 text-gray-600 mt-2 text-center">
                      Please complete the security check to verify you&apos;re not a robot
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="flex-1 px-6 py-3.5 rounded-lg border dark:border-gray-700 border-gray-300 dark:text-gray-300 text-gray-700 dark:hover:bg-gray-800 hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !recaptchaToken}
                    className="flex-1 bg-[#00FB75] text-black font-semibold px-6 py-3.5 rounded-lg hover:bg-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Registering...
                      </>
                    ) : (
                      "Complete Registration"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {
        showSuccessModal && successData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={`w-full max-w-md rounded-2xl p-8 text-center ${isDarkMode ? 'bg-[#0A0A0A] border border-gray-800 text-white' : 'bg-white text-gray-900'}`}>
              {/* Success Icon */}
              <div className="mb-6 flex justify-center">
                <div className="rounded-full bg-green-500/20 p-4">
                  <CheckCircle2 className="w-16 h-16 text-green-500" />
                </div>
              </div>

              {/* Success Message */}
              <h2 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Registration Successful!</h2>
              <p className={`text-lg mb-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Welcome aboard, {successData?.user_name}!
              </p>

              {/* Event Details */}
              <div className={`rounded-xl p-4 mb-6 text-left ${isDarkMode ? 'bg-[#1A1A1A]' : 'bg-gray-50'}`}>
                <p className={`text-sm mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Event</p>
                <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{successData?.event_title}</p>

                <p className={`text-sm mt-3 mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Confirmation sent to</p>
                <p className="font-medium text-blue-600">{successData?.user_email}</p>
              </div>

              {/* Registration Type Specific Messages */}
              {successData?.registration_type === "profile_first" && (
                <div className={`rounded-xl p-4 mb-6 border ${isDarkMode ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200' : 'border-yellow-600/30 bg-yellow-50 text-yellow-900'}`}>
                  <p className="text-sm">
                    📧 <span className="font-semibold">Check your email</span> to complete your account setup and activate your registration.
                  </p>
                </div>
              )}

              {successData?.registration_type === "anonymous" && (
                <div className={`rounded-xl p-4 mb-6 border ${isDarkMode ? 'border-blue-500/30 bg-blue-500/10 text-blue-200' : 'border-blue-600/30 bg-blue-50 text-blue-900'}`}>
                  <p className="text-sm">
                    ✅ Your anonymous registration is complete. You&apos;ll receive event updates at your email.
                  </p>
                </div>
              )}

              {formData.create_account && !successData?.registration_type && (
                <div className={`rounded-xl p-4 mb-6 border ${isDarkMode ? 'border-blue-500/30 bg-blue-500/10 text-blue-200' : 'border-blue-600/30 bg-blue-50 text-blue-900'}`}>
                  <p className="text-sm">
                    🎉 <span className="font-semibold">Account created!</span> Please check your email to verify your account.
                  </p>
                </div>
              )}

              {!successData?.registration_type && !formData.create_account && (
                <p className={`text-sm mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  A confirmation email has been sent to your inbox with event details and next steps.
                </p>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => {
                    if (successData?.redirect_url) {
                      window.location.href = successData.redirect_url;
                    } else if (successData?.registration_type === "profile_first") {
                      router.push("/events");
                    } else if (formData.create_account) {
                      router.push("/auth/login");
                    } else {
                      router.push(`/events/${slug}`);
                    }
                  }}
                  className="w-full bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {successData?.registration_type === "profile_first"
                    ? "View All Events"
                    : formData.create_account
                      ? "Go to Login"
                      : "View Event Details"
                  }
                </button>

                <button
                  onClick={() => router.push("/events")}
                  className={`w-full px-6 py-3 rounded-lg border transition-colors ${isDarkMode
                    ? 'border-gray-700 hover:bg-gray-800 text-white'
                    : 'border-gray-300 hover:bg-gray-50 text-gray-900'
                    }`}
                >
                  Browse More Events
                </button>
              </div>
            </div>
          </div>
        )
      }
    </>
  );
}