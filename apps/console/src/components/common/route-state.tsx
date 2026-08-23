import { Link, useRouter } from "@tanstack/react-router";
import { Button, buttonVariants } from "@taskome/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@taskome/ui/components/empty";
import { Spinner } from "@taskome/ui/components/spinner";
import { ArrowLeftIcon, FileQuestionIcon, RefreshCcwIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";

function RouteStateLayout({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-svh items-center justify-center p-6">{children}</main>;
}

export function RoutePendingState() {
  return (
    <RouteStateLayout>
      <Empty className="max-w-lg">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Spinner />
          </EmptyMedia>
          <EmptyDescription>Loading page ...</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </RouteStateLayout>
  );
}

export function RouteErrorState() {
  const router = useRouter();
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await router.invalidate({ sync: true });
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <RouteStateLayout>
      <Empty className="max-w-lg">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlertIcon />
          </EmptyMedia>
          <EmptyTitle>
            <h1>Something went wrong</h1>
          </EmptyTitle>
          <EmptyDescription>We couldn't load this page. Try again in a moment.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button disabled={isRetrying} onClick={() => void handleRetry()}>
            {isRetrying ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RefreshCcwIcon data-icon="inline-start" />
            )}
            {isRetrying ? "Retrying…" : "Try again"}
          </Button>
        </EmptyContent>
      </Empty>
    </RouteStateLayout>
  );
}

export function RouteNotFoundState() {
  return (
    <RouteStateLayout>
      <Empty className="max-w-lg">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileQuestionIcon />
          </EmptyMedia>
          <EmptyTitle>
            <h1>Page not found</h1>
          </EmptyTitle>
          <EmptyDescription>
            The page you are looking for does not exist or may have moved.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link to="/" className={buttonVariants()}>
            <ArrowLeftIcon data-icon="inline-start" />
            Back to console
          </Link>
        </EmptyContent>
      </Empty>
    </RouteStateLayout>
  );
}
