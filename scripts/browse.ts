import { chromium } from "@playwright/test";
import { getSessionCookies } from "../tests/helpers/auth";

// Deterministic seed user IDs verified from scripts/seed.ts & database
const SEED_USERS = {
  learner: {
    id: "seed-learner-01",
    name: "Alice Learner",
    defaultPath: "/learn/intro-to-typescript/type-system-foundation",
  },
  creator: {
    id: "seed-creator-01",
    name: "Bob Creator",
    defaultPath: "/dashboard/courses/seed-course-ts",
  },
} as const;

type Role = keyof typeof SEED_USERS;

async function browse() {
  const args = process.argv.slice(2);
  const isHeadless = args.includes("--headless");
  const filteredArgs = args.filter((a) => !a.startsWith("--"));

  const roleArg = (filteredArgs[0] || "learner").toLowerCase() as Role;
  const targetRole: Role = roleArg === "creator" ? "creator" : "learner";
  const customPath = filteredArgs[1];

  const user = SEED_USERS[targetRole];
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const targetPath = customPath || user.defaultPath;
  const targetUrl = new URL(targetPath, baseUrl).toString();

  console.log(`[browse] Minting authentic session via Better Auth testUtils...`);
  console.log(`[browse] User: ${user.name} (${user.id})`);

  // Calls testAuth.$context.test.getCookies({ userId })
  // Inserts a legitimate session row into the DB and signs the session token
  const cookies = await getSessionCookies(user.id);

  console.log(`[browse] Launching Chrome (${isHeadless ? "headless" : "headed"})...`);
  console.log(`[browse] Target URL: ${targetUrl}`);

  const browser = await chromium.launch({
    channel: "chrome",
    headless: isHeadless,
  });

  const context = await browser.newContext();
  await context.addCookies(cookies);

  const page = await context.newPage();
  await page.goto(targetUrl);

  if (!isHeadless) {
    console.log(`[browse] Browser window open as ${user.name}. Navigate freely.`);
    console.log(`[browse] Close the Chrome window when finished.`);

    await new Promise<void>((resolve) => {
      page.on("close", () => resolve());
      browser.on("disconnected", () => resolve());
    });

    console.log(`[browse] Session closed.`);
  } else {
    console.log(`[browse] Page title: ${await page.title()}`);
    await page.waitForTimeout(1000);
    await browser.close();
  }
}

browse().catch((err) => {
  console.error("[browse] Error:", err);
  process.exit(1);
});
