"use client";

import React, { useState, useCallback } from 'react';
import { useTheme } from 'next-themes';
import {
  FileText,
  CheckCircle,
  XCircle,
  Upload,
  AlertCircle,
  User,
  Briefcase,
  GraduationCap,
  UserCheck,
  Loader2,
  Download,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

interface FieldMapping {
  [csvField: string]: {
    db_field: string;
    field_type: string;
    required: boolean;
    csv_index: number;
  };
}

interface ValidationResult {
  is_valid: boolean;
  field_mapping: FieldMapping;
  missing_required: string[];
  template_info: {
    required_fields: Array<{csv_name: string; db_field: string; required: boolean}>;
    optional_fields: Array<{csv_name: string; db_field: string; required: boolean}>;
    examples: Array<{template_name: string; fields: string[]}>;
  };
  sample_rows: Array<{[key: string]: string}>;
}

interface CSVValidatorProps {
  onValidationComplete: (result: ValidationResult) => void;
}

export default function CSVValidator({ onValidationComplete }: CSVValidatorProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const validateFile = useCallback(async () => {
    if (!file) return;

    setValidating(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/users/validate-csv', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Validation failed');
      }

      const validationResult: ValidationResult = await response.json();
      setResult(validationResult);
      onValidationComplete(validationResult);
    } catch (error) {
      console.error('Validation failed:', error);
      toast.error('Failed to validate CSV file');
    } finally {
      setValidating(false);
    }
  }, [file, onValidationComplete]);

  const getStatusColor = (valid: boolean) => {
    return valid ? 'bg-green-500' : 'bg-red-500';
  };

  const getFieldTypeIcon = (fieldType: string) => {
    switch (fieldType) {
      case 'user':
        return <User className="w-4 h-4 text-white" />;
      case 'profile':
        return <Briefcase className="w-4 h-4 text-white" />;
      default:
        return <FileText className="w-4 h-4 text-white" />;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const downloadTemplate = (templateName: string, fields: string[]) => {
    const headers = fields.join(',');
    const sampleRow = fields.map(() => 'Sample').join(',');
    const csvContent = `${headers}\n${sampleRow}`;
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${templateName.replace(/\s+/g, '_').toLowerCase()}_template.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 rounded-lg border bg-[#121212]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#00FB75]" />
          <h2 className="text-lg font-medium">CSV Template Validation</h2>
        </div>
        <button
          onClick={validateFile}
          disabled={!file || validating}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#00FB75] text-black rounded-lg hover:bg-green-400 transition-colors disabled:opacity-50"
        >
          {validating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Validating...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Validate CSV File
            </>
          )}
        </button>
      </div>

      {/* File Upload */}
      <div className="mb-6">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="w-full p-3 text-sm rounded-lg border bg-[#1A1A1A] border-[#1A1A1A] focus:border-[#00FB75] focus:outline-none file:mr-4 file:cursor-pointer"
        />
      </div>

      {result && (
        <div className="space-y-6">
          {/* Validation Status */}
          <div className="flex items-center justify-center p-4 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full ${getStatusColor(result.is_valid)} flex items-center justify-center`}>
                {result.is_valid ? (
                  <CheckCircle className="w-3 h-3 text-white" />
                ) : (
                  <XCircle className="w-3 h-3 text-white" />
                )}
              </div>
              <div>
                <h3 className={`text-lg font-medium ${result.is_valid ? 'text-green-400' : 'text-red-400'}`}>
                  Validation Status: {result.is_valid ? 'Valid' : 'Invalid'}
                </h3>
                {!result.is_valid && result.missing_required.length > 0 && (
                  <p className="text-sm text-orange-400 mt-1">
                    Missing required fields
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Missing Required Fields */}
          {!result.is_valid && result.missing_required.length > 0 && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="flex items-start gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                <h3 className="text-sm font-medium text-red-400">Missing Required Fields</h3>
              </div>
              <ul className="space-y-1">
                {result.missing_required.map((field, index) => (
                  <li key={index} className="text-xs text-red-300 flex items-start gap-1.5">
                    <span className="text-red-500 mt-0.5">•</span>
                    {field}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Field Mapping */}
          {result.is_valid && result.field_mapping && (
            <div className="p-4 rounded-lg border border-[#1A1A1A]">
              <h3 className="text-sm font-medium mb-4">Detected Field Mapping</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#1A1A1A]">
                      <th className="px-3 py-2 text-left font-medium text-gray-400">CSV Field</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-400">Database Field</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-400">Type</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-400">Required</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(result.field_mapping).map(([csvField, mapping]) => (
                      <tr key={csvField} className="border-t border-[#1A1A1A]">
                        <td className="px-3 py-2 font-mono text-gray-300">{csvField}</td>
                        <td className="px-3 py-2 text-gray-300">{mapping.db_field}</td>
                        <td>
                          <span className={`inline-flex items-center gap-1.5 text-xs px-1.5 py-0.5 rounded ${
                            mapping.required ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {getFieldTypeIcon(mapping.field_type)}
                            <span>{mapping.field_type}</span>
                          </span>
                        </td>
                        <td>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            mapping.required ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {mapping.required ? 'Required' : 'Optional'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Template Information */}
          {result.is_valid && result.template_info && (
            <div className="space-y-6">
              <div className="p-4 rounded-lg border border-[#1A1A1A]">
                <h3 className="text-sm font-medium mb-4">Required Fields</h3>
                <div className="space-y-2">
                  {result.template_info.required_fields.map((field, index) => (
                    <div key={index} className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">{field.csv_name}</span>
                      <span className="text-gray-300">→ {field.db_field}</span>
                      {field.required && (
                        <span className="ml-2 text-orange-400">(Required)</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-lg border border-[#1A1A1A]">
                <h3 className="text-sm font-medium mb-4">Optional Fields</h3>
                <div className="space-y-2">
                  {result.template_info.optional_fields.map((field, index) => (
                    <div key={index} className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">{field.csv_name}</span>
                      <span className="text-gray-300">→ {field.db_field}</span>
                      <span className="ml-2 text-blue-400">(Optional)</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-lg border border-[#1A1A1A]">
                <h3 className="text-sm font-medium mb-4">Supported Templates</h3>
                <div className="grid grid-cols-2 gap-3">
                  {result.template_info.examples.map((example, index) => (
                    <button
                      key={index}
                      onClick={() => downloadTemplate(example.template_name, example.fields)}
                      className="p-3 rounded-lg border border-[#1A1A1A] hover:border-[#00FB75]/50 transition-colors text-left"
                    >
                      <div className="text-xs">
                        <div className="font-medium text-gray-300">{example.template_name}</div>
                        <div className="text-gray-500 mt-1">
                          {example.fields.join(', ')}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Sample Data */}
          {result.is_valid && result.sample_rows && (
            <div className="p-4 rounded-lg border border-[#1A1A1A]">
              <h3 className="text-sm font-medium mb-4">Sample Data (First 3 Rows)</h3>
              <div className="space-y-3">
                {result.sample_rows.slice(0, 3).map((row, index) => (
                  <div key={index} className="bg-[#1A1A1A] p-3 rounded border border-[#2A2A2A]">
                    <h4 className="text-xs font-medium text-gray-400 mb-2">Row {index + 1}:</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(row).map(([key, value]) => (
                        <div key={key} className="text-gray-300">
                          <strong>{key}:</strong> {value || '(empty)'}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Refresh Button */}
      {result && (
        <div className="flex justify-center">
          <button
            onClick={() => {
              setResult(null);
              setFile(null);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-[#1A1A1A] hover:border-[#00FB75]/50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Validate Another File
          </button>
        </div>
      )}
    </div>
  );
}