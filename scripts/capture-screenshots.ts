import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { getSessionCookies } from "../tests/helpers/auth";

const OUTPUT_DIR = path.resolve(process.cwd(), "public/demo/screenshots");
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const CHROME_PATH =
  process.env.PLAYWRIGHT_CHROME_PATH ||
  (fs.existsSync("/home/darkside/.local/bin/google-chrome")
    ? "/home/darkside/.local/bin/google-chrome"
    : undefined);

interface ScreenshotTarget {
  filename: string;
  name: string;
  route: string;
  userId?: "seed-learner-01" | "seed-learner-05" | "seed-creator-01";
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
  isMobile?: boolean;
  fullPage?: boolean;
  description: string;
  extraDelayMs?: number;
  action?: (page: Page) => Promise<void>;
}

const TARGETS: ScreenshotTarget[] = [
  {
    filename: "01-catalog-marketplace.png",
    name: "Editorial Course Catalog",
    route: "/",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    description: "Serif hero headline, category filter pills, hairline border cards, and All-Access badges.",
  },
  {
    filename: "01b-catalog-grid.png",
    name: "Catalog Course Grid",
    route: "/",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    description: "Multi-column course cards with category labels, pricing badges, and All-Access pills.",
    action: async (page) => {
      await page.evaluate(() => window.scrollBy(0, 480));
    },
  },
  {
    filename: "02-course-detail-pricing.png",
    name: "Course Detail & Dual-Pricing",
    route: "/intro-to-typescript",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    description: "Prospectus overview with side-by-side 'Buy this course' ($49) and 'All-Access Pass' ($15/mo) pricing cards.",
  },
  {
    filename: "03-classroom-player.png",
    name: "Distraction-Free Classroom",
    route: "/learn/intro-to-typescript/type-system-foundation",
    userId: "seed-learner-01",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    extraDelayMs: 1000,
    description: "Clean video playback shell, ink-black progress bar, and collapsible syllabus navigation.",
  },
  {
    filename: "04-classroom-locked-preview.png",
    name: "Locked Content Access Gate",
    route: "/learn/intro-to-typescript/generics-and-constraints",
    userId: "seed-learner-05",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    extraDelayMs: 600,
    description: "Warm Blush Peach overlay wash signaling gated content with zero harsh disabled styling.",
  },
  {
    filename: "05-learner-library.png",
    name: "Learner Library & Workspace",
    route: "/library",
    userId: "seed-learner-01",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    description: "Personal enrolled course space with real-time progress bars, access badges, and zero ads.",
  },
  {
    filename: "06-creator-studio.png",
    name: "Creator Course Editor (Prospectus)",
    route: "/dashboard/courses/seed-course-ts",
    userId: "seed-creator-01",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    description: "Course metadata editor, subject category selector, price controls, and publication toggle.",
  },
  {
    filename: "06b-creator-curriculum.png",
    name: "Creator Curriculum Builder",
    route: "/dashboard/courses/seed-course-ts",
    userId: "seed-creator-01",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    description: "Curriculum builder with sequenced lessons, preview toggles, and video upload statuses.",
    action: async (page) => {
      const tab = page.getByRole("tab", { name: /curriculum/i });
      if (await tab.isVisible()) {
        await tab.click();
      }
    },
  },
  {
    filename: "07-creator-dashboard.png",
    name: "Creator Course Management Hub",
    route: "/dashboard/courses",
    userId: "seed-creator-01",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    description: "Creator course overview with publication badges, lesson metrics, and studio navigation.",
  },
  {
    filename: "08-billing-portal.png",
    name: "Billing & Subscription Center",
    route: "/billing",
    userId: "seed-learner-01",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    description: "All-Access Pass status, Stripe Customer Portal integration, and past invoice ledger.",
  },
  {
    filename: "09-mobile-catalog.png",
    name: "Mobile Responsive Catalog",
    route: "/",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    description: "Mobile-first catalog experience with stacked header and touch-friendly course cards.",
  },
  {
    filename: "10-mobile-course-detail.png",
    name: "Mobile Course Prospectus",
    route: "/intro-to-typescript",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    description: "Hand-held course prospectus with stacked dual-pricing cards.",
  },
  {
    filename: "11-login-screen.png",
    name: "Editorial Authentication Portal",
    route: "/login",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    description: "Clean sign-in modal with Google and GitHub OAuth buttons on warm paper canvas.",
  },
];

async function capture() {
  console.log("📸 Starting Cursusaurus GitHub Screenshot Generator…");
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Output Directory: ${OUTPUT_DIR}`);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Preflight server connectivity
  try {
    const res = await fetch(BASE_URL);
    if (!res.ok) {
      console.warn(`⚠️ Warning: Server responded with status ${res.status}`);
    } else {
      console.log(`   ✓ Connected to application server at ${BASE_URL}`);
    }
  } catch {
    console.error(`❌ Error: App server is not reachable at ${BASE_URL}. Ensure 'pnpm dev' is running.`);
    process.exit(1);
  }

  console.log(`   Launching browser (Chrome path: ${CHROME_PATH || "system default"})…`);
  const browser: Browser = await chromium.launch({
    channel: CHROME_PATH ? undefined : "chrome",
    executablePath: CHROME_PATH,
    headless: true,
  });

  // Mint cached sessions
  console.log("   🔑 Minting authenticated test sessions…");
  const userCookiesMap: Record<string, any> = {
    "seed-learner-01": await getSessionCookies("seed-learner-01"),
    "seed-learner-05": await getSessionCookies("seed-learner-05"),
    "seed-creator-01": await getSessionCookies("seed-creator-01"),
  };

  for (const target of TARGETS) {
    console.log(`\n📷 Capturing [${target.filename}] — ${target.name}…`);

    const context: BrowserContext = await browser.newContext({
      viewport: target.viewport,
      deviceScaleFactor: target.deviceScaleFactor,
      isMobile: target.isMobile,
    });

    if (target.userId && userCookiesMap[target.userId]) {
      await context.addCookies(userCookiesMap[target.userId]);
    }

    const page: Page = await context.newPage();
    const fullUrl = new URL(target.route, BASE_URL).toString();

    try {
      await page.goto(fullUrl, { waitUntil: "networkidle", timeout: 30000 });

      // Guarantee local fonts (Signifier & Sohne) are loaded
      await page.evaluate(async () => {
        if ("fonts" in document) {
          await document.fonts.ready;
        }
      });

      if (target.action) {
        await target.action(page);
      }

      if (target.extraDelayMs) {
        await page.waitForTimeout(target.extraDelayMs);
      } else {
        await page.waitForTimeout(400);
      }

      const destPath = path.join(OUTPUT_DIR, target.filename);
      await page.screenshot({
        path: destPath,
        fullPage: target.fullPage ?? false,
      });

      const stats = fs.statSync(destPath);
      const kb = Math.round(stats.size / 1024);
      console.log(`   ✓ Saved ${target.filename} (${kb} KB)`);
    } catch (err) {
      console.error(`   ❌ Failed to capture ${target.filename}:`, err);
    } finally {
      await context.close();
    }
  }

  await browser.close();
  console.log("\n✨ All screenshots captured successfully in public/demo/screenshots/\n");
}

capture().catch((err) => {
  console.error("Screenshot capture pipeline failed:", err);
  process.exit(1);
});
