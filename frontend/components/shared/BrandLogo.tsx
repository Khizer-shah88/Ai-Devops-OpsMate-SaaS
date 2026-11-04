"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  size?: number;
  showText?: boolean;
  subtitle?: string;
  className?: string;
  textClassName?: string;
}

export function BrandLogo({
  size = 40,
  showText = true,
  subtitle = "Developer Assistant",
  className,
  textClassName,
}: BrandLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <div className="h-full w-full rounded-[12px] bg-card border border-border shadow-sm flex items-center justify-center p-[14%]">
          <Image
            src="/logo.svg"
            alt="DevMat AI"
            width={size}
            height={size}
            className="w-full h-full object-contain"
            priority
          />
        </div>
        <span className="absolute -top-[2px] -right-[2px] w-2.5 h-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400 border-2 border-background shadow-sm" />
      </div>
      {showText && (
        <div className="min-w-0">
          <p className={cn("text-[15px] font-extrabold text-foreground leading-none tracking-tight", textClassName)}>
            DevMat AI
          </p>
          {subtitle ? (
            <p className="text-[11px] text-muted-foreground mt-1 leading-none truncate">
              {subtitle}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
