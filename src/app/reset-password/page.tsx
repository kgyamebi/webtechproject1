import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/recovery-forms";
import { PublicFrame } from "@/components/shell/public-frame";
import { Card } from "@/components/ui/card";
import { FormSkeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Choose a new password" };

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return (
    <PublicFrame title="Choose a new password">
      <Card className="mt-8 max-w-xl">
        <Suspense fallback={<FormSkeleton />}>
          <ResetSection searchParams={searchParams} />
        </Suspense>
      </Card>
    </PublicFrame>
  );
}

async function ResetSection({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return <ResetPasswordForm token={params.token ?? ""} />;
}
