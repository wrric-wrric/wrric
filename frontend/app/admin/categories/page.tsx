"use client";

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  Tag,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  AlertCircle
} from 'lucide-react';
import { EventCategory } from '@/types/events';
import toast from 'react-hot-toast';

export default function CategoriesPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const router = useRouter();

  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<EventCategory | null>(null);
  const [newCategory, setNewCategory] = useState({
    name: '',
    color_code: '#00FB75',
    description: '',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/admin/categories');
      if (!response.ok) throw new Error('Failed to fetch categories');

      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategory.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    try {
      const response = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newCategory),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create category');
      }

      toast.success('Category created successfully');
      setNewCategory({ name: '', color_code: '#00FB75', description: '' });
      setShowCreateForm(false);
      fetchCategories();
    } catch (error: any) {
      console.error('Create category error:', error);
      toast.error(error.message || 'Failed to create category');
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !editingCategory.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    try {
      const response = await fetch(`/api/admin/categories/${editingCategory.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editingCategory.name,
          color_code: editingCategory.color_code,
          description: editingCategory.description,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update category');
      }

      toast.success('Category updated successfully');
      setEditingCategory(null);
      fetchCategories();
    } catch (error: any) {
      console.error('Update category error:', error);
      toast.error(error.message || 'Failed to update category');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category? Events using this category will be unaffected.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/categories/${categoryId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete category');
      }

      toast.success('Category deleted successfully');
      fetchCategories();
    } catch (error: any) {
      console.error('Delete category error:', error);
      toast.error(error.message || 'Failed to delete category');
    }
  };

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    category.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 border-b border-slate-200 px-4 py-3 bg-white">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Tag className="w-4 h-4 text-[#00FB75]" />
            <span className="font-medium">Categories</span>
            <span className="text-gray-500">/</span>
            <span className="dark:text-gray-400 text-gray-600">List</span>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Category
          </button>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 opacity-50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search categories..."
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border dark:bg-[#121212] bg-white dark:border-[#1A1A1A] border-gray-200 focus:border-[#00FB75] focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {loading ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 dark:bg-[#121212] bg-white rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="rounded-lg border dark:bg-[#121212] bg-white p-8 text-center">
            <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm dark:text-gray-400 text-gray-600">
              {searchQuery ? 'No categories found' : 'Create your first category'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filteredCategories.map((category) => (
              <div
                key={category.id}
                className="rounded-lg border dark:bg-[#121212] bg-white p-4 hover:border-[#00FB75]/50 transition-colors"
                style={{
                  borderLeftWidth: '3px',
                  borderLeftColor: category.color_code,
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold">{category.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: category.color_code }}
                      />
                      <span className="text-xs font-mono dark:text-gray-400 text-gray-600">{category.color_code}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditingCategory(category)}
                      className="p-1.5 rounded hover:bg-slate-100 transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      className="p-1.5 rounded hover:bg-red-500/20 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                </div>

                {category.description && (
                  <p className="text-xs dark:text-gray-400 text-gray-600 line-clamp-2 mb-3">
                    {category.description}
                  </p>
                )}

                <div className="flex items-center justify-between pt-3 border-t dark:border-[#1A1A1A] border-gray-200">
                  <span className="text-xs dark:text-gray-400 text-gray-600">{category.event_count || 0} events</span>
                  <span className="text-xs text-gray-500">
                    {new Date(category.updated_at || category.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="rounded-xl p-6 w-full max-w-md dark:bg-[#121212] bg-white border dark:border-[#1A1A1A] border-gray-200">
            <h3 className="text-lg font-bold mb-4">New Category</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1.5">Name *</label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border dark:bg-[#0A0A0A] bg-gray-50 dark:border-[#1A1A1A] border-gray-200 focus:border-[#00FB75] focus:outline-none"
                  placeholder="Category name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5">Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newCategory.color_code}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, color_code: e.target.value }))}
                    className="w-10 h-10 cursor-pointer rounded-lg border dark:border-[#1A1A1A] border-gray-200"
                  />
                  <input
                    type="text"
                    value={newCategory.color_code}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, color_code: e.target.value }))}
                    className="flex-1 px-3 py-2 text-sm rounded-lg border dark:bg-[#0A0A0A] bg-gray-50 dark:border-[#1A1A1A] border-gray-200 focus:border-[#00FB75] focus:outline-none"
                    placeholder="#00FB75"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5">Description</label>
                <textarea
                  value={newCategory.description}
                  onChange={(e) => setNewCategory(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-lg border dark:bg-[#0A0A0A] bg-gray-50 dark:border-[#1A1A1A] border-gray-200 focus:border-[#00FB75] focus:outline-none resize-none"
                  placeholder="Optional description"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowCreateForm(false)}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCategory}
                className="flex-1 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="rounded-xl p-6 w-full max-w-md dark:bg-[#121212] bg-white border dark:border-[#1A1A1A] border-gray-200">
            <h3 className="text-lg font-bold mb-4">Edit Category</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1.5">Name *</label>
                <input
                  type="text"
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="w-full px-3 py-2 text-sm rounded-lg border dark:bg-[#0A0A0A] bg-gray-50 dark:border-[#1A1A1A] border-gray-200 focus:border-[#00FB75] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5">Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={editingCategory.color_code}
                    onChange={(e) => setEditingCategory(prev => prev ? { ...prev, color_code: e.target.value } : null)}
                    className="w-10 h-10 cursor-pointer rounded-lg border dark:border-[#1A1A1A] border-gray-200"
                  />
                  <input
                    type="text"
                    value={editingCategory.color_code}
                    onChange={(e) => setEditingCategory(prev => prev ? { ...prev, color_code: e.target.value } : null)}
                    className="flex-1 px-3 py-2 text-sm rounded-lg border dark:bg-[#0A0A0A] bg-gray-50 dark:border-[#1A1A1A] border-gray-200 focus:border-[#00FB75] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5">Description</label>
                <textarea
                  value={editingCategory.description || ''}
                  onChange={(e) => setEditingCategory(prev => prev ? { ...prev, description: e.target.value } : null)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-lg border dark:bg-[#0A0A0A] bg-gray-50 dark:border-[#1A1A1A] border-gray-200 focus:border-[#00FB75] focus:outline-none resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setEditingCategory(null)}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateCategory}
                className="flex-1 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}