import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import React, { useMemo } from "react";
import Icon from "~/components/Icon";
import { cn } from "../utils";

export const buttonVariants = cva(
  [
    "BB-Button inline-flex items-center justify-center gap-2 ring-offset-background",
    "focus-visible:outline-hidden focus-visible:ring-2",
    "disabled:pointer-events-none disabled:[&_svg]:opacity-50",
    "transition",
    "cursor-pointer",
    "whitespace-nowrap",
  ],
  {
    variants: {
      variant: {
        primary: [
          "bg-btn-primary-bg text-btn-primary-label",
          "hover:bg-btn-primary-bg-hover",
          "focus-visible:ring-alert-informative",
          "disabled:bg-btn-primary-bg-disabled disabled:text-btn-primary-label-disabled",
          "data-[loading=true]:bg-btn-primary-bg data-[loading=true]:text-btn-primary-label data-[loading=true]:cursor-default",
        ],
        secondary: [
          "bg-btn-secondary-bg text-general-label",
          "border border-btn-secondary-border",
          "hover:bg-btn-secondary-bg-hover",
          "focus-visible:ring-alert-informative",
          "disabled:bg-btn-secondary-bg-disabled disabled:text-general-label-disabled",
          "data-[loading=true]:bg-btn-secondary-bg data-[loading=true]:text-general-label data-[loading=true]:cursor-default",
        ],
        outlined: [
          "border-[1.5px] border-btn-outlined-border text-general-label",
          "hover:border-btn-outlined-border-hover",
          "focus-visible:ring-alert-informative",
          "disabled:border-btn-outlined-border-disabled disabled:text-general-label-disabled",
          "data-[loading=true]:border-btn-outlined-border data-[loading=true]:text-general-label data-[loading=true]:cursor-default",
        ],
        warning: [
          "bg-btn-warning-bg text-btn-warning-label",
          "hover:bg-btn-warning-bg-hover",
          "focus-visible:ring-alert-warning/30",
          "disabled:bg-btn-warning-bg-disabled disabled:text-btn-warning-label-disabled",
          "data-[loading=true]:bg-btn-warning-bg data-[loading=true]:text-btn-warning-label data-[loading=true]:cursor-default",
        ],
        danger: [
          "bg-btn-destructive-bg text-btn-destructive-label",
          "hover:bg-btn-destructive-bg-hover",
          "focus-visible:ring-alert-error/30",
          "disabled:bg-btn-destructive-bg-disabled disabled:text-btn-destructive-label-disabled",
          "data-[loading=true]:bg-btn-destructive-bg data-[loading=true]:text-btn-destructive-label data-[loading=true]:cursor-default",
        ],
        ghost: [
          "bg-transparent text-general-label",
          "hover:bg-btn-ghost-bg-hover",
          "focus-visible:ring-alert-informative",
          "disabled:text-general-label-disabled",
          "data-[loading=true]:bg-transparent data-[loading=true]:text-general-label data-[loading=true]:cursor-default",
        ],
      },
      size: {
        xs: "body-xs-medium h-6 rounded-sm px-2 [&_.BB-Icon]:size-3",
        sm: "body-xs-medium h-8 rounded-sm px-3",
        md: "body-sm-medium h-10 rounded-md px-4",
        lg: "body-md-medium h-12 rounded-md px-5",
        xl: "body-lg-medium h-14 rounded-lg px-5",
      },
      icon: {
        true: "aspect-square p-0",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Apply props and styles to child component  */
  asChild?: boolean;
  loading?: boolean;
  loadingChildren?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
  const {
    className,
    children,
    variant = "primary",
    size = "md",
    icon = false,
    disabled = false,
    asChild = false,
    loading = false,
    loadingChildren = "Loading...",
    ...rest
  } = props;

  // Memoize the loading icon to prevent unnecessary re-renders
  const loadingIcon = useMemo(
    () => <Icon id="mdi-loading" className="size-4 min-w-4 flex-0 animate-spin" />,
    [],
  );

  // Create a stable content structure to prevent DOM reconciliation issues.
  // Bare text children are wrapped in <span> elements so browser auto-translation
  // (which swaps text nodes for <font> wrappers) can't desync React's DOM
  // bookkeeping and crash reconciliation with `removeChild` NotFoundError.
  // Consecutive text is grouped into a single span so the flex `gap` only spaces
  // real items (e.g. icon <-> label), never fragments of one label.
  const content = useMemo(() => {
    if (loading) {
      if (loadingChildren === null) {
        return loadingIcon;
      }
      return (
        <span className="inline-flex items-center gap-2">
          {loadingIcon}
          <span>{loadingChildren}</span>
        </span>
      );
    }

    // Slot requires a single element child; never wrap when delegating to it.
    if (asChild) return children;

    // Only multi-child buttons hit the crash: bare text sitting beside an icon
    // (or split into fragments) is what React removes/reorders after a translator
    // re-parents the text node. A lone text child is left untouched so the common
    // <button>Label</button> DOM contract (and text-based test queries) is kept.
    const childArray = React.Children.toArray(children);
    if (childArray.length < 2) return children;

    const nodes: React.ReactNode[] = [];
    let textRun = "";
    const flushText = () => {
      if (textRun.length > 0) {
        // Join consecutive fragments into one text node so React only ever
        // updates its value (never removes an inner node a translator moved).
        nodes.push(<span key={`text-${nodes.length}`}>{textRun}</span>);
        textRun = "";
      }
    };
    React.Children.forEach(children, (child, index) => {
      if (typeof child === "string" || typeof child === "number") {
        textRun += child;
        return;
      }
      flushText();
      nodes.push(
        React.isValidElement(child)
          ? React.cloneElement(child, { key: child.key ?? `child-${index}` })
          : child,
      );
    });
    flushText();
    return nodes;
  }, [loading, loadingIcon, loadingChildren, children, asChild]);

  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, icon }), className, {
        notranslate: loading,
        "pointer-events-none": loading, // Prevent interaction during loading
      })}
      ref={ref}
      disabled={disabled || loading}
      // Add data attribute to help with external tool detection
      data-loading={loading}
      {...rest}
    >
      {content}
    </Comp>
  );
});

Button.displayName = "Button";
