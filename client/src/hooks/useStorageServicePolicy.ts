import { useCallback, useEffect, useState } from "react";

export interface StorageServicePolicy {
  branchMovesEnabled: boolean;
  generalMovesEnabled: boolean;
  intoStorageEnabled: boolean;
  outOfStorageEnabled: boolean;
}

export function useStorageServicePolicy() {
  const [policy, setPolicy] = useState<StorageServicePolicy | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState("loading");
    fetch("/api/ustorage/service-policy", { credentials: "include" })
      .then((response) => {
        if (!response.ok) throw new Error("Service policy is unavailable");
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        setPolicy(data);
        setState("ready");
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { policy, state, retry };
}