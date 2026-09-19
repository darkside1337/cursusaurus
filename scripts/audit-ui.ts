import { execSync } from "child_process";

try {
  const result = execSync(
    "git grep -n -E '<button|<input' -- 'app/' 'components/' ':!components/ui/'",
    { encoding: "utf-8" }
  ).trim();

  if (result) {
    console.error("❌ UI Audit failed: Found raw <button> or <input> tags outside components/ui/:\n");
    console.error(result);
    process.exit(1);
  }
} catch (err: unknown) {
  // git grep exits with code 1 when no matches are found, which is what we want
  const error = err as { status?: number };
  if (error.status === 1) {
    console.log("✅ UI Audit passed: No raw <button> or <input> tags found outside components/ui/.");
    process.exit(0);
  }
  console.error("Error executing UI audit:", err);
  process.exit(1);
}
