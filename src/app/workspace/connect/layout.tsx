import { ConnectNav } from "@/components/connect/connect-nav";
import { DeviceFrame } from "@/components/connect/device-frame";
import { ShellInert } from "@/components/connect/shell-inert";
import { SwipeBack } from "@/components/connect/swipe-back";

export default function ConnectLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="connect-app fixed inset-0 z-30 flex">
      <ShellInert />
      <SwipeBack />
      <ConnectNav />
      <div className="flex min-w-0 flex-1 items-center justify-center">
        <DeviceFrame>{children}</DeviceFrame>
      </div>
      <aside className="hidden w-72 shrink-0 flex-col justify-center px-8 xl:flex">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--screen-soft)]">While you talk</p>
        <p className="mt-3 text-sm leading-6">Random Connect uses an alias until both people choose to be friends. Friend chats show the name you are already allowed to see.</p>
        <p className="mt-3 text-sm leading-6">Report and block stay inside the chat. A voice or video call can run here when the media server is running, and it is not recorded.</p>
      </aside>
    </div>
  );
}
