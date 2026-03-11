"use client";

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import {
  Search,
  Building2,
  Globe,
  Edit,
  Trash2,
  Loader2,
  ArrowUp,
  ArrowDown,
  Beaker,
  Rocket,
  Building,
  GraduationCap,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Entity {
  id: string;
  name: string;
  entity_type: 'lab' | 'startup' | 'organization' | 'university';
  university: string;
  source: 'scraped' | 'user';
  created_at: string;
  last_updated: string;
  image_count: number;
  publication_count: number;
  verification_count: number;
  view_count: number;
}

export default function AdminEntitiesPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const router = useRouter();

  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    scraped: 0,
    user_created: 0,
    verified: 0,
    entity_types: { lab: 0, startup: 0, organization: 0, university: 0 },
    new_7d: 0
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [entityType, setEntityType] = useState<string>('');
  const [source, setSource] = useState<string>('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchEntities = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        page_size: '20',
        sort_by: sortBy,
        sort_order: sortOrder,
      });

      if (searchQuery) params.append('search', searchQuery);
      if (entityType) params.append('entity_type', entityType);
      if (source) params.append('source', source);

      const response = await fetch(`/api/admin/entities?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setEntities(data.entities);
      setTotalPages(data.total_pages);
    } catch (error) {
      console.error('Failed to fetch entities:', error);
      toast.error('Failed to load entities');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, entityType, source, sortBy, sortOrder]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/entities/stats/overview');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchEntities();
    fetchStats();
  }, [fetchEntities, fetchStats]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete entity "${name}"?`)) return;

    try {
      const response = await fetch(`/api/admin/entities/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Entity deleted successfully');
        fetchEntities();
        fetchStats();
      } else {
        throw new Error('Failed to delete entity');
      }
    } catch (error) {
      toast.error('Failed to delete entity');
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const getEntityTypeIcon = (type: string) => {
    switch (type) {
      case 'lab':
        return <Beaker className="w-4 h-4" />;
      case 'startup':
        return <Rocket className="w-4 h-4" />;
      case 'organization':
        return <Building className="w-4 h-4" />;
      case 'university':
        return <GraduationCap className="w-4 h-4" />;
      default:
        return <Building2 className="w-4 h-4" />;
    }
  };

  const getEntityTypeColor = (type: string) => {
    switch (type) {
      case 'lab':
        return 'blue';
      case 'startup':
        return 'green';
      case 'organization':
        return 'purple';
      case 'university':
        return 'orange';
      default:
        return 'gray';
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 border-b border-slate-200 px-4 py-3 bg-white">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="w-4 h-4 text-[#00FB75]" />
            <span className="font-medium">Entities</span>
            <span className="text-gray-500">/</span>
            <span className="dark:text-gray-400 text-gray-600">List</span>
          </div>
          <span className="text-xs dark:text-gray-400 text-gray-600">{stats.total} total</span>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 opacity-50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search entities..."
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border dark:bg-[#121212] bg-white dark:border-[#1A1A1A] border-gray-200 focus:border-[#00FB75] focus:outline-none"
            />
          </div>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border dark:bg-[#121212] bg-white dark:border-[#1A1A1A] border-gray-200 focus:border-[#00FB75] focus:outline-none"
          >
            <option value="">All Types</option>
            <option value="lab">Labs</option>
            <option value="startup">Startups</option>
            <option value="organization">Organizations</option>
            <option value="university">Universities</option>
          </select>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border dark:bg-[#121212] bg-white dark:border-[#1A1A1A] border-gray-200 focus:border-[#00FB75] focus:outline-none"
          >
            <option value="">All Sources</option>
            <option value="scraped">Scraped</option>
            <option value="user">User Created</option>
          </select>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-4">
          <div className="rounded-lg border dark:bg-[#121212] bg-white p-3">
            <Building2 className="w-4 h-4 text-blue-500 mb-1" />
            <div className="text-lg font-bold">{stats.total}</div>
            <div className="text-xs dark:text-gray-400 text-gray-600">Total</div>
          </div>
          <div className="rounded-lg border dark:bg-[#121212] bg-white p-3">
            <Beaker className="w-4 h-4 text-blue-500 mb-1" />
            <div className="text-lg font-bold">{stats.entity_types.lab}</div>
            <div className="text-xs dark:text-gray-400 text-gray-600">Labs</div>
          </div>
          <div className="rounded-lg border dark:bg-[#121212] bg-white p-3">
            <Rocket className="w-4 h-4 text-green-500 mb-1" />
            <div className="text-lg font-bold">{stats.entity_types.startup}</div>
            <div className="text-xs dark:text-gray-400 text-gray-600">Startups</div>
          </div>
          <div className="rounded-lg border dark:bg-[#121212] bg-white p-3">
            <Building className="w-4 h-4 text-purple-500 mb-1" />
            <div className="text-lg font-bold">{stats.entity_types.organization}</div>
            <div className="text-xs dark:text-gray-400 text-gray-600">Orgs</div>
          </div>
          <div className="rounded-lg border dark:bg-[#121212] bg-white p-3">
            <GraduationCap className="w-4 h-4 text-orange-500 mb-1" />
            <div className="text-lg font-bold">{stats.entity_types.university}</div>
            <div className="text-xs dark:text-gray-400 text-gray-600">Unis</div>
          </div>
          <div className="rounded-lg border dark:bg-[#121212] bg-white p-3">
            <Globe className="w-4 h-4 text-cyan-500 mb-1" />
            <div className="text-lg font-bold">{stats.verified}</div>
            <div className="text-xs dark:text-gray-400 text-gray-600">Verified</div>
          </div>
        </div>

        <div className="rounded-lg border dark:bg-[#121212] bg-white overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 mx-auto mb-3 text-[#00FB75] animate-spin" />
              <p className="text-sm dark:text-gray-400 text-gray-600">Loading entities...</p>
            </div>
          ) : entities.length === 0 ? (
            <div className="p-8 text-center">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm dark:text-gray-400 text-gray-600">No entities found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b dark:border-[#1A1A1A] border-gray-200">
                      <th className="px-4 py-2 text-left text-xs font-medium dark:text-gray-400 text-gray-600">Entity</th>
                      <th className="px-4 py-2 text-left text-xs font-medium dark:text-gray-400 text-gray-600">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium dark:text-gray-400 text-gray-600">Source</th>
                      <th
                        className="px-4 py-2 text-left text-xs font-medium dark:text-gray-400 text-gray-600 cursor-pointer hover:dark:text-white text-gray-900"
                        onClick={() => handleSort('created_at')}
                      >
                        <div className="flex items-center gap-1">
                          Created
                          {sortBy === 'created_at' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                        </div>
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium dark:text-gray-400 text-gray-600">Views</th>
                      <th className="px-4 py-2 text-left text-xs font-medium dark:text-gray-400 text-gray-600">Content</th>
                      <th className="px-4 py-2 text-left text-xs font-medium dark:text-gray-400 text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entities.map((entity) => (
                      <tr
                        key={entity.id}
                        className="border-b border-slate-100 hover:bg-blue-50/40 transition-colors group"
                      >
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium">{entity.name}</div>
                          <div className="text-xs dark:text-gray-400 text-gray-600">{entity.university}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className={`flex items-center gap-1.5 text-xs`}>
                            {getEntityTypeIcon(entity.entity_type)}
                            <span className="capitalize">{entity.entity_type}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${entity.source === 'scraped'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-green-500/20 text-green-400'
                            }`}>
                            {entity.source}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs">
                            {new Date(entity.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs">{entity.view_count}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 text-xs">
                            <span className="dark:text-gray-400 text-gray-600">{entity.image_count} img</span>
                            <span className="dark:text-gray-400 text-gray-600">{entity.publication_count} pubs</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => router.push(`/admin/entities/${entity.id}`)}
                              className="p-1.5 rounded hover:bg-slate-100 transition-colors text-slate-500"
                              title="View Details"
                            >
                              <Globe className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(entity.id, entity.name)}
                              className="p-1.5 rounded hover:bg-red-500/20 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t dark:border-[#1A1A1A] border-gray-200">
                  <div className="text-xs dark:text-gray-400 text-gray-600">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className={`p-1.5 rounded transition-colors ${currentPage === 1 ? 'opacity-30' : 'hover:bg-slate-100'
                        }`}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-7 h-7 rounded text-xs font-medium transition-colors ${currentPage === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'hover:bg-slate-100 text-slate-600'
                            }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className={`p-1.5 rounded transition-colors ${currentPage === totalPages ? 'opacity-30' : 'hover:bg-slate-100'
                        }`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
