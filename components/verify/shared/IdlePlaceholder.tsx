import { AVATAR_GRADIENTS } from "./format";

export default function IdlePlaceholder() {
  const pairs = [["AK", 0], ["BM", 1], ["JD", 2], ["RS", 3], ["TL", 4]] as [string, number][];
  return (
    <div className="text-center py-12">
      <div className="flex justify-center items-end gap-2 mb-5 h-14">
        {pairs.map(([init, i]) => (
          <div
            key={i}
            className="rounded-xl flex items-center justify-center text-xs font-bold text-white"
            style={{
              background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length],
              opacity: 0.35 + i * 0.10,
              width: 32 + i * 4,
              height: 32 + i * 4,
              transform: `translateY(${i % 2 === 0 ? -4 : 4}px)`,
              filter: `blur(${i === 2 ? 0 : 0.6}px)`,
              animation: `orbFloat ${5 + i * 1.5}s ease-in-out ${i * 300}ms infinite`,
            }}
          >
            {init}
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-400">
        Type a name to find matching certificates
      </p>
    </div>
  );
}
