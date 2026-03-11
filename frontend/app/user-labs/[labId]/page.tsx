"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import toast from "react-hot-toast";
import {
  Building, MapPin, Globe, Mail, User, ArrowLeft, Edit, FlaskConical, Target,
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X, Play, Pause, Star, BarChart3,
  GraduationCap, Award, Leaf, CheckCircle, FileText, ExternalLink,
  Shield, Zap, Activity, Globe2, Loader2, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
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
  last_updated: string;
}

function LabGallery({ images, labName }: { images: Lab['images']; labName: string }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (images.length === 0) return (
    <div className="w-full aspect-video bg-white/[0.02] border border-white/5 rounded-3xl flex flex-col items-center justify-center space-y-4">
      <FlaskConical className="w-12 h-12 text-muted-foreground/20" />
      <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Zero Visual Assets Detected</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="relative aspect-video rounded-3xl overflow-hidden border border-white/5 group">
        <img src={images[currentIndex].url} alt={labName} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Asset {currentIndex + 1} / {images.length}</span>
            <p className="text-sm font-bold text-white uppercase tracking-tight">{images[currentIndex].caption || 'SATELLITE VIEW'}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => setCurrentIndex(p => (p - 1 + images.length) % images.length)} className="h-10 w-10 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 hover:border-primary/50">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setCurrentIndex(p => (p + 1) % images.length)} className="h-10 w-10 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 hover:border-primary/50">
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {images.map((img, i) => (
          <button key={img.id} onClick={() => setCurrentIndex(i)} className={clsx("flex-shrink-0 w-24 aspect-video rounded-xl overflow-hidden border-2 transition-all", i === currentIndex ? "border-primary scale-105 shadow-[0_0_15px_rgba(0,251,117,0.3)]" : "border-white/5 opacity-40 hover:opacity-100")}>
            <img src={img.url} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function LabDetailsPage() {
  const { labId } = useParams();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [lab, setLab] = useState<Lab | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    const fetchLab = async () => {
      try {
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        const response = await fetch(`/api/user-labs/${labId}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error();
        setLab(await response.json());
      } catch {
        toast.error("Access Denied: Connection to entity lost");
        router.push("/user-labs");
      } finally { setLoading(false); }
    };
    fetchLab();
  }, [labId, router]);

  if (!mounted || loading) return (
    <div className="h-full flex flex-col items-center justify-center p-20 space-y-4">
      <Loader2 className="w-12 h-12 text-primary animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 animate-pulse">Establishing Entity Interface...</p>
    </div>
  );

  if (!lab) return null;

  return (
    <div className="h-full overflow-y-auto bg-[#050505] p-4 md:p-8 space-y-8">
      {/* Navigation & Header */}
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => router.push('/user-labs')} className="px-0 hover:bg-transparent text-muted-foreground/60 hover:text-primary flex items-center gap-2 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest">Return to Fleet</span>
          </Button>
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-[0_0_30px_rgba(0,251,117,0.1)]">
              <FlaskConical className="w-10 h-10" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1 rounded-lg text-[10px] font-black uppercase whitespace-nowrap">Entity Online</Badge>
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(0,251,117,1)]" />
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">{lab.university}</h1>
              <div className="flex items-center gap-4 mt-3 text-xs font-bold text-muted-foreground/40 uppercase tracking-widest">
                <MapPin className="w-4 h-4 text-primary" />
                <span>{[lab.location.city, lab.location.country].filter(Boolean).join(" // ")}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" className="h-14 border-white/10 bg-white/5 backdrop-blur-xl rounded-2xl px-8 hover:border-primary/50 transition-all font-black" onClick={() => router.push(`/user-labs/${lab.id}/edit`)}>
            <Edit className="w-4 h-4 mr-3 text-primary" />
            <span className="text-[10px] uppercase tracking-widest">Recalibrate</span>
          </Button>
          <Button className="h-14 bg-white text-black hover:bg-white/90 rounded-2xl px-8 font-black shadow-[0_0_20px_rgba(255,255,255,0.1)]">
            <ExternalLink className="w-4 h-4 mr-3" />
            <span className="text-[10px] uppercase tracking-widest">Export Protocol</span>
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid xl:grid-cols-3 gap-8">
        {/* Primary Data Pane */}
        <div className="xl:col-span-2 space-y-8">
          <LabGallery images={lab.images} labName={lab.university} />

          <Card className="border-white/5 bg-white/[0.02] backdrop-blur-3xl overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="p-8">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-5 h-5 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Research Abstract</span>
              </div>
              <CardTitle className="text-3xl font-black uppercase tracking-tight">Mission Statement</CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <p className="text-lg leading-relaxed text-muted-foreground/80 font-medium italic">
                "{lab.research_abstract}"
              </p>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="border-white/5 bg-white/[0.02] backdrop-blur-3xl relative overflow-hidden">
              <CardHeader className="p-8">
                <div className="flex items-center gap-3 mb-2">
                  <Target className="w-5 h-5 text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Strategic Depth</span>
                </div>
                <CardTitle className="text-xl font-black uppercase tracking-tight">Research Scopes</CardTitle>
              </CardHeader>
              <CardContent className="p-8 pt-0 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {lab.scopes.map((s, i) => (
                    <Badge key={i} className="bg-white/5 text-primary border-primary/20 rounded-xl px-4 py-2 font-black uppercase text-[10px] tracking-widest">{s}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/5 bg-white/[0.02] backdrop-blur-3xl relative overflow-hidden">
              <CardHeader className="p-8">
                <div className="flex items-center gap-3 mb-2">
                  <Leaf className="w-5 h-5 text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Sustainability</span>
                </div>
                <CardTitle className="text-xl font-black uppercase tracking-tight">Climate Alignment</CardTitle>
              </CardHeader>
              <CardContent className="p-8 pt-0 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {lab.climate_tech_focus.map((f, i) => (
                    <Badge key={i} className="bg-primary text-black border-transparent rounded-xl px-4 py-2 font-black uppercase text-[10px] tracking-widest shadow-[0_0_15px_rgba(0,251,117,0.3)]">{f}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {(lab.lab_equipment?.items?.length ?? 0) > 0 && (
            <Card className="border-white/5 bg-white/[0.02] backdrop-blur-3xl relative overflow-hidden">
              <CardHeader className="p-8">
                <div className="flex items-center gap-3 mb-2">
                  <Zap className="w-5 h-5 text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Hardware Layer</span>
                </div>
                <CardTitle className="text-xl font-black uppercase tracking-tight">Technical Inventory</CardTitle>
              </CardHeader>
              <CardContent className="p-8 pt-0">
                <div className="grid sm:grid-cols-2 gap-4">
                  {lab.lab_equipment.items?.map((item, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/5 group hover:border-primary/20 transition-all">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:shadow-[0_0_15px_rgba(0,251,117,0.2)] transition-all">
                        <CheckCircle className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-black uppercase tracking-tight">{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar Intelligence Pane */}
        <div className="space-y-8">
          <Card className="border-white/5 bg-white/[0.02] backdrop-blur-3xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-primary shadow-[0_0_10px_rgba(0,251,117,1)]" />
            <CardHeader className="p-8">
              <CardTitle className="text-xl font-black uppercase tracking-tight">Intelligence Feed</CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-8">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Infrastructure Sync</span>
                  <span className="text-xs font-black text-primary">COMPLETE</span>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                    <span className="text-muted-foreground/40 text-[9px]">Strategic Alignment</span>
                    <span>94%</span>
                  </div>
                  <Progress value={94} className="h-2" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                    <span className="text-muted-foreground/40 text-[9px]">Resource Capacity</span>
                    <span>68%</span>
                  </div>
                  <Progress value={68} className="h-2" />
                </div>
              </div>

              <Separator className="bg-white/5" />

              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                  <Building className="w-6 h-6 text-primary" />
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 block">Department</span>
                    <span className="text-sm font-black uppercase tracking-tight">{lab.department.name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                  <Shield className="w-6 h-6 text-primary" />
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 block">Faculty</span>
                    <span className="text-sm font-black uppercase tracking-tight">{lab.department.faculty || 'Unclassified'}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/5 bg-white/[0.02] backdrop-blur-3xl relative overflow-hidden">
            <CardHeader className="p-8">
              <CardTitle className="text-xl font-black uppercase tracking-tight">Uplink Protocols</CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-6">
              <div className="flex flex-col gap-4">
                <div className="p-5 rounded-3xl bg-black/40 border border-white/5 space-y-4 relative group hover:border-primary/20 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-primary">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 block">Technical POC</span>
                      <span className="text-base font-black uppercase tracking-tight">{lab.point_of_contact.name}</span>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full h-10 border-white/10 hover:border-primary/50 text-[10px] font-black uppercase tracking-widest rounded-xl bg-white/5" onClick={() => window.location.href = `mailto:${lab.point_of_contact.email}`}>
                    <Mail className="w-4 h-4 mr-2" />
                    Open COMMS Channel
                  </Button>
                </div>

                {lab.website && (
                  <Button variant="ghost" className="w-full h-12 bg-white/5 border border-white/5 hover:border-primary/50 hover:bg-white/10 text-xs font-black uppercase tracking-widest rounded-2xl transition-all" onClick={() => window.open(lab.website, '_blank')}>
                    <Globe2 className="w-4 h-4 mr-3 text-primary" />
                    Neural Mesh Uplink
                  </Button>
                )}
              </div>
            </CardContent>
            <CardFooter className="px-8 pb-8 pt-0 flex flex-col items-center gap-2">
              <span className="text-[9px] font-bold text-muted-foreground/20 uppercase tracking-[0.4em]">Last Grid Sync</span>
              <Badge className="bg-white/5 text-muted-foreground/40 border-white/5 rounded-full px-4">{new Date(lab.last_updated).toLocaleString()}</Badge>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
