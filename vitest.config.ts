import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    hookTimeout: 60000,
    testTimeout: 60000,
    exclude: ["**/node_modules/**", "**/tests/e2e/**", "**/.next/**"],
    env: {
      DATABASE_URL: "postgres://postgres:postgres@localhost:5432/test",
      BETTER_AUTH_SECRET: "test_secret_32_characters_long_min",
      BETTER_AUTH_URL: "http://localhost:3000",
      STRIPE_SECRET_KEY: "sk_test_mock_stripe_secret_key",
      STRIPE_WEBHOOK_SECRET: "whsec_test_secret_for_vitest",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_mock_stripe_publishable_key",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test_service_role_key",
    },
  },
});
