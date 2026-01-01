export type RpcConfig = {
  url: string;
  username?: string;
  password?: string;
  timeoutMs?: number;
};

export type AddressUtxo = {
  address: string;
  txid: string;
  outputIndex: number;
  script: string;
  liners: number;
  height: number;
};

export type AddressBalance = {
  balance_liners: number;
  received_liners: number;
  balance: number;
  received: number;
};

export type FeeEstimate = {
  feerate: number;
  blocks: number;
  errors?: string[];
};

export type BlockchainInfo = {
  chain: string;
  blocks: number;
  headers: number;
  difficulty: number;
  verificationprogress: number;
  size_on_disk?: number;
  pruned?: boolean;
};

export class RpcError extends Error {
  code?: number;
  constructor(message: string, code?: number) {
    super(message);
    this.code = code;
  }
}

export class RpcClient {
  private config: RpcConfig;
  private tauriHttp: any | null = null;

  constructor(config: RpcConfig) {
    this.config = config;
  }

  setConfig(config: RpcConfig) {
    this.config = config;
  }

  private headers(): HeadersInit {
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (this.config.username && this.config.password) {
      const token = btoa(`${this.config.username}:${this.config.password}`);
      headers["Authorization"] = `Basic ${token}`;
    }
    return headers;
  }

  private async ensureTauriHttp() {
    if (!this.isTauriRuntime()) return null;
    if (this.tauriHttp) return this.tauriHttp;
    const mod = await import("@tauri-apps/plugin-http");
    this.tauriHttp = mod;
    return mod;
  }

  private isTauriRuntime() {
    if (typeof window === "undefined") return false;
    const w = window as any;
    return Boolean(w.__TAURI_IPC__ || w.__TAURI_INTERNALS__ || w.__TAURI_METADATA__ || w.__TAURI__);
  }

  async call<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs && this.config.timeoutMs > 0 ? this.config.timeoutMs : 15000,
    );
    try {
      const payload = {
        jsonrpc: "2.0",
        id: "baseline-light",
        method,
        params,
      };
      const useTauri = this.isTauriRuntime();
      if (useTauri) {
        const http = await this.ensureTauriHttp();
        const resp = await http.fetch(this.config.url, {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        if (!resp.ok) {
          const text = await resp.text();
          throw new RpcError(`RPC HTTP ${resp.status}: ${text}`, resp.status);
        }
        const data: any = await resp.json();
        if (data?.error) {
          throw new RpcError(data.error.message ?? "RPC error", data.error.code);
        }
        return data.result as T;
      } else {
        const res = await fetch(this.config.url, {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        if (!res.ok) {
          const text = await res.text();
          throw new RpcError(`RPC HTTP ${res.status}: ${text}`, res.status);
        }
        const data = await res.json();
        if (data.error) {
          throw new RpcError(data.error.message ?? "RPC error", data.error.code);
        }
        return data.result as T;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  getBlockchainInfo(): Promise<BlockchainInfo> {
    return this.call("getblockchaininfo");
  }

  getAddressBalance(addresses: string[]): Promise<AddressBalance> {
    return this.call("getaddressbalance", [{ addresses }]);
  }

  getAddressUtxos(addresses: string[]): Promise<AddressUtxo[]> {
    return this.call("getaddressutxos", [{ addresses }]);
  }

  getAddressTxids(addresses: string[], includeHeight = true): Promise<any[]> {
    return this.call("getaddresstxids", [{ addresses, include_height: includeHeight }]);
  }

  getRawTransaction(txid: string, verbose = true, blockHash?: string): Promise<any> {
    const params: unknown[] = [txid, verbose];
    if (blockHash) params.push(blockHash);
    return this.call("getrawtransaction", params);
  }

  sendRawTransaction(hex: string): Promise<string> {
    return this.call("sendrawtransaction", [hex]);
  }

  estimateSmartFee(targetBlocks = 6): Promise<FeeEstimate> {
    return this.call("estimatesmartfee", [targetBlocks]);
  }
}
