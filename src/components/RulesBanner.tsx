"use client";

export function RulesBanner() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      <div className="animate-fade-in rounded-lg border border-[#FF4500]/30 bg-[#FF4500]/5 px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-lg text-[#FF4500]">⚠️</span>
          <div>
            <p className="text-sm font-medium text-[#FF4500]">Rules</p>
            <p className="mt-0.5 text-xs leading-relaxed text-[#aaa]">
              Swearing is fine. Doxxing, credible threats of violence, and
              illegal content are not. Violators will be silently shadowbanned by
              an AI moderator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
