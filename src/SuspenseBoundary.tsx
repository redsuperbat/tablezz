import { type ParentProps, Suspense } from "solid-js";

const LoadingSpinner = () => {
  return (
    <div class="flex min-h-screen items-center justify-center bg-white">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-500"></div>
    </div>
  );
};

export function SuspenseBoundary(props: ParentProps) {
  return <Suspense fallback={<LoadingSpinner />}>{props.children}</Suspense>;
}
