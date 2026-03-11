"use client";

import { useState, useRef, useEffect } from "react";
import { Share2, Link2, X, QrCode, Mail, Check, Twitter, Linkedin, MessageCircle } from "lucide-react";
import toast from "react-hot-toast";
import QRCode from "qrcode";
import Image from "next/image";

interface ShareButtonProps {
  entityId: string;
  labName: string;
  size?: "sm" | "md" | "lg";
}

export default function ShareButton({ entityId, labName, size = "md" }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrCode, setQRCode] = useState<string>("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const labUrl = typeof window !== "undefined"
    ? `${window.location.origin}/labs/${entityId}`
    : `/labs/${entityId}`;

  const shareText = `Check out this research lab: ${labName}`;

  // Generate QR code
  useEffect(() => {
    if (showQR && labUrl) {
      QRCode.toDataURL(labUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: "#00FB75",
          light: "#00000000"
        }
      })
        .then((url: string) => setQRCode(url))
        .catch((err: unknown) => console.error("QR generation error:", err));
    }
  }, [showQR, labUrl]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowQR(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const recordShare = async (platform: string) => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      await fetch(`/api/labs/${entityId}/share`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ platform }),
      });
    } catch {
      // Non-critical, don't block UI
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(labUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      recordShare("link");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleShare = (platform: string, url: string) => {
    window.open(url, "_blank", "noopener,noreferrer,width=600,height=400");
    recordShare(platform);
    setOpen(false);
    setShowQR(false);
  };

  const handleTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(labUrl)}`;
    handleShare("twitter", url);
  };

  const handleLinkedIn = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(labUrl)}`;
    handleShare("linkedin", url);
  };

  const handleWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${labUrl}`)}`;
    handleShare("whatsapp", url);
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`Research Lab: ${labName}`);
    const body = encodeURIComponent(`${shareText}\n\n${labUrl}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    recordShare("email");
    setOpen(false);
    setShowQR(false);
  };

  const handleQRCode = () => {
    setShowQR(!showQR);
  };

  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  const buttonClasses = {
    sm: "p-1.5",
    md: "p-2",
    lg: "p-2.5",
  };

  // Calculate popover position
  const getPopoverPosition = () => {
    if (!buttonRef.current) return { top: "100%", right: "0" };
    
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Default position: below the button
    let top: string = "100%";
    let right: string = "0";
    let left: string = "auto";
    let bottom: string = "auto";

    // If near bottom of viewport, show above
    if (rect.bottom + 250 > viewportHeight) {
      top = "auto";
      bottom = "100%";
    }

    // If near right edge, align to left
    if (rect.right - 250 < 0) {
      right = "auto";
      left = "0";
    }

    return { top, right, left, bottom };
  };

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(!open);
          setShowQR(false);
        }}
        className={`flex items-center justify-center rounded-full hover:bg-[#00FB75]/10 transition-all duration-200 group ${buttonClasses[size]}`}
        aria-label="Share this lab"
      >
        <Share2
          className={`${sizeClasses[size]} text-gray-500 dark:text-gray-400 group-hover:text-[#00FB75] group-hover:scale-110 transition-all duration-200`}
        />
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="fixed md:absolute z-50 mt-2 rounded-xl border bg-white dark:bg-gray-900 dark:border-gray-700 border-gray-200 shadow-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-200 min-w-[280px]"
          style={getPopoverPosition()}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Share Lab</span>
            <button
              onClick={() => {
                setOpen(false);
                setShowQR(false);
              }}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {showQR ? (
            <div className="space-y-3">
              <div className="flex flex-col items-center">
                {qrCode && (
                  <Image
                    src={qrCode}
                    alt="QR Code"
                    width={150}
                    height={150}
                    className="rounded-lg border-2 border-[#00FB75] p-2 bg-white"
                  />
                )}
                <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
                  Scan to visit lab page
                </p>
              </div>
              <button
                onClick={() => setShowQR(false)}
                className="w-full text-sm text-[#00FB75] hover:text-green-500 transition-colors"
              >
                ← Back to sharing options
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {/* Copy Link */}
                <button
                  onClick={handleCopyLink}
                  className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 border border-gray-200 dark:border-gray-700 group/link"
                >
                  {copied ? (
                    <Check className="w-6 h-6 text-[#00FB75]" />
                  ) : (
                    <Link2 className="w-6 h-6 text-gray-500 dark:text-gray-400 group-hover/link:text-[#00FB75]" />
                  )}
                  <span className="text-xs font-medium">
                    {copied ? "Copied!" : "Copy Link"}
                  </span>
                </button>

                {/* QR Code */}
                <button
                  onClick={handleQRCode}
                  className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 border border-gray-200 dark:border-gray-700 group/qr"
                >
                  <QrCode className="w-6 h-6 text-gray-500 dark:text-gray-400 group-hover/qr:text-[#00FB75]" />
                  <span className="text-xs font-medium">QR Code</span>
                </button>
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleTwitter}
                  className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200 border border-gray-200 dark:border-gray-700 group/twitter"
                >
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Twitter className="w-5 h-5 text-blue-500" />
                  </div>
                  <span className="text-sm font-medium flex-1 text-left">Share on Twitter</span>
                </button>

                <button
                  onClick={handleLinkedIn}
                  className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-blue-100/50 dark:hover:bg-blue-900/20 transition-all duration-200 border border-gray-200 dark:border-gray-700 group/linkedin"
                >
                  <div className="p-2 bg-blue-600/10 rounded-lg">
                    <Linkedin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-sm font-medium flex-1 text-left">Share on LinkedIn</span>
                </button>

                <button
                  onClick={handleWhatsApp}
                  className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/20 transition-all duration-200 border border-gray-200 dark:border-gray-700 group/whatsapp"
                >
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <MessageCircle className="w-5 h-5 text-green-500" />
                  </div>
                  <span className="text-sm font-medium flex-1 text-left">Share on WhatsApp</span>
                </button>

                <button
                  onClick={handleEmail}
                  className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 border border-gray-200 dark:border-gray-700 group/email"
                >
                  <div className="p-2 bg-gray-500/10 rounded-lg">
                    <Mail className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  </div>
                  <span className="text-sm font-medium flex-1 text-left">Share via Email</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}