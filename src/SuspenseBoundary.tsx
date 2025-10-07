import { type ParentProps, Suspense } from "solid-js";

const LoadingSpinner = () => {
  return (
    <div class="min-h-screen bg-white flex items-center justify-center">
      <div class="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
    </div>
  );
};

export function SuspenseBoundary({ children }: ParentProps) {
  return <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>;
}
