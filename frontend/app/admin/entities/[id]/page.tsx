"use client";

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Globe,
  Calendar,
  Edit,
  Trash2,
  Loader2,
  Image as ImageIcon,
  FileText,
  CheckCircle,
  User,
  Eye,
  Link
} from 'lucide-react';
import toast from 'react-hot-toast';

interface EntityImage {
  id: number;
  url: string;
  caption: string;
  is_primary: boolean;
}

interface Publication {
  id: string;
  title: string;
  journal: string;
  publication_date: string;
  citation_count: number;
}

interface Verification {
  id: number;
  verifier: string;
  verified_at: string;
  level: string;
  notes: string;
}

interface EcosystemLink {
  id: string;
  profile_id: string;
  role: string;
  context: string;
}

interface EntityDetails {
  id: string;
  name: string;
  entity_type: 'lab' | 'startup' | 'organization' | 'university';
  university: string;
  location: {
    city: string;
    country: string;
    lat: number;
    lng: number;
  };
  website: string;
  source: 'scraped' | 'user';
  created_at: string;
  last_updated: string;
  created_by: string;
  images: EntityImage[];
  publications: Publication[];
  verifications: Verification[];
  ecosystem_links: EcosystemLink[];
  view_count: number;
  interaction_count: number;
}

export default function EntityDetailPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const router = useRouter();
  const params = useParams();
  const entityId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState<EntityDetails | null>(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ name: '', entity_type: '', university: '', website: '' });

  const fetchEntity = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/entities/${entityId}`);
      if (!response.ok) {
        throw new Error('Entity not found');
      }
      const data = await response.json();
      setEntity(data);
      setEditData({
        name: data.name,
        entity_type: data.entity_type,
        university: data.university,
        website: data.website
      });
    } catch (error) {
      console.error('Failed to fetch entity:', error);
      toast.error('Failed to load entity details');
      router.push('/admin/entities');
    } finally {
      setLoading(false);
    }
  }, [entityId, router]);

  useEffect(() => {
    fetchEntity();
  }, [fetchEntity]);

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/admin/entities/${entityId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      });

      if (response.ok) {
        toast.success('Entity updated successfully');
        setEditing(false);
        fetchEntity();
      } else {
        throw new Error('Failed to update entity');
      }
    } catch (error) {
      toast.error('Failed to update entity');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete entity "${entity?.name}"?`)) return;

    try {
      const response = await fetch(`/api/admin/entities/${entityId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Entity deleted successfully');
        router.push('/admin/entities');
      } else {
        throw new Error('Failed to delete entity');
      }
    } catch (error) {
      toast.error('Failed to delete entity');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="sticky top-0 z-10 border-b px-4 py-3 dark:bg-[#0A0A0A] bg-white/95 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="w-4 h-4 text-[#00FB75]" />
            <span className="font-medium">Entities</span>
            <span className="text-gray-500">/</span>
            <span className="dark:text-gray-400 text-gray-600">Loading...</span>
          </div>
        </div>
        <div className="flex-1 p-4 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#00FB75] animate-spin" />
        </div>
      </div>
    );
  }

  if (!entity) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 border-b px-4 py-3 dark:bg-[#0A0A0A] bg-white/95 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="w-4 h-4 text-[#00FB75]" />
            <span className="font-medium">Entities</span>
            <span className="text-gray-500">/</span>
            <span className="dark:text-gray-400 text-gray-600">{entity.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              entity.source === 'scraped'
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-green-500/20 text-green-400'
            }`}>
              {entity.source}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={() => router.push('/admin/entities')}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs dark:bg-[#121212] bg-white border dark:border-[#1A1A1A] border-gray-200 rounded-lg hover:border-[#00FB75]/50 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <button
            onClick={() => setEditing(!editing)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs dark:bg-[#121212] bg-white border dark:border-[#1A1A1A] border-gray-200 rounded-lg hover:border-[#00FB75]/50 transition-colors"
          >
            <Edit className="w-3.5 h-3.5" />
            {editing ? 'Cancel' : 'Edit'}
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 space-y-4">
            <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
              <h2 className="text-lg font-bold mb-3">{entity.name}</h2>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="dark:text-gray-400 text-gray-600 capitalize">{entity.entity_type}</span>
                  <span className="text-gray-600">•</span>
                  <span className="dark:text-gray-400 text-gray-600">{entity.university}</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t dark:border-[#1A1A1A] border-gray-200 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <MapPin className="w-3.5 h-3.5 text-gray-500" />
                  <span>{entity.location.city}, {entity.location.country}</span>
                </div>
                {entity.website && (
                  <div className="flex items-center gap-2 text-xs">
                    <Globe className="w-3.5 h-3.5 text-gray-500" />
                    <a href={entity.website} target="_blank" rel="noopener noreferrer" className="text-[#00FB75] hover:underline">
                      {entity.website}
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-gray-500" />
                  <span>Created {new Date(entity.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t dark:border-[#1A1A1A] border-gray-200">
                <div className="text-center p-2 dark:bg-[#0A0A0A] bg-gray-50 rounded">
                  <div className="text-lg font-bold">{entity.view_count}</div>
                  <div className="text-xs dark:text-gray-400 text-gray-600">Views</div>
                </div>
                <div className="text-center p-2 dark:bg-[#0A0A0A] bg-gray-50 rounded">
                  <div className="text-lg font-bold">{entity.ecosystem_links.length}</div>
                  <div className="text-xs dark:text-gray-400 text-gray-600">Links</div>
                </div>
              </div>
            </div>

            {editing && (
              <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
                <h3 className="text-sm font-bold mb-3">Edit Entity</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Name</label>
                    <input
                      type="text"
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm rounded-lg border dark:bg-[#0A0A0A] bg-gray-50 dark:border-[#1A1A1A] border-gray-200 focus:border-[#00FB75] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Type</label>
                    <select
                      value={editData.entity_type}
                      onChange={(e) => setEditData({ ...editData, entity_type: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm rounded-lg border dark:bg-[#0A0A0A] bg-gray-50 dark:border-[#1A1A1A] border-gray-200 focus:border-[#00FB75] focus:outline-none"
                    >
                      <option value="lab">Lab</option>
                      <option value="startup">Startup</option>
                      <option value="organization">Organization</option>
                      <option value="university">University</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">University</label>
                    <input
                      type="text"
                      value={editData.university}
                      onChange={(e) => setEditData({ ...editData, university: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm rounded-lg border dark:bg-[#0A0A0A] bg-gray-50 dark:border-[#1A1A1A] border-gray-200 focus:border-[#00FB75] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Website</label>
                    <input
                      type="url"
                      value={editData.website}
                      onChange={(e) => setEditData({ ...editData, website: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm rounded-lg border dark:bg-[#0A0A0A] bg-gray-50 dark:border-[#1A1A1A] border-gray-200 focus:border-[#00FB75] focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={handleSave}
                    className="w-full px-3 py-1.5 text-xs font-medium bg-[#00FB75] text-black rounded-lg hover:bg-green-400 transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-4">
            {entity.images.length > 0 && (
              <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-blue-500" />
                  Images ({entity.images.length})
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {entity.images.map((image) => (
                    <div key={image.id} className="relative rounded-lg overflow-hidden dark:bg-[#0A0A0A] bg-gray-50">
                      <img
                        src={image.url}
                        alt={image.caption}
                        className="w-full h-24 object-cover"
                      />
                      {image.is_primary && (
                        <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-[#00FB75] text-black text-[10px] font-bold rounded">
                          Primary
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {entity.publications.length > 0 && (
              <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-500" />
                  Publications ({entity.publications.length})
                </h3>
                <div className="space-y-2">
                  {entity.publications.map((pub) => (
                    <div key={pub.id} className="p-2 rounded dark:bg-[#0A0A0A] bg-gray-50">
                      <div className="text-xs font-medium mb-1">{pub.title}</div>
                      <div className="flex items-center gap-2 text-[10px] dark:text-gray-400 text-gray-600">
                        <span>{pub.journal}</span>
                        <span>•</span>
                        <span>{new Date(pub.publication_date).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{pub.citation_count} citations</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {entity.verifications.length > 0 && (
              <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Verifications ({entity.verifications.length})
                </h3>
                <div className="space-y-2">
                  {entity.verifications.map((verif) => (
                    <div key={verif.id} className="flex items-center justify-between p-2 rounded dark:bg-[#0A0A0A] bg-gray-50">
                      <div>
                        <div className="text-xs font-medium">{verif.verifier}</div>
                        <div className="text-[10px] dark:text-gray-400 text-gray-600 capitalize">{verif.level}</div>
                      </div>
                      <span className="text-[10px] text-gray-500">
                        {new Date(verif.verified_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {entity.ecosystem_links.length > 0 && (
              <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <Link className="w-4 h-4 text-orange-500" />
                  Ecosystem Links ({entity.ecosystem_links.length})
                </h3>
                <div className="space-y-2">
                  {entity.ecosystem_links.map((link) => (
                    <div key={link.id} className="flex items-center justify-between p-2 rounded dark:bg-[#0A0A0A] bg-gray-50">
                      <div>
                        <div className="text-xs font-medium capitalize">{link.role}</div>
                        <div className="text-[10px] dark:text-gray-400 text-gray-600">{link.context}</div>
                      </div>
                      <span className="text-[10px] text-gray-500 font-mono">
                        {link.profile_id.slice(0, 8)}...
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
