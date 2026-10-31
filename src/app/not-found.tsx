import Link from "next/link";
import { PublicFrame } from "@/components/shell/public-frame";

export default function NotFound() {
  return (
    <PublicFrame title="Page not found">
      <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">
        That address is not part of Campus+. You can return home or sign in if you already have an account.
      </p>
      <div className="mt-6 flex gap-4 text-sm">
        <Link className="text-pine underline-offset-4 hover:underline" href="/">
          Home
        </Link>
        <Link className="text-pine underline-offset-4 hover:underline" href="/login">
          Sign in
        </Link>
      </div>
    </PublicFrame>
  );
}
