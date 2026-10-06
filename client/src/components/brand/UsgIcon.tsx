import * as React from "react"

import { cn } from "@/lib/utils"

export const usgIconNames = [
  "appliance", "arrow-right", "bed", "box", "calendar", "card", "care",
  "chat", "checklist", "clock", "document", "elevator", "fragile", "home",
  "packing", "photo", "pin", "quote", "route", "shield", "sofa", "stairs",
  "star", "storage", "support", "tape", "team", "tracking", "truck",
  "unpacking", "van", "wardrobe",
] as const

export type UsgIconName = (typeof usgIconNames)[number]
export type UsgIconStyle = "outline" | "duotone"

export interface UsgIconProps
  extends React.SVGAttributes<SVGSVGElement> {
  name: UsgIconName
  variant?: UsgIconStyle
  size?: number
  label?: string
}

export function UsgIcon({
  name,
  variant = "outline",
  size = 24,
  label,
  className,
  ...props
}: UsgIconProps) {
  if (variant === "duotone") {
    return (
      <img
        src={`/brand/v1/icons/duotone/${name}.svg`}
        width={size}
        height={size}
        alt={label ?? ""}
        aria-hidden={label ? undefined : true}
        className={cn("inline-block shrink-0", className)}
      />
    )
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("inline-block shrink-0", className)}
      {...props}
    >
      <use href={`/brand/v1/icons/sprite.svg#usg-${name}`} />
    </svg>
  )
}