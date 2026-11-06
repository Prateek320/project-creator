import { defineConfig } from "@neon/config/v1";

/**
 * Neon branches map to proovd environments:
 *   main    → production (default branch)
 *   staging → staging, deployed from the git `staging` branch
 *   dev     → local development
 * Those three are long-lived. Any other branch (feature work, previews) expires after 7 days.
 */
const LONG_LIVED = new Set(["main", "staging", "dev"]);

export default defineConfig({
  auth: false,
  branch: (branch) => {
    if (branch.isDefault || LONG_LIVED.has(branch.name)) return {};
    if (!branch.exists) return { ttl: "7d" };
    return {};
  },
});
