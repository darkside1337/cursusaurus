import { notFound, redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { getCourseWithLessons } from "@/features/courses";
import { CurriculumStudio } from "./curriculum-studio";

interface CourseStudioPageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseStudioPage({ params }: CourseStudioPageProps) {
  const session = await getServerSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard/courses");
  }

  const { id } = await params;
  const course = await getCourseWithLessons(id);

  if (!course) {
    notFound();
  }

  if (course.creatorId !== session.user.id) {
    redirect("/dashboard/courses");
  }

  return (
    <CurriculumStudio
      initialCourse={course}
      initialLessons={course.lessons}
    />
  );
}
