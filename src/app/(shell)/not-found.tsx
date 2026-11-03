import { Compass } from "lucide-react";
import Link from "next/link";
import { PageContainer } from "@/components/page-header";
import { EmptyState } from "@/components/states";

export default function NotFound() {
  return (
    <PageContainer>
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="This page doesn't exist, or its module is turned off in Settings → Modules."
        action={
          <Link href="/" className="text-primary text-sm font-medium hover:underline">
            Back to Command Home
          </Link>
        }
      />
    </PageContainer>
  );
}
