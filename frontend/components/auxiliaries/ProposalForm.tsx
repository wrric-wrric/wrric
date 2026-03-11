"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import toast from "react-hot-toast";
import { DollarSign, FileText, Target, Send } from "lucide-react";

interface ProposalFormProps {
  entityId: string;
  funderId: string;
  onSuccess?: () => void;
}

export default function ProposalForm({ entityId, funderId, onSuccess }: ProposalFormProps) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    summary: "",
    ask_amount: "",
    equity_seek: "",
    stage: "seed",
    climate_focus: [] as string[],
    documents: [] as string[],
  });

  const stages = [
    { value: "idea", label: "Idea/Concept" },
    { value: "prototype", label: "Prototype" },
    { value: "seed", label: "Seed" },
    { value: "series_a", label: "Series A" },
    { value: "series_b", label: "Series B" },
    { value: "growth", label: "Growth" },
  ];

  const climateFocusAreas = [
    "renewable_energy",
    "carbon_capture",
    "sustainable_agriculture",
    "electric_vehicles",
    "energy_storage",
    "green_hydrogen",
    "circular_economy",
    "climate_adaptation"
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const response = await fetch("/api/proposals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          entity_id: entityId,
          funder_id: funderId,
          ask_amount: formData.ask_amount ? parseInt(formData.ask_amount) : null,
          equity_seek: formData.equity_seek ? parseFloat(formData.equity_seek) : null,
        }),
      });

      if (!response.ok) throw new Error("Failed to create proposal");
      
      toast.success("Proposal created successfully!");
      onSuccess?.();
      router.refresh();
    } catch (error) {
      console.error("Proposal creation error:", error);
      toast.error("Failed to create proposal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">Proposal Title</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          className={`w-full p-3 rounded-lg border transition-colors ${
            isDark 
              ? "bg-gray-800 border-gray-700 text-white focus:border-[#00FB75]" 
              : "bg-white border-gray-300 text-gray-900 focus:border-[#00FB75]"
          }`}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Summary</label>
        <textarea
          value={formData.summary}
          onChange={(e) => setFormData(prev => ({ ...prev, summary: e.target.value }))}
          rows={4}
          className={`w-full p-3 rounded-lg border transition-colors resize-none ${
            isDark 
              ? "bg-gray-800 border-gray-700 text-white focus:border-[#00FB75]" 
              : "bg-white border-gray-300 text-gray-900 focus:border-[#00FB75]"
          }`}
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Funding Ask ($)
          </label>
          <input
            type="number"
            value={formData.ask_amount}
            onChange={(e) => setFormData(prev => ({ ...prev, ask_amount: e.target.value }))}
            className={`w-full p-3 rounded-lg border transition-colors ${
              isDark 
                ? "bg-gray-800 border-gray-700 text-white focus:border-[#00FB75]" 
                : "bg-white border-gray-300 text-gray-900 focus:border-[#00FB75]"
            }`}
            placeholder="500000"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Equity Sought (%)</label>
          <input
            type="number"
            step="0.1"
            value={formData.equity_seek}
            onChange={(e) => setFormData(prev => ({ ...prev, equity_seek: e.target.value }))}
            className={`w-full p-3 rounded-lg border transition-colors ${
              isDark 
                ? "bg-gray-800 border-gray-700 text-white focus:border-[#00FB75]" 
                : "bg-white border-gray-300 text-gray-900 focus:border-[#00FB75]"
            }`}
            placeholder="10.0"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Funding Stage</label>
        <select
          value={formData.stage}
          onChange={(e) => setFormData(prev => ({ ...prev, stage: e.target.value }))}
          className={`w-full p-3 rounded-lg border transition-colors ${
            isDark 
              ? "bg-gray-800 border-gray-700 text-white focus:border-[#00FB75]" 
              : "bg-white border-gray-300 text-gray-900 focus:border-[#00FB75]"
          }`}
        >
          {stages.map(stage => (
            <option key={stage.value} value={stage.value}>
              {stage.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2 flex items-center gap-2">
          <Target className="w-4 h-4" />
          Climate Focus Areas
        </label>
        <div className="grid grid-cols-2 gap-2">
          {climateFocusAreas.map(focus => (
            <label key={focus} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.climate_focus.includes(focus)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setFormData(prev => ({
                      ...prev,
                      climate_focus: [...prev.climate_focus, focus]
                    }));
                  } else {
                    setFormData(prev => ({
                      ...prev,
                      climate_focus: prev.climate_focus.filter(f => f !== focus)
                    }));
                  }
                }}
                className="rounded border-gray-300 text-[#00FB75] focus:ring-[#00FB75]"
              />
              <span className="text-sm capitalize">
                {focus.replace(/_/g, ' ')}
              </span>
            </label>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className={`w-full bg-[#00FB75] text-black font-semibold px-6 py-3 rounded-lg hover:bg-green-400 transition-colors flex items-center justify-center gap-2 ${
          loading ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            Creating Proposal...
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Submit Proposal
          </>
        )}
      </button>
    </form>
  );
}