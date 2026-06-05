import { useEffect, useState } from "react";
import type { Title } from "../types";

export function useShareCurrentTitle(currentTitle?: Title) {
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!shareFeedback) return;
    const timer = window.setTimeout(() => setShareFeedback(null), 1800);
    return () => window.clearTimeout(timer);
  }, [shareFeedback]);

  async function handleShareCurrentTitle() {
    if (!currentTitle) return;
    const shareText = `${currentTitle.name} (${currentTitle.releaseYear})`;
    const payload = {
      title: "CouchPicks pick",
      text: `Check out this pick: ${shareText}`
    };

    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await navigator.share(payload);
        setShareFeedback("Shared");
        return;
      }
    } catch {
      // fall through to clipboard
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload.text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = payload.text;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setShareFeedback("Copied");
    } catch {
      setShareFeedback("Unable to share");
    }
  }

  return {
    shareFeedback,
    handleShareCurrentTitle
  };
}
