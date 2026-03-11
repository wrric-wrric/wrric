"use client";

import { useRouter } from 'next/navigation';
import BulkImportEnhanced from '@/components/admin/BulkImportEnhanced';
import toast from 'react-hot-toast';

export default function BulkImportManagementPage() {
  const router = useRouter();

  const handleImportStart = () => {
    console.log('Import started');
  };

  const handleImportComplete = (result: { success: boolean; message: string; batchId?: string }) => {
    if (result.success) {
      toast.success(result.message);
      // Redirect to imported users page after successful import
      setTimeout(() => {
        router.push('/admin/imported-users');
      }, 1500);
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <BulkImportEnhanced
        onImportStart={handleImportStart}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
}