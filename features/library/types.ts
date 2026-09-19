import type { CourseAccessState } from "@/features/entitlements/access";

export interface LibraryNextLesson {
  id: string;
  orderIndex: number;
  slug: string;
  title: string;
}

export interface LibraryCourseItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string;
  thumbnailUrl: string | null;
  creatorName: string | null;
  accessType: CourseAccessState; // "purchased" | "all-access"
  lessonCount: number;
  completedLessonsCount: number;
  progressPercentage: number;
  totalDurationSeconds: number;
  completedDurationSeconds: number;
  isCompleted: boolean;
  nextLesson: LibraryNextLesson | null;
}

export interface LibraryMetrics {
  activeSyllabiCount: number;
  hoursMastered: number;
  completedSyllabiCount: number;
}

export interface LearnerLibrarySummary {
  courses: LibraryCourseItem[];
  metrics: LibraryMetrics;
  isSubscriptionPastDue: boolean;
  hasAllAccess: boolean;
}
