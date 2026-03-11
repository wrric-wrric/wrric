"use client";

import { useState } from 'react';
import { useTheme } from 'next-themes';
import {
  Users,
  Upload,
  FileText,
  TrendingUp,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function BulkImportPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [currentView, setCurrentView] = useState<'upload' | 'users' | 'analytics'>('upload');

  const handleImportStart = () => {
    toast.success('Navigate to Imported Users page');
    setCurrentView('users');
  };

  const handleImportComplete = (result: { success: boolean; message: string }) => {
    toast.success(result.message);
  };

  const views = [
    {
      id: 'upload' as const,
      label: 'Upload CSV',
      icon: Upload,
      description: 'Upload and validate CSV files for bulk user import'
    },
    {
      id: 'users' as const,
      label: 'Manage Users',
      icon: Users,
      description: 'View and manage imported users with invitation tracking'
    },
    {
      id: 'analytics' as const,
      label: 'Import Analytics',
      icon: TrendingUp,
      description: 'View import statistics and performance metrics'
    }
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b px-4 py-3 bg-[#0A0A0A]/95 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Upload className="w-5 h-5 text-[#00FB75]" />
            <span className="font-medium">Bulk User Import</span>
          </div>
        </div>

        {/* View Navigation */}
        <div className="flex items-center gap-1 mt-3">
          {views.map((view, index) => {
            const Icon = view.icon;
            const isActive = currentView === view.id;
            
            return (
              <div key={view.id} className="flex items-center">
                {index > 0 && (
                  <ArrowRight className="w-3 h-3 text-gray-500" />
                )}
                <button
                  onClick={() => setCurrentView(view.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all ${
                    isActive
                      ? 'bg-[#00FB75] text-black'
                      : 'text-gray-400 hover:text-white hover:bg-[#1A1A1A]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{view.label}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {currentView === 'upload' && (
          <div className="h-full overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto">
              <div className="text-center py-8">
                <Upload className="w-16 h-16 mx-auto text-[#00FB75]" />
                <h2 className="text-2xl font-bold text-gray-300 mb-4">Enhanced CSV Import</h2>
                <p className="text-lg text-gray-400 mb-8">
                  Advanced CSV validation and bulk user import functionality
                </p>
                <p className="text-gray-500">
                  Navigate to &quot;Manage Users&quot; to access the full import interface
                </p>
              </div>
            </div>
          </div>
        )}

        {currentView === 'users' && (
          <div className="h-full">
            <iframe
              src="/admin/imported-users"
              className="w-full h-full border-0"
              title="Imported Users Management"
            />
          </div>
        )}

        {currentView === 'analytics' && (
          <div className="h-full">
            <iframe
              src="/admin/import-analytics"
              className="w-full h-full border-0"
              title="Import Analytics Dashboard"
            />
          </div>
        )}
      </div>
    </div>
  );
}