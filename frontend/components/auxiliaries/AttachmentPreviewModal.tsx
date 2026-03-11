"use client";

import { useState, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Play,
  Pause,
  Maximize2,
  FileText,
  File,
  Loader2,
} from "lucide-react";
import { MessageAttachment } from "@/types/message";

interface AttachmentPreviewModalProps {
  attachment: MessageAttachment | null;
  onClose: () => void;
}

export default function AttachmentPreviewModal({
  attachment,
  onClose,
}: AttachmentPreviewModalProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [downloading, setDownloading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isDocumentLoading, setIsDocumentLoading] = useState(false);

  const videoRef = useCallback((node: HTMLVideoElement | null) => {
    if (node) {
      node.onerror = () => setVideoError(true);
    }
  }, []);

  useEffect(() => {
    if (!attachment) return;

    setZoom(1);
    setRotation(0);
    setIsPlaying(false);
    setVideoError(false);
    setImageError(false);
    setIsDocumentLoading(false);
  }, [attachment]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [onClose]);

  const handleDownload = async () => {
    if (!attachment) return;
    setDownloading(true);
    try {
      const response = await fetch(attachment.download_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setDownloading(false);
    }
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.5, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.5, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const togglePlayPause = () => {
    const video = document.querySelector("video") as HTMLVideoElement;
    if (video) {
      if (isPlaying) {
        video.pause();
      } else {
        video.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleFullscreen = () => {
    const video = document.querySelector("video") as HTMLVideoElement;
    if (video) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        video.requestFullscreen();
      }
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes("pdf")) return <FileText className="w-16 h-16 text-red-500" />;
    if (mimeType.includes("word") || mimeType.includes("document"))
      return <FileText className="w-16 h-16 text-blue-500" />;
    if (mimeType.includes("sheet") || mimeType.includes("excel"))
      return <FileText className="w-16 h-16 text-green-500" />;
    return <File className="w-16 h-16 text-gray-500" />;
  };

  if (!attachment) return null;

  const isImage = attachment.mime_type.startsWith("image/");
  const isVideo = attachment.mime_type.startsWith("video/");
  const isPDF = attachment.mime_type.includes("pdf");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full h-full flex flex-col">
        <div
          className={`flex items-center justify-between px-4 py-3 ${
            isDark ? "bg-gray-900" : "bg-gray-100"
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`text-sm font-medium ${
                isDark ? "text-white" : "text-gray-900"
              } truncate max-w-[300px]`}
            >
              {attachment.file_name}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                isDark ? "bg-gray-800 text-gray-400" : "bg-gray-200 text-gray-600"
              }`}
            >
              {formatFileSize(attachment.file_size)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {(isImage || isVideo) && (
              <>
                <button
                  onClick={handleZoomOut}
                  disabled={zoom <= 0.5}
                  className={`p-2 rounded-lg transition-colors ${
                    isDark
                      ? "hover:bg-gray-800 text-gray-400"
                      : "hover:bg-gray-200 text-gray-600"
                  } disabled:opacity-50`}
                  title="Zoom Out"
                >
                  <ZoomOut className="w-5 h-5" />
                </button>
                <span
                  className={`text-sm ${
                    isDark ? "text-gray-400" : "text-gray-600"
                  } w-12 text-center`}
                >
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  disabled={zoom >= 3}
                  className={`p-2 rounded-lg transition-colors ${
                    isDark
                      ? "hover:bg-gray-800 text-gray-400"
                      : "hover:bg-gray-200 text-gray-600"
                  } disabled:opacity-50`}
                  title="Zoom In"
                >
                  <ZoomIn className="w-5 h-5" />
                </button>
                {isImage && (
                  <button
                    onClick={handleRotate}
                    className={`p-2 rounded-lg transition-colors ${
                      isDark
                        ? "hover:bg-gray-800 text-gray-400"
                        : "hover:bg-gray-200 text-gray-600"
                    }`}
                    title="Rotate"
                  >
                    <RotateCw className="w-5 h-5" />
                  </button>
                )}
              </>
            )}
            <button
              onClick={handleDownload}
              disabled={downloading}
              className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${
                isDark
                  ? "hover:bg-gray-800 text-gray-400"
                  : "hover:bg-gray-200 text-gray-600"
              } disabled:opacity-50`}
            >
              {downloading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
              <span className="text-sm">Download</span>
            </button>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                isDark
                  ? "hover:bg-gray-800 text-gray-400"
                  : "hover:bg-gray-200 text-gray-600"
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex items-center justify-center p-4">
          <div className="relative max-w-full max-h-full">
            {isImage && (
              <>
                {imageError ? (
                  <div
                    className={`flex flex-col items-center justify-center w-[400px] h-[400px] rounded-lg ${
                      isDark ? "bg-gray-800" : "bg-gray-100"
                    }`}
                  >
                    <FileText className="w-16 h-16 text-gray-400 mb-4" />
                    <p
                      className={`text-sm ${
                        isDark ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      Unable to load image
                    </p>
                  </div>
                ) : (
                  <img
                    src={attachment.download_url}
                    alt={attachment.file_name}
                    className="max-w-full max-h-[70vh] object-contain transition-transform duration-200"
                    style={{
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    }}
                    onError={() => setImageError(true)}
                  />
                )}
              </>
            )}

            {isVideo && (
              <>
                {videoError ? (
                  <div
                    className={`flex flex-col items-center justify-center w-[400px] h-[300px] rounded-lg ${
                      isDark ? "bg-gray-800" : "bg-gray-100"
                    }`}
                  >
                    <FileText className="w-16 h-16 text-gray-400 mb-4" />
                    <p
                      className={`text-sm ${
                        isDark ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      Unable to load video
                    </p>
                  </div>
                ) : (
                  <div className="relative">
                    <video
                      ref={videoRef}
                      src={attachment.download_url}
                      className="max-w-full max-h-[70vh]"
                      controls
                      style={{
                        transform: `scale(${zoom})`,
                      }}
                    />
                    <button
                      onClick={handleFullscreen}
                      className={`absolute top-2 right-2 p-2 rounded-lg bg-black/50 hover:bg-black/70 transition-colors ${
                        isDark ? "text-white" : "text-white"
                      }`}
                      title="Fullscreen"
                    >
                      <Maximize2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </>
            )}

            {isPDF && (
              <div
                className={`w-[800px] h-[70vh] rounded-lg overflow-hidden ${
                  isDark ? "bg-gray-800" : "bg-gray-100"
                }`}
              >
                {isDocumentLoading && (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-[#00FB75]" />
                  </div>
                )}
                <iframe
                  src={`${attachment.download_url}#toolbar=0`}
                  className="w-full h-full"
                  title={attachment.file_name}
                  onLoad={() => setIsDocumentLoading(false)}
                />
              </div>
            )}

            {!isImage && !isVideo && !isPDF && (
              <div
                className={`flex flex-col items-center justify-center w-[400px] h-[300px] rounded-lg ${
                  isDark ? "bg-gray-800" : "bg-gray-100"
                }`}
              >
                {getFileIcon(attachment.mime_type)}
                <p
                  className={`mt-4 text-sm ${
                    isDark ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Preview not available
                </p>
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className={`mt-4 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                    downloading
                      ? "opacity-50 cursor-not-allowed"
                      : "bg-[#00FB75] text-black hover:bg-green-400"
                  }`}
                >
                  {downloading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Download File
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
