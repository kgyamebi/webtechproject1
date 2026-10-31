import { StatusClock } from "@/components/connect/status-clock";

export function DeviceFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-full w-full items-stretch justify-center md:h-auto md:w-[390px]">
      <span className="pointer-events-none absolute -left-[3px] top-28 hidden h-10 w-[3px] rounded-l bg-[#8b9096] md:block" aria-hidden="true" />
      <span className="pointer-events-none absolute -left-[3px] top-44 hidden h-16 w-[3px] rounded-l bg-[#8b9096] md:block" aria-hidden="true" />
      <span className="pointer-events-none absolute -right-[3px] top-40 hidden h-20 w-[3px] rounded-r bg-[#8b9096] md:block" aria-hidden="true" />
      <div className="relative flex h-[100dvh] min-h-0 w-full flex-col bg-[var(--screen)] md:h-[min(844px,calc(100dvh-3rem))] md:rounded-[2.9rem] md:bg-[linear-gradient(145deg,#9aa0a6_0%,#3a3d42_18%,#c5c8cc_38%,#2c2e32_62%,#8e949b_100%)] md:p-[3px] md:shadow-[0_30px_70px_rgba(23,28,26,0.32),inset_0_1px_0_rgba(255,255,255,0.45)]">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-black md:rounded-[2.7rem] md:p-[9px]">
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--screen)] text-[var(--screen-ink)] md:rounded-[2.2rem]">
            <div className="pointer-events-none absolute left-1/2 top-[10px] z-20 hidden h-8 w-[7.4rem] -translate-x-1/2 rounded-full bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] md:block" aria-hidden="true" />
            <div className="relative z-10 hidden items-center justify-between px-7 pb-1 pt-3.5 text-[12px] font-semibold md:flex" aria-hidden="true">
              <StatusClock />
              <span className="flex items-center gap-1.5">
                <SignalMark />
                <WifiMark />
                <BatteryMark />
              </span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] md:pt-1">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SignalMark() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor" aria-hidden="true">
      <rect x="0" y="8" width="2.5" height="4" rx="0.5" />
      <rect x="4" y="5.5" width="2.5" height="6.5" rx="0.5" />
      <rect x="8" y="3" width="2.5" height="9" rx="0.5" />
      <rect x="12" y="0.5" width="2.5" height="11.5" rx="0.5" />
    </svg>
  );
}

function WifiMark() {
  return (
    <svg width="15" height="12" viewBox="0 0 15 12" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M1 4.2c3.6-3 9.4-3 13 0" />
      <path d="M3.2 6.6c2.4-2 6.2-2 8.6 0" />
      <path d="M5.5 9c1.2-1 2.8-1 4 0" />
    </svg>
  );
}

function BatteryMark() {
  return (
    <svg width="22" height="12" viewBox="0 0 22 12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <rect x="1" y="1" width="17" height="10" rx="2" />
      <rect x="3" y="3" width="11" height="6" rx="1" fill="currentColor" stroke="none" />
      <path d="M19 4.5h1.2a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H19" />
    </svg>
  );
}
