"use client";

export function CameraFeed({
  videoRef,
  visible,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  visible: boolean;
}) {
  return (
    <video
      ref={videoRef}
      muted
      playsInline
      className={`h-32 w-48 rounded-lg border border-[color:var(--edu-panel-border)] object-cover [transform:scaleX(-1)] ${
        visible ? "opacity-100" : "pointer-events-none absolute -z-10 h-1 w-1 opacity-0"
      }`}
    />
  );
}
