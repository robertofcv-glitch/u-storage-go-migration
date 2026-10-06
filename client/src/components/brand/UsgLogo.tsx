import * as React from "react"

import { cn } from "@/lib/utils"

const logoSources = {
  official: "/brand/v1/logos/official-color.svg",
  purple: "/brand/v1/logos/official-purple.svg",
  reverse: "/brand/v1/logos/official-reverse.svg",
  black: "/brand/v1/logos/official-black.svg",
  white: "/brand/v1/logos/official-white.svg",
} as const

export type UsgLogoVariant = keyof typeof logoSources

export interface UsgLogoProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  variant?: UsgLogoVariant
}

export function UsgLogo({
  variant = "official",
  alt = "U-Storage Go",
  className,
  ...props
}: UsgLogoProps) {
  return (
    <img
      src={logoSources[variant]}
      alt={alt}
      className={cn("block h-auto max-w-full", className)}
      {...props}
    />
  )
}