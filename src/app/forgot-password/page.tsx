import { ForgotPasswordForm } from "@/components/auth/recovery-forms";
import { PublicFrame } from "@/components/shell/public-frame";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <PublicFrame title="Reset your password">
      <p className="mt-3 max-w-xl text-ink-soft">
        The response is the same whether or not an account exists, so the form does not reveal who has registered.
      </p>
      <Card className="mt-8 max-w-xl">
        <ForgotPasswordForm />
      </Card>
    </PublicFrame>
  );
}
