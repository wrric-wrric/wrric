"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Plus, Trash2, Users, Award, ChevronDown, ChevronUp, FolderOpen, X, Search,
  ShieldAlert, FolderPlus, Check, Loader2, Cpu, Filter, Layers
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { clsx } from "clsx";
import toast from 'react-hot-toast';

interface Category {
  id: string;
  name: string;
  description?: string;
  category_type?: string;
  participant_count: number;
  judge_count: number;
  created_at?: string;
}

interface Member {
  id: string;
  name?: string;
  display_name?: string;
  email: string;
  team_name?: string;
}

interface Participant {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  team_name?: string;
}

interface Judge {
  id: string;
  display_name: string;
  username?: string;
  email?: string;
}

export default function CategoriesPage() {
  const { eventId } = useParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newType, setNewType] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [members, setMembers] = useState<{ participants: Member[]; judges: Member[] } | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);

  const [allParticipants, setAllParticipants] = useState<Participant[]>([]);
  const [allJudges, setAllJudges] = useState<Judge[]>([]);
  const [showAddParticipants, setShowAddParticipants] = useState(false);
  const [showAddJudges, setShowAddJudges] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [selectedJudges, setSelectedJudges] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const authHeaders: Record<string, string> = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/hackathons/${eventId}/categories`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setCategories(data || []);
      }
    } catch { setCategories([]); }
    finally { setLoading(false); }
  }, [eventId, token]);

  const fetchAllParticipants = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/hackathons/${eventId}/participants?limit=500`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setAllParticipants(data.items || []);
      }
    } catch { }
  }, [eventId, token]);

  const fetchAllJudges = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/hackathons/${eventId}/judges`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setAllJudges(Array.isArray(data) ? data : []);
      }
    } catch { }
  }, [eventId, token]);

  useEffect(() => { fetchCategories(); fetchAllParticipants(); fetchAllJudges(); }, [fetchCategories, fetchAllParticipants, fetchAllJudges]);

  const createCategory = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const form = new FormData();
      form.append('name', newName.trim());
      if (newDescription.trim()) form.append('description', newDescription.trim());
      if (newType.trim()) form.append('category_type', newType.trim());

      const res = await fetch(`/api/admin/hackathons/${eventId}/categories`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (res.ok) {
        setNewName('');
        setNewDescription('');
        setNewType('');
        toast.success('Strategy Node Initialized');
        fetchCategories();
      }
    } finally { setCreating(false); }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Decommission this strategy node? All member links will be severed.')) return;
    try {
      const res = await fetch(`/api/admin/hackathons/${eventId}/categories/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (res.ok) {
        toast.error('Node Decommissioned');
        fetchCategories();
        if (expandedId === id) setExpandedId(null);
      }
    } catch { }
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setMembers(null);
      return;
    }
    setExpandedId(id);
    setMembersLoading(true);
    setMembers(null);
    try {
      const res = await fetch(`/api/admin/hackathons/${eventId}/categories/${id}/members`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } finally { setMembersLoading(false); }
  };

  const addParticipantsToCategory = async () => {
    if (!expandedId || selectedParticipants.length === 0) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/hackathons/${eventId}/categories/${expandedId}/participants`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ participant_ids: selectedParticipants }),
      });
      if (res.ok) {
        toast.success('Personnel Linked Successfully');
        setSelectedParticipants([]);
        setShowAddParticipants(false);
        toggleExpand(expandedId);
        fetchCategories();
      }
    } finally { setIsSubmitting(false); }
  };

  const removeParticipantFromCategory = async (participantId: string) => {
    if (!expandedId) return;
    try {
      await fetch(`/api/admin/hackathons/${eventId}/categories/${expandedId}/participants/${participantId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      toggleExpand(expandedId);
      fetchCategories();
    } catch { }
  };

  const addJudgesToCategory = async () => {
    if (!expandedId || selectedJudges.length === 0) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/hackathons/${eventId}/categories/${expandedId}/judges`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ judge_ids: selectedJudges }),
      });
      if (res.ok) {
        toast.success('Evaluators Linked Successfully');
        setSelectedJudges([]);
        setShowAddJudges(false);
        toggleExpand(expandedId);
        fetchCategories();
      }
    } finally { setIsSubmitting(false); }
  };

  const removeJudgeFromCategory = async (judgeId: string) => {
    if (!expandedId) return;
    try {
      await fetch(`/api/admin/hackathons/${eventId}/categories/${expandedId}/judges/${judgeId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      toggleExpand(expandedId);
      fetchCategories();
    } catch { }
  };

  const availableParticipants = allParticipants.filter(p =>
    !members?.participants.some(m => m.id === p.id) &&
    (searchFilter === '' || `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchFilter.toLowerCase()))
  );
  const availableJudges = allJudges.filter(j =>
    !members?.judges.some(m => m.id === j.id) &&
    (searchFilter === '' || (j.display_name || j.username || '').toLowerCase().includes(searchFilter.toLowerCase()))
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <Cpu className="w-10 h-10 text-primary animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Accessing Strategy Registry...</p>
    </div>
  );

  return (
    <div className="space-y-10 p-2 max-w-7xl mx-auto selection:bg-primary selection:text-black pb-32">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Layers className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Strategic Architecture</span>
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-white uppercase italic">
            TACTICAL <span className="text-primary not-italic">LAYERS</span>
          </h1>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/40 leading-relaxed max-w-2xl">
            Configure isolation protocols and evaluation groupings. Strategic assignment drives sector performance.
          </p>
        </div>
      </div>

      {/* Initiation Protocol */}
      <Card className="border-white/5 bg-white/[0.02] backdrop-blur-3xl rounded-[2.5rem] overflow-hidden">
        <CardContent className="p-10 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black uppercase tracking-tighter text-white italic flex items-center gap-3">
              <FolderPlus className="w-6 h-6 text-primary" /> Initialize New Strategy Node
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-primary/60 ml-1">Node Designation</label>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="ALPHA-TRACK"
                className="h-14 rounded-2xl border-white/5 bg-white/[0.02] text-[10px] font-black uppercase tracking-widest focus:border-primary/50 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-primary/60 ml-1">Directive Focus</label>
              <Input
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                placeholder="SECONDARY OPERATIONS"
                className="h-14 rounded-2xl border-white/5 bg-white/[0.02] text-[10px] font-black uppercase tracking-widest focus:border-primary/50 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-primary/60 ml-1">Protocol Type</label>
              <select
                value={newType}
                onChange={e => setNewType(e.target.value)}
                className="w-full h-14 rounded-2xl border border-white/5 bg-white/[0.02] text-[10px] font-black uppercase tracking-widest focus:border-primary/50 transition-all outline-none px-4"
              >
                <option value="">GENERIC NODE</option>
                <option value="timezone">TEMPORAL GROUP</option>
                <option value="session">ACTIVE SESSION</option>
                <option value="track">CORE TRACK</option>
                <option value="panel">EVALUATOR PANEL</option>
              </select>
            </div>
            <div className="md:pt-[1.4rem]">
              <Button
                onClick={createCategory}
                disabled={creating || !newName.trim()}
                className="w-full h-14 bg-primary text-black hover:bg-primary/90 rounded-2xl font-black uppercase tracking-widest shadow-[0_0_30px_rgba(0,251,117,0.15)] group transition-all"
              >
                {creating ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : <>COMMIT INITIALIZATION <Plus className="ml-2 w-4 h-4" /></>}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Layer Registry */}
      <div className="space-y-4">
        {categories.length === 0 ? (
          <div className="p-24 text-center space-y-6 bg-white/[0.01] border border-white/5 rounded-[3rem] backdrop-blur-xl">
            <FolderOpen className="w-20 h-20 mx-auto text-muted-foreground/5 animate-pulse" />
            <div className="space-y-2">
              <h3 className="text-2xl font-black uppercase tracking-tighter text-white italic">Architecture Registry Empty</h3>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/20 leading-relaxed">
                Initialize the first tactical node to begin sector organization.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-6">
            {categories.map(cat => (
              <Card key={cat.id} className={clsx(
                "border transition-all duration-500 rounded-[2.5rem] overflow-hidden group",
                expandedId === cat.id ? "border-primary/40 bg-primary/[0.03] shadow-[0_0_50px_rgba(0,251,117,0.05)]" : "border-white/5 bg-white/[0.01] hover:bg-white/[0.02] hover:border-white/10"
              )}>
                <div className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-6 flex-1 min-w-0">
                    <button
                      onClick={() => toggleExpand(cat.id)}
                      className={clsx(
                        "w-12 h-12 rounded-2xl border flex items-center justify-center transition-all duration-500",
                        expandedId === cat.id ? "bg-primary border-primary text-black rotate-180" : "bg-white/5 border-white/5 text-primary group-hover:scale-110"
                      )}
                    >
                      {expandedId === cat.id ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                    </button>
                    <div className="min-w-0 space-y-1">
                      <h3 className={clsx("text-2xl font-black uppercase tracking-tighter transition-colors italic", expandedId === cat.id ? "text-primary" : "text-white group-hover:text-primary")}>
                        {cat.name}
                      </h3>
                      <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 leading-none">
                        {cat.category_type && (
                          <Badge variant="outline" className="border-primary/20 text-primary bg-primary/5 px-2 py-0 h-4 text-[8px]">{cat.category_type}</Badge>
                        )}
                        <span className="truncate">{cat.description || "NO DIRECTIVE PROVIDED"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8 shrink-0">
                    <div className="flex gap-4">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Links</span>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 text-white/60">
                            <Users className="w-3.5 h-3.5" /> <span className="text-sm font-black italic">{cat.participant_count}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-primary/60">
                            <Award className="w-3.5 h-3.5" /> <span className="text-sm font-black italic">{cat.judge_count}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteCategory(cat.id)}
                      className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-black transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Expanded Visualization */}
                {expandedId === cat.id && (
                  <div className="px-8 pb-10 border-t border-primary/10 animate-in fade-in slide-in-from-top-4 duration-500">
                    {membersLoading ? (
                      <div className="py-20 text-center space-y-4">
                        <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">Scanning Neural Links...</p>
                      </div>
                    ) : members ? (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-10">
                        {/* Participants Cluster */}
                        <div className="space-y-6">
                          <div className="flex items-center justify-between border-b border-white/5 pb-4">
                            <div className="space-y-1">
                              <h4 className="text-sm font-black uppercase tracking-widest text-white italic flex items-center gap-2">
                                <Users className="w-4 h-4 text-primary" /> Personnel Cluster
                              </h4>
                              <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">{members.participants.length} Active Synchronization Links</p>
                            </div>
                            <Button
                              variant="outline"
                              onClick={() => { setShowAddParticipants(!showAddParticipants); setShowAddJudges(false); setSearchFilter(''); }}
                              className={clsx("h-10 px-6 rounded-xl text-[9px] font-black uppercase tracking-widest border-primary/20 bg-primary/5 text-primary hover:bg-primary hover:text-black transition-all")}
                            >
                              {showAddParticipants ? "Abort Link" : "Inject Personnel"}
                            </Button>
                          </div>

                          {showAddParticipants && (
                            <div className="p-6 bg-black/40 border border-primary/20 rounded-3xl space-y-6 animate-in zoom-in-95">
                              <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                  value={searchFilter}
                                  onChange={e => setSearchFilter(e.target.value)}
                                  placeholder="REGISTRY SCAN..."
                                  className="pl-12 h-12 rounded-xl border-white/5 bg-white/[0.02] text-[10px] font-black uppercase tracking-widest focus:border-primary transition-all"
                                />
                              </div>
                              <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                {availableParticipants.slice(0, 50).map(p => (
                                  <label key={p.id} className={clsx(
                                    "flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer group",
                                    selectedParticipants.includes(p.id) ? "bg-primary border-primary text-black" : "bg-white/[0.01] border-white/5 text-muted-foreground hover:border-white/20"
                                  )}>
                                    <input type="checkbox" checked={selectedParticipants.includes(p.id)} onChange={e => setSelectedParticipants(e.target.checked ? [...selectedParticipants, p.id] : selectedParticipants.filter(id => id !== p.id))} className="hidden" />
                                    <div className={clsx("w-4 h-4 rounded border flex items-center justify-center", selectedParticipants.includes(p.id) ? "border-black" : "border-white/20 group-hover:border-primary/40")}>
                                      {selectedParticipants.includes(p.id) && <Check className="w-3 h-3 stroke-[4]" />}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[10px] font-black uppercase tracking-widest">{p.first_name} {p.last_name}</span>
                                      <span className={clsx("text-[9px] font-bold opacity-60", selectedParticipants.includes(p.id) ? "text-black" : "text-primary")}>{p.email}</span>
                                    </div>
                                  </label>
                                ))}
                              </div>
                              <Button onClick={addParticipantsToCategory} disabled={selectedParticipants.length === 0 || isSubmitting} className="w-full h-12 bg-white text-black hover:bg-neutral-200 font-black uppercase tracking-widest rounded-xl">
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : `Execute Cluster Link (${selectedParticipants.length})`}
                              </Button>
                            </div>
                          )}

                          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {members.participants.map(p => (
                              <div key={p.id} className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between group hover:border-primary/20 transition-all">
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 group-hover:scale-110 transition-transform">
                                    <Users className="w-5 h-5" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white group-hover:text-primary transition-colors">{p.name}</span>
                                    <span className="text-[9px] font-bold text-muted-foreground/40">{p.email}</span>
                                  </div>
                                </div>
                                <button onClick={() => removeParticipantFromCategory(p.id)} className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-black transition-all">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                            {members.participants.length === 0 && !showAddParticipants && (
                              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/20 italic py-10 text-center">Personnel manifest unassigned.</p>
                            )}
                          </div>
                        </div>

                        {/* Evaluator Cluster */}
                        <div className="space-y-6">
                          <div className="flex items-center justify-between border-b border-white/5 pb-4">
                            <div className="space-y-1">
                              <h4 className="text-sm font-black uppercase tracking-widest text-white italic flex items-center gap-2">
                                <Award className="w-4 h-4 text-primary" /> Evaluator Cluster
                              </h4>
                              <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">{members.judges.length} Active Authorization Links</p>
                            </div>
                            <Button
                              variant="outline"
                              onClick={() => { setShowAddJudges(!showAddJudges); setShowAddParticipants(false); setSearchFilter(''); }}
                              className={clsx("h-10 px-6 rounded-xl text-[9px] font-black uppercase tracking-widest border-primary/20 bg-primary/5 text-primary hover:bg-primary hover:text-black transition-all")}
                            >
                              {showAddJudges ? "Abort Link" : "Inject Evaluator"}
                            </Button>
                          </div>

                          {showAddJudges && (
                            <div className="p-6 bg-black/40 border border-primary/20 rounded-3xl space-y-6 animate-in zoom-in-95">
                              <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                  value={searchFilter}
                                  onChange={e => setSearchFilter(e.target.value)}
                                  placeholder="REGISTRY SCAN..."
                                  className="pl-12 h-12 rounded-xl border-white/5 bg-white/[0.02] text-[10px] font-black uppercase tracking-widest focus:border-primary transition-all"
                                />
                              </div>
                              <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                {availableJudges.map(j => (
                                  <label key={j.id} className={clsx(
                                    "flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer group",
                                    selectedJudges.includes(j.id) ? "bg-primary border-primary text-black" : "bg-white/[0.01] border-white/5 text-muted-foreground hover:border-white/20"
                                  )}>
                                    <input type="checkbox" checked={selectedJudges.includes(j.id)} onChange={e => setSelectedJudges(e.target.checked ? [...selectedJudges, j.id] : selectedJudges.filter(id => id !== j.id))} className="hidden" />
                                    <div className={clsx("w-4 h-4 rounded border flex items-center justify-center", selectedJudges.includes(j.id) ? "border-black" : "border-white/20 group-hover:border-primary/40")}>
                                      {selectedJudges.includes(j.id) && <Check className="w-3 h-3 stroke-[4]" />}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[10px] font-black uppercase tracking-widest">{j.display_name || j.username}</span>
                                      <span className={clsx("text-[9px] font-bold opacity-60", selectedJudges.includes(j.id) ? "text-black" : "text-primary")}>{j.email}</span>
                                    </div>
                                  </label>
                                ))}
                              </div>
                              <Button onClick={addJudgesToCategory} disabled={selectedJudges.length === 0 || isSubmitting} className="w-full h-12 bg-white text-black hover:bg-neutral-200 font-black uppercase tracking-widest rounded-xl">
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : `Execute Cluster Link (${selectedJudges.length})`}
                              </Button>
                            </div>
                          )}

                          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {members.judges.map(j => (
                              <div key={j.id} className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between group hover:border-primary/20 transition-all">
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 group-hover:scale-110 transition-transform">
                                    <Award className="w-5 h-5" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white group-hover:text-primary transition-colors">{j.display_name}</span>
                                    <span className="text-[9px] font-bold text-muted-foreground/40">{j.email}</span>
                                  </div>
                                </div>
                                <button onClick={() => removeJudgeFromCategory(j.id)} className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-black transition-all">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                            {members.judges.length === 0 && !showAddJudges && (
                              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/20 italic py-10 text-center">Evaluator manifest unassigned.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 251, 117, 0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0, 251, 117, 0.2); }
      `}</style>
    </div>
  );
}
