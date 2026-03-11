"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Loader2, Trash2, X, Check, Plus, Users, ShieldAlert, Cpu,
  ArrowLeft, MoreHorizontal, Search, Upload, User as UserIcon
} from 'lucide-react';
import { clsx } from "clsx";
import Link from 'next/link';

export default function ParticipantsPage() {
  const { eventId } = useParams();
  const [participants, setParticipants] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<any>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const limit = 50;

  const [error, setError] = useState('');

  const getAuthHeaders = () => {
    const tok = typeof window !== 'undefined' ? (localStorage.getItem('token') || sessionStorage.getItem('token')) : null;
    return { Authorization: `Bearer ${tok}` };
  };

  const fetchParticipants = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/hackathons/${eventId}/participants?search=${encodeURIComponent(search)}&skip=${skip}&limit=${limit}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || `Error ${res.status}`);
        return;
      }
      setParticipants(data.items || []);
      setTotal(data.total || 0);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  }, [eventId, search, skip, limit]);

  useEffect(() => { fetchParticipants(); }, [fetchParticipants]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch(`/api/admin/hackathons/${eventId}/participants/upload`, { method: 'POST', headers: getAuthHeaders(), body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed');
      setUploadPreview(data);
      setMapping(data.inferred_mapping || {});
    } catch (err: any) { alert(err.message); } finally { setUploading(false); }
  };

  const confirmUpload = async () => {
    if (!uploadPreview) return;
    setUploading(true);
    try {
      const res = await fetch(`/api/admin/hackathons/${eventId}/participants/upload/confirm`, {
        method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ upload_batch_id: uploadPreview.upload_batch_id, column_mapping: mapping }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Confirm failed');
      setShowUpload(false); setUploadPreview(null);
      fetchParticipants();
    } catch (err: any) { alert(err.message); } finally { setUploading(false); }
  };

  const deleteParticipant = async (id: string) => {
    if (!confirm('Remove this participant?')) return;
    await fetch(`/api/admin/hackathons/${eventId}/participants/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    fetchParticipants();
  };

  const deleteAll = async () => {
    if (!confirm(`Delete ALL ${total} participants? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/hackathons/${eventId}/participants`, { method: 'DELETE', headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Delete failed');
      fetchParticipants();
    } catch (err: any) { alert(err.message); }
  };

  const targetFields = [
    'first_name', 'last_name', 'email', 'organization', 'team_name', 'project_title', 'project_description',
    'phone_number', 'country', 'timezone',
    'theme', 'participant_type', 'occupation', 'department', 'major', 'position', 'specialization',
    '__full_name__', '__skip__'
  ];

  const [showManualAdd, setShowManualAdd] = useState(false);
  const [newParticipant, setNewParticipant] = useState({
    first_name: '', last_name: '', email: '', organization: '', team_name: '', project_title: ''
  });

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    try {
      const res = await fetch(`/api/admin/hackathons/${eventId}/participants/manual`, {
        method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(newParticipant)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to add participant');
      setShowManualAdd(false);
      setNewParticipant({ first_name: '', last_name: '', email: '', organization: '', team_name: '', project_title: '' });
      fetchParticipants();
    } catch (err: any) { alert(err.message); } finally { setUploading(false); }
  };

  return (
    <div className="min-h-screen bg-[#E8E8E8] dark:bg-black/50 p-6 md:p-8 space-y-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/admin/hackathons/${eventId}`}
              className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-blue-600 transition-colors shadow-sm"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Participants</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{total} Total Registered</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setShowManualAdd(true)}
              className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl px-4"
            >
              <Plus className="w-4 h-4 mr-2 text-blue-600" /> Add Participant
            </Button>
            <Button
              onClick={() => { setShowUpload(true); setUploadPreview(null); }}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 shadow-sm"
            >
              <Upload className="w-4 h-4 mr-2" /> Bulk Upload
            </Button>
          </div>
        </div>

        {/* Action Bar */}
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={search}
                onChange={e => { setSearch(e.target.value); setSkip(0); }}
                placeholder="Search by name, email, or team..."
                className="pl-10 h-10 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl"
              />
            </div>

            <div className="flex items-center gap-2">
              {total > 0 && (
                <Button
                  variant="ghost"
                  onClick={deleteAll}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 rounded-xl text-sm"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Purge Records
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 text-sm text-red-600 dark:text-red-400 flex items-center gap-3">
            <ShieldAlert className="w-4 h-4" /> {error}
          </div>
        )}

        {/* Data Table */}
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Participant</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Team / Project</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Organization</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                {participants.map(p => (
                  <tr key={p.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={clsx(
                        "w-8 h-8 rounded-lg flex items-center justify-center border",
                        p.participant_type === 'Group'
                          ? "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/50 text-blue-600 dark:text-blue-400"
                          : "bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400"
                      )}>
                        {p.participant_type === 'Group' ? <Users className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {p.first_name} {p.last_name}
                      </p>
                      <span className="text-xs text-gray-500">{p.participant_type || 'Individual'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-600 dark:text-gray-400">{p.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-800 dark:text-gray-200">{p.team_name || 'Individual'}</p>
                      <p className="text-xs text-gray-500 truncate max-w-[200px]">{p.project_title || 'No Project'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-500 dark:text-gray-400 truncate max-w-[150px]">
                        {p.organization || '-'}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteParticipant(p.id)}
                        className="w-8 h-8 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-all opacity-40 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {participants.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-20 bg-gray-50/30 dark:bg-transparent">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 mb-4">
                  <Users className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-gray-900 dark:text-white">No participants found</p>
                  <p className="text-sm text-gray-500 mt-1">Try adjusting your search or upload new ones.</p>
                </div>
              </div>
            )}

            {loading && (
              <div className="py-20 flex justify-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
            )}
          </div>
        </Card>

        {/* Pagination */}
        {total > limit && (
          <div className="flex justify-center items-center gap-4">
            <Button
              variant="outline"
              disabled={skip === 0}
              onClick={() => setSkip(Math.max(0, skip - limit))}
              className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl"
            >
              Previous
            </Button>
            <div className="px-4 py-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium">
              Page {Math.floor(skip / limit) + 1} of {Math.ceil(total / limit)}
            </div>
            <Button
              variant="outline"
              disabled={skip + limit >= total}
              onClick={() => setSkip(skip + limit)}
              className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl"
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Manual Entry Modal */}
      {showManualAdd && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-[2rem] w-full max-w-xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add New Participant</h2>
                <p className="text-xs text-gray-500">Enter details manually</p>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setShowManualAdd(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <form onSubmit={handleManualAdd} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-1">First Name</label>
                  <Input required value={newParticipant.first_name} onChange={e => setNewParticipant({ ...newParticipant, first_name: e.target.value })} placeholder="John" className="h-11 rounded-xl border-gray-200" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-1">Last Name</label>
                  <Input required value={newParticipant.last_name} onChange={e => setNewParticipant({ ...newParticipant, last_name: e.target.value })} placeholder="Doe" className="h-11 rounded-xl border-gray-200" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-1">Email Address</label>
                <Input required type="email" value={newParticipant.email} onChange={e => setNewParticipant({ ...newParticipant, email: e.target.value })} placeholder="john@example.com" className="h-11 rounded-xl border-gray-200" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-1">Organization / University</label>
                <Input value={newParticipant.organization} onChange={e => setNewParticipant({ ...newParticipant, organization: e.target.value })} placeholder="e.g. MKU University" className="h-11 rounded-xl border-gray-200" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-1">Team Name</label>
                  <Input value={newParticipant.team_name} onChange={e => setNewParticipant({ ...newParticipant, team_name: e.target.value })} placeholder="Team Alpha" className="h-11 rounded-xl border-gray-200" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-1">Project Title</label>
                  <Input value={newParticipant.project_title} onChange={e => setNewParticipant({ ...newParticipant, project_title: e.target.value })} placeholder="Project Titan" className="h-11 rounded-xl border-gray-200" />
                </div>
              </div>
              <div className="pt-2 flex gap-3">
                <Button type="button" variant="outline" onClick={() => setShowManualAdd(false)} className="flex-1 h-12 rounded-xl border-gray-200">Cancel</Button>
                <Button type="submit" disabled={uploading} className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold">
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm Add"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-[2rem] w-full max-w-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[90vh]">
            <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{uploadPreview ? 'Map Columns' : 'Bulk Participant Upload'}</h2>
                <p className="text-xs text-gray-500">{uploadPreview ? 'Match CSV columns to system fields' : 'Upload CSV/Excel file'}</p>
              </div>
              {!uploading && (
                <Button variant="ghost" size="icon" className="rounded-full" onClick={() => { setShowUpload(false); setUploadPreview(null); }}>
                  <X className="w-5 h-5" />
                </Button>
              )}
            </div>

            <CardContent className="p-8 overflow-y-auto space-y-6">
              {!uploadPreview ? (
                <div className="space-y-6">
                  <div className="border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-[2.5rem] p-12 text-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all group">
                    <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleUpload} className="hidden" id="file-upload" disabled={uploading} />
                    {uploading ? (
                      <div className="space-y-4">
                        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
                        <p className="text-sm font-semibold text-gray-700">Analyzing file...</p>
                      </div>
                    ) : (
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <Upload className="w-12 h-12 mx-auto text-blue-100 group-hover:text-blue-200 transition-colors mb-4" />
                        <p className="text-base font-bold text-gray-900 dark:text-white">Choose File</p>
                        <p className="text-sm text-gray-500 mt-1">Supports CSV, Excel (XLSX, XLS)</p>
                      </label>
                    )}
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/20">
                    <h4 className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider mb-2">Instructions</h4>
                    <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1.5 list-disc pl-4">
                      <li>Use a header row in your file</li>
                      <li>Mandatory fields: Name (or First/Last) and Email</li>
                      <li>The system will attempt to detect columns automatically</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/50 rounded-xl flex justify-between items-center">
                    <div>
                      <p className="text-sm font-bold text-green-800 dark:text-green-300">{uploadPreview.total_rows} Records Detected</p>
                      <p className="text-xs text-green-700/60 dark:text-green-400/60">{uploadPreview.filename}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Mapping Configuration</p>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                      {Object.entries(mapping).map(([src, tgt]) => (
                        <div key={src} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-750">
                          <span className="flex-1 truncate font-medium text-sm text-gray-700 dark:text-gray-300">{src}</span>
                          <ArrowLeft className="w-3 h-3 text-gray-300 rotate-180" />
                          <select
                            value={tgt}
                            onChange={e => setMapping({ ...mapping, [src]: e.target.value })}
                            className="w-40 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold py-1.5"
                          >
                            {targetFields.map(f => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}
                          </select>
                        </div>
                      ))}

                      {uploadPreview.unmapped_columns?.map((col: string) => (
                        <div key={col} className="flex items-center gap-3 bg-gray-50/50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800 opacity-70">
                          <span className="flex-1 truncate text-xs text-gray-500 font-mono">{col}</span>
                          <ArrowLeft className="w-3 h-3 text-gray-200 rotate-180" />
                          <select
                            value={mapping[col] || '__skip__'}
                            onChange={e => setMapping({ ...mapping, [col]: e.target.value })}
                            className="w-40 bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium py-1.5"
                          >
                            <option value="__skip__">Ignore Field</option>
                            {targetFields.filter(f => f !== '__skip__').map(f => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 flex flex-col gap-3">
                    <Button
                      onClick={confirmUpload}
                      disabled={uploading}
                      className="h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/10"
                    >
                      {uploading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Check className="w-5 h-5 mr-2" />}
                      {uploading ? `Processing ${uploadPreview.total_rows} Records...` : 'Confirm and Upload'}
                    </Button>
                    <Button
                      onClick={() => setUploadPreview(null)}
                      disabled={uploading}
                      variant="ghost"
                      className="text-gray-500 h-10 hover:text-gray-700"
                    >
                      Choose Different File
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </div>
        </div>
      )}
    </div>
  );
}
