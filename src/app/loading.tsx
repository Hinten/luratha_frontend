const SKELETON_CARD_COUNT = 8;

export default function Loading() {
  return (
    <div
      className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-24"
      style={{ backgroundColor: "var(--color-neutral-light)" }}
    >
      {/* Animated logo placeholder */}
      <div
        className="w-32 h-8 rounded-full mb-12"
        style={{
          background:
            "linear-gradient(90deg, var(--color-neutral-mid) 25%, var(--color-accent) 50%, var(--color-neutral-mid) 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.6s ease-in-out infinite",
        }}
      />

      {/* Skeleton cards grid */}
      <div className="w-full max-w-5xl grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {Array.from({ length: SKELETON_CARD_COUNT }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            {/* Image skeleton */}
            <div
              className="w-full aspect-square rounded-3xl"
              style={{
                background:
                  "linear-gradient(90deg, var(--color-neutral-mid) 25%, var(--color-accent) 50%, var(--color-neutral-mid) 75%)",
                backgroundSize: "200% 100%",
                animation: `shimmer 1.6s ease-in-out infinite`,
                animationDelay: `${i * 0.1}s`,
              }}
            />
            {/* Title skeleton */}
            <div
              className="h-4 rounded-full w-3/4"
              style={{
                background:
                  "linear-gradient(90deg, var(--color-neutral-mid) 25%, var(--color-accent) 50%, var(--color-neutral-mid) 75%)",
                backgroundSize: "200% 100%",
                animation: `shimmer 1.6s ease-in-out infinite`,
                animationDelay: `${i * 0.1 + 0.1}s`,
              }}
            />
            {/* Price skeleton */}
            <div
              className="h-4 rounded-full w-1/2"
              style={{
                background:
                  "linear-gradient(90deg, var(--color-neutral-mid) 25%, var(--color-accent) 50%, var(--color-neutral-mid) 75%)",
                backgroundSize: "200% 100%",
                animation: `shimmer 1.6s ease-in-out infinite`,
                animationDelay: `${i * 0.1 + 0.2}s`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
