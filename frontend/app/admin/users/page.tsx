"use client";

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import {
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
  Shield,
  User,
  Calendar,
  Edit,
  Trash2,
  Loader2,
  ArrowUp,
  ArrowDown,
  UserPlus,
  X,
  ChevronDown
} from 'lucide-react';

import toast from 'react-hot-toast';

interface User {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
  last_activity: string;
  profile_count: number;
  session_count: number;
}

export default function AdminUsersPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    admin: 0,
    regular: 0,
    new_7d: 0,
    total_profiles: 0,
    active_sessions: 0
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [adminOnly, setAdminOnly] = useState(false);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  // Add User Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    first_name: '',
    last_name: '',
    profile_type: 'Standard User',
    is_admin: false,
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        page_size: '20',
        sort_by: sortBy,
        sort_order: sortOrder,
      });

      if (searchQuery) params.append('search', searchQuery);
      if (adminOnly) params.append('admin_only', 'true');

      const response = await fetch(`/api/admin/users?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setUsers(data.users);
      setTotalPages(data.total_pages);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, adminOnly, sortBy, sortOrder]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/users/stats/overview');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, [fetchUsers, fetchStats]);

  const handleDelete = async (id: string, username: string) => {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) return;

    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('User deleted successfully');
        fetchUsers();
        fetchStats();
      } else {
        throw new Error('Failed to delete user');
      }
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  const handleToggleAdmin = async (id: string, currentStatus: boolean, username: string) => {
    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_admin: !currentStatus }),
      });

      if (response.ok) {
        toast.success(`User ${!currentStatus ? 'granted' : 'revoked'} admin privileges`);
        fetchUsers();
        fetchStats();
      } else {
        throw new Error('Failed to update user');
      }
    } catch (error) {
      toast.error('Failed to update user');
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email) {
      toast.error("Email is required");
      return;
    }

    setIsAddingUser(true);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newUser),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to create user');
      }

      toast.success('User created! An invitation email has been sent.');
      setIsAddModalOpen(false);
      setNewUser({
        email: '',
        first_name: '',
        last_name: '',
        profile_type: 'Standard User',
        is_admin: false,
      });
      fetchUsers();
      fetchStats();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create user');
    } finally {
      setIsAddingUser(false);
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

  return (
    <div className="flex flex-col h-full bg-[#E8E8E8] dark:bg-black dark:bg-opacity-50">
      <div className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 px-4 py-3 bg-white dark:bg-[#111]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-[#00FB75]" />
            <span className="font-medium">Users</span>
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
              placeholder="Search users..."
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border dark:bg-[#121212] bg-white dark:border-[#1A1A1A] border-gray-200 focus:border-[#00FB75] focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={adminOnly}
              onChange={(e) => setAdminOnly(e.target.checked)}
              className="w-4 h-4 rounded text-[#00FB75]"
            />
            <span className="dark:text-gray-400 text-gray-600">Admins only</span>
          </label>
        </div>
        <div className="absolute top-3 right-4">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-2 px-3 py-1.5 bg-[#00FB75] hover:bg-[#00e56a] text-black text-sm font-medium rounded-lg transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-4">
          <div className="rounded-lg border dark:bg-[#121212] bg-white p-3">
            <Users className="w-4 h-4 text-blue-500 mb-1" />
            <div className="text-lg font-bold">{stats.total}</div>
            <div className="text-xs dark:text-gray-400 text-gray-600">Total</div>
          </div>
          <div className="rounded-lg border dark:bg-[#121212] bg-white p-3">
            <Shield className="w-4 h-4 text-purple-500 mb-1" />
            <div className="text-lg font-bold">{stats.admin}</div>
            <div className="text-xs dark:text-gray-400 text-gray-600">Admins</div>
          </div>
          <div className="rounded-lg border dark:bg-[#121212] bg-white p-3">
            <User className="w-4 h-4 text-green-500 mb-1" />
            <div className="text-lg font-bold">{stats.regular}</div>
            <div className="text-xs dark:text-gray-400 text-gray-600">Regular</div>
          </div>
          <div className="rounded-lg border dark:bg-[#121212] bg-white p-3">
            <Calendar className="w-4 h-4 text-orange-500 mb-1" />
            <div className="text-lg font-bold">{stats.new_7d}</div>
            <div className="text-xs dark:text-gray-400 text-gray-600">New (7d)</div>
          </div>
          <div className="rounded-lg border dark:bg-[#121212] bg-white p-3">
            <User className="w-4 h-4 text-cyan-500 mb-1" />
            <div className="text-lg font-bold">{stats.total_profiles}</div>
            <div className="text-xs dark:text-gray-400 text-gray-600">Profiles</div>
          </div>
          <div className="rounded-lg border dark:bg-[#121212] bg-white p-3">
            <Users className="w-4 h-4 text-pink-500 mb-1" />
            <div className="text-lg font-bold">{stats.active_sessions}</div>
            <div className="text-xs dark:text-gray-400 text-gray-600">Sessions</div>
          </div>
        </div>

        <div className="rounded-lg border dark:bg-[#121212] bg-white overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 mx-auto mb-3 text-[#00FB75] animate-spin" />
              <p className="text-sm dark:text-gray-400 text-gray-600">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm dark:text-gray-400 text-gray-600">No users found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b dark:border-[#1A1A1A] border-gray-200">
                      <th className="px-4 py-2 text-left text-xs font-medium dark:text-gray-400 text-gray-600">User</th>
                      <th
                        className="px-4 py-2 text-left text-xs font-medium dark:text-gray-400 text-gray-600 cursor-pointer hover:dark:text-white text-gray-900"
                        onClick={() => handleSort('created_at')}
                      >
                        <div className="flex items-center gap-1">
                          Created
                          {sortBy === 'created_at' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                        </div>
                      </th>
                      <th
                        className="px-4 py-2 text-left text-xs font-medium dark:text-gray-400 text-gray-600 cursor-pointer hover:dark:text-white text-gray-900"
                        onClick={() => handleSort('last_activity')}
                      >
                        <div className="flex items-center gap-1">
                          Activity
                          {sortBy === 'last_activity' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                        </div>
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium dark:text-gray-400 text-gray-600">Profiles</th>
                      <th className="px-4 py-2 text-left text-xs font-medium dark:text-gray-400 text-gray-600">Sessions</th>
                      <th className="px-4 py-2 text-left text-xs font-medium dark:text-gray-400 text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr
                        key={user.id}
                        className="border-b dark:border-[#1A1A1A] border-gray-100 hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-sm">{user.username}</div>
                            {user.is_admin && <Shield className="w-3.5 h-3.5 text-purple-500" />}
                          </div>
                          <div className="text-xs dark:text-gray-400 text-gray-600">{user.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs">
                            {new Date(user.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs">
                            {user.last_activity ? new Date(user.last_activity).toLocaleDateString() : 'Never'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs">{user.profile_count}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs">{user.session_count}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => router.push(`/admin/users/${user.id}`)}
                              className="p-1.5 rounded hover:bg-slate-100 transition-colors"
                              title="View Details"
                            >
                              <User className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleAdmin(user.id, user.is_admin, user.username)}
                              className="p-1.5 rounded hover:bg-slate-100 transition-colors"
                              title={user.is_admin ? 'Revoke Admin' : 'Grant Admin'}
                            >
                              <Shield className={`w-3.5 h-3.5 ${user.is_admin ? 'text-purple-500' : 'text-gray-500'}`} />
                            </button>
                            <button
                              onClick={() => handleDelete(user.id, user.username)}
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
                      className={`p-1.5 rounded transition-colors ${currentPage === 1 ? 'opacity-30' : 'hover:bg-[#2A2A2A]'
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
                      className={`p-1.5 rounded transition-colors ${currentPage === totalPages ? 'opacity-30' : 'hover:bg-[#2A2A2A]'
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

      {/* Add User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#111] rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-gray-900">Add New User</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                  required
                  placeholder="name@company.com"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={newUser.first_name}
                    onChange={e => setNewUser({ ...newUser, first_name: e.target.value })}
                    placeholder="John"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-white text-gray-900 placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={newUser.last_name}
                    onChange={e => setNewUser({ ...newUser, last_name: e.target.value })}
                    placeholder="Doe"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-white text-gray-900 placeholder:text-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Profile Type</label>
                <div className="relative">
                  <select
                    value={newUser.profile_type}
                    onChange={e => setNewUser({ ...newUser, profile_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors appearance-none bg-white text-gray-900"
                  >
                    <option value="Standard User">Standard User</option>
                    <option value="Judge">Judge</option>
                    <option value="Participant">Participant</option>
                    <option value="Partner">Partner</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-gray-100">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-900">Administrator Access</span>
                  <span className="text-xs text-gray-500">Grant full access to the admin dashboard</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newUser.is_admin}
                    onChange={e => setNewUser({ ...newUser, is_admin: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingUser}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {isAddingUser ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create User'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
