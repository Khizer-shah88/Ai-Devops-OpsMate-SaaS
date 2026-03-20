"use client";

import { LoadingSpinner } from "@/components/LoadingSpinner";

export function AiLoader({ message = "AI is working..." }: { message?: string }) {
 return (
 <div className="flex min-h-[180px] items-center justify-center">
 <LoadingSpinner label={message} />
 </div>
 );
}
