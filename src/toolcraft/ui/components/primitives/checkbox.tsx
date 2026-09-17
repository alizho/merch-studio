"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

/**
 * Sharp 18x18 box, void fill when checked, volt check stroke — the
 * `checkbox` component in /Users/kiwi/Downloads/design.md. Draw-in and
 * :active scale live in `merch-checkbox-box`/`merch-checkbox-check` in
 * `../../styles.css`, since `@starting-style`/`animation` isn't expressible
 * as Tailwind utility classes.
 */
const checkboxVariants = cva(
  "merch-checkbox-box peer relative flex shrink-0 cursor-pointer items-center justify-center border border-[color:var(--border)] bg-transparent outline-none transition-colors after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring focus-visible:ring-[color:color-mix(in_oklab,var(--ring)_30%,transparent)] data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-checked:border-[#000000] data-checked:bg-[#000000] dark:data-checked:border-[#000000] dark:data-checked:bg-[#000000]",
  {
    variants: {
      size: {
        default: "size-[18px]",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

function Checkbox({
  className,
  size,
  ...props
}: CheckboxPrimitive.Root.Props & VariantProps<typeof checkboxVariants>) {
  const resolvedSize = size ?? "default";

  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      data-size={resolvedSize}
      className={cn(checkboxVariants({ size: resolvedSize }), className)}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center"
      >
        <svg
          aria-hidden="true"
          className="merch-checkbox-check"
          fill="none"
          height="10"
          viewBox="0 0 14 14"
          width="10"
        >
          <path
            d="M2 7.5L5.5 11L12 3"
            stroke="#F7FE62"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
