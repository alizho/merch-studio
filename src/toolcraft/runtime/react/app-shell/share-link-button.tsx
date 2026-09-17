"use client";

import * as React from "react";
import { Check, Link as LinkIcon } from "lucide-react";
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@/toolcraft/ui";

/** How long the "Copied" state holds before reverting to the idle label. */
const COPIED_FEEDBACK_MS = 1600;

function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return Promise.reject(new Error("Clipboard unavailable"));
  }

  return navigator.clipboard.writeText(text);
}

/**
 * Copies the current page URL so a teammate can open the same document.
 * There's no per-file or multi-device sync yet, so the link is just the
 * page itself — reopening it loads whatever that browser's local storage
 * has, which today is always this design.
 */
export function ShareLinkButton(): React.JSX.Element {
  const [copied, setCopied] = React.useState(false);
  const resetTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => {
    return () => clearTimeout(resetTimeoutRef.current);
  }, []);

  const handleClick = React.useCallback(() => {
    if (typeof window === "undefined") return;

    copyToClipboard(window.location.href)
      .then(() => {
        clearTimeout(resetTimeoutRef.current);
        setCopied(true);
        resetTimeoutRef.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
      })
      .catch(() => {
        /* Clipboard access denied or unavailable; nothing to fall back to. */
      });
  }, []);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label="Copy share link"
            className="ml-auto gap-1.5"
            onClick={handleClick}
            size="sm"
            type="button"
            variant="ghost"
          >
            {copied ? <Check data-icon="copied" /> : <LinkIcon data-icon="link" />}
            <span>{copied ? "Copied" : "Copy link"}</span>
          </Button>
        }
      />
      <TooltipContent side="bottom">Copy a link to this design</TooltipContent>
    </Tooltip>
  );
}
