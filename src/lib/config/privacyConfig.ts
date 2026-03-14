// src/lib/config/privacyConfig.ts
//
// Centralized privacy configuration for cloak402.
// All tunables (delay windows, funding bands, per-seller overrides) live here
// so that ephemeral.ts and ghostPay.ts never hardcode privacy parameters.

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// ── Types ───────────────────────────────────────────────────────────────

export interface PrivacyConfig {
  /** Minimum random delay before any API call (ms) */
  delayMinMs: number;
  /** Maximum random delay before any API call (ms) */
  delayMaxMs: number;

  /** Minimum USDC funded to each ephemeral wallet (string for precision) */
  fundingMinUsdc: string;
  /** Maximum USDC funded to each ephemeral wallet (string for precision) */
  fundingMaxUsdc: string;

  /**
   * Per-seller overrides keyed by URL path prefix.
   * Allows different funding/delay ranges for different endpoints.
   * Example: { "/book-flight": { fundingMinUsdc: "0.05", fundingMaxUsdc: "0.12" } }
   */
  sellerOverrides: Record<
    string,
    Partial<Pick<PrivacyConfig, "fundingMinUsdc" | "fundingMaxUsdc" | "delayMinMs" | "delayMaxMs">>
  >;
}

/** Resolved config for a single call — no optionals, no overrides map */
export interface ResolvedPrivacyParams {
  delayMinMs: number;
  delayMaxMs: number;
  fundingMinUsdc: string;
  fundingMaxUsdc: string;
}

// ── Loader ──────────────────────────────────────────────────────────────

let cached: PrivacyConfig | null = null;

/**
 * Loads the global PrivacyConfig from environment variables with sane defaults.
 * The result is cached for the lifetime of the process.
 */
export function loadPrivacyConfig(): PrivacyConfig {
  if (cached) return cached;

  let sellerOverrides: PrivacyConfig["sellerOverrides"] = {};
  const raw = process.env.PRIVACY_SELLER_OVERRIDES;
  if (raw) {
    try {
      sellerOverrides = JSON.parse(raw);
    } catch {
      console.warn(
        "[privacyConfig] ⚠️  PRIVACY_SELLER_OVERRIDES is not valid JSON, ignoring"
      );
    }
  }

  cached = {
    delayMinMs: parseInt(process.env.PRIVACY_DELAY_MIN_MS ?? "1500", 10),
    delayMaxMs: parseInt(process.env.PRIVACY_DELAY_MAX_MS ?? "6000", 10),
    fundingMinUsdc: process.env.PRIVACY_FUNDING_MIN_USDC ?? "0.03",
    fundingMaxUsdc: process.env.PRIVACY_FUNDING_MAX_USDC ?? "0.09",
    sellerOverrides,
  };

  console.log(
    `[privacyConfig] loaded: delay=${cached.delayMinMs}–${cached.delayMaxMs}ms, ` +
      `funding=${cached.fundingMinUsdc}–${cached.fundingMaxUsdc} USDC, ` +
      `${Object.keys(sellerOverrides).length} seller override(s)`
  );

  return cached;
}

// ── Resolver ────────────────────────────────────────────────────────────

/**
 * Resolves the effective privacy parameters for a given API path.
 * Merges global defaults with any matching seller override.
 */
export function resolveParamsForPath(path: string): ResolvedPrivacyParams {
  const config = loadPrivacyConfig();

  // Find the first override whose key is a prefix of the path
  let override: Partial<ResolvedPrivacyParams> = {};
  for (const [prefix, ov] of Object.entries(config.sellerOverrides)) {
    if (path.startsWith(prefix)) {
      override = ov;
      break;
    }
  }

  return {
    delayMinMs: override.delayMinMs ?? config.delayMinMs,
    delayMaxMs: override.delayMaxMs ?? config.delayMaxMs,
    fundingMinUsdc: override.fundingMinUsdc ?? config.fundingMinUsdc,
    fundingMaxUsdc: override.fundingMaxUsdc ?? config.fundingMaxUsdc,
  };
}
