"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Plus, Search, Calendar, Globe, MapPin, Users,
  Edit, Eye, EyeOff, Star, Trash2, ChevronLeft, ChevronRight,
  CheckCircle, Clock, Loader2
} from 'lucide-react';
import { Event } from '@/types/events';
import toast from 'react-hot-toast';

export default function AdminEventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, published: 0, upcoming: 0, featured: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft' | 'featured'>('all');

  const getAuthHeaders = (): Record<string, string> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: currentPage.toString(), limit: '20' });
      if (searchQuery) params.append('search', searchQuery);
      if (filter === 'published') params.append('is_published', 'true');
      if (filter === 'draft') params.append('is_published', 'false');
      if (filter === 'featured') params.append('is_featured', 'true');

      const res = await fetch(`/api/admin/events?${params.toString()}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items: Event[] = data.items ?? [];
      setEvents(items);
      setTotalPages(data.pages ?? 1);
      const now = new Date();
      setStats({
        total: items.length,
        published: items.filter(e => e.is_published).length,
        upcoming: items.filter(e => new Date(e.event_datetime) > now).length,
        featured: items.filter(e => e.is_featured).length,
      });
    } catch {
      toast.error('Failed to load events');
    } finally { setLoading(false); }
  }, [currentPage, searchQuery, filter]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handlePublish = async (id: string, publish: boolean) => {
    const res = await fetch(`/api/admin/events/${id}/${publish ? 'publish' : 'unpublish'}`, { method: 'POST', headers: getAuthHeaders() });
    if (res.ok) { toast.success(`Event ${publish ? 'published' : 'unpublished'}`); fetchEvents(); }
    else toast.error('Failed to update status');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this event?')) return;
    const res = await fetch(`/api/admin/events/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    if (res.ok) { toast.success('Event deleted'); fetchEvents(); }
    else toast.error('Failed to delete');
  };

  const toggleSelectAll = () =>
    setSelectedEvents(selectedEvents.length === events.length ? [] : events.map(e => e.id));

  const filters: Array<'all' | 'published' | 'draft' | 'featured'> = ['all', 'published', 'draft', 'featured'];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Events
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage all platform events and publications</p>
        </div>
        <Link href="/admin/events/new">
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" /> New Event
          </button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: stats.total, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Published', value: stats.published, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Upcoming', value: stats.upcoming, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Featured', value: stats.featured, icon: Star, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
            <div className={`w-8 h-8 rounded-md ${s.bg} flex items-center justify-center mb-2`}>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <p className="text-2xl font-bold text-slate-800">{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search events..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Filter tabs */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-0.5">
            {filters.map(f => (
              <button key={f} onClick={() => { setFilter(f); setCurrentPage(1); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize transition-colors
                  ${filter === f ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {f}
              </button>
            ))}
          </div>

          {selectedEvents.length > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-slate-500">{selectedEvents.length} selected</span>
              <button onClick={() => {
                if (!confirm(`Delete ${selectedEvents.length} events?`)) return;
                Promise.all(selectedEvents.map(id => fetch(`/api/admin/events/${id}`, { method: 'DELETE', headers: getAuthHeaders() })))
                  .then(() => { toast.success('Deleted'); setSelectedEvents([]); fetchEvents(); });
              }} className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50">Delete</button>
              <button onClick={() => setSelectedEvents([])} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-360px)]">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600 mr-2" />
              <span className="text-sm text-slate-500">Loading events...</span>
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-300">
              <Calendar className="w-10 h-10 mb-3" />
              <p className="text-sm font-medium text-slate-400">No events found</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={selectedEvents.length === events.length && events.length > 0}
                      onChange={toggleSelectAll} className="rounded border-slate-300 text-blue-600" />
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Event</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((event, idx) => (
                  <tr key={event.id} className={`hover:bg-blue-50/40 transition-colors group ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                    <td className="px-4 py-3.5">
                      <input type="checkbox" checked={selectedEvents.includes(event.id)}
                        onChange={() => setSelectedEvents(prev => prev.includes(event.id) ? prev.filter(i => i !== event.id) : [...prev, event.id])}
                        className="rounded border-slate-300 text-blue-600" />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {event.featured_image_url
                            ? <img src={event.featured_image_url} alt="" className="w-full h-full object-cover" />
                            : <Calendar className="w-4 h-4 text-blue-600" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">{event.title}</span>
                            {event.is_featured && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                          </div>
                          <p className="text-xs text-slate-400 truncate max-w-xs">{event.short_description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm text-slate-700">{new Date(event.event_datetime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      <p className="text-xs text-slate-400">{new Date(event.event_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-sm text-slate-600">
                        {event.location_type === 'physical' ? <MapPin className="w-3.5 h-3.5 text-slate-400" /> : <Globe className="w-3.5 h-3.5 text-blue-500" />}
                        <span className="capitalize text-xs">{event.location_type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {event.is_published
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Published</span>
                        : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Draft</span>}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => router.push(`/admin/events/${event.id}/edit`)}
                          className="p-1.5 rounded-md hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition-colors" title="Edit">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handlePublish(event.id, !event.is_published)}
                          className="p-1.5 rounded-md hover:bg-emerald-100 text-slate-400 hover:text-emerald-600 transition-colors" title={event.is_published ? 'Unpublish' : 'Publish'}>
                          {event.is_published ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => router.push(`/admin/events/${event.id}/registrations`)}
                          className="p-1.5 rounded-md hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition-colors" title="Registrations">
                          <Users className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(event.id)}
                          className="p-1.5 rounded-md hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
            <span className="text-xs text-slate-500">Page {currentPage} of {totalPages}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => (
                <button key={i} onClick={() => setCurrentPage(i + 1)}
                  className={`w-7 h-7 rounded text-xs font-medium transition-colors ${currentPage === i + 1 ? 'bg-blue-600 text-white' : 'hover:bg-slate-200 text-slate-600'}`}>
                  {i + 1}
                </button>
              ))}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
