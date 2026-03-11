"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Upload,
  Download,
  X,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Info
} from "lucide-react";
import toast from "react-hot-toast";

interface Event {
  id: string;
  title: string;
  slug: string;
}

interface ImportResult {
  created: number;
  updated: number;
  existing: number;
  errors: number;
  error_details?: any[];
}

export default function ImportAttendeesPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const router = useRouter();
  const params = useParams();
  const { id } = params as { id: string };

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const fetchEvent = useCallback(async () => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const response = await fetch(`/api/admin/events/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Event not found");
      const data = await response.json();
      setEvent(data);
    } catch (error) {
      console.error("Failed to fetch event:", error);
      toast.error("Event not found");
      router.push("/admin/events");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }

    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").slice(0, 11); // Show first 10 lines
      setPreview(lines);
      setImportResult(null);
    };
    reader.readAsText(selectedFile);
  };

  const handleDownloadTemplate = () => {
    const template = `first_name,last_name,email,position,organization,participation_type,attendance_type,wants_profile_visible,profile_visibility_types,special_requirements
John,Doe,john@example.com,Researcher,University of Nairobi,attendee,on_site,true,"[""attendee""]",Dietary requirements
Jane,Smith,jane@example.com,Entrepreneur,ACME Corp,idea_holder,remote,true,"[""idea_holder""]",None`;

    const blob = new Blob([template], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "import-attendees-template.csv";
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Please select a file to import");
      return;
    }

    setImporting(true);
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("event_id", id);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/admin/events/import-attendees`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData as any,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Import failed");
      }

      const result: ImportResult = await response.json();
      setImportResult(result);

      if (result.errors > 0) {
        toast.error(
          `Import completed with ${result.errors} errors. Check details below.`
        );
      } else {
        toast.success(
          `Import successful! ${result.created} created, ${result.updated} updated, ${result.existing} skipped.`
        );
      }

      setFile(null);
      setPreview([]);
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error(error.message || "An error occurred during import");
    } finally {
      setImporting(false);
    }
  };

  if (!event) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDark ? 'bg-black' : 'bg-gray-50'
      }`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00FB75] mx-auto mb-4"></div>
        <p className={isDark ? 'dark:text-white text-gray-900' : 'text-gray-900'}>Loading event...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E8E8E8] dark:bg-black dark:bg-opacity-50">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Event
              </button>
              <div>
                <h1 className="text-2xl font-bold dark:text-white text-gray-900">
                  Import Attendees
                </h1>
                <p className="text-sm text-muted-foreground">
                  {event.title}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          {/* Upload Section */}
          <div className={`rounded-2xl p-8 mb-8 border ${
            isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
          }`}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold mb-2 dark:text-white text-gray-900">
                  Upload CSV File
                </h2>
                <p className="text-sm text-muted-foreground">
                  Upload a CSV file with attendee information to bulk import registrations.
                </p>
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Template
              </button>
            </div>

            {/* Drop Zone */}
            <div className={`border-2 border-dashed rounded-xl p-8 text-center mb-6 ${
              isDark ? 'border-gray-700' : 'border-gray-300'
            } ${file ? 'border-[#00FB75]' : ''}`}>
              <input
                type="file"
                id="csv-upload"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="csv-upload"
                className="cursor-pointer"
              >
                <Upload className="w-12 h-12 mx-auto mb-4 dark:text-gray-400 text-gray-600" />
                <p className="mb-2 font-medium dark:text-white text-gray-900">
                  {file ? file.name : "Click to upload or drag and drop"}
                </p>
                <p className="text-sm text-muted-foreground">
                  CSV files only
                </p>
              </label>
            </div>

            {/* CSV Format Info */}
            <div className={`rounded-xl p-4 mb-6 ${
              isDark ? 'bg-blue-900/20' : 'bg-blue-50'
            }`}>
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium mb-2 dark:text-white text-gray-900">
                    Required CSV Format:
                  </p>
                  <code className="text-xs bg-black/10 dark:bg-black/20 px-2 py-1 rounded">
                    first_name,last_name,email,position,organization,participation_type,attendance_type,wants_profile_visible,profile_visibility_types,special_requirements
                  </code>
                </div>
              </div>
            </div>

            {/* File Preview */}
            {preview.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium mb-3 dark:text-white text-gray-900">
                  File Preview (first 10 rows)
                </h3>
                <div className={`rounded-xl border overflow-hidden max-h-64 overflow-y-auto ${
                  isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
                }`}>
                  <table className="w-full text-sm">
                    <thead className={`sticky top-0 ${
                      isDark ? 'bg-gray-900' : 'bg-gray-100'
                    }`}>
                      <tr>
                        {preview[0].split(",").map((header, i) => (
                          <th key={i} className="px-3 py-2 text-left font-medium text-xs">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(1, 11).map((row, i) => (
                        <tr key={i} className={`border-t ${
                          isDark ? 'border-gray-700' : 'border-gray-200'
                        }`}>
                          {row.split(",").map((cell, j) => (
                            <td key={j} className="px-3 py-2 text-xs">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Import Button */}
            <button
              onClick={handleImport}
              disabled={!file || importing}
              className={`w-full px-6 py-3 rounded-xl font-bold transition-all ${
                !file || importing
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:scale-105'
              } bg-[#00FB75] text-black hover:bg-green-400`}
            >
              {importing ? "Importing..." : "Import Attendees"}
            </button>
          </div>

          {/* Import Results */}
          {importResult && (
            <div className={`rounded-2xl p-6 mb-8 border ${
              isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
            }`}>
              <h2 className="text-xl font-bold mb-4 dark:text-white text-gray-900">
                Import Results
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`p-4 rounded-xl text-center ${
                  isDark ? 'bg-gray-800' : 'bg-gray-50'
                }`}>
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <div className="text-2xl font-bold dark:text-white text-gray-900">
                    {importResult.created}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Created
                  </div>
                </div>
                <div className={`p-4 rounded-xl text-center ${
                  isDark ? 'bg-gray-800' : 'bg-gray-50'
                }`}>
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                  <div className="text-2xl font-bold dark:text-white text-gray-900">
                    {importResult.updated}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Updated
                  </div>
                </div>
                <div className={`p-4 rounded-xl text-center ${
                  isDark ? 'bg-gray-800' : 'bg-gray-50'
                }`}>
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                  <div className="text-2xl font-bold dark:text-white text-gray-900">
                    {importResult.existing}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Existing
                  </div>
                </div>
                <div className={`p-4 rounded-xl text-center ${
                  isDark ? 'bg-gray-800' : 'bg-gray-50'
                }`}>
                  <XCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
                  <div className="text-2xl font-bold dark:text-white text-gray-900">
                    {importResult.errors}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Errors
                  </div>
                </div>
              </div>

              {importResult.error_details && importResult.error_details.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2 dark:text-white text-gray-900">
                    Error Details:
                  </h3>
                  <div className={`rounded-lg p-4 max-h-48 overflow-y-auto ${
                    isDark ? 'bg-gray-800' : 'bg-gray-50'
                  }`}>
                    {importResult.error_details.map((error, i) => (
                      <div key={i} className="text-sm text-red-500 mb-1">
                        Row {i + 1}: {JSON.stringify(error)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Help Section */}
          <div className={`rounded-2xl p-6 border ${
            isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
          }`}>
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 dark:text-gray-400 text-gray-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-2 dark:text-white text-gray-900">
                  CSV File Requirements:
                </p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• First row must contain column headers</li>
                  <li>• Required fields: first_name, last_name, email</li>
                  <li>• participation_type: attendee, jury, speaker, idea_holder</li>
                  <li>• attendance_type: on_site, remote, hybrid</li>
                  <li>• wants_profile_visible: true or false</li>
                  <li>• profile_visibility_types: JSON array, e.g., [&quot;attendee&quot;, &quot;speaker&quot;]</li>
                  <li>• File must be UTF-8 encoded</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
