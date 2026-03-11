"use client";

import { useState } from 'react';
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

// Type Definitions
interface CSVFieldMapping {
  [csvField: string]: {
    db_field: string;
    field_type: string;
    required: boolean;
    csv_index: number;
  };
}

interface CSVValidationResult {
  is_valid: boolean;
  field_mapping: CSVFieldMapping;
  missing_required: string[];
  template_info: {
    required_fields: Array<{ csv_name: string; db_field: string; required: boolean }>;
    optional_fields: Array<{ csv_name: string; db_field: string; required: boolean }>;
    examples: Array<{ template_name: string; fields: string[] }>;
  };
  sample_rows: Array<{ [key: string]: string }>;
}

interface ImportErrorBreakdown {
  validation_errors: string[];
  duplicate_users: string[];
  other_errors: string[];
}

interface BulkImportResult {
  success: boolean;
  message: string;
  created_users: number;
  skipped_users: number;
  errors: string[];
  batch_id?: string;
  details?: {
    total_rows_processed: number;
    batch_id: string;
    has_errors: boolean;
    error_count: number;
    error_breakdown: ImportErrorBreakdown;
    summary: {
      success_rate: number;
      skip_rate: number;
    };
  };
}

interface BulkImportEnhancedProps {
  onImportStart?: () => void;
  onImportComplete?: (result: { success: boolean; message: string; batchId?: string }) => void;
}

export default function BulkImportEnhanced({ onImportStart, onImportComplete }: BulkImportEnhancedProps) {
  // State Management
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [validating, setValidating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationResult, setValidationResult] = useState<CSVValidationResult | null>(null);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [expandedErrorCategory, setExpandedErrorCategory] = useState<string | null>(null);

  // Drag and Drop Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  // File Upload and Validation
  const handleFileUpload = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    setSelectedFile(file);
    validateCSV(file);
  };

  const validateCSV = async (file: File) => {
    setValidating(true);
    setValidationResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/users/validate-csv', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Validation failed');
      }

      const result: CSVValidationResult = await response.json();
      setValidationResult(result);

      if (result.is_valid) {
        toast.success('CSV file validated successfully!');
      } else {
        toast.error(`Validation failed: ${result.missing_required.length} required fields missing`);
      }
    } catch (error) {
      console.error('Validation error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to validate CSV');
      setValidationResult(null);
    } finally {
      setValidating(false);
    }
  };

  // Import CSV
  const handleImport = async () => {
    if (!selectedFile || !validationResult?.is_valid) {
      toast.error('Please upload and validate a CSV file first');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    onImportStart?.();

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const xhr = new XMLHttpRequest();

      // Progress tracking
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(progress);
        }
      });

      // Success/Error handling
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const response: BulkImportResult = JSON.parse(xhr.responseText);
          setImportResult(response);

          // Show detailed results
          if (response.created_users > 0) {
            toast.success(`Successfully imported ${response.created_users} users!`);
          }

          if (response.errors && response.errors.length > 0) {
            toast.error(`${response.errors.length} issue(s) found. Check details below.`, {
              duration: 5000
            });
          }

          // Only redirect if successful and no errors
          if (response.created_users > 0 && (!response.errors || response.errors.length === 0)) {
            onImportComplete?.({
              success: true,
              message: `Imported ${response.created_users} users`,
              batchId: response.batch_id || response.details?.batch_id
            });
          }
        } else {
          const error = JSON.parse(xhr.responseText);
          toast.error(error.detail || 'Import failed');
          onImportComplete?.({
            success: false,
            message: error.detail || 'Import failed'
          });
        }
        setUploading(false);
      });

      xhr.addEventListener('error', () => {
        toast.error('Network error during import');
        onImportComplete?.({
          success: false,
          message: 'Network error'
        });
        setUploading(false);
      });

      const token = localStorage.getItem('token');
      xhr.open('POST', '/api/admin/users/bulk-import');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);

    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import users');
      onImportComplete?.({
        success: false,
        message: 'Import failed'
      });
      setUploading(false);
    }
  };

  // Template Download
  const downloadTemplate = (templateType: string) => {
    const templates: { [key: string]: { filename: string; headers: string; sample: string } } = {
      standard: {
        filename: 'standard_template.csv',
        headers: 'email,full_name,profile_type',
        sample: 'user@example.com,John Doe,academic'
      },
      academic: {
        filename: 'academic_template.csv',
        headers: 'email,first_name,last_name,university,department,major,specialization',
        sample: 'john.doe@university.edu,John,Doe,State University,Computer Science,Artificial Intelligence,Machine Learning'
      },
      simple: {
        filename: 'simple_template.csv',
        headers: 'Email,Name,Phone,Occupation,Organization,Bio',
        sample: 'user@example.com,John Doe,555-123-4567,Researcher,Tech Institute,Climate tech researcher'
      }
    };

    const template = templates[templateType];
    if (!template) return;

    const csvContent = `${template.headers}\n${template.sample}`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = template.filename;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success(`Downloaded ${template.filename}`);
  };

  // Reset Form
  const resetForm = () => {
    setSelectedFile(null);
    setValidationResult(null);
    setImportResult(null);
    setUploadProgress(0);
    setExpandedErrorCategory(null);
  };

  // Export Errors to CSV
  const exportErrors = () => {
    if (!importResult?.errors || importResult.errors.length === 0) return;

    const csv = 'Row,Error\n' + importResult.errors.map(e => {
      const match = e.match(/Row (\d+): (.+)/);
      return match ? `${match[1]},"${match[2]}"` : `N/A,"${e}"`;
    }).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-errors-${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Error report downloaded');
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Bulk User Import</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Upload CSV files with intelligent validation and field mapping
          </p>
        </div>
        {selectedFile && (
          <button
            onClick={resetForm}
            className="px-4 py-2 text-sm border border-gray-600 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Clear & Start Over
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* File Upload Area */}
          <div className="bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#1A1A1A] rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#00FB75]" />
              Upload CSV File
            </h3>

            <div
              className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-all ${dragActive
                  ? 'border-[#00FB75] bg-[#00FB75]/5'
                  : selectedFile
                    ? 'border-green-500/30 bg-green-500/5'
                    : 'border-gray-300 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-600'
                }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={validating || uploading}
              />

              {validating ? (
                <div className="space-y-3">
                  <Loader2 className="w-12 h-12 mx-auto text-[#00FB75] animate-spin" />
                  <p className="text-sm font-medium">Validating CSV...</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Checking fields and data format</p>
                </div>
              ) : selectedFile ? (
                <div className="space-y-3">
                  <FileText className="w-12 h-12 mx-auto text-green-500" />
                  <div>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                  {validationResult && (
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${validationResult.is_valid
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                      }`}>
                      {validationResult.is_valid ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Validated
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4" />
                          Invalid
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className="w-12 h-12 mx-auto text-gray-500" />
                  <div>
                    <p className="font-medium">Drop CSV file here</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">or click to browse</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Validation Results */}
          {validationResult && (
            <div className="bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#1A1A1A] rounded-lg p-6 space-y-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                {validationResult.is_valid ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                )}
                Validation Results
              </h3>

              {/* Validation Errors */}
              {!validationResult.is_valid && validationResult.missing_required.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    Missing Required Fields
                  </h4>
                  <ul className="space-y-1">
                    {validationResult.missing_required.map((field, index) => (
                      <li key={index} className="text-sm text-red-300">• {field}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Field Mapping Table */}
              {validationResult.is_valid && validationResult.field_mapping && (
                <div>
                  <h4 className="text-sm font-semibold mb-3">Detected Field Mapping</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-[#1A1A1A]">
                          <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-400">CSV Column</th>
                          <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-400">Maps To</th>
                          <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-400">Type</th>
                          <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-400">Required</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(validationResult.field_mapping).map(([csvField, mapping]) => (
                          <tr key={csvField} className="border-t border-gray-800">
                            <td className="px-4 py-2 font-mono text-xs">{csvField}</td>
                            <td className="px-4 py-2">{mapping.db_field}</td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-0.5 rounded text-xs ${mapping.field_type === 'user'
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : 'bg-green-500/20 text-green-400'
                                }`}>
                                {mapping.field_type}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              {mapping.required ? (
                                <span className="text-orange-400">Yes</span>
                              ) : (
                                <span className="text-gray-500">No</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sample Data Preview */}
              {validationResult.is_valid && validationResult.sample_rows && validationResult.sample_rows.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-3">Sample Data (First 3 Rows)</h4>
                  <div className="space-y-2">
                    {validationResult.sample_rows.slice(0, 3).map((row, index) => (
                      <div key={index} className="bg-gray-50 dark:bg-[#1A1A1A] rounded-lg p-3">
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Row {index + 1}</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          {Object.entries(row).map(([key, value]) => (
                            <div key={key}>
                              <span className="text-gray-500">{key}:</span>{' '}
                              <span className="text-gray-700 dark:text-gray-300">{value || '(empty)'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Import Button */}
              {validationResult.is_valid && (
                <button
                  onClick={handleImport}
                  disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#00FB75] text-black rounded-lg hover:bg-green-400 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Importing... {uploadProgress}%
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      Import Users
                    </>
                  )}
                </button>
              )}

              {/* Progress Bar */}
              {uploading && (
                <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-[#00FB75] h-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Import Results with Error Details */}
          {importResult && (
            <div className="bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#1A1A1A] rounded-lg p-6 space-y-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                {importResult.created_users > 0 ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-orange-500" />
                )}
                Import Complete
              </h3>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-green-400">{importResult.created_users}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Imported</div>
                </div>
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-orange-400">{importResult.skipped_users}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Skipped</div>
                </div>
              </div>

              {/* Progress Visualization */}
              {importResult.details && (
                <div className="space-y-2">
                  <div className="h-8 bg-gray-800 rounded-full overflow-hidden flex">
                    <div
                      className="bg-green-500 flex items-center justify-center text-xs font-bold text-white"
                      style={{ width: `${importResult.details.summary.success_rate}%` }}
                    >
                      {importResult.details.summary.success_rate > 10 &&
                        `${importResult.details.summary.success_rate.toFixed(0)}%`
                      }
                    </div>
                    <div
                      className="bg-orange-500 flex items-center justify-center text-xs font-bold text-white"
                      style={{ width: `${importResult.details.summary.skip_rate}%` }}
                    >
                      {importResult.details.summary.skip_rate > 10 &&
                        `${importResult.details.summary.skip_rate.toFixed(0)}%`
                      }
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 text-center">
                    Batch ID: {importResult.details.batch_id}
                  </div>
                </div>
              )}

              {/* Error Categories */}
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2 text-orange-400">
                    <AlertCircle className="w-4 h-4" />
                    Issues Found ({importResult.errors.length})
                  </h4>

                  {/* Duplicate Users */}
                  {importResult.details?.error_breakdown.duplicate_users &&
                    importResult.details.error_breakdown.duplicate_users.length > 0 && (
                      <div className="border border-orange-500/30 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setExpandedErrorCategory(
                            expandedErrorCategory === 'duplicate' ? null : 'duplicate'
                          )}
                          className="w-full px-4 py-3 bg-orange-500/10 hover:bg-orange-500/20 transition-colors flex items-center justify-between"
                        >
                          <span className="font-medium flex items-center gap-2">
                            👥 Duplicate Users ({importResult.details.error_breakdown.duplicate_users.length})
                          </span>
                          <span>{expandedErrorCategory === 'duplicate' ? '▼' : '▶'}</span>
                        </button>
                        {expandedErrorCategory === 'duplicate' && (
                          <div className="p-4 bg-orange-500/5 space-y-3">
                            <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3 text-sm text-blue-300">
                              💡 These emails already exist. Delete existing users first or use different emails.
                            </div>
                            <ul className="space-y-1 text-sm">
                              {importResult.details.error_breakdown.duplicate_users.map((err, i) => (
                                <li key={i} className="text-gray-700 dark:text-gray-300">• {err}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                  {/* Validation Errors */}
                  {importResult.details?.error_breakdown.validation_errors &&
                    importResult.details.error_breakdown.validation_errors.length > 0 && (
                      <div className="border border-red-500/30 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setExpandedErrorCategory(
                            expandedErrorCategory === 'validation' ? null : 'validation'
                          )}
                          className="w-full px-4 py-3 bg-red-500/10 hover:bg-red-500/20 transition-colors flex items-center justify-between"
                        >
                          <span className="font-medium flex items-center gap-2">
                            ❌ Validation Errors ({importResult.details.error_breakdown.validation_errors.length})
                          </span>
                          <span>{expandedErrorCategory === 'validation' ? '▼' : '▶'}</span>
                        </button>
                        {expandedErrorCategory === 'validation' && (
                          <div className="p-4 bg-red-500/5 space-y-3">
                            <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3 text-sm text-blue-300">
                              💡 Fix these data issues in your CSV and try importing again.
                            </div>
                            <ul className="space-y-1 text-sm">
                              {importResult.details.error_breakdown.validation_errors.map((err, i) => (
                                <li key={i} className="text-gray-700 dark:text-gray-300">• {err}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                  {/* Other Errors */}
                  {importResult.details?.error_breakdown.other_errors &&
                    importResult.details.error_breakdown.other_errors.length > 0 && (
                      <div className="border border-gray-500/30 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setExpandedErrorCategory(
                            expandedErrorCategory === 'other' ? null : 'other'
                          )}
                          className="w-full px-4 py-3 bg-gray-500/10 hover:bg-gray-500/20 transition-colors flex items-center justify-between"
                        >
                          <span className="font-medium flex items-center gap-2">
                            ⚠️ Other Errors ({importResult.details.error_breakdown.other_errors.length})
                          </span>
                          <span>{expandedErrorCategory === 'other' ? '▼' : '▶'}</span>
                        </button>
                        {expandedErrorCategory === 'other' && (
                          <div className="p-4 bg-gray-500/5">
                            <ul className="space-y-1 text-sm">
                              {importResult.details.error_breakdown.other_errors.map((err, i) => (
                                <li key={i} className="text-gray-700 dark:text-gray-300">• {err}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                  {/* Export Errors Button */}
                  <button
                    onClick={exportErrors}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg transition-colors text-blue-300 font-medium"
                  >
                    <Download className="w-4 h-4" />
                    Export Error Report
                  </button>
                </div>
              )}

              {/* Action Button */}
              {importResult.created_users > 0 && (
                <button
                  onClick={() => {
                    onImportComplete?.({
                      success: true,
                      message: `Imported ${importResult.created_users} users`,
                      batchId: importResult.batch_id || importResult.details?.batch_id
                    });
                  }}
                  className="w-full px-6 py-3 bg-[#00FB75] text-black rounded-lg hover:bg-green-400 transition-colors font-semibold"
                >
                  View Imported Users
                </button>
              )}
            </div>
          )}
        </div>

        {/* Templates Sidebar */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#1A1A1A] rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Download className="w-5 h-5 text-[#00FB75]" />
              CSV Templates
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Download pre-formatted templates to get started
            </p>

            <div className="space-y-3">
              <button
                onClick={() => downloadTemplate('standard')}
                className="w-full p-4 text-left border border-gray-700 rounded-lg hover:border-[#00FB75] hover:bg-[#00FB75]/5 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium group-hover:text-[#00FB75]">Standard</p>
                    <p className="text-xs text-gray-500 mt-1">
                      email, full_name, profile_type
                    </p>
                  </div>
                  <Download className="w-4 h-4 text-gray-500 group-hover:text-[#00FB75]" />
                </div>
              </button>

              <button
                onClick={() => downloadTemplate('academic')}
                className="w-full p-4 text-left border border-gray-700 rounded-lg hover:border-[#00FB75] hover:bg-[#00FB75]/5 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium group-hover:text-[#00FB75]">Academic</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Full academic profile fields
                    </p>
                  </div>
                  <Download className="w-4 h-4 text-gray-500 group-hover:text-[#00FB75]" />
                </div>
              </button>

              <button
                onClick={() => downloadTemplate('simple')}
                className="w-full p-4 text-left border border-gray-700 rounded-lg hover:border-[#00FB75] hover:bg-[#00FB75]/5 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium group-hover:text-[#00FB75]">Simple</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Basic contact information
                    </p>
                  </div>
                  <Download className="w-4 h-4 text-gray-500 group-hover:text-[#00FB75]" />
                </div>
              </button>
            </div>
          </div>

          {/* Help Section */}
          <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg p-6">
            <h4 className="font-semibold mb-2 text-blue-400">Quick Guide</h4>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li>• Download a template to get started</li>
              <li>• Fill in user details in the CSV</li>
              <li>• Upload the file for validation</li>
              <li>• Review the field mapping</li>
              <li>• Click Import to add users</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
