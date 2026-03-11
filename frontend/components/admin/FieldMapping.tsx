"use client";

import React from 'react';
import { useTheme } from 'next-themes';
import {
  User,
  Briefcase,
  ArrowRight,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface FieldMappingProps {
  fieldMapping: {[key: string]: any};
  sampleRows: Array<{[key: string]: string}>;
}

export default function FieldMapping({ fieldMapping, sampleRows }: FieldMappingProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const getFieldTypeColor = (fieldType: string) => {
    switch (fieldType) {
      case 'user':
        return 'bg-blue-500';
      case 'profile':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getFieldTypeIcon = (fieldType: string) => {
    switch (fieldType) {
      case 'user':
        return <User className="w-3.5 h-3.5 text-white" />;
      case 'profile':
        return <Briefcase className="w-3.5 h-3.5 text-white" />;
      default:
        return null;
    }
  };

  const getMappedValue = (csvField: string, rowIndex: number) => {
    const mapping = fieldMapping[csvField];
    if (!mapping) return 'Not Mapped';
    
    const sampleRow = sampleRows[rowIndex];
    if (!sampleRow) return 'No Data';
    
    return sampleRow[csvField] || '(empty)';
  };

  const mappedFields = Object.keys(fieldMapping).length;
  const requiredFields = Object.values(fieldMapping).filter((m: any) => m?.required).length;

  return (
    <div className="p-6 rounded-lg border bg-[#121212]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ArrowRight className="w-5 h-5 text-[#00FB75]" />
          <h2 className="text-lg font-medium">Field Mapping Visualization</h2>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-400">
            {mappedFields} Fields Mapped
          </span>
          <span className="text-gray-400">•</span>
          <span className="text-gray-400">
            {requiredFields} Required Fields
          </span>
        </div>
      </div>

      {/* Mapping Overview */}
      <div className="mb-6 p-4 rounded-lg bg-[#1A1A1A]">
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className={`inline-flex items-center px-2 py-1 rounded ${
              mappedFields > 0 ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
            }`}>
              {mappedFields > 0 && <CheckCircle className="w-3 h-3 mr-1" />}
              {mappedFields === 0 && <XCircle className="w-3 h-3 mr-1" />}
              {mappedFields} Fields Mapped
            </span>
          </div>
          <div className="text-sm">
            <span className={`inline-flex items-center px-2 py-1 rounded ${
              requiredFields > 0 ? 'bg-orange-500/20 text-orange-400' : 'bg-gray-500/20 text-gray-400'
            }`}>
              {requiredFields} Required Fields
            </span>
          </div>
        </div>
      </div>

      {/* Mapping Table */}
      <div className="rounded-lg border border-[#1A1A1A] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#1A1A1A]">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">CSV Field</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Database Field</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Type</th>
              {sampleRows.map((_, index) => (
                <th key={index} className="px-4 py-3 text-left text-xs font-medium text-gray-400">
                  Sample {index + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(fieldMapping).map(([csvField, mapping]: [string, any]) => (
              <tr key={csvField} className="border-t border-[#1A1A1A]">
                <td className="px-4 py-3 font-mono text-sm text-gray-300">
                  {csvField}
                </td>
                <td className="px-4 py-3 text-sm text-gray-300">
                  {mapping?.db_field || 'Not Mapped'}
                </td>
                <td>
                  <span 
                    className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded ${
                      getFieldTypeColor(mapping?.field_type || 'default')
                    } text-white`}
                  >
                    {getFieldTypeIcon(mapping?.field_type)}
                    <span>{mapping?.field_type || 'unknown'}</span>
                  </span>
                </td>
                <td>
                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                    mapping?.required 
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50' 
                      : 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                  }`}>
                    {mapping?.required ? 'Required' : 'Optional'}
                  </span>
                </td>
                {sampleRows.map((_, index) => (
                  <td key={index} className="px-4 py-3 text-sm">
                    <div className="text-gray-300">
                      {getMappedValue(csvField, index)}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-6 p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
        <h4 className="text-sm font-medium text-blue-400 mb-3">Legend</h4>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-1 rounded bg-blue-500 text-white">
              <User className="w-3 h-3" />
              User
            </span>
            <span className="text-gray-400">- User data field (email, username, etc.)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-1 rounded bg-green-500 text-white">
              <Briefcase className="w-3 h-3" />
              Profile
            </span>
            <span className="text-gray-400">- Profile or entity data</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-1 rounded bg-orange-500 text-white border border-orange-500/50">
              Required
            </span>
            <span className="text-gray-400">- Field must be mapped for successful import</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-1 rounded bg-blue-500 text-white border border-blue-500/50">
              Optional
            </span>
            <span className="text-gray-400">- Field is optional but can be mapped</span>
          </div>
        </div>
      </div>
    </div>
  );
}