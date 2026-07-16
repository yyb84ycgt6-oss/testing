/**
 * Environment-based configuration loader.
 * All secrets and external URLs come from environment variables only —
 * nothing is hard-coded here.
 */

export interface AppConfig {
  readonly nodeEnv: "development" | "test" | "production";
  readonly logLevel: "debug" | "info" | "warn" | "error";
  /** Never log this value; treat as opaque. */
  readonly jwtSecret: string;
  readonly databaseUrl: string;
  readonly auditRetentionDays: number;
}

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
        "Set it in your environment or .env file — never hard-code secrets."
    );
  }
  return val;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export function loadConfig(): AppConfig {
  const nodeEnv = optionalEnv("NODE_ENV", "development") as AppConfig["nodeEnv"];
  const validEnvs: AppConfig["nodeEnv"][] = ["development", "test", "production"];
  if (!validEnvs.includes(nodeEnv)) {
    throw new Error(`Invalid NODE_ENV: "${nodeEnv}". Must be one of ${validEnvs.join(", ")}.`);
  }

  // In test mode allow placeholder values so CI doesn't require real secrets.
  const isTest = nodeEnv === "test";

  return {
    nodeEnv,
    logLevel: optionalEnv("LOG_LEVEL", "info") as AppConfig["logLevel"],
    jwtSecret: isTest
      ? optionalEnv("JWT_SECRET", "test-only-secret-not-for-production")
      : requireEnv("JWT_SECRET"),
    databaseUrl: isTest
      ? optionalEnv("DATABASE_URL", "sqlite://:memory:")
      : requireEnv("DATABASE_URL"),
    auditRetentionDays: Number(optionalEnv("AUDIT_RETENTION_DAYS", "365")),
  };
}
