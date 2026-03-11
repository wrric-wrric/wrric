"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useSidebar } from "@/hooks/sideBarProvider";
import toast from "react-hot-toast";
import { Building, Globe, Mail, Phone, DollarSign, MapPin, Target, History, ArrowLeft, Plus, X } from "lucide-react";

export default function NewFunderPage() {
  const router = useRouter();
  const { theme, resolvedTheme } = useTheme();
  const { setLoadSession } = useSidebar();
  
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    website: "",
    // Contact fields
    email: "",
    phone: "",
    // Profile
    profile: "",
    org_type: "vc",
    // Regions (array)
    regions: [] as string[],
    // Thematic focus (array)
    thematic_focus: [] as string[],
    // Investment amounts
    min_ticket: "",
    max_ticket: "",
    // Investment history (array of objects)
    investment_history: [] as Array<{ company: string; amount: string; year: string }>,
  });
  
  const [newRegion, setNewRegion] = useState("");
  const [newFocus, setNewFocus] = useState("");
  const [newInvestment, setNewInvestment] = useState({ company: "", amount: "", year: "" });
  const [loading, setLoading] = useState(false);
  const [isFunder, setIsFunder] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const orgTypes = [
    { value: "vc", label: "Venture Capital", icon: "💼" },
    { value: "angel", label: "Angel Investor", icon: "👼" },
    { value: "gov", label: "Government Fund", icon: "🏛️" },
    { value: "foundation", label: "Foundation", icon: "🏢" },
    { value: "corporate", label: "Corporate VC", icon: "🏭" },
  ];

  // Fix hydration
  useEffect(() => {
    setMounted(true);
    setLoadSession(() => {});
    return () => setLoadSession(() => {});
  }, [setLoadSession]);

  const currentTheme = mounted ? resolvedTheme : "light";
  const isDark = currentTheme === "dark";

  useEffect(() => {
    const checkFunderProfile = async () => {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!token) {
        toast.error("Please log in to access this page.");
        router.push("/auth/login?redirect=/funders/new");
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
            toast.error("You must have a funder profile to create a funder organization.");
            router.push("/profiles/new?type=funder");
          }
        } else {
          toast.error("Failed to verify profile.");
          router.push("/auth/login?redirect=/funders/new");
        }
      } catch (error) {
        console.error("Check profile error:", error);
        toast.error("Failed to verify profile.");
        router.push("/auth/login?redirect=/funders/new");
      } finally {
        setCheckingAuth(false);
      }
    };
    checkFunderProfile();
  }, [router]);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.name.trim()) {
      newErrors.name = "Organization name is required.";
    }
    if (!formData.profile.trim()) {
      newErrors.profile = "Organization profile is required.";
    }
    if (formData.thematic_focus.length === 0) {
      newErrors.thematic_focus = "At least one thematic focus is required.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setLoading(true);

    // Convert form data to the expected format
    const submitData = {
      name: formData.name,
      website: formData.website,
      contact: {
        email: formData.email,
        phone: formData.phone
      },
      profile: formData.profile,
      org_type: formData.org_type,
      regions: formData.regions,
      thematic_focus: formData.thematic_focus,
      min_ticket: formData.min_ticket ? parseInt(formData.min_ticket) : null,
      max_ticket: formData.max_ticket ? parseInt(formData.max_ticket) : null,
      investment_history: formData.investment_history.map(inv => ({
        company: inv.company,
        amount: parseInt(inv.amount),
        year: parseInt(inv.year)
      })),
    };

    try {
      const response = await fetch("/api/funders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || sessionStorage.getItem("token") || ""}`,
        },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      toast.success("Funder organization created successfully!");
      router.push("/funders");
    } catch (error) {
      console.error("Funder creation error:", error);
      toast.error("Failed to create funder organization. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" })); // Clear error on change
  };

  const handleInvestmentChange = (field: string, value: string) => {
    setNewInvestment(prev => ({ ...prev, [field]: value }));
  };

  const addRegion = () => {
    if (newRegion.trim() && !formData.regions.includes(newRegion.trim())) {
      setFormData(prev => ({
        ...prev,
        regions: [...prev.regions, newRegion.trim()]
      }));
      setNewRegion("");
    }
  };

  const removeRegion = (index: number) => {
    setFormData(prev => ({
      ...prev,
      regions: prev.regions.filter((_, i) => i !== index)
    }));
  };

  const addFocus = () => {
    if (newFocus.trim() && !formData.thematic_focus.includes(newFocus.trim())) {
      setFormData(prev => ({
        ...prev,
        thematic_focus: [...prev.thematic_focus, newFocus.trim()]
      }));
      setNewFocus("");
      setErrors((prev) => ({ ...prev, thematic_focus: "" })); // Clear error on add
    }
  };

  const removeFocus = (index: number) => {
    setFormData(prev => ({
      ...prev,
      thematic_focus: prev.thematic_focus.filter((_, i) => i !== index)
    }));
  };

  const addInvestment = () => {
    if (newInvestment.company.trim() && newInvestment.amount && newInvestment.year) {
      setFormData(prev => ({
        ...prev,
        investment_history: [...prev.investment_history, { ...newInvestment }]
      }));
      setNewInvestment({ company: "", amount: "", year: "" });
    }
  };

  const removeInvestment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      investment_history: prev.investment_history.filter((_, i) => i !== index)
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent, callback: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      callback();
    }
  };

  if (!mounted || checkingAuth) {
    return (
      <div className={`min-h-screen ${isDark ? "bg-black" : "bg-gray-50"}`}>
        <div className="container mx-auto px-6 py-8">
          <div className="max-w-2xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="space-y-4">
                {[...Array(8)].map((_, i) => (
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
              <h1 className="text-2xl font-bold">Create Funder Organization</h1>
              <p className="text-sm opacity-70">Add your investment organization details</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Information */}
            <div className={`rounded-xl p-6 ${isDark ? "bg-gray-900" : "bg-white shadow-sm"}`}>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Building className="w-5 h-5" />
                Basic Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">
                    Organization Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., Tech Ventures Fund"
                    className={`w-full p-3 rounded-lg border transition-colors ${
                      isDark 
                        ? "bg-gray-800 border-gray-700 text-white focus:border-[#00FB75]" 
                        : "bg-white border-gray-300 text-gray-900 focus:border-[#00FB75]"
                    } ${errors.name ? "border-red-500" : ""}`}
                    required
                  />
                  {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                </div>

                <div className="med:col-span-2">
                  <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Website
                  </label>
                  <input
                    name="website"
                    value={formData.website}
                    onChange={handleInputChange}
                    placeholder="https://yourfund.com"
                    className={`w-full p-3 rounded-lg border transition-colors ${
                      isDark 
                        ? "bg-gray-800 border-gray-700 text-white focus:border-[#00FB75]" 
                        : "bg-white border-gray-300 text-gray-900 focus:border-[#00FB75]"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Organization Type <span className="text-red-500">*</span>
                    </label>
                  <select
                    name="org_type"
                    value={formData.org_type}
                    onChange={handleInputChange}
                    className={`w-full p-3 rounded-lg border transition-colors ${
                      isDark 
                        ? "bg-gray-800 border-gray-700 text-white focus:border-[#00FB75]" 
                        : "bg-white border-gray-300 text-gray-900 focus:border-[#00FB75]"
                    }`}
                    required
                  >
                    {orgTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </option>
                    ))}
                  </select>
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
                  <input
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="contact@fund.com"
                    className={`w-full p-3 rounded-lg border transition-colors ${
                      isDark 
                        ? "bg-gray-800 border-gray-700 text-white focus:border-[#00FB75]" 
                        : "bg-white border-gray-300 text-gray-900 focus:border-[#00FB75]"
                    }`}
                  />
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
                    placeholder="+1234567890"
                    className={`w-full p-3 rounded-lg border transition-colors ${
                      isDark 
                        ? "bg-gray-800 border-gray-700 text-white focus:border-[#00FB75]" 
                        : "bg-white border-gray-300 text-gray-900 focus:border-[#00FB75]"
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Organization Profile */}
            <div className={`rounded-xl p-6 ${isDark ? "bg-gray-900" : "bg-white shadow-sm"}`}>
              <h2 className="text-lg font-semibold mb-4">
                Organization Profile <span className="text-red-500">*</span>
              </h2>
              <textarea
                name="profile"
                value={formData.profile}
                onChange={handleInputChange}
                placeholder="Describe your fund's mission, investment philosophy, and key focus areas..."
                rows={4}
                className={`w-full p-3 rounded-lg border transition-colors resize-none ${
                  isDark 
                    ? "bg-gray-800 border-gray-700 text-white focus:border-[#00FB75]" 
                    : "bg-white border-gray-300 text-gray-900 focus:border-[#00FB75]"
                } ${errors.profile ? "border-red-500" : ""}`}
                required
              />
              {errors.profile && <p className="text-red-500 text-sm mt-1">{errors.profile}</p>}
            </div>

            {/* Investment Regions */}
            <div className={`rounded-xl p-6 ${isDark ? "bg-gray-900" : "bg-white shadow-sm"}`}>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Investment Regions
              </h2>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    value={newRegion}
                    onChange={(e) => setNewRegion(e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, addRegion)}
                    placeholder="Add a region (e.g., North America, Africa, Europe)"
                    className={`flex-1 p-3 rounded-lg border transition-colors ${
                      isDark 
                        ? "bg-gray-800 border-gray-700 text-white focus:border-[#00FB75]" 
                        : "bg-white border-gray-300 text-gray-900 focus:border-[#00FB75]"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={addRegion}
                    className={`px-4 py-3 rounded-lg transition-colors ${
                      isDark 
                        ? "bg-gray-700 hover:bg-gray-600 text-white" 
                        : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                    }`}
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                
                {formData.regions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.regions.map((region, index) => (
                      <div
                        key={index}
                        className={`flex items-center gap-2 px-3 py-2 rounded-full ${
                          isDark ? "bg-gray-700" : "bg-gray-200"
                        }`}
                      >
                        <span className="text-sm">{region}</span>
                        <button
                          type="button"
                          onClick={() => removeRegion(index)}
                          className={`p-1 rounded-full ${
                            isDark ? "hover:bg-gray-600" : "hover:bg-gray-300"
                          }`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Thematic Focus */}
            <div className={`rounded-xl p-6 ${isDark ? "bg-gray-900" : "bg-white shadow-sm"}`}>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5" />
                Thematic Focus <span className="text-red-500">*</span>
              </h2>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    value={newFocus}
                    onChange={(e) => setNewFocus(e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, addFocus)}
                    placeholder="Add a focus area (e.g., Climate Tech, Healthcare, AI)"
                    className={`flex-1 p-3 rounded-lg border transition-colors ${
                      isDark 
                        ? "bg-gray-800 border-gray-700 text-white focus:border-[#00FB75]" 
                        : "bg-white border-gray-300 text-gray-900 focus:border-[#00FB75]"
                    } ${errors.thematic_focus ? "border-red-500" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={addFocus}
                    className={`px-4 py-3 rounded-lg transition-colors ${
                      isDark 
                        ? "bg-gray-700 hover:bg-gray-600 text-white" 
                        : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                    }`}
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                {errors.thematic_focus && <p className="text-red-500 text-sm mt-1">{errors.thematic_focus}</p>}
                
                {formData.thematic_focus.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.thematic_focus.map((focus, index) => (
                      <div
                        key={index}
                        className={`flex items-center gap-2 px-3 py-2 rounded-full ${
                          isDark ? "bg-gray-700" : "bg-gray-200"
                        }`}
                      >
                        <span className="text-sm">{focus}</span>
                        <button
                          type="button"
                          onClick={() => removeFocus(index)}
                          className={`p-1 rounded-full ${
                            isDark ? "hover:bg-gray-600" : "hover:bg-gray-300"
                          }`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
                  <input
                    name="min_ticket"
                    type="number"
                    value={formData.min_ticket}
                    onChange={handleInputChange}
                    placeholder="50000"
                    className={`w-full p-3 rounded-lg border transition-colors ${
                      isDark 
                        ? "bg-gray-800 border-gray-700 text-white focus:border-[#00FB75]" 
                        : "bg-white border-gray-300 text-gray-900 focus:border-[#00FB75]"
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Maximum Ticket Size ($)</label>
                  <input
                    name="max_ticket"
                    type="number"
                    value={formData.max_ticket}
                    onChange={handleInputChange}
                    placeholder="500000"
                    className={`w-full p-3 rounded-lg border transition-colors ${
                      isDark 
                        ? "bg-gray-800 border-gray-700 text-white focus:border-[#00FB75]" 
                        : "bg-white border-gray-300 text-gray-900 focus:border-[#00FB75]"
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Investment History */}
            <div className={`rounded-xl p-6 ${isDark ? "bg-gray-900" : "bg-white shadow-sm"}`}>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <History className="w-5 h-5" />
                Investment History
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    value={newInvestment.company}
                    onChange={(e) => handleInvestmentChange('company', e.target.value)}
                    placeholder="Company name"
                    className={`p-3 rounded-lg border transition-colors ${
                      isDark 
                        ? "bg-gray-800 border-gray-700 text-white focus:border-[#00FB75]" 
                        : "bg-white border-gray-300 text-gray-900 focus:border-[#00FB75]"
                    }`}
                  />
                  <input
                    value={newInvestment.amount}
                    onChange={(e) => handleInvestmentChange('amount', e.target.value)}
                    placeholder="Amount ($)"
                    type="number"
                    className={`p-3 rounded-lg border transition-colors ${
                      isDark 
                        ? "bg-gray-800 border-gray-700 text-white focus:border-[#00FB75]" 
                        : "bg-white border-gray-300 text-gray-900 focus:border-[#00FB75]"
                    }`}
                  />
                  <input
                    value={newInvestment.year}
                    onChange={(e) => handleInvestmentChange('year', e.target.value)}
                    placeholder="Year"
                    type="number"
                    className={`p-3 rounded-lg border transition-colors ${
                      isDark 
                        ? "bg-gray-800 border-gray-700 text-white focus:border-[#00FB75]" 
                        : "bg-white border-gray-300 text-gray-900 focus:border-[#00FB75]"
                    }`}
                  />
                </div>
                <button
                  type="button"
                  onClick={addInvestment}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    isDark 
                      ? "bg-gray-700 hover:bg-gray-600 text-white" 
                      : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  Add Investment
                </button>
                
                {formData.investment_history.length > 0 && (
                  <div className="space-y-2">
                    {formData.investment_history.map((investment, index) => (
                      <div
                        key={index}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          isDark ? "bg-gray-800" : "bg-gray-100"
                        }`}
                      >
                        <div>
                          <span className="font-medium">{investment.company}</span>
                          <span className={`text-sm mx-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                            - ${parseInt(investment.amount).toLocaleString()} ({investment.year})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeInvestment(index)}
                          className={`p-1 rounded ${
                            isDark ? "hover:bg-gray-700" : "hover:bg-gray-200"
                          }`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-6">
              <button
                type="button"
                onClick={() => router.back()}
                className={`flex-1 px-6 py-3 rounded-lg border transition-colors ${
                  isDark 
                    ? "border-gray-700 text-gray-300 hover:bg-gray-800" 
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`flex-1 bg-[#00FB75] text-black font-semibold px-6 py-3 rounded-lg hover:bg-green-400 transition-colors flex items-center justify-center gap-2 ${
                  loading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Creating Funder...
                  </>
                ) : (
                  "Create Funder Organization"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}