"use client";

import { useState, useRef, useEffect } from "react";
import { useTheme } from "next-themes";
import EmojiPicker, { Theme, EmojiClickData, SkinTonePickerLocation } from "emoji-picker-react";

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

export default function EmojiPickerComponent({
  onEmojiSelect,
  onClose,
  isOpen,
}: EmojiPickerProps) {
  const { resolvedTheme } = useTheme();
  const pickerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiSelect(emojiData.emoji);
  };

  if (!mounted || !isOpen) return null;

  return (
    <div
      ref={pickerRef}
      className="relative"
    >
      <div
        className={`rounded-lg shadow-xl overflow-hidden ${
          resolvedTheme === "dark" ? "dark" : ""
        }`}
      >
        <EmojiPicker
          onEmojiClick={handleEmojiClick}
          width={320}
          height={400}
          theme={resolvedTheme === "dark" ? Theme.DARK : Theme.LIGHT}
          skinTonePickerLocation={SkinTonePickerLocation.PREVIEW}
          autoFocusSearch={false}
          lazyLoadEmojis
        />
      </div>
    </div>
  );
}
