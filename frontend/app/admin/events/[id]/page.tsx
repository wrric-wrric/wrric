"use client";

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { useRouter, useParams } from 'next/navigation';
import {
  Calendar,
  MapPin,
  Globe,
  Users,
  ExternalLink,
  Edit,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Users as UsersIcon,
  Clock,
  Tag,
  Star,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Loader2,
  Target
} from 'lucide-react';
import { Event } from '@/types/events';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function AdminEventDetailPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    views: 0,
    registrations: 0,
    engagement: 0,
  });

  const getAuthHeaders = (): Record<string, string> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchEvent = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/events/${id}`, { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch event');
      const data = await response.json();
      setEvent(data);
    } catch (error) {
      console.error('Error fetching event:', error);
      toast.error('Failed to load event');
      router.push('/admin/events');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  const fetchStats = useCallback(async () => {
    try {
      setStats({ views: 1245, registrations: 89, engagement: 72 });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchEvent();
    fetchStats();
  }, [fetchEvent, fetchStats]);

  const handlePublishToggle = async () => {
    if (!event) return;
    try {
      const action = event.is_published ? 'unpublish' : 'publish';
      const response = await fetch(`/api/admin/events/${id}/${action}`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error(`Failed to ${action} event`);
      toast.success(`Event ${action}ed successfully`);
      fetchEvent();
    } catch (error) {
      console.error('Publish toggle error:', error);
      toast.error('Failed to update event status');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) return;
    try {
      const response = await fetch(`/api/admin/events/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to delete event');
      toast.success('Event deleted successfully');
      router.push('/admin/events');
    } catch (error) {
      console.error('Delete event error:', error);
      toast.error('Failed to delete event');
    }
  };

  const copyEventLink = () => {
    if (!event) return;
    const link = `${window.location.origin}/events/${event.slug}`;
    navigator.clipboard.writeText(link);
    toast.success('Event link copied to clipboard!');
  };

  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'EEEE, MMMM d, yyyy · h:mm a');
    } catch {
      return 'Date TBD';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-6">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-sm font-black tracking-[0.3em] uppercase opacity-50">Calibrating Console...</p>
      </div>
    );
  }

  if (!event) return null;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Dynamic Header */}
      <div className="sticky top-0 z-10 border-b border-white/5 bg-black/80 backdrop-blur-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => router.push('/admin/events')} className="group text-muted-foreground hover:text-primary p-0 h-auto">
              <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              Terminal / Events
            </Button>
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-black tracking-tight">{event.title}</h1>
              <Badge variant="outline" className={`h-6 font-bold uppercase tracking-widest px-2 ${event.is_published ? 'border-primary/50 text-primary neon-text' : 'border-yellow-500/50 text-yellow-500'}`}>
                {event.is_published ? 'System Live' : 'Encryption Draft'}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={copyEventLink} className="border-white/10 hover:border-primary/50">
              <Copy className="w-4 h-4 mr-2" />
              Link
            </Button>
            <Button variant="outline" size="sm" asChild className="border-white/10 hover:border-primary/50">
              <a href={`/events/${event.slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                View
              </a>
            </Button>
            <Button size="sm" onClick={() => router.push(`/admin/events/${id}/edit`)} className="bg-primary text-black hover:bg-primary/90">
              <Edit className="w-4 h-4 mr-2" />
              Modify Specs
            </Button>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            <Card className="border-white/5 bg-white/[0.02] backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center gap-3">
                  <Tag className="w-5 h-5 text-primary" />
                  Mission Profile
                </CardTitle>
                <CardDescription className="text-muted-foreground/80 italic">Core event telemetry and identification</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Deployment Window</p>
                      <p className="text-sm font-bold">{formatDateTime(event.event_datetime)}</p>
                      <p className="text-[10px] text-primary/70 font-mono mt-1 uppercase">Zone: {event.timezone}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      {event.location_type === 'physical' ? <MapPin className="w-5 h-5 text-blue-400" /> : <Globe className="w-5 h-5 text-blue-400" />}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Operational Area</p>
                      <p className="text-sm font-bold capitalize">{event.location_type} Network</p>
                      {event.physical_location && <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{event.physical_location}</p>}
                      {event.virtual_link && <a href={event.virtual_link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline font-mono mt-1 block truncate max-w-[150px]">{event.virtual_link}</a>}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-sm font-bold text-foreground/80 flex items-center gap-2">
                    <Edit className="w-4 h-4" />
                    Transmission Logs
                  </p>
                  <div className="prose prose-invert prose-emerald max-w-none text-sm text-muted-foreground/80 leading-relaxed bg-black/20 p-6 rounded-2xl border border-white/5" dangerouslySetInnerHTML={{ __html: event.description }} />
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="border-white/5 bg-white/[0.02]">
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <UsersIcon className="w-4 h-4 text-primary" />
                    Signal Access
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {event.registration_url ? (
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-primary/30 transition-colors">
                      <p className="text-[10px] font-black uppercase text-muted-foreground/60 mb-2">Gate URL</p>
                      <a href={event.registration_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary font-mono hover:underline break-all">
                        {event.registration_url}
                      </a>
                    </div>
                  ) : (
                    <div className="text-center p-8 border border-dashed border-white/10 rounded-2xl opacity-40">
                      <XCircle className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-xs font-bold uppercase tracking-widest">Internal Grid Only</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-white/5 bg-white/[0.02]">
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    Categories
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {event.categories.map(c => (
                    <Badge key={c.id} style={{ borderColor: `${c.color_code}40`, color: c.color_code }} variant="outline" className="bg-black/40 px-3 py-1 font-bold">
                      {c.name}
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Sidebar / Stats */}
          <div className="space-y-8">
            <Card className="border-white/5 bg-black/40 backdrop-blur-2xl">
              <CardHeader>
                <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Operational Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {[
                    { label: 'System Visibility', value: event.is_published ? 'Operational' : 'Ghost Mode', status: event.is_published ? 'text-primary' : 'text-yellow-500' },
                    { label: 'Network Priority', value: event.priority, status: 'text-foreground' },
                    { label: 'Global Featured', value: event.is_featured ? 'Enabled' : 'Bypass', status: event.is_featured ? 'text-yellow-400' : 'text-muted-foreground' },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between items-center text-xs p-2 rounded-lg bg-white/5">
                      <span className="font-bold text-muted-foreground/60 uppercase tracking-tighter">{item.label}</span>
                      <span className={`font-black ${item.status}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
                <Button onClick={handlePublishToggle} className={`w-full font-black tracking-widest uppercase h-11 ${event.is_published ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 'bg-primary hover:bg-primary/90 text-black shadow-[0_0_15px_rgba(0,251,117,0.3)]'}`}>
                  {event.is_published ? 'Initiate Lockdown' : 'Authorize Broadcast'}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-white/5 bg-white/[0.02] overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader>
                <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Telemetry</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Vessels', value: stats.registrations, icon: UsersIcon },
                    { label: 'Uplinks', value: stats.views, icon: Eye },
                  ].map((s, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-black/40 border border-white/5 text-center">
                      <s.icon className="w-4 h-4 mx-auto mb-2 text-primary opacity-50" />
                      <div className="text-2xl font-black neon-text">{s.value}</div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-4 rounded-2xl bg-primary/5 border border-primary/10 text-center">
                  <div className="text-lg font-black text-primary">{stats.engagement}%</div>
                  <p className="text-[8px] font-bold uppercase tracking-[0.3em] text-primary/60">Core Engagement Rate</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-500/10 bg-red-500/[0.02] border-dashed">
              <CardHeader>
                <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-red-500">Decommission Area</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-[10px] text-muted-foreground leading-relaxed italic">Warning: Initiating decommissioning will erase all event telemetry from the central grid permanently.</p>
                <Button variant="ghost" onClick={handleDelete} className="w-full h-11 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white font-black uppercase tracking-widest">
                  Decommission Event
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
