"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Digest, DigestConfig, DigestWithArticles, Topic } from "@/types";

type ConfigBundle = { digests: Digest[]; topics: Topic[] };

interface DataCacheAPI {
  configs: DigestConfig[];
  configsReady: boolean;
  reloadConfigs: () => Promise<DigestConfig[]>;

  getBundle: (configId: string) => ConfigBundle | undefined;
  loadBundle: (configId: string, force?: boolean) => Promise<ConfigBundle>;
  invalidateBundle: (configId: string) => void;

  getDigest: (id: string) => DigestWithArticles | undefined;
  loadDigest: (id: string) => Promise<DigestWithArticles | null>;
  invalidateDigest: (id: string) => void;
}

const Ctx = createContext<DataCacheAPI | null>(null);

export function DataCacheProvider({ children }: { children: React.ReactNode }) {
  const [configs, setConfigs] = useState<DigestConfig[]>([]);
  const [configsReady, setConfigsReady] = useState(false);

  const bundles = useRef(new Map<string, ConfigBundle>());
  const digestCache = useRef(new Map<string, DigestWithArticles>());
  const inflight = useRef(new Map<string, Promise<unknown>>());

  const reloadConfigs = useCallback(async () => {
    const res = await fetch("/api/digest-configs");
    if (!res.ok) {
      setConfigsReady(true);
      return [] as DigestConfig[];
    }
    const data: DigestConfig[] = await res.json();
    const list = Array.isArray(data) ? data : [];
    setConfigs(list);
    setConfigsReady(true);
    return list;
  }, []);

  useEffect(() => {
    reloadConfigs();
  }, [reloadConfigs]);

  const getBundle = useCallback((configId: string) => bundles.current.get(configId), []);

  const loadBundle = useCallback(async (configId: string, force = false): Promise<ConfigBundle> => {
    if (!force) {
      const cached = bundles.current.get(configId);
      if (cached) return cached;
      const pending = inflight.current.get(`bundle:${configId}`) as Promise<ConfigBundle> | undefined;
      if (pending) return pending;
    }
    const p = (async () => {
      const [d, t] = await Promise.all([
        fetch(`/api/digests?limit=10&digestConfigId=${configId}`).then((r) => r.json()),
        fetch(`/api/topics?digestConfigId=${configId}`).then((r) => r.json()),
      ]);
      const bundle: ConfigBundle = {
        digests: Array.isArray(d) ? d : [],
        topics: Array.isArray(t) ? t : [],
      };
      bundles.current.set(configId, bundle);
      return bundle;
    })();
    inflight.current.set(`bundle:${configId}`, p);
    try {
      return await p;
    } finally {
      inflight.current.delete(`bundle:${configId}`);
    }
  }, []);

  const invalidateBundle = useCallback((configId: string) => {
    bundles.current.delete(configId);
  }, []);

  const getDigest = useCallback((id: string) => digestCache.current.get(id), []);

  const loadDigest = useCallback(async (id: string): Promise<DigestWithArticles | null> => {
    const pending = inflight.current.get(`digest:${id}`) as Promise<DigestWithArticles | null> | undefined;
    if (pending) return pending;
    const p = (async () => {
      const res = await fetch(`/api/digest/${id}`);
      if (!res.ok) return null;
      const data: DigestWithArticles = await res.json();
      digestCache.current.set(id, data);
      return data;
    })();
    inflight.current.set(`digest:${id}`, p);
    try {
      return await p;
    } finally {
      inflight.current.delete(`digest:${id}`);
    }
  }, []);

  const invalidateDigest = useCallback((id: string) => {
    digestCache.current.delete(id);
  }, []);

  // After configs load, proactively warm every config's bundle + its latest digest (parallel).
  useEffect(() => {
    if (!configsReady || configs.length === 0) return;
    (async () => {
      const bundleResults = await Promise.all(
        configs.map((c) => loadBundle(c.id).catch(() => null)),
      );
      await Promise.all(
        bundleResults.map((b) => {
          const latest = b?.digests[0];
          return latest ? loadDigest(latest.id).catch(() => null) : null;
        }),
      );
    })();
  }, [configs, configsReady, loadBundle, loadDigest]);

  const api = useMemo<DataCacheAPI>(() => ({
    configs,
    configsReady,
    reloadConfigs,
    getBundle,
    loadBundle,
    invalidateBundle,
    getDigest,
    loadDigest,
    invalidateDigest,
  }), [configs, configsReady, reloadConfigs, getBundle, loadBundle, invalidateBundle, getDigest, loadDigest, invalidateDigest]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useDataCache() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDataCache must be used within DataCacheProvider");
  return ctx;
}
