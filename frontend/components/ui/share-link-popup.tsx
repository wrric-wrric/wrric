"use client";

import { useState } from "react";
import { Copy, ExternalLink, X } from "lucide-react";
import toast from "react-hot-toast";

interface ShareLinkPopupProps {
  isOpen: boolean;
  url: string;
  onClose: () => void;
  onCopy?: (url: string) => void;
}

export function ShareLinkPopup({ isOpen, url, onClose, onCopy }: ShareLinkPopupProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      
      setCopied(true);
      toast.success("Copied to clipboard!");
      
      // Call the onCopy callback if provided
      if (onCopy) {
        onCopy(url);
      }
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleOpenLink = () => {
    window.open(url, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-auto border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Share Session
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Share this link with others to let them view this session:
          </p>
          
          {/* URL Display */}
          <div className="flex gap-2 mb-4">
            <input 
              type="text" 
              value={url} 
              readOnly 
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00FB75]"
              onClick={(e) => e.currentTarget.select()}
            />
            <button
              onClick={handleCopy}
              disabled={copied}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                copied 
                  ? "bg-green-500 text-white" 
                  : "bg-[#00FB75] text-black hover:bg-green-400"
              }`}
            >
              <Copy className="w-4 h-4" />
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={handleOpenLink}
              className="flex items-center gap-2 px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open Link
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}