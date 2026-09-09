import { cva, type VariantProps } from "class-variance-authority";
import React from "react";
import { cn } from "../utils";

/* Tag */

const tagVariants = cva(
  [
    "BB-Tag body-xs-regular inline-flex items-center justify-center rounded-full px-1.5",
  ],
  {
    variants: {
      color: {
        grey: "bg-tag-grey-bg text-tag-grey-label",
        success: "bg-tag-green-bg text-tag-green-label",
        warning: "bg-tag-orange-bg text-tag-orange-label",
        danger: "bg-tag-red-bg text-tag-red-label",
        brand: "bg-tag-brand-bg text-tag-brand-label",
        ruby: "bg-tag-pink-bg text-tag-pink-label",
        purple: "bg-tag-purple-bg text-tag-purple-label",
        yellow: "bg-tag-yellow-bg text-tag-yellow-label",
        "dark-blue": "bg-tag-blue-bg text-tag-blue-label",
        burgundy: "bg-tag-burgundy-bg text-tag-burgundy-label",
      },
    },
    defaultVariants: {
      color: "grey",
    },
  },
);

export type SpanProps = Omit<React.HTMLAttributes<HTMLSpanElement>, "color">;
export interface TagProps extends SpanProps, VariantProps<typeof tagVariants> {}

export const Tag = React.forwardRef<HTMLSpanElement, TagProps>(
  ({ className, color, ...props }, ref) => {
    if (!props.children) {
      return null;
    }
    return (
      <span ref={ref} className={cn(tagVariants({ color }), className)} {...props} />
    );
  },
);
Tag.displayName = "Tag";
