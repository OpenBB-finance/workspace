import type { ReactNode } from "react";
import { Button } from "~/components/ds/atoms/Button";
import { Tag } from "~/components/ds/atoms/Tag";
import { cn } from "~/components/ds/utils";
import Icon from "~/components/Icon";
import type { IconId } from "~/components/Icon.types";

export interface PricingMetadata {
  icon: IconId;
  label: string;
  description: string | ReactNode;
}

export interface PricingFeature {
  text: string | ReactNode;
}

export interface PricingCardProps {
  tag: {
    text: string;
    color?: string;
    backgroundColor?: string;
  };
  title: string;
  subtitle?: string;
  description: string;
  button: {
    text: string;
    variant?: "primary" | "outlined";
    onClick: () => void;
    className?: string;
  };
  metadata: PricingMetadata[];
  features: {
    title: string;
    subtitle?: string;
    items: PricingFeature[];
  };
  showPill?: boolean;
  highlighted?: boolean;
  className?: string;
  loading?: boolean;
}

export function PricingCard({
  tag,
  title,
  subtitle,
  description,
  button,
  metadata,
  features,
  showPill = true,
  className,
  loading = false,
}: PricingCardProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col p-6 overflow-auto text-dark-400",
        className,
      )}
    >
      <div className="flex items-center mb-6">
        <Tag
          style={{
            color: tag.color || "#006699",
            backgroundColor: tag.backgroundColor || "#33BBFF4D",
            opacity: showPill ? 1 : 0,
          }}
        >
          {tag.text}
        </Tag>
      </div>

      <div className="flex items-center mb-6">
        <h3 className="title-xs-bold text-dark-600">
          {title}
          {subtitle && <span className="text-sm font-normal"> {subtitle}</span>}
        </h3>
      </div>

      <p className="body-sm-regular text-dark-400 mb-4">{description}</p>

      <Button
        onClick={button.onClick}
        className={cn("w-full mt-auto mb-8", button.className)}
        variant={button.variant}
        loading={loading}
      >
        {button.text}
      </Button>

      <div className="space-y-4 mb-6 min-h-[240px]">
        {metadata.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="mr-2 flex-shrink-0">
              <Icon id={item.icon} className="size-4" />
            </div>
            <div>
              <p className="body-sm-regular text-dark-400">
                <span className="font-bold">{item.label}:</span> {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div
        className={cn(
          "w-full h-px mb-4 bg-[#C8E7FF]",
          title.includes("Open") && "bg-light-300",
        )}
      />

      <div className="mb-6 flex-grow flex flex-col">
        <h4 className="body-sm-bold text-dark-400 uppercase tracking-widest mb-4">
          {features.title}
        </h4>
        {features.subtitle && (
          <p className="body-sm-regular text-dark-400 mb-4">{features.subtitle}</p>
        )}
        <ul className="space-y-4 flex-grow">
          {features.items.map((feature, index) => (
            <li key={index} className="flex items-center gap-2">
              <Icon id="check-pick-plan" className="size-6 min-w-6" />
              <span className="body-sm-regular text-dark-400">{feature.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
