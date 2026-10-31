import Link from "next/link";
import { PublicFrame } from "@/components/shell/public-frame";
import { Card, CardText, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Check your email" };

export default function CheckEmailPage() {
  const development = process.env.NODE_ENV === "development";

  return (
    <PublicFrame title="Check your email">
      <Card className="mt-8 max-w-xl">
        <CardTitle>Verify the address, then sign in</CardTitle>
        <CardText>
          If this address can be registered, a verification link has been prepared. Verifying it
          proves you control the inbox. It does not enrol you in a course.
        </CardText>
        {development ? (
          <p className="mt-4 text-sm leading-6 text-ink-soft">
            Local development stores that message at{" "}
            <Link className="text-pine underline-offset-4 hover:underline" href="/dev/mailbox">
              the development mailbox
            </Link>
            . That page is not available in production.
          </p>
        ) : null}
        <Link href="/login" className="mt-6 inline-block text-sm text-pine underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </Card>
    </PublicFrame>
  );
}
