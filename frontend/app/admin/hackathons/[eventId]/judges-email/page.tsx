"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Send, Clock, ChevronDown, ChevronUp, Paperclip, X, CheckCircle, Info, ExternalLink, FolderPlus,
  ShieldCheck, Radio, Mail, Search, Cpu, AlertTriangle, Loader2, ArrowRight, Globe, Lock
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { clsx } from "clsx";
import toast from 'react-hot-toast';

interface Judge {
  id: string;
  display_name: string;
  username: string;
  email: string;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  participant_count: number;
  judge_count: number;
}

interface EmailLog {
  id: string;
  subject: string;
  body: string;
  meeting_link?: string;
  attachment_names: string[];
  recipient_count: number;
  recipient_emails: string[];
  sent_count: number;
  failed_count: number;
  sent_by?: string;
  created_at: string;
  recipient_type?: string;
  category_id?: string;
}

export default function JudgeEmailPage() {
  const { eventId } = useParams();
  const [judges, setJudges] = useState<Judge[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [judgePortalUrl, setJudgePortalUrl] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [attachmentLoading, setAttachmentLoading] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showCategoryAssignment, setShowCategoryAssignment] = useState(false);

  const [emailHistory, setEmailHistory] = useState<EmailLog[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const authHeaders: Record<string, string> = { Authorization: `Bearer ${token}` };

  const [error, setError] = useState('');

  const fetchJudges = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/hackathons/${eventId}/judges/list-for-email`, { headers: authHeaders });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || `Error ${res.status}`);
        return;
      }
      setJudges(data || []);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  }, [eventId, token]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/hackathons/${eventId}/categories`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setCategories(Array.isArray(data) ? data : []);
      }
    } catch (err) { console.error('[JudgeEmail] fetchCategories error:', err); }
  }, [eventId, token]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/hackathons/${eventId}/email/history?limit=50`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setEmailHistory(data.items || []);
        setHistoryTotal(data.total || 0);
      }
    } catch (err) { console.error('[JudgeEmail] fetchHistory error:', err); }
  }, [eventId, token]);

  useEffect(() => { fetchJudges(); fetchCategories(); fetchHistory(); }, [fetchJudges, fetchCategories, fetchHistory]);

  const toggleAll = () => {
    if (selected.length === judges.length) setSelected([]);
    else setSelected(judges.map(j => j.id));
  };

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const addAttachments = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setAttachmentLoading(true);
    const newFiles = Array.from(files);
    setAttachments(prev => [...prev, ...newFiles]);
    setTimeout(() => {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setAttachmentLoading(false);
    }, 500);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const send = async () => {
    if (!subject.trim() || !body.trim() || selected.length === 0) {
      toast.error('Protocol Incomplete: Subject, Body, and Recipients required');
      return;
    }
    setSending(true);
    try {
      const form = new FormData();
      form.append('judge_ids', JSON.stringify(selected));
      form.append('subject', subject);
      form.append('body', body);
      if (judgePortalUrl.trim()) form.append('judge_portal_url', judgePortalUrl.trim());
      if (meetingLink.trim()) form.append('meeting_link', meetingLink.trim());
      attachments.forEach(file => form.append('attachments', file));

      if (showCategoryAssignment) {
        if (newCategoryName.trim()) form.append('create_category_name', newCategoryName.trim());
        else if (selectedCategory) form.append('category_id', selectedCategory);
      }

      const res = await fetch(`/api/admin/hackathons/${eventId}/judges/email`, {
        method: 'POST',
        headers: authHeaders,
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(`Transmission Error: ${data.detail || 'Generic failure'}`);
        return;
      }
      setResult(data);
      toast.success(`Broadcasting initiated. Success: ${data.sent} | Failure: ${data.failed}`);
      setSubject(''); setBody(''); setJudgePortalUrl(''); setMeetingLink(''); setAttachments([]); setSelected([]);
      setSelectedCategory(''); setNewCategoryName(''); setShowCategoryAssignment(false);
      fetchHistory();
      fetchCategories();
    } catch (err: any) { toast.error(`Critical Transmission Error: ${err.message}`); } finally { setSending(false); }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading && judges.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <Cpu className="w-10 h-10 text-primary animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Synchronizing Evaluator Node...</p>
    </div>
  );

  return (
    <div className="space-y-10 p-2 max-w-7xl mx-auto selection:bg-primary selection:text-black pb-32">
      {/* Header Telemetry */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Lock className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Evaluator Cluster</span>
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-white uppercase italic">
            JUDGE <span className="text-primary not-italic">COMMMS</span>
          </h1>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="border-white/10 text-white font-black uppercase text-[10px] px-3 py-1 bg-white/5">
              Evaluator Port [7]
            </Badge>
            <Badge variant="outline" className="border-primary/20 text-primary font-black uppercase text-[10px] px-3 py-1 bg-primary/5">
              SECURE DOWNLINK
            </Badge>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-2 p-6 rounded-[2rem] bg-red-500/5 border border-red-500/10 flex items-center gap-4">
          <AlertTriangle className="w-6 h-6 text-red-500" />
          <p className="text-[10px] font-black uppercase tracking-widest text-red-500 italic">NODE FAULT: {error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-2">
        {/* Recipient Isolation Area */}
        <Card className="lg:col-span-4 border-white/5 bg-white/[0.01] backdrop-blur-3xl rounded-[2.5rem] overflow-hidden">
          <CardContent className="p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-primary uppercase tracking-widest italic">Signal Target</span>
                <span className="text-xl font-black text-white tracking-tighter italic">EVALUATORS</span>
              </div>
              <Badge className="bg-primary/20 text-primary border-primary/20 font-black">{selected.length} / {judges.length}</Badge>
            </div>

            <div className="flex justify-end">
              <button onClick={toggleAll} className="text-[9px] font-black uppercase tracking-[0.2em] text-primary hover:text-white transition-colors italic">
                {selected.length === judges.length ? 'GLOBAL DESELECT' : 'GLOBAL SELECT'}
              </button>
            </div>

            <div className="space-y-2 h-[550px] overflow-auto pr-2 custom-scrollbar">
              {judges.length === 0 ? (
                <div className="text-center py-20 space-y-4">
                  <Mail className="w-12 h-12 text-muted-foreground/5 mx-auto" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/20 leading-relaxed italic">
                    Evaluator directory empty. Go to Judges and uplink personnel.
                  </p>
                </div>
              ) : judges.map(j => (
                <label key={j.id} className={clsx(
                  "flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer group",
                  selected.includes(j.id) ? "bg-primary/10 border-primary/30" : "bg-white/[0.02] border-white/5 hover:border-white/20"
                )}>
                  <div className={clsx("w-5 h-5 rounded flex items-center justify-center border transition-all", selected.includes(j.id) ? "bg-primary border-primary text-black" : "border-white/20")}>
                    {selected.includes(j.id) && <CheckCircle className="w-3.5 h-3.5" />}
                  </div>
                  <input type="checkbox" checked={selected.includes(j.id)} onChange={() => toggle(j.id)} className="hidden" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-widest text-white italic truncate group-hover:text-primary transition-colors">{j.display_name || j.username}</div>
                    <div className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest truncate">{j.email}</div>
                  </div>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Transmission Interface */}
        <Card className="lg:col-span-8 border-white/5 bg-white/[0.01] backdrop-blur-3xl rounded-[3rem] overflow-hidden">
          <CardContent className="p-10 space-y-8">
            <div className="flex items-center justify-between border-b border-white/5 pb-6">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-primary uppercase tracking-widest italic">Evaluator Downlink</span>
                <span className="text-xl font-black text-white tracking-tighter italic">STRATEGIC COMMAND</span>
              </div>
              <div className="relative group">
                <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-all">
                  <Info className="w-3.5 h-3.5" /> PERSONALIZATION DATA
                </button>
                <div className="absolute right-0 top-full mt-4 w-64 p-6 bg-black/90 backdrop-blur-3xl border border-primary/20 rounded-3xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-4 italic">Available Variables:</p>
                  <div className="space-y-2">
                    {['name', 'email', 'event_title'].map(v => (
                      <div key={v} className="bg-white/5 p-2 rounded-xl border border-white/5 font-mono text-[9px] text-white">{'{{' + v + '}}'}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-primary/40 ml-1 italic">Subject Identifier</label>
                <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="INSTRUCTIONAL SUBJECT LINE..." className="h-16 rounded-2xl border-white/5 bg-black/40 text-[11px] font-black uppercase tracking-[0.2em] focus:border-primary/50 transition-all text-white" />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-primary/40 ml-1 italic">Strategy Content</label>
                <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="DIRECT EVALUATION INSTRUCTIONS..." className="min-h-[200px] rounded-[2rem] border-white/5 bg-black/40 text-[11px] font-black uppercase tracking-[0.1em] focus:border-primary/50 transition-all text-white p-6 leading-relaxed custom-scrollbar" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-primary/40 ml-1 italic">Target Junction (Judge Portal)</label>
                  <div className="relative group">
                    <Input value={judgePortalUrl} onChange={e => setJudgePortalUrl(e.target.value)} placeholder="PORTAL SECURE URL..." className="h-14 pr-12 rounded-2xl border-white/5 bg-black/40 text-[9px] font-black uppercase tracking-widest focus:border-primary/50 text-white" />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-hover:text-primary transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-primary/40 ml-1 italic">Meeting Node</label>
                  <Input value={meetingLink} onChange={e => setMeetingLink(e.target.value)} placeholder="VIRTUAL JUNCTION URL..." className="h-14 rounded-2xl border-white/5 bg-black/40 text-[9px] font-black uppercase tracking-widest focus:border-primary/50 text-white" />
                </div>
              </div>

              {/* Tactical Category Assignment */}
              <div className="p-8 rounded-[2rem] bg-white/[0.02] border border-white/5 space-y-6">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={clsx("w-6 h-6 rounded-lg border transition-all flex items-center justify-center", showCategoryAssignment ? "bg-primary border-primary text-black" : "border-white/20 group-hover:border-primary/50")}>
                    {showCategoryAssignment && <CheckCircle className="w-4 h-4" />}
                  </div>
                  <input type="checkbox" checked={showCategoryAssignment} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShowCategoryAssignment(e.target.checked)} className="hidden" />
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-white italic tracking-tighter uppercase">ASSIGN TO SECTOR CLUSTER</span>
                    <span className="text-[9px] font-black tracking-widest text-muted-foreground/40 uppercase">Limit evaluation scope to specific personnel.</span>
                  </div>
                </label>

                {showCategoryAssignment && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-9 animate-in slide-in-from-left-4 duration-300">
                    <div className="space-y-2">
                      <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">Select Node</span>
                      <select value={selectedCategory} onChange={e => { setSelectedCategory(e.target.value); setNewCategoryName(''); }} className="w-full h-12 px-4 rounded-xl border border-white/5 bg-black text-[9px] font-black uppercase tracking-widest text-white outline-none">
                        <option value="">EXISTING PROTOCOL...</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name.toUpperCase()} ({c.judge_count} EVALUATORS)</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">Force New Identifier</span>
                      <Input value={newCategoryName} onChange={e => { setNewCategoryName(e.target.value); setSelectedCategory(''); }} placeholder="NEW SECTOR NAME..." className="h-12 rounded-xl border-white/5 bg-black text-[9px] font-black uppercase tracking-widest text-white" />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-primary/40 ml-1 italic">Tactical Briefs</label>
                <div className="flex gap-2">
                  <input ref={fileInputRef} type="file" multiple onChange={addAttachments} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} className="flex-1 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all">
                    {attachmentLoading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Paperclip className="w-4 h-4 text-primary" />}
                    INJECT ASSETS
                  </button>
                </div>
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {attachments.map((file, i) => (
                      <Badge key={i} variant="outline" className="bg-white/5 border-white/10 text-white font-black uppercase text-[8px] py-1 pl-3 pr-2 flex items-center gap-2 rounded-lg">
                        {file.name}
                        <button onClick={() => removeAttachment(i)} className="p-1 hover:text-red-400"><X className="w-3 h-3" /></button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <Button
                onClick={send}
                disabled={sending || selected.length === 0}
                className="w-full h-16 rounded-[2rem] bg-primary text-black font-black uppercase tracking-[0.3em] italic text-sm hover:bg-primary/90 shadow-[0_0_50px_rgba(0,251,117,0.2)]"
              >
                {sending ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Send className="mr-3 w-5 h-5" /> INITIATE DOWNLINK BROADCAST</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transmission Logs */}
      <div className="space-y-6">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-4 group px-4 py-2 hover:bg-white/5 rounded-2xl transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
            <Clock className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="text-sm font-black uppercase tracking-tighter text-white italic">Evaluator Signal Logs ({historyTotal})</p>
            <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">Historical Command Archives</p>
          </div>
          {showHistory ? <ChevronUp className="ml-4 w-4 h-4 text-primary" /> : <ChevronDown className="ml-4 w-4 h-4 text-primary" />}
        </button>

        {showHistory && (
          <div className="space-y-4 px-2 animate-in fade-in duration-500">
            {emailHistory.length === 0 ? (
              <div className="p-20 text-center bg-white/[0.01] border border-white/5 rounded-[2.5rem] italic text-[10px] font-black uppercase text-muted-foreground/10 tracking-[0.3em]">
                Signal archives empty.
              </div>
            ) : emailHistory.map(log => (
              <Card key={log.id} className="border-white/5 bg-white/[0.02] hover:bg-white/[0.03] transition-all rounded-[2rem] overflow-hidden">
                <button
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  className="w-full p-8 flex items-center justify-between text-left group"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-primary/40 group-hover:text-primary transition-colors">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-black uppercase tracking-widest text-white italic">{log.subject}</div>
                      <div className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest flex items-center gap-4">
                        <span>{formatDate(log.created_at)}</span>
                        <span className="text-primary/20">|</span>
                        <span>{log.sent_count} TRANSMITTED</span>
                        {log.failed_count > 0 && <span className="text-red-500">| {log.failed_count} FAULT</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {log.attachment_names?.length > 0 && <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-none font-black text-[8px] uppercase">{log.attachment_names.length} ASSETS</Badge>}
                    <Badge className={clsx("font-black text-[8px] uppercase border-none", log.failed_count > 0 ? 'bg-yellow-500/20 text-yellow-500' : 'bg-primary/20 text-primary')}>
                      {log.failed_count > 0 ? 'PARTIAL SIGNAL' : 'SECURE COMMAND'}
                    </Badge>
                    <div className={clsx("w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center transition-transform", expandedLog === log.id && "rotate-180")}>
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </button>

                {expandedLog === log.id && (
                  <CardContent className="px-8 pb-8 space-y-6 border-t border-white/5 pt-8 animate-in slide-in-from-top-4">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[8px] font-black text-primary uppercase tracking-[0.2em] italic">Declassified Directive</label>
                        <p className="p-6 rounded-2xl bg-black/40 text-[10px] text-white/70 italic leading-relaxed whitespace-pre-wrap selection:bg-primary selection:text-black">
                          {log.body}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {log.recipient_emails.length > 0 && (
                          <div className="space-y-2">
                            <label className="text-[8px] font-black text-primary uppercase tracking-[0.2em] italic">Uplink Evaluators</label>
                            <div className="flex flex-wrap gap-2">
                              {log.recipient_emails.map((email, i) => (
                                <span key={i} className="px-3 py-1 rounded-lg bg-white/5 text-[8px] font-black text-muted-foreground uppercase tracking-widest">{email}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="space-y-6">
                          {log.meeting_link && (
                            <div className="space-y-2">
                              <label className="text-[8px] font-black text-primary uppercase tracking-[0.2em] italic">Evaluation Junction</label>
                              <a href={log.meeting_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 group">
                                <ArrowRight className="w-3 h-3 text-primary group-hover:translate-x-1 transition-transform" />
                                <span className="text-[9px] font-black text-white hover:text-primary transition-colors underline truncate">{log.meeting_link}</span>
                              </a>
                            </div>
                          )}
                          {log.attachment_names?.length > 0 && (
                            <div className="space-y-2">
                              <label className="text-[8px] font-black text-primary uppercase tracking-[0.2em] italic">Tactical Assets</label>
                              <div className="flex flex-wrap gap-2">
                                {log.attachment_names.map((name, i) => (
                                  <span key={i} className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 text-[8px] font-black text-purple-400 uppercase tracking-widest border border-purple-500/10">
                                    <Paperclip className="w-3 h-3" /> {name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
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
