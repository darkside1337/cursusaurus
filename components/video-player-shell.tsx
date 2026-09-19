"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Lock, Play, Video, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { recordLessonPlaybackAction } from "@/features/progress/actions";

interface VideoPlayerShellProps {
  courseId: string;
  lessonId: string;
  courseSlug: string;
  isUnlocked: boolean;
  isPreview?: boolean;
  initialPositionSeconds?: number;
  isCompleted?: boolean;
  onCompleted?: () => void;
  onPositionUpdate?: (seconds: number) => void;
}

export function VideoPlayerShell({
  courseId,
  lessonId,
  courseSlug,
  isUnlocked,
  isPreview = false,
  initialPositionSeconds = 0,
  isCompleted = false,
  onCompleted,
  onPositionUpdate,
}: VideoPlayerShellProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoStatus, setVideoStatus] = useState<"loading" | "ok" | "no_video" | "error">("loading");
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const lastReportedTimeRef = useRef<number>(0);
  const hasResumedRef = useRef<boolean>(false);

  // Fetch signed playback URL when lesson changes or when unlocked
  useEffect(() => {
    if (!isUnlocked) {
      return;
    }

    let isMounted = true;
    lastReportedTimeRef.current = 0;

    async function fetchSignedUrl() {
      setVideoStatus("loading");
      setSignedUrl(null);
      try {
        const res = await fetch(
          `/api/video/signed-url?courseId=${encodeURIComponent(courseId)}&lessonId=${encodeURIComponent(lessonId)}`
        );

        if (!isMounted) return;

        if (res.status === 200) {
          const data = await res.json();
          if (data.status === "no_video") {
            setVideoStatus("no_video");
          } else if (data.status === "ok" && data.signedUrl) {
            setSignedUrl(data.signedUrl);
            setVideoStatus("ok");
          } else {
            setVideoStatus("error");
          }
        } else {
          setVideoStatus("error");
        }
      } catch {
        if (isMounted) setVideoStatus("error");
      }
    }

    fetchSignedUrl();

    return () => {
      isMounted = false;
    };
  }, [courseId, lessonId, isUnlocked]);

  // Handle position reporting to server
  const reportProgress = useCallback(
    async (seconds: number, ended = false) => {
      try {
        const rounded = Math.floor(seconds);
        onPositionUpdate?.(rounded);
        const res = await recordLessonPlaybackAction({
          courseId,
          lessonId,
          positionSeconds: rounded,
          ended,
        });
        if (res.success && res.data?.completed && !isCompleted) {
          onCompleted?.();
        }
      } catch {
        // Non-blocking progress sync
      }
    },
    [courseId, lessonId, isCompleted, onCompleted, onPositionUpdate]
  );

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    const current = Math.floor(video.currentTime);
    // Throttle to every 5 seconds
    if (Math.abs(current - lastReportedTimeRef.current) >= 5) {
      lastReportedTimeRef.current = current;
      reportProgress(current, false);
    }
  };

  const handlePause = () => {
    const video = videoRef.current;
    if (!video) return;
    const current = Math.floor(video.currentTime);
    lastReportedTimeRef.current = current;
    reportProgress(current, false);
  };

  const handleEnded = () => {
    const video = videoRef.current;
    if (!video) return;
    const duration = Math.floor(video.duration || 0);
    reportProgress(duration, true);
    onCompleted?.();
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video || hasResumedRef.current) return;

    if (initialPositionSeconds > 0 && !isCompleted) {
      video.currentTime = Math.min(initialPositionSeconds, video.duration || initialPositionSeconds);
    }
    hasResumedRef.current = true;
  };

  // 1. Locked Enrollment Wash (docs/DESIGN.md §116-121)
  if (!isUnlocked) {
    return (
      <Card className="rounded-[20px] bg-blush-peach/30 border border-blush-peach overflow-hidden shadow-subtle-3 aspect-video flex flex-col items-center justify-center p-6 sm:p-8 text-center">
        <div className="h-12 w-12 rounded-full bg-blush-peach flex items-center justify-center mb-4 text-sienna-brown shadow-sm">
          <Lock className="h-6 w-6" />
        </div>
        <Badge
          variant="secondary"
          className="bg-blush-peach text-sienna-brown rounded-full font-sohne text-xs font-medium mb-3"
        >
          All-Access Exclusive
        </Badge>
        <h3 className="font-serif text-xl sm:text-2xl text-ink-black font-normal mb-2">
          This lesson is reserved for enrolled learners
        </h3>
        <p className="font-sohne text-xs sm:text-sm text-slate-gray max-w-md mb-6 leading-relaxed">
          Subscribe to the All-Access Pass or purchase this course outright to unlock this lecture and all curriculum artifacts.
        </p>
        <Button
          render={<Link href={`/${courseSlug}`} />}
          className="rounded-full bg-ink-black text-paper-white hover:bg-ink-black/90 px-6 font-sohne text-xs font-medium shadow-sm"
        >
          View Enrollment Options
        </Button>
      </Card>
    );
  }

  // 2. Loading State
  if (videoStatus === "loading") {
    return (
      <div className="relative rounded-[20px] overflow-hidden bg-ink-black shadow-subtle-3 aspect-video flex flex-col items-center justify-center text-paper-white/50">
        <Loader2 className="h-8 w-8 animate-spin mb-2" />
        <span className="font-sohne text-xs">Loading classroom stream...</span>
      </div>
    );
  }

  // 3. No Video Uploaded State
  if (videoStatus === "no_video") {
    return (
      <Card className="rounded-[20px] bg-ink-black border-none overflow-hidden shadow-subtle-3 aspect-video flex flex-col items-center justify-center p-6 sm:p-8 text-center text-paper-white/70">
        <div className="h-12 w-12 rounded-full bg-paper-white/10 flex items-center justify-center mb-3 text-paper-white/70">
          <Video className="h-6 w-6 stroke-[1.5]" />
        </div>
        <h3 className="font-serif text-lg sm:text-xl text-paper-white font-normal mb-1">
          Lecture video in preparation
        </h3>
        <p className="font-sohne text-xs text-paper-white/60 max-w-sm leading-relaxed">
          The curriculum outline and monograph notes are ready. The lecture video recording will be available shortly.
        </p>
      </Card>
    );
  }

  // 4. Error State
  if (videoStatus === "error" || !signedUrl) {
    return (
      <Card className="rounded-[20px] bg-ink-black border-none overflow-hidden shadow-subtle-3 aspect-video flex flex-col items-center justify-center p-6 sm:p-8 text-center text-paper-white/70">
        <Play className="h-8 w-8 mb-2 opacity-40" />
        <p className="font-sohne text-xs text-paper-white/60">
          Unable to initialize playback stream. Please refresh the classroom page.
        </p>
      </Card>
    );
  }

  // 5. Active Video Player Shell
  return (
    <div className="relative rounded-[20px] overflow-hidden bg-ink-black shadow-subtle-3 aspect-video group">
      {isPreview && (
        <div className="absolute top-4 left-4 z-20 pointer-events-none">
          <Badge className="bg-mist-gray text-ink-black border border-hairline text-[10px] px-2.5 py-0.5 rounded-full font-medium font-sohne shadow-sm">
            Free Preview
          </Badge>
        </div>
      )}

      <video
        ref={videoRef}
        src={signedUrl}
        controls
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onPause={handlePause}
        onEnded={handleEnded}
        onLoadedMetadata={handleLoadedMetadata}
        className="w-full h-full object-contain"
      />
    </div>
  );
}
