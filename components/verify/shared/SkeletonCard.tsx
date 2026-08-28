export default function SkeletonCard({ delay }: { delay: number }) {
  return (
    <div
      className="rounded-2xl p-5 relative overflow-hidden bg-white border border-gray-100"
      style={{
        boxShadow: "0 1px 4px rgba(15,46,28,0.04)",
        animation: `slideUpFade 0.35s ease ${delay}ms both`,
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl animate-pulse flex-shrink-0 bg-gray-100" />
        <div className="flex-1 space-y-2">
          <div className="h-3 rounded-full animate-pulse w-3/4 bg-gray-100" />
          <div className="h-2 rounded-full animate-pulse w-1/2 bg-gray-100" />
        </div>
      </div>
      <div className="h-8 rounded-lg animate-pulse mb-3 bg-gray-50" />
      <div className="h-9 rounded-xl animate-pulse bg-gray-50" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(90deg,transparent,rgba(82,183,136,0.06),transparent)",
          animation: "shimmerSlide 1.6s ease infinite",
        }}
      />
    </div>
  );
}
