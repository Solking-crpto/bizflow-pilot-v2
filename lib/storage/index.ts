import "server-only";
import { StorageProvider } from "./types";
import { SupabaseStorageProvider, getEvidenceBucket, buildEvidencePath } from "./supabase";
import { LocalStorageProvider } from "./local";

export * from "./types";
export * from "./validator";
export { getEvidenceBucket, buildEvidencePath, SupabaseStorageProvider, LocalStorageProvider };

let cachedProvider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (cachedProvider) return cachedProvider;

  const driver = process.env.STORAGE_DRIVER?.toLowerCase();
  if (driver === "local") {
    cachedProvider = new LocalStorageProvider();
    return cachedProvider;
  }

  // If Supabase credentials are not provided and in non-production, fallback to local
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    if (process.env.NODE_ENV !== "production") {
      cachedProvider = new LocalStorageProvider();
      return cachedProvider;
    }
  }

  cachedProvider = new SupabaseStorageProvider();
  return cachedProvider;
}
