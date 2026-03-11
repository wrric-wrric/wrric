"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useSidebar } from "@/hooks/sideBarProvider";
import toast from "react-hot-toast";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Eye,
  MapPin,
  FlaskConical,
  Calendar,
  Grid3X3,
  List,
  Filter,
  Loader2,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

interface Lab {
  id: string;
  university: string;
  research_abstract: string;
  profile_id?: string;
  location: { city?: string; country?: string; };
  department: { name?: string; };
  scopes: string[];
  climate_tech_focus: string[];
  images: Array<{ id: string; url: string; caption?: string; is_primary: boolean; }>;
  last_updated: string;
}

export default function LabsPage() {
  const router = useRouter();
  const { setLoadSession } = useSidebar();
  const [mounted, setMounted] = useState(false);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name">("newest");

  useEffect(() => {
    setMounted(true);
    setLoadSession(() => { });
    fetchLabs();
  }, []);

  const fetchLabs = async () => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const response = await fetch("/api/user-labs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setLabs(data);
    } catch {
      toast.error("Protocol Error: Failed to sync lab entities");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (labId: string) => {
    if (!confirm("Confirm entity decommissioning? This action cannot be reversed.")) return;
    setDeleteLoading(labId);
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const response = await fetch(`/api/user-labs/${labId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error();
      toast.success("Entity Decommissioned");
      setLabs(labs.filter(l => l.id !== labId));
    } catch {
      toast.error("Decommissioning Failed");
    } finally {
      setDeleteLoading(null);
    }
  };

  const filteredLabs = labs
    .filter(lab =>
      lab.university.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lab.research_abstract.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lab.scopes.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      if (sortBy === "newest") return new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime();
      if (sortBy === "oldest") return new Date(a.last_updated).getTime() - new Date(b.last_updated).getTime();
      return a.university.localeCompare(b.university);
    });

  if (!mounted) return null;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto h-full overflow-y-auto">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(0,251,117,1)]" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Lab Network v4.0</span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter uppercase shrink-0">Managed Infrastructure</h1>
          <p className="text-muted-foreground/40 text-xs font-bold uppercase tracking-widest max-w-md">
            Oversee and recalibrate your laboratory entities across the global climate-tech research grid.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
            <Input
              placeholder="FILTER BY ENTITY..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-11 bg-white/[0.02] border-white/5 rounded-xl uppercase text-[10px] font-black tracking-widest focus-visible:ring-primary/20"
            />
          </div>
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("grid")}
              className={`h-9 px-3 rounded-lg ${viewMode === "grid" ? "bg-white/10 text-primary" : "text-muted-foreground/40"}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("list")}
              className={`h-9 px-3 rounded-lg ${viewMode === "list" ? "bg-white/10 text-primary" : "text-muted-foreground/40"}`}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
          <Button
            onClick={() => router.push("/user-labs/new")}
            className="h-11 bg-primary text-black font-black uppercase text-[10px] tracking-widest px-6 rounded-xl hover:bg-primary/90 shadow-[0_0_20px_rgba(0,251,117,0.2)]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Register Entity
          </Button>
        </div>
      </div>

      <Separator className="bg-white/5" />

      {/* Lab Entities Grid/List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 animate-pulse">Syncing Entity Matrix...</p>
        </div>
      ) : filteredLabs.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-24 text-center space-y-6 opacity-40 grayscale">
          <FlaskConical className="w-16 h-16" />
          <div className="space-y-1">
            <h3 className="text-xl font-bold uppercase tracking-tight">Zero Entities Detected</h3>
            <p className="text-xs font-medium uppercase tracking-widest">Initialization required for laboratory tracking.</p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push("/user-labs/new")}
            className="border-white/10 rounded-xl px-10 font-bold"
          >
            Initialize First Entity
          </Button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredLabs.map((lab) => {
            const primaryImage = lab.images.find(img => img.is_primary) || lab.images[0];
            return (
              <Card
                key={lab.id}
                className="group border-white/5 bg-white/[0.02] backdrop-blur-3xl overflow-hidden relative transition-all hover:bg-white/[0.04] hover:border-primary/20"
              >
                <div className="h-44 relative overflow-hidden">
                  {primaryImage ? (
                    <img src={primaryImage.url} alt={lab.university} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-60 flex-shrink-0" />
                  ) : (
                    <div className="w-full h-full bg-white/5 flex items-center justify-center">
                      <FlaskConical className="w-10 h-10 text-muted-foreground/20" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050505] to-transparent" />
                  <div className="absolute top-4 right-4 flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => router.push(`/user-labs/${lab.id}/edit`)} className="h-9 w-9 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 hover:border-primary/50 text-white transition-all">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(lab.id)} disabled={deleteLoading === lab.id} className="h-9 w-9 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 hover:border-red-500/50 text-white transition-all">
                      {deleteLoading === lab.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </Button>
                  </div>
                  <div className="absolute bottom-4 left-4">
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 rounded-lg text-[10px] font-black uppercase px-2 h-6">
                      {lab.location.city || 'Orbital Station'}
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-xl font-black uppercase tracking-tight truncate group-hover:text-primary transition-colors">{lab.university}</h3>
                    <p className="text-xs font-bold text-muted-foreground/40 uppercase tracking-widest">{lab.department?.name || 'Unspecified Sector'}</p>
                  </div>

                  <p className="text-xs leading-relaxed text-muted-foreground/60 font-medium line-clamp-3 h-12">
                    {lab.research_abstract}
                  </p>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {lab.climate_tech_focus.slice(0, 1).map((f, i) => (
                      <Badge key={i} className="bg-white/5 text-white border-white/5 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-tighter">
                        {f}
                      </Badge>
                    ))}
                    {lab.scopes.slice(0, 1).map((s, i) => (
                      <Badge key={i} className="bg-white/5 text-muted-foreground/60 border-white/5 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-tighter">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="p-6 pt-0 flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-muted-foreground/20">
                  <span>Uplink: {new Date(lab.last_updated).toLocaleDateString()}</span>
                  <Button variant="ghost" className="h-8 px-0 text-primary hover:bg-transparent flex items-center gap-1 group/btn" onClick={() => router.push(`/user-labs/${lab.id}`)}>
                    Access Port <ChevronRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-white/5 bg-white/[0.01] backdrop-blur-xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 bg-white/5">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Entity Portfolio</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Sector / Location</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Focus Core</th>
                <th className="px-8 py-5 text-right font-black uppercase tracking-[0.3em] text-muted-foreground/60">Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredLabs.map((lab) => (
                <tr key={lab.id} className="group hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => router.push(`/user-labs/${lab.id}`)}>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/5 overflow-hidden flex-shrink-0">
                        {lab.images[0] ? <img src={lab.images[0].url} className="w-full h-full object-cover opacity-60" /> : <FlaskConical className="w-5 h-5 m-auto text-muted-foreground/20" />}
                      </div>
                      <div>
                        <div className="text-sm font-black uppercase tracking-tight group-hover:text-primary transition-colors">{lab.university}</div>
                        <div className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest mt-0.5">ID-{lab.id.slice(0, 8)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-muted-foreground/80 uppercase tracking-widest">{lab.department?.name || 'GLOBAL CORE'}</span>
                      <span className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest">{lab.location.city}, {lab.location.country}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex gap-2">
                      {lab.climate_tech_focus.slice(0, 2).map((f, i) => (
                        <Badge key={i} className="bg-primary/5 text-primary border-primary/20 rounded-lg text-[9px] font-black uppercase">{f}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => router.push(`/user-labs/${lab.id}/edit`)} className="h-9 w-9 rounded-xl border border-white/5 hover:border-primary/50 transition-all">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(lab.id)} disabled={deleteLoading === lab.id} className="h-9 w-9 rounded-xl border border-white/5 hover:border-red-500/50 transition-all">
                        {deleteLoading === lab.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
