"use client";

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  User,
  Shield,
  Calendar,
  Edit,
  Trash2,
  Loader2,
  Users as UsersIcon,
  Activity,
  Key,
  CheckCircle,
  XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Profile {
  id: string;
  display_name: string;
  type: string;
  organization: string;
  created_at: string;
}

interface Session {
  id: string;
  title: string;
  status: string;
  start_time: string;
  query_count: number;
}

interface UserDetails {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
  profile_image_url?: string;
  created_at: string;
  updated_at: string;
  profiles: Profile[];
  recent_sessions: Session[];
  password_reset_count: number;
  last_password_reset: string;
}

export default function UserDetailPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserDetails | null>(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ username: '', is_admin: false });

  const fetchUser = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}`);
      if (!response.ok) {
        throw new Error('User not found');
      }
      const data = await response.json();
      setUser(data);
      setEditData({ username: data.username, is_admin: data.is_admin });
    } catch (error) {
      console.error('Failed to fetch user:', error);
      toast.error('Failed to load user details');
      router.push('/admin/users');
    } finally {
      setLoading(false);
    }
  }, [userId, router]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      });

      if (response.ok) {
        toast.success('User updated successfully');
        setEditing(false);
        fetchUser();
      } else {
        throw new Error('Failed to update user');
      }
    } catch (error) {
      toast.error('Failed to update user');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete user "${user?.username}"?`)) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('User deleted successfully');
        router.push('/admin/users');
      } else {
        throw new Error('Failed to delete user');
      }
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="sticky top-0 z-10 border-b px-4 py-3 dark:bg-[#0A0A0A] bg-white/95 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-[#00FB75]" />
            <span className="font-medium">Users</span>
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

  if (!user) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 border-b px-4 py-3 dark:bg-[#0A0A0A] bg-white/95 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-[#00FB75]" />
            <span className="font-medium">Users</span>
            <span className="text-gray-500">/</span>
            <span className="dark:text-gray-400 text-gray-600">{user.username}</span>
          </div>
          <div className="flex items-center gap-2">
            {user.is_admin && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Admin
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={() => router.push('/admin/users')}
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
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  isDark ? 'bg-gray-800' : 'bg-gray-100'
                }`}>
                  {user.profile_image_url ? (
                    <img
                      src={user.profile_image_url}
                      alt={user.username}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <User className="w-6 h-6 opacity-40" />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-bold">{user.username}</h2>
                  <div className="text-xs dark:text-gray-400 text-gray-600">{user.email}</div>
                </div>
              </div>
              <div className="space-y-2 pt-4 border-t dark:border-[#1A1A1A] border-gray-200">
                <div className="flex items-center gap-2 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-gray-500" />
                  <span>Joined {new Date(user.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Key className="w-3.5 h-3.5 text-gray-500" />
                  <span>{user.password_reset_count} password resets</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t dark:border-[#1A1A1A] border-gray-200">
                <div className="text-center p-2 dark:bg-[#0A0A0A] bg-gray-50 rounded">
                  <div className="text-lg font-bold">{user.profiles.length}</div>
                  <div className="text-xs dark:text-gray-400 text-gray-600">Profiles</div>
                </div>
                <div className="text-center p-2 dark:bg-[#0A0A0A] bg-gray-50 rounded">
                  <div className="text-lg font-bold">{user.recent_sessions.length}</div>
                  <div className="text-xs dark:text-gray-400 text-gray-600">Sessions</div>
                </div>
              </div>
            </div>

            {editing && (
              <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
                <h3 className="text-sm font-bold mb-3">Edit User</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Username</label>
                    <input
                      type="text"
                      value={editData.username}
                      onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm rounded-lg border dark:bg-[#0A0A0A] bg-gray-50 dark:border-[#1A1A1A] border-gray-200 focus:border-[#00FB75] focus:outline-none"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editData.is_admin}
                      onChange={(e) => setEditData({ ...editData, is_admin: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span>Grant Admin Privileges</span>
                  </label>
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
            <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <UsersIcon className="w-4 h-4 text-blue-500" />
                Profiles ({user.profiles.length})
              </h3>
              {user.profiles.length === 0 ? (
                <div className="text-xs text-gray-500 text-center py-4">No profiles created</div>
              ) : (
                <div className="space-y-2">
                  {user.profiles.map((profile) => (
                    <div key={profile.id} className="flex items-center justify-between p-2 rounded dark:bg-[#0A0A0A] bg-gray-50">
                      <div>
                        <div className="text-xs font-medium">{profile.display_name}</div>
                        <div className="text-[10px] dark:text-gray-400 text-gray-600 capitalize">{profile.type} • {profile.organization}</div>
                      </div>
                      <span className="text-[10px] text-gray-500">
                        {new Date(profile.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-500" />
                Recent Sessions ({user.recent_sessions.length})
              </h3>
              {user.recent_sessions.length === 0 ? (
                <div className="text-xs text-gray-500 text-center py-4">No recent sessions</div>
              ) : (
                <div className="space-y-2">
                  {user.recent_sessions.map((session) => (
                    <div key={session.id} className="flex items-center justify-between p-2 rounded dark:bg-[#0A0A0A] bg-gray-50">
                      <div>
                        <div className="text-xs font-medium">{session.title}</div>
                        <div className="flex items-center gap-2 text-[10px] mt-0.5">
                          <span className={session.status === 'running' ? 'text-green-400' : 'text-gray-500'}>
                            {session.status === 'running' ? <CheckCircle className="w-3 h-3 inline" /> : <XCircle className="w-3 h-3 inline" />}
                            {session.status}
                          </span>
                          <span className="text-gray-500">•</span>
                          <span className="dark:text-gray-400 text-gray-600">{session.query_count} queries</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-500">
                        {new Date(session.start_time).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
