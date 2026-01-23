import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

type QueryKey = string | readonly unknown[];
type NormalizedKey = string;

type QueryStatus = "idle" | "loading" | "success" | "error";

type QueryState<T> = {
  status: QueryStatus;
  data?: T;
  error?: Error;
  updatedAt?: number;
};

type Fetcher<T> = () => Promise<T>;

type QueryOptions<T> = {
  enabled?: boolean;
  staleTime?: number;
  refetchIntervalMs?: number;
  keepPreviousData?: boolean;
  initialData?: T;
};

type QueryClient = {
  getState<T>(key: NormalizedKey): QueryState<T> | undefined;
  setState<T>(key: NormalizedKey, next: QueryState<T>): void;
  subscribe(key: NormalizedKey, fn: () => void): () => void;
  fetch<T>(
    key: NormalizedKey,
    fetcher: Fetcher<T>,
    opts?: { keepPreviousData?: boolean },
  ): Promise<T>;
  invalidate(key: NormalizedKey): void;
};

const QueryContext = createContext<QueryClient | null>(null);

function normalizeKey(key: QueryKey): NormalizedKey {
  return typeof key === "string" ? key : JSON.stringify(key);
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<Map<NormalizedKey, QueryState<any>>>(new Map());
  const subsRef = useRef<Map<NormalizedKey, Set<() => void>>>(new Map());
  const inFlightRef = useRef<Map<NormalizedKey, Promise<any>>>(new Map());

  const notify = (key: NormalizedKey) => {
    const subs = subsRef.current.get(key);
    if (subs) {
      subs.forEach((fn) => fn());
    }
  };

  const getState = <T,>(key: NormalizedKey): QueryState<T> | undefined => storeRef.current.get(key);

  const setState = <T,>(key: NormalizedKey, next: QueryState<T>) => {
    storeRef.current.set(key, next);
    notify(key);
  };

  const subscribe = (key: NormalizedKey, fn: () => void) => {
    let subs = subsRef.current.get(key);
    if (!subs) {
      subs = new Set();
      subsRef.current.set(key, subs);
    }
    subs.add(fn);
    return () => {
      const current = subsRef.current.get(key);
      if (!current) return;
      current.delete(fn);
      if (current.size === 0) {
        subsRef.current.delete(key);
      }
    };
  };

  const fetchQuery = async <T,>(
    key: NormalizedKey,
    fetcher: Fetcher<T>,
    opts?: { keepPreviousData?: boolean },
  ): Promise<T> => {
    const existing = inFlightRef.current.get(key);
    if (existing) return existing as Promise<T>;

    const prev = getState<T>(key);
    const keepPrev = opts?.keepPreviousData ?? false;
    if (keepPrev && prev && prev.status === "success") {
      setState<T>(key, { ...prev, status: "loading" });
    } else {
      setState<T>(key, { status: "loading", data: keepPrev ? prev?.data : undefined, error: undefined, updatedAt: prev?.updatedAt });
    }

    const promise = (async () => {
      try {
        const data = await fetcher();
        const next: QueryState<T> = { status: "success", data, error: undefined, updatedAt: Date.now() };
        setState<T>(key, next);
        return data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        const next: QueryState<T> = {
          status: "error",
          error,
          data: keepPrev ? prev?.data : undefined,
          updatedAt: prev?.updatedAt,
        };
        setState<T>(key, next);
        throw error;
      } finally {
        inFlightRef.current.delete(key);
      }
    })();

    inFlightRef.current.set(key, promise);
    return promise;
  };

  const invalidate = (key: NormalizedKey) => {
    const prev = storeRef.current.get(key);
    if (prev) {
      setState(key, { ...prev, updatedAt: 0 });
    }
  };

  const client: QueryClient = useMemo(
    () => ({
      getState,
      setState,
      subscribe,
      fetch: fetchQuery,
      invalidate,
    }),
    [],
  );

  return <QueryContext.Provider value={client}>{children}</QueryContext.Provider>;
}

export function useQueryClient(): QueryClient {
  const ctx = useContext(QueryContext);
  if (!ctx) {
    throw new Error("useQueryClient must be used within a QueryProvider");
  }
  return ctx;
}

export function useRpcQuery<T>(
  key: QueryKey,
  fetcher: Fetcher<T>,
  options?: QueryOptions<T>,
) {
  const client = useQueryClient();
  const normalizedKey = useMemo(() => normalizeKey(key), [key]);
  const staleTime = options?.staleTime ?? 15_000;
  const enabled = options?.enabled ?? true;
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const [state, setLocalState] = useState<QueryState<T>>(() => {
    const existing = client.getState<T>(normalizedKey);
    if (existing) return existing;
    if (options?.initialData !== undefined) {
      return { status: "success", data: options.initialData, updatedAt: Date.now() };
    }
    return { status: "idle" };
  });

  useEffect(() => {
    const existing = client.getState<T>(normalizedKey);
    if (existing) {
      setLocalState(existing);
    } else if (options?.initialData !== undefined) {
      setLocalState({ status: "success", data: options.initialData, updatedAt: Date.now() });
    } else {
      setLocalState({ status: "idle" });
    }
    return client.subscribe(normalizedKey, () => {
      const next = client.getState<T>(normalizedKey);
      if (next) {
        setLocalState(next);
      }
    });
  }, [client, normalizedKey, options?.initialData]);

  useEffect(() => {
    if (!enabled) return;
    const current = client.getState<T>(normalizedKey);
    const now = Date.now();
    const isStale = !current?.updatedAt || now - current.updatedAt > staleTime;
    if (!current || current.status === "idle" || isStale) {
      void client.fetch<T>(normalizedKey, () => fetcherRef.current(), {
        keepPreviousData: options?.keepPreviousData,
      });
    }
  }, [client, normalizedKey, enabled, staleTime, options?.keepPreviousData]);

  useEffect(() => {
    if (!enabled || !options?.refetchIntervalMs) return;
    const interval = setInterval(() => {
      void client.fetch<T>(normalizedKey, () => fetcherRef.current(), { keepPreviousData: true });
    }, options.refetchIntervalMs);
    return () => clearInterval(interval);
  }, [client, normalizedKey, enabled, options?.refetchIntervalMs]);

  const refetch = useMemo(
    () => () => client.fetch<T>(normalizedKey, () => fetcherRef.current(), { keepPreviousData: true }),
    [client, normalizedKey],
  );

  return {
    data: state.data as T | undefined,
    error: state.error,
    loading: state.status === "loading" || (enabled && state.status === "idle"),
    stale: state.updatedAt ? Date.now() - state.updatedAt > staleTime : true,
    status: state.status,
    refetch,
    updatedAt: state.updatedAt,
  };
}
