"use client";

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import {
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Clock,
  XCircle,
  CheckCircle,
  RefreshCw,
  Trash2,
  Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ImportedUser {
  id: string;
  email: string;
  full_name: string;
  profile_type: string;
  invitation_status: 'pending' | 'accepted' | 'declined' | 'expired';
  invitation_sent_at: string;
  invitation_responded_at: string | null;
  import_batch_id: string;
}

interface BulkUsersResponse {
  users: ImportedUser[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export default function ImportedUsersPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const router = useRouter();

  const [users, setUsers] = useState<ImportedUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    search: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchUsers();
  }, [currentPage, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        page_size: '20',
        ...(filters.status && { status_filter: filters.status }),
        ...(filters.search && { search: filters.search })
      });

      const response = await fetch(`/api/admin/users/bulk-imported?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: BulkUsersResponse = await response.json();
      setUsers(data.users);
      setTotalPages(data.total_pages);
      setTotal(data.total);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error('Failed to load imported users');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedUsers.length === 0) {
      toast.error('No users selected');
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch('/api/admin/users/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_ids: selectedUsers,
          action
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        toast.success(`${action} ${result.updated_count || selectedUsers.length} users successfully`);
        setSelectedUsers([]);
        fetchUsers();
      } else {
        throw new Error(result.detail || 'Action failed');
      }
    } catch (error) {
      console.error('Bulk action failed:', error);
      toast.error(`Failed to ${action} users`);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'bg-green-500/20 text-green-400';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'declined':
        return 'bg-red-500/20 text-red-400';
      case 'expired':
        return 'bg-gray-500/20 dark:text-gray-400 text-gray-600';
      default:
        return 'bg-gray-500/20 dark:text-gray-400 text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle className="w-3.5 h-3.5" />;
      case 'pending':
        return <Clock className="w-3.5 h-3.5" />;
      case 'declined':
        return <XCircle className="w-3.5 h-3.5" />;
      case 'expired':
        return <Clock className="w-3.5 h-3.5" />;
      default:
        return <Clock className="w-3.5 h-3.5" />;
    }
  };

  const toggleSelectUser = (id: string) => {
    setSelectedUsers(prev =>
      prev.includes(id)
        ? prev.filter(userId => userId !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map(user => user.id));
    }
  };

  const handleIndividualAction = async (action: string, userId: string) => {
    setSelectedUsers([userId]);
    await handleBulkAction(action);
  };

  const getIndividualActions = (user: ImportedUser) => {
    const actions = [];
    
    if (user.invitation_status === 'expired') {
      actions.push({
        label: 'Retry',
        action: () => handleIndividualAction('retry', user.id),
        className: 'text-yellow-400 hover:bg-yellow-500/20'
      });
    }
    
    if (user.invitation_status === 'pending') {
      actions.push({
        label: 'Force Accept',
        action: () => handleIndividualAction('accept', user.id),
        className: 'text-green-400 hover:bg-green-500/20'
      });
    }
    
    actions.push({
      label: 'Delete',
      action: () => handleIndividualAction('delete', user.id),
      className: 'text-red-400 hover:bg-red-500/20'
    });

    return actions;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 border-b px-4 py-3 dark:bg-[#0A0A0A] bg-white/95 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-[#00FB75]" />
            <span className="font-medium">Imported Users</span>
            <span className="text-gray-500">/</span>
            <span className="dark:text-gray-400 text-gray-600">Management</span>
          </div>
          <button
            onClick={fetchUsers}
            className="p-1.5 rounded-lg border dark:border-[#1A1A1A] border-gray-200 hover:border-[#00FB75]/50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex items-center gap-3 mt-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 opacity-50" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              placeholder="Search users..."
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border dark:bg-[#121212] bg-white dark:border-[#1A1A1A] border-gray-200 focus:border-[#00FB75] focus:outline-none"
            />
          </div>
          
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="px-3 py-1.5 text-sm rounded-lg border dark:bg-[#121212] bg-white dark:border-[#1A1A1A] border-gray-200 focus:border-[#00FB75] focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {selectedUsers.length > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 mx-4 mt-4">
          <div className="flex items-center gap-2 text-sm">
            <UserCheck className="w-4 h-4 text-blue-500" />
            <span>{selectedUsers.length} selected</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleBulkAction('retry')}
              disabled={actionLoading}
              className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded hover:bg-yellow-500/30 transition-colors disabled:opacity-50"
            >
              Retry
            </button>
            <button
              onClick={() => handleBulkAction('accept')}
              disabled={actionLoading}
              className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors disabled:opacity-50"
            >
              Force Accept
            </button>
            <button
              onClick={() => handleBulkAction('decline')}
              disabled={actionLoading}
              className="px-2 py-1 text-xs bg-orange-500/20 text-orange-400 rounded hover:bg-orange-500/30 transition-colors disabled:opacity-50"
            >
              Force Decline
            </button>
            <button
              onClick={() => handleBulkAction('delete')}
              disabled={actionLoading}
              className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors disabled:opacity-50"
            >
              Delete
            </button>
            <button
              onClick={() => setSelectedUsers([])}
              className="px-2 py-1 text-xs bg-[#1A1A1A] rounded hover:bg-[#2A2A2A] transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 p-4 overflow-y-auto">
        <div className="rounded-lg border dark:bg-[#121212] bg-white overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 mx-auto mb-3 text-[#00FB75] animate-spin" />
              <p className="text-sm dark:text-gray-400 text-gray-600">Loading imported users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm dark:text-gray-400 text-gray-600">No imported users found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b dark:border-[#1A1A1A] border-gray-200">
                      <th className="px-4 py-2 text-left">
                        <input
                          type="checkbox"
                          checked={selectedUsers.length === users.length && users.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded"
                        />
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium dark:text-gray-400 text-gray-600">User</th>
                      <th className="px-4 py-2 text-left text-xs font-medium dark:text-gray-400 text-gray-600">Profile Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium dark:text-gray-400 text-gray-600">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium dark:text-gray-400 text-gray-600">Invitation Sent</th>
                      <th className="px-4 py-2 text-left text-xs font-medium dark:text-gray-400 text-gray-600">Responded</th>
                      <th className="px-4 py-2 text-left text-xs font-medium dark:text-gray-400 text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr
                        key={user.id}
                        className="border-b dark:border-[#1A1A1A] border-gray-200 hover:bg-[#1A1A1A]/50"
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedUsers.includes(user.id)}
                            onChange={() => toggleSelectUser(user.id)}
                            className="w-4 h-4 rounded"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium">{user.full_name}</div>
                          <div className="text-xs dark:text-gray-400 text-gray-600">{user.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs capitalize">{user.profile_type}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-xs px-1.5 py-0.5 rounded ${getStatusColor(user.invitation_status)}`}>
                            {getStatusIcon(user.invitation_status)}
                            {user.invitation_status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs">
                            {new Date(user.invitation_sent_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs">
                            {user.invitation_responded_at 
                              ? new Date(user.invitation_responded_at).toLocaleDateString()
                              : '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {getIndividualActions(user).map((action, index) => (
                              <button
                                key={index}
                                onClick={action.action}
                                className="p-1.5 rounded transition-colors text-xs"
                                title={action.label}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ))}
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
                    Page {currentPage} of {totalPages} ({total} total)
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className={`p-1.5 rounded transition-colors ${
                        currentPage === 1 ? 'opacity-30' : 'hover:bg-[#2A2A2A]'
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
                          className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                            currentPage === pageNum
                              ? 'bg-[#00FB75] text-black'
                              : 'hover:bg-[#2A2A2A]'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className={`p-1.5 rounded transition-colors ${
                        currentPage === totalPages ? 'opacity-30' : 'hover:bg-[#2A2A2A]'
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