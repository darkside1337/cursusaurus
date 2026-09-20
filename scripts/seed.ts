import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { eq, inArray, like, sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import {
  courses,
  entitlements,
  lessonProgress,
  lessons,
  purchases,
  refundTombstones,
  subscriptions,
  user,
} from "@/lib/db/schema";
import { getStorageClient } from "@/lib/storage";

const VIDEO_BUCKET = "course-videos";
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_BUCKET_BUDGET_BYTES = 300 * 1024 * 1024; // 300 MB threshold (60% of 500 MB)

interface ManifestClip {
  sha256: string;
  bytes: number;
  durationSeconds: number;
}

interface Manifest {
  clips: Record<string, ManifestClip>;
}

// ---------------------------------------------------------------------------
// 1. Safety Guards & CLI Argument Parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isSkipVideos = args.includes("--skip-videos");
const isCheckImages = args.includes("--check-images");
const isClean = args.includes("--clean");

function runSafetyGuards() {
  console.log("🛡️  Running safety guards…");

  if (process.env.NODE_ENV === "production") {
    console.error("❌ Refusing to seed: NODE_ENV is set to 'production'.");
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ Refusing to seed: DATABASE_URL is not set.");
    process.exit(1);
  }

  try {
    const parsed = new URL(dbUrl);
    const host = parsed.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1" || host === "db" || host === "postgres";
    const isNeon = host.endsWith(".neon.tech");
    const isSupabase = host.endsWith(".supabase.com") || host.endsWith(".supabase.co");

    if (!isLocal && !isNeon && !isSupabase) {
      console.error(
        `❌ Refusing to seed: Database host '${host}' is not on the allowed development host allowlist (localhost, *.neon.tech, *.supabase.co).`
      );
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ Failed to parse DATABASE_URL hostname:", err);
    process.exit(1);
  }

  console.log("   ✓ Environment is non-production");
  console.log("   ✓ Database host is approved");
}

// ---------------------------------------------------------------------------
// 2. Preflight Checks & Manifest Hash Verification
// ---------------------------------------------------------------------------

function loadAndVerifyManifest(): Manifest {
  const manifestPath = path.resolve(process.cwd(), "scripts/fixtures/manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Fixtures manifest not found at ${manifestPath}`);
  }

  const manifest: Manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  for (const [clipName, meta] of Object.entries(manifest.clips)) {
    const clipPath = path.resolve(process.cwd(), "scripts/fixtures/videos", clipName);
    if (!fs.existsSync(clipPath)) {
      throw new Error(`Fixture video file missing: ${clipPath}`);
    }

    const buf = fs.readFileSync(clipPath);
    if (buf.length > MAX_FILE_BYTES) {
      throw new Error(`Fixture ${clipName} (${buf.length} bytes) exceeds 50MB per-file cap.`);
    }

    const actualHash = crypto.createHash("sha256").update(buf).digest("hex");
    if (actualHash !== meta.sha256) {
      throw new Error(
        `Checksum mismatch for ${clipName}! Expected ${meta.sha256}, got ${actualHash}`
      );
    }
  }

  return manifest;
}

async function checkStorageBudget(manifest: Manifest, lessonCount: number): Promise<{ existingBytes: number; projectedNewBytes: number; totalProjectedBytes: number }> {
  const storage = getStorageClient();
  const { data: buckets, error: bucketErr } = await storage.storage.listBuckets();
  if (bucketErr) {
    throw new Error(`Failed to list storage buckets: ${bucketErr.message}`);
  }

  const bucket = buckets?.find((b) => b.name === VIDEO_BUCKET || b.id === VIDEO_BUCKET);
  if (!bucket) {
    throw new Error(`Storage bucket '${VIDEO_BUCKET}' does not exist.`);
  }

  // Calculate current storage size by scanning folders
  let existingBytes = 0;
  const { data: rootItems } = await storage.storage.from(VIDEO_BUCKET).list("", { limit: 100 });
  if (rootItems) {
    for (const item of rootItems) {
      if (item.metadata?.size) {
        existingBytes += item.metadata.size;
      }
    }
  }

  // Calculate projected new bytes: 3 fixtures + per-lesson copies
  const clipValues = Object.values(manifest.clips);
  const fixtureBytes = clipValues.reduce((acc, c) => acc + c.bytes, 0);
  const avgClipBytes = fixtureBytes / (clipValues.length || 1);
  const projectedNewBytes = fixtureBytes + lessonCount * avgClipBytes;
  const totalProjectedBytes = existingBytes + projectedNewBytes;

  if (totalProjectedBytes > MAX_BUCKET_BUDGET_BYTES) {
    throw new Error(
      `Projected bucket usage (${(totalProjectedBytes / 1024 / 1024).toFixed(2)} MB) exceeds threshold of ${(MAX_BUCKET_BUDGET_BYTES / 1024 / 1024).toFixed(2)} MB.`
    );
  }

  return { existingBytes, projectedNewBytes, totalProjectedBytes };
}

async function checkUnsplashImages(urls: string[]) {
  console.log("🔍 Checking cover thumbnail URLs (--check-images)…");
  let failed = 0;
  for (const url of urls) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) {
        console.log(`   ✓ [${res.status}] ${url.slice(0, 60)}…`);
      } else {
        console.warn(`   ⚠️ [${res.status}] Failed URL: ${url}`);
        failed++;
      }
    } catch (e) {
      console.warn(`   ⚠️ Error checking ${url}:`, e);
      failed++;
    }
  }
  if (failed > 0) {
    console.warn(`   ⚠️ ${failed} image URLs returned warnings.`);
  } else {
    console.log("   ✓ All thumbnail URLs responded with HTTP 200.");
  }
}

// ---------------------------------------------------------------------------
// 3. Data Definitions (8 Users, 8 Courses, 25 Lessons)
// ---------------------------------------------------------------------------

const SEED_CREATORS = [
  {
    id: "seed-creator-01",
    name: "Bob Creator",
    email: "creator@example.com",
    emailVerified: true,
  },
  {
    id: "seed-creator-02",
    name: "Elena Rostova",
    email: "elena.rostova@cursusaurus.dev",
    emailVerified: true,
  },
  {
    id: "seed-creator-03",
    name: "Marcus Thorne",
    email: "marcus.thorne@cursusaurus.dev",
    emailVerified: true,
  },
];

const SEED_LEARNERS = [
  {
    id: "seed-learner-01",
    name: "Alice Learner",
    email: "learner@example.com",
    emailVerified: true,
  },
  {
    id: "seed-learner-02",
    name: "Daniel Vance",
    email: "daniel.vance@example.com",
    emailVerified: true,
  },
  {
    id: "seed-learner-03",
    name: "Chloe Bennett",
    email: "chloe.bennett@example.com",
    emailVerified: true,
  },
  {
    id: "seed-learner-04",
    name: "Liam Patel",
    email: "liam.patel@example.com",
    emailVerified: true,
  },
  {
    id: "seed-learner-05",
    name: "Sophia Ramos",
    email: "sophia.ramos@example.com",
    emailVerified: true,
  },
];

const SEED_COURSES = [
  {
    id: "seed-course-ts",
    title: "Introduction to TypeScript & Type-Level Design",
    slug: "intro-to-typescript",
    description: "A rigorous exploration of structural typing, generic constraints, conditional mapping, and domain modeling from first principles.",
    category: "Code",
    priceCents: 4900,
    isPublished: true,
    creatorId: "seed-creator-01",
    thumbnailUrl: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1200&auto=format&fit=crop",
    lessons: [
      {
        id: "seed-lesson-ts-01",
        title: "The Type System Foundation",
        slug: "type-system-foundation",
        description: "Understanding structural typing, nominal escape hatches, and primitive unions.",
        orderIndex: 0,
        isPreview: true,
      },
      {
        id: "seed-lesson-ts-02",
        title: "Generics and Constraints",
        slug: "generics-and-constraints",
        description: "Building flexible, reusable type contracts without sacrificing sound inference.",
        orderIndex: 1,
        isPreview: false,
      },
      {
        id: "seed-lesson-ts-03",
        title: "Conditional and Mapped Types",
        slug: "conditional-and-mapped-types",
        description: "Advanced type transformations, distributive conditionals, and infer keyword patterns.",
        orderIndex: 2,
        isPreview: false,
      },
      {
        id: "seed-lesson-ts-04",
        title: "Domain Modeling & Parse, Don't Validate",
        slug: "domain-modeling-patterns",
        description: "Synthesizing domain invariants into compile-time proofs and runtime guards.",
        orderIndex: 3,
        isPreview: false,
      },
    ],
  },
  {
    id: "seed-course-next",
    title: "Next.js Architecture & High-Performance Systems",
    slug: "nextjs-architecture",
    description: "Deep dive into App Router primitives, Server Components, Suspense boundaries, caching lifecycles, and resilient streaming architecture.",
    category: "Code",
    priceCents: 9900,
    isPublished: true,
    creatorId: "seed-creator-03",
    thumbnailUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1200&auto=format&fit=crop",
    lessons: [
      {
        id: "seed-lesson-next-01",
        title: "Server Components & Suspense Architecture",
        slug: "rsc-suspense-architecture",
        description: "Understanding React 19 execution boundaries and selective hydration protocols.",
        orderIndex: 0,
        isPreview: true,
      },
      {
        id: "seed-lesson-next-02",
        title: "Data Cache, Partial Prerendering & Cache Life",
        slug: "data-cache-and-ppr",
        description: "Mastering Next.js 16 caching layers and instant static shells.",
        orderIndex: 1,
        isPreview: false,
      },
      {
        id: "seed-lesson-next-03",
        title: "Mutations, Server Actions & Optimistic States",
        slug: "mutations-and-optimistic-ui",
        description: "Transactional mutations with progressive enhancement and rollback handling.",
        orderIndex: 2,
        isPreview: false,
      },
      {
        id: "seed-lesson-next-04",
        title: "Edge Routing & Distributed Edge State",
        slug: "edge-routing-and-proxy",
        description: "Designing low-latency edge routing with global caching and session security.",
        orderIndex: 3,
        isPreview: false,
      },
    ],
  },
  {
    id: "seed-course-typography",
    title: "Editorial Typography & Spatial Layouts",
    slug: "editorial-typography",
    description: "Principles of classical book design translated to modern digital surfaces: typographic scales, fluid vertical rhythm, and editorial whitespace.",
    category: "Design",
    priceCents: 7900,
    isPublished: true,
    creatorId: "seed-creator-02",
    thumbnailUrl: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=1200&auto=format&fit=crop",
    lessons: [
      {
        id: "seed-lesson-typo-01",
        title: "Modular Scales & Measure Discipline",
        slug: "modular-scales-and-measure",
        description: "Constructing harmonic type scales and strict line-length constraints.",
        orderIndex: 0,
        isPreview: true,
      },
      {
        id: "seed-lesson-typo-02",
        title: "Vertical Rhythm & Baseline Geometry",
        slug: "vertical-rhythm-and-baselines",
        description: "Aligning text blocks, headings, and margins across fluid viewports.",
        orderIndex: 1,
        isPreview: false,
      },
      {
        id: "seed-lesson-typo-03",
        title: "Expressive Serif Pairings & Micro-Typo",
        slug: "expressive-serif-pairings",
        description: "Editorial hierarchy, optical sizes, ligatures, and tabular numerals.",
        orderIndex: 2,
        isPreview: false,
      },
    ],
  },
  {
    id: "seed-course-writing",
    title: "The Engineering Monograph: Technical Writing with Precision",
    slug: "engineering-monograph",
    description: "Write technical documentation and architecture decision records that clarify complex trade-offs, persuade engineering teams, and endure.",
    category: "Writing",
    priceCents: 3900,
    isPublished: true,
    creatorId: "seed-creator-02",
    thumbnailUrl: "https://images.unsplash.com/photo-1455390582262-044cdead277a?q=80&w=1200&auto=format&fit=crop",
    lessons: [
      {
        id: "seed-lesson-writ-01",
        title: "The Anatomy of an Architecture RFC",
        slug: "anatomy-of-an-rfc",
        description: "Structuring technical proposals that lead with invariants and trade-offs.",
        orderIndex: 0,
        isPreview: true,
      },
      {
        id: "seed-lesson-writ-02",
        title: "Eliminating Ambiguity in Invariant Specs",
        slug: "eliminating-ambiguity-in-specs",
        description: "Drafting unambiguous state definitions and contractual boundary guarantees.",
        orderIndex: 1,
        isPreview: false,
      },
      {
        id: "seed-lesson-writ-03",
        title: "Diagrammatic Precision: Sequences & Systems",
        slug: "diagrammatic-precision",
        description: "Using Mermaid and minimal formal diagrams to communicate systems truth.",
        orderIndex: 2,
        isPreview: false,
      },
    ],
  },
  {
    id: "seed-course-photo",
    title: "Documentary Cinematography & Color Grading",
    slug: "documentary-cinematography",
    description: "Visual storytelling through natural lighting, deliberate framing, continuous camera motion, and cinema-grade ACES color pipelines.",
    category: "Photography",
    priceCents: 8900,
    isPublished: true,
    creatorId: "seed-creator-01",
    thumbnailUrl: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?q=80&w=1200&auto=format&fit=crop",
    lessons: [
      {
        id: "seed-lesson-photo-01",
        title: "Available Light & Subject Geometry",
        slug: "available-light-subject-geometry",
        description: "Finding narrative contrast using window sources, reflectors, and falloff.",
        orderIndex: 0,
        isPreview: true,
      },
      {
        id: "seed-lesson-photo-02",
        title: "Focal Length Psychology & Space Compression",
        slug: "focal-length-psychology",
        description: "How 28mm vs 50mm vs 85mm fundamentally transforms audience empathy.",
        orderIndex: 1,
        isPreview: false,
      },
      {
        id: "seed-lesson-photo-03",
        title: "ACES Workflows & Film Emulation",
        slug: "aces-workflows-film-emulation",
        description: "Building non-destructive color grade trees that mimic analog print stocks.",
        orderIndex: 2,
        isPreview: false,
      },
    ],
  },
  {
    id: "seed-course-business",
    title: "B2B Software Pricing Strategies & Monetization Mechanics",
    slug: "b2b-pricing-strategies",
    description: "Designing value metrics, packaging tiers, seat vs usage pricing, and hybrid monetization models for modern cloud software products.",
    category: "Business",
    priceCents: 12900,
    isPublished: true,
    creatorId: "seed-creator-03",
    thumbnailUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1200&auto=format&fit=crop",
    lessons: [
      {
        id: "seed-lesson-biz-01",
        title: "Aligning the Primary Value Metric",
        slug: "aligning-primary-value-metric",
        description: "Selecting pricing meters that grow symmetrically with customer business value.",
        orderIndex: 0,
        isPreview: true,
      },
      {
        id: "seed-lesson-biz-02",
        title: "Packaging Tiers & The Good-Better-Best Trap",
        slug: "packaging-tiers-and-traps",
        description: "Constructing high-converting feature gates without inducing buyer friction.",
        orderIndex: 1,
        isPreview: false,
      },
      {
        id: "seed-lesson-biz-03",
        title: "Expansion Economics & Churn Insulation",
        slug: "expansion-economics-and-churn",
        description: "Mechanisms for net revenue retention exceeding 120% through usage tiers.",
        orderIndex: 2,
        isPreview: false,
      },
    ],
  },
  {
    id: "seed-course-marketing",
    title: "Positioning & Technical Product Storytelling",
    slug: "product-storytelling",
    description: "Differentiate Developer and B2B products in crowded markets: identify competitor anchor traps, define categories, and craft compelling narratives.",
    category: "Marketing",
    priceCents: 5900,
    isPublished: true,
    creatorId: "seed-creator-02",
    thumbnailUrl: "https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=1200&auto=format&fit=crop",
    lessons: [
      {
        id: "seed-lesson-mkt-01",
        title: "The Flaw of Feature Comparison Tables",
        slug: "flaw-of-feature-comparison",
        description: "Why competing on checkbox features surrenders market authority to incumbents.",
        orderIndex: 0,
        isPreview: true,
      },
      {
        id: "seed-lesson-mkt-02",
        title: "Defining the Enemy & The Shift in Context",
        slug: "defining-the-enemy-and-shift",
        description: "Framing your product around an undeniable change in the industry.",
        orderIndex: 1,
        isPreview: false,
      },
      {
        id: "seed-lesson-mkt-03",
        title: "Technical Hero Copy That Converts Engineers",
        slug: "technical-hero-copy",
        description: "Crafting headlines and code snippets that immediately communicate superpowers.",
        orderIndex: 2,
        isPreview: false,
      },
    ],
  },
  {
    id: "seed-course-consensus",
    title: "Distributed Consensus from Scratch (Draft)",
    slug: "distributed-consensus",
    description: "Building a verified Raft implementation in TypeScript with deterministic network simulation and fault injection.",
    category: "Code",
    priceCents: 14900,
    isPublished: false, // DRAFT to verify unpublished filtering
    creatorId: "seed-creator-03",
    thumbnailUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1200&auto=format&fit=crop",
    lessons: [
      {
        id: "seed-lesson-dc-01",
        title: "Leader Election & Heartbeat Timers",
        slug: "leader-election-and-heartbeats",
        description: "Simulating partitioned clusters and randomized election timeouts.",
        orderIndex: 0,
        isPreview: true,
      },
      {
        id: "seed-lesson-dc-02",
        title: "Log Replication & Safety Invariants",
        slug: "log-replication-and-safety",
        description: "Proving commit safety and uncommitted entry truncation.",
        orderIndex: 1,
        isPreview: false,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// 4. Clean Operation (`--clean`)
// ---------------------------------------------------------------------------

async function cleanSeededData() {
  console.log("🧹 Running seed:clean… Deleting all seeded records & storage assets.");

  // 1. Storage cleaning
  try {
    const storage = getStorageClient();
    const { data: rootItems } = await storage.storage.from(VIDEO_BUCKET).list("", { limit: 100 });
    if (rootItems) {
      for (const item of rootItems) {
        if (item.name === "_fixtures" || item.name.startsWith("seed-course-")) {
          const { data: subFiles } = await storage.storage.from(VIDEO_BUCKET).list(item.name, { limit: 100 });
          if (subFiles && subFiles.length > 0) {
            const pathsToRemove = subFiles.map((sf) => `${item.name}/${sf.name}`);
            await storage.storage.from(VIDEO_BUCKET).remove(pathsToRemove);
            console.log(`   Deleted ${pathsToRemove.length} storage objects in ${item.name}/`);
          }
        }
      }
    }
  } catch (err) {
    console.warn("   ⚠️ Warning during storage cleaning:", err);
  }

  // 2. Database cleaning
  const seedCourseIds = SEED_COURSES.map((c) => c.id);
  const seedUserIds = [...SEED_CREATORS, ...SEED_LEARNERS].map((u) => u.id);

  await db.delete(lessonProgress).where(inArray(lessonProgress.courseId, seedCourseIds));
  await db.delete(entitlements).where(inArray(entitlements.userId, seedUserIds));
  await db.delete(subscriptions).where(inArray(subscriptions.userId, seedUserIds));
  await db.delete(purchases).where(inArray(purchases.userId, seedUserIds));
  await db.delete(refundTombstones).where(like(refundTombstones.stripePaymentIntentId, "seed_%"));
  await db.delete(lessons).where(inArray(lessons.courseId, seedCourseIds));
  await db.delete(courses).where(inArray(courses.id, seedCourseIds));
  await db.delete(user).where(inArray(user.id, seedUserIds));

  console.log("   ✓ Database rows with seed- IDs and matching records removed.");
  console.log("✨ Clean completed successfully.");
}

// ---------------------------------------------------------------------------
// 5. Main Seed Engine
// ---------------------------------------------------------------------------

async function seed() {
  runSafetyGuards();

  if (isClean) {
    await cleanSeededData();
    process.exit(0);
  }

  const manifest = loadAndVerifyManifest();
  console.log("   ✓ Verified manifest.json checksums & file size caps");

  const totalLessons = SEED_COURSES.reduce((acc, c) => acc + c.lessons.length, 0);

  // Storage preflight
  const budget = await checkStorageBudget(manifest, totalLessons);
  console.log(
    `   ✓ Storage budget preflight: Existing ${(budget.existingBytes / 1024 / 1024).toFixed(
      2
    )} MB + Projected ${(budget.projectedNewBytes / 1024 / 1024).toFixed(
      2
    )} MB = ${(budget.totalProjectedBytes / 1024 / 1024).toFixed(2)} MB / ${(
      MAX_BUCKET_BUDGET_BYTES / 1024 / 1024
    ).toFixed(0)} MB threshold`
  );

  if (isCheckImages) {
    const imageUrls = SEED_COURSES.map((c) => c.thumbnailUrl).filter(Boolean) as string[];
    await checkUnsplashImages(imageUrls);
  }

  if (isDryRun) {
    console.log("\n📋 DRY RUN SUMMARY:");
    console.log(`   - Creators to upsert: ${SEED_CREATORS.length}`);
    console.log(`   - Learners to upsert: ${SEED_LEARNERS.length}`);
    console.log(`   - Courses to upsert: ${SEED_COURSES.length} (${SEED_COURSES.filter((c) => c.isPublished).length} published, 1 draft)`);
    console.log(`   - Lessons to upsert: ${totalLessons}`);
    console.log(`   - Video fixtures: 3 clips (${(Object.values(manifest.clips).reduce((a, c) => a + c.bytes, 0) / 1024 / 1024).toFixed(2)} MB total)`);
    console.log(`   - Video storage copies: ${totalLessons} server-side copies`);
    console.log("\n✨ Dry run completed with 0 writes performed.");
    process.exit(0);
  }

  console.log("\n🌱 Seeding database records…");

  // A. Upsert Creators & Learners
  for (const u of [...SEED_CREATORS, ...SEED_LEARNERS]) {
    await db
      .insert(user)
      .values({
        id: u.id,
        name: u.name,
        email: u.email,
        emailVerified: u.emailVerified,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: user.id,
        set: {
          name: u.name,
          email: u.email,
          updatedAt: new Date(),
        },
      });
  }
  console.log(`   ✓ Upserted ${SEED_CREATORS.length} creators and ${SEED_LEARNERS.length} learners`);

  // B. Admin Account Grant (if SEED_ADMIN_EMAIL exists in DB)
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "medini.ali.2000@gmail.com";
  let adminUserId: string | null = null;
  if (adminEmail) {
    const [adminUser] = await db.select().from(user).where(eq(user.email, adminEmail)).limit(1);
    if (adminUser) {
      adminUserId = adminUser.id;
      console.log(`   ✓ Found admin account for '${adminEmail}' (${adminUserId})`);
    } else {
      console.warn(`   ⚠️ Admin user with email '${adminEmail}' not found in DB. Skipping admin grant.`);
    }
  }

  // C. Upsert Courses
  for (const c of SEED_COURSES) {
    await db
      .insert(courses)
      .values({
        id: c.id,
        title: c.title,
        slug: c.slug,
        description: c.description,
        category: c.category,
        priceCents: c.priceCents,
        isPublished: c.isPublished,
        creatorId: c.creatorId,
        thumbnailUrl: c.thumbnailUrl,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: courses.id,
        set: {
          title: c.title,
          slug: c.slug,
          description: c.description,
          category: c.category,
          priceCents: c.priceCents,
          isPublished: c.isPublished,
          thumbnailUrl: c.thumbnailUrl,
          updatedAt: new Date(),
        },
      });
  }
  console.log(`   ✓ Upserted ${SEED_COURSES.length} courses across all catalog categories`);

  // D. Upsert Lessons
  for (const c of SEED_COURSES) {
    for (const l of c.lessons) {
      await db
        .insert(lessons)
        .values({
          id: l.id,
          courseId: c.id,
          title: l.title,
          slug: l.slug,
          description: l.description,
          orderIndex: l.orderIndex,
          durationSeconds: 20, // matching fixture manifest duration
          isPreview: l.isPreview,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: lessons.id,
          set: {
            title: l.title,
            slug: l.slug,
            description: l.description,
            orderIndex: l.orderIndex,
            isPreview: l.isPreview,
            updatedAt: new Date(),
          },
        });
    }
  }
  console.log(`   ✓ Upserted ${totalLessons} lesson curriculum records`);

  // E. Storage Operations (Upload once, copy server-side)
  let objectsUploaded = 0;
  let objectsCopied = 0;
  let objectsSkipped = 0;

  if (!isSkipVideos) {
    console.log("\n📦 Synchronizing showcase video assets to Supabase Storage…");
    const storage = getStorageClient();

    // 1. Upload _fixtures once
    for (const [clipName, meta] of Object.entries(manifest.clips)) {
      const targetPath = `_fixtures/${clipName}`;
      const clipPath = path.resolve(process.cwd(), "scripts/fixtures/videos", clipName);
      const buf = fs.readFileSync(clipPath);

      const { data: uploadRes, error: uploadErr } = await storage.storage
        .from(VIDEO_BUCKET)
        .upload(targetPath, buf, {
          upsert: true,
          contentType: "video/mp4",
        });

      if (uploadErr) {
        throw new Error(`Failed to upload ${targetPath}: ${uploadErr.message}`);
      }
      objectsUploaded++;
    }
    console.log(`   ✓ Uploaded ${objectsUploaded} master fixture clips to '_fixtures/'`);

    // 2. Server-side copy to each lesson path & set videoKey
    const clipKeys = Object.keys(manifest.clips); // ["clip-a.mp4", "clip-b.mp4", "clip-c.mp4"]

    for (const c of SEED_COURSES) {
      // List existing files in course directory to check for skip
      const { data: existingCourseFiles } = await storage.storage
        .from(VIDEO_BUCKET)
        .list(c.id, { limit: 100 });
      const existingFileMap = new Map((existingCourseFiles || []).map((f) => [f.name, f.metadata?.size ?? 0]));

      for (const l of c.lessons) {
        // Clip mapping rule: Lesson 1 (orderIndex 0) gets clip-a.
        // Subsequent lessons cycle clip-b, clip-c, clip-a
        let selectedClip = "clip-a.mp4";
        if (l.orderIndex === 1) selectedClip = "clip-b.mp4";
        else if (l.orderIndex === 2) selectedClip = "clip-c.mp4";
        else if (l.orderIndex > 2) {
          const cycle = ["clip-b.mp4", "clip-c.mp4", "clip-a.mp4"];
          selectedClip = cycle[(l.orderIndex - 1) % cycle.length];
        }

        const sourcePath = `_fixtures/${selectedClip}`;
        const targetFilename = `${l.id}.mp4`;
        const canonicalKey = `${c.id}/${targetFilename}`;
        const expectedBytes = manifest.clips[selectedClip].bytes;

        const currentSize = existingFileMap.get(targetFilename);
        if (currentSize === expectedBytes) {
          objectsSkipped++;
        } else {
          // If different size or missing, copy
          const { error: copyErr } = await storage.storage
            .from(VIDEO_BUCKET)
            .copy(sourcePath, canonicalKey);

          if (copyErr && !copyErr.message?.includes("already exists")) {
            console.warn(`   ⚠️ Warning copying ${sourcePath} -> ${canonicalKey}: ${copyErr.message}`);
          }
          objectsCopied++;
        }

        // Link verified videoKey in database
        await db
          .update(lessons)
          .set({
            videoKey: canonicalKey,
            durationSeconds: manifest.clips[selectedClip].durationSeconds,
            updatedAt: new Date(),
          })
          .where(eq(lessons.id, l.id));
      }
    }

    console.log(
      `   ✓ Linked video assets: ${objectsCopied} copied, ${objectsSkipped} already cached, ${objectsUploaded} base fixtures.`
    );
  } else {
    console.log("   ⏭️  Skipped video asset synchronization (--skip-videos)");
  }

  // F. Access State Fixtures
  console.log("\n🔑 Seeding access-state & entitlement fixtures…");

  // 1. Alice (`seed-learner-01`): Active All-Access + Single Purchase
  await db
    .insert(purchases)
    .values({
      id: "seed-purchase-alice-01",
      userId: "seed-learner-01",
      courseId: "seed-course-ts",
      stripePaymentIntentId: "seed_pi_alice_01",
      stripeSessionId: "seed_cs_alice_01",
      pricePaidCents: 4900,
      status: "completed",
      purchasedAt: new Date(),
    })
    .onConflictDoNothing();

  await db
    .insert(entitlements)
    .values({
      id: "seed-ent-alice-purchase",
      userId: "seed-learner-01",
      courseId: "seed-course-ts",
      source: "purchase",
      grantedAt: new Date(),
      revokedAt: null,
    })
    .onConflictDoNothing();

  await db
    .insert(subscriptions)
    .values({
      id: "seed-sub-alice-01",
      userId: "seed-learner-01",
      stripeSubscriptionId: "seed_sub_alice_01",
      stripeCustomerId: "seed_cus_alice_01",
      stripeSessionId: "seed_cs_alice_sub_01",
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000),
      cancelAtPeriodEnd: false,
    })
    .onConflictDoNothing();

  await db
    .insert(entitlements)
    .values({
      id: "seed-ent-alice-sub",
      userId: "seed-learner-01",
      courseId: null,
      source: "subscription",
      grantedAt: new Date(),
      revokedAt: null,
    })
    .onConflictDoNothing();

  // 2. Daniel Vance (`seed-learner-02`): Canceled in-period (hasAccess = true)
  await db
    .insert(subscriptions)
    .values({
      id: "seed-sub-daniel-02",
      userId: "seed-learner-02",
      stripeSubscriptionId: "seed_sub_daniel_02",
      stripeCustomerId: "seed_cus_daniel_02",
      stripeSessionId: "seed_cs_daniel_sub_02",
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 14 * 86400 * 1000),
      cancelAtPeriodEnd: true,
    })
    .onConflictDoNothing();

  await db
    .insert(entitlements)
    .values({
      id: "seed-ent-daniel-sub",
      userId: "seed-learner-02",
      courseId: null,
      source: "subscription",
      grantedAt: new Date(),
      revokedAt: null,
    })
    .onConflictDoNothing();

  // 3. Chloe Bennett (`seed-learner-03`): Expired subscription (hasAccess = false)
  const expiredDate = new Date(Date.now() - 5 * 86400 * 1000);
  await db
    .insert(subscriptions)
    .values({
      id: "seed-sub-chloe-03",
      userId: "seed-learner-03",
      stripeSubscriptionId: "seed_sub_chloe_03",
      stripeCustomerId: "seed_cus_chloe_03",
      stripeSessionId: "seed_cs_chloe_sub_03",
      status: "canceled",
      currentPeriodEnd: expiredDate,
      cancelAtPeriodEnd: true,
    })
    .onConflictDoNothing();

  await db
    .insert(entitlements)
    .values({
      id: "seed-ent-chloe-sub",
      userId: "seed-learner-03",
      courseId: null,
      source: "subscription",
      grantedAt: new Date(Date.now() - 35 * 86400 * 1000),
      revokedAt: expiredDate,
    })
    .onConflictDoNothing();

  // 4. Liam Patel (`seed-learner-04`): Refunded purchase (hasAccess = false)
  await db
    .insert(purchases)
    .values({
      id: "seed-purchase-liam-04",
      userId: "seed-learner-04",
      courseId: "seed-course-ts",
      stripePaymentIntentId: "seed_pi_refund_04",
      stripeSessionId: "seed_cs_refund_04",
      pricePaidCents: 4900,
      status: "refunded",
      purchasedAt: new Date(Date.now() - 10 * 86400 * 1000),
    })
    .onConflictDoNothing();

  await db
    .insert(refundTombstones)
    .values({
      stripePaymentIntentId: "seed_pi_refund_04",
      refundedAt: new Date(Date.now() - 2 * 86400 * 1000),
    })
    .onConflictDoNothing();

  await db
    .insert(entitlements)
    .values({
      id: "seed-ent-liam-purchase",
      userId: "seed-learner-04",
      courseId: "seed-course-ts",
      source: "purchase",
      grantedAt: new Date(Date.now() - 10 * 86400 * 1000),
      revokedAt: new Date(Date.now() - 2 * 86400 * 1000),
    })
    .onConflictDoNothing();

  // 5. Admin Account Grant (if user exists)
  if (adminUserId) {
    await db
      .insert(subscriptions)
      .values({
        id: `seed-sub-admin-${adminUserId.slice(0, 8)}`,
        userId: adminUserId,
        stripeSubscriptionId: `seed_sub_admin_${adminUserId.slice(0, 8)}`,
        stripeCustomerId: `seed_cus_admin_${adminUserId.slice(0, 8)}`,
        stripeSessionId: `seed_cs_admin_${adminUserId.slice(0, 8)}`,
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 365 * 86400 * 1000),
        cancelAtPeriodEnd: false,
      })
      .onConflictDoNothing();

    await db
      .insert(entitlements)
      .values({
        id: `seed-ent-admin-${adminUserId.slice(0, 8)}`,
        userId: adminUserId,
        courseId: null,
        source: "subscription",
        grantedAt: new Date(),
        revokedAt: null,
      })
      .onConflictDoNothing();

    console.log(`   ✓ Granted active All-Access Pass to admin account (${adminEmail})`);
  }

  // G. Lesson Progress Milestones (Alice)
  await db
    .insert(lessonProgress)
    .values([
      {
        id: "seed-prog-alice-01",
        userId: "seed-learner-01",
        courseId: "seed-course-ts",
        lessonId: "seed-lesson-ts-01",
        completed: true,
        lastPositionSeconds: 20,
        updatedAt: new Date(),
      },
      {
        id: "seed-prog-alice-02",
        userId: "seed-learner-01",
        courseId: "seed-course-ts",
        lessonId: "seed-lesson-ts-02",
        completed: false,
        lastPositionSeconds: 8,
        updatedAt: new Date(),
      },
    ])
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: {
        completed: sql`excluded.completed`,
        lastPositionSeconds: sql`excluded.last_position_seconds`,
        updatedAt: new Date(),
      },
    });

  console.log("   ✓ Seeded lesson progress milestones (TypeScript Lesson 1 completed, Lesson 2 in-progress)");

  console.log("\n===============================================================================");
  console.log("✨ SEED COMPLETED SUCCESSFULLY");
  console.log("===============================================================================");
  console.log(`• Users: ${SEED_CREATORS.length} creators, ${SEED_LEARNERS.length} learners${adminUserId ? " + 1 admin" : ""}`);
  console.log(`• Courses: ${SEED_COURSES.length} total (7 published, 1 draft)`);
  console.log(`• Lessons: ${totalLessons} curriculum items`);
  console.log(`• Media: ${objectsUploaded} uploaded, ${objectsCopied} copied, ${objectsSkipped} cached`);
  console.log(`• Entitlements: Alice (active sub + purchase), Daniel (canceled/in-period), Chloe (expired), Liam (refunded)`);
  console.log("===============================================================================\n");

  process.exit(0);
}

seed().catch((err) => {
  console.error("\n❌ Seeding failed with error:\n", err);
  process.exit(1);
});
