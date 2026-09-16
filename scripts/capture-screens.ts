import { chromium } from "@playwright/test";
import { getSessionCookies } from "../tests/helpers/auth";

const BASE = "http://localhost:3000";
const OUT = "/tmp/opencode/ours";
const DOM = "/tmp/opencode/ours-dom";

const CREATOR = "seed-creator-01";
const LEARNER = "seed-learner-01";

const captures: { name: string; path: string; userId: string | null }[] = [
  { name: "catalog", path: "/", userId: LEARNER },
  { name: "course-detail", path: "/intro-to-typescript", userId: LEARNER },
  { name: "login", path: "/login", userId: null },
  { name: "dashboard-courses", path: "/dashboard/courses", userId: CREATOR },
  { name: "dashboard-new", path: "/dashboard/courses/new", userId: CREATOR },
  { name: "dashboard-edit", path: "/dashboard/courses/seed-course-ts", userId: CREATOR },
  { name: "not-found", path: "/definitely-not-a-route", userId: null },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  for (const { name, path, userId } of captures) {
    const page = await context.newPage();

    if (userId) {
      const cookies = await getSessionCookies(userId, "localhost");
      console.log(`[${name}] resolved ${cookies.length} cookie(s) for ${userId}`);
      await context.addCookies(cookies as Parameters<typeof context.addCookies>[0]);
    }

    const response = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);
    await page.waitForLoadState("networkidle").catch(() => {});

    const status = response?.status();
    const finalUrl = page.url();
    const bodyLen = (await page.content()).length;
    console.log(`[${name}] ${status} ${finalUrl} dom=${bodyLen}`);

    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    const html = await page.content();
    await import("fs").then((fs) => fs.promises.writeFile(`${DOM}/${name}.html`, html));

    await page.close();
  }

  await browser.close();
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});