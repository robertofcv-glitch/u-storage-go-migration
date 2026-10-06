import { useCallback, useEffect, useRef } from "react";
import { mergeAttributionParams } from "@/lib/attribution";

/**
 * postMessage protocol used between the embedded U-Storage Go experience (inside the
 * iframe) and the host page (e.g. u-storage.com.mx). All messages are namespaced
 * with the `ruku-embed:` prefix.
 *
 * Child -> Parent:
 *   { type: "ruku-embed:ready" }              sent once the widget mounts
 *   { type: "ruku-embed:resize", height }     current content height in px
 *   { type: "ruku-embed:scrollToTop", offset? } ask host to scroll to the iframe
 *       (plus an optional pixel offset inside the iframe, e.g. the wizard's top)
 *
 * Parent -> Child:
 *   { type: "ruku-embed:params", params }     forward host URL params (utm_*, partner)
 *   { type: "ruku-embed:requestHeight" }      ask the widget to re-report its height
 */
export const EMBED_NAMESPACE = "ruku-embed";

/** True when the current window is rendered inside an iframe. */
export function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin access to window.top throws — that means we are framed.
    return true;
  }
}

interface EmbedResizeApi {
  postHeight: () => void;
  scrollParentTop: (offset?: number) => void;
}

/**
 * Wires up the iframe auto-resize + attribution handshake.
 *
 * When `enabled` is false (i.e. not embedded) every method is a no-op so the
 * same experience component works identically as a standalone page.
 */
export function useEmbedResize(enabled: boolean = true): EmbedResizeApi {
  const lastHeight = useRef(0);

  const postHeight = useCallback(() => {
    if (!enabled) return;
    const height = Math.ceil(
      Math.max(
        document.documentElement.scrollHeight,
        document.body?.scrollHeight ?? 0,
      ),
    );
    if (height > 0 && height !== lastHeight.current) {
      lastHeight.current = height;
      window.parent.postMessage({ type: `${EMBED_NAMESPACE}:resize`, height }, "*");
    }
  }, [enabled]);

  const scrollParentTop = useCallback(
    (offset?: number) => {
      if (!enabled) return;
      window.parent.postMessage(
        { type: `${EMBED_NAMESPACE}:scrollToTop`, offset: offset ?? 0 },
        "*",
      );
    },
    [enabled],
  );

  useEffect(() => {
    if (!enabled) return;

    postHeight();

    const resizeObserver = new ResizeObserver(() => postHeight());
    if (document.body) resizeObserver.observe(document.body);

    const handleLoad = () => postHeight();
    window.addEventListener("load", handleLoad);
    window.addEventListener("resize", postHeight);

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === `${EMBED_NAMESPACE}:params` && data.params) {
        mergeAttributionParams(data.params as Record<string, string | undefined>);
      }
      if (data.type === `${EMBED_NAMESPACE}:requestHeight`) {
        lastHeight.current = 0;
        postHeight();
      }
    };
    window.addEventListener("message", handleMessage);

    // Announce readiness so the host can forward its URL params.
    window.parent.postMessage({ type: `${EMBED_NAMESPACE}:ready` }, "*");

    // Safety net: re-measure periodically to catch late async layout shifts
    // (fonts, images, expanding wizard sections) that observers can miss.
    const interval = window.setInterval(postHeight, 1000);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("load", handleLoad);
      window.removeEventListener("resize", postHeight);
      window.removeEventListener("message", handleMessage);
      window.clearInterval(interval);
    };
  }, [enabled, postHeight]);

  return { postHeight, scrollParentTop };
}
