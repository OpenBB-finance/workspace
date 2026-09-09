import { cn } from "~/components/ds/utils";
import Icon from "~/components/Icon";
import type { IconId } from "~/components/Icon.types";

interface FeatureCardProps {
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  iconId: IconId;
}

function FeatureCard({
  title,
  description,
  imageSrc,
  imageAlt,
  iconId,
}: FeatureCardProps) {
  return (
    <div className="flex flex-col rounded overflow-hidden bg-white dark:bg-dark-900 max-w-[280px]">
      <div className="relative bg-dark-800 aspect-[16/10]">
        <img
          src={imageSrc}
          alt={imageAlt}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="flex flex-col items-start gap-2.5 p-6">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex items-center rounded justify-center size-6 shrink-0",
              "bg-light-50 dark:bg-dark-500",
            )}
          >
            <Icon
              id={iconId}
              className="size-4 text-brand-main dark:text-brand-lighter"
            />
          </div>
          <h3 className="body-xs-bold text-light-900 dark:text-light-100">{title}</h3>
        </div>
        <p className="body-xs-regular text-light-700 dark:text-light-100 leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

export default function AppsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4">
      <p className="body-xs-regular text-light-500 dark:text-light-400 text-center mb-10">
        Your Apps page is empty. Add a new App and start using it.
      </p>

      <div className="flex flex-wrap gap-4 w-full max-w-2xl justify-center items-center">
        <FeatureCard
          title="Save a Dashboard as an App"
          description="Create an app template from one of your dashboards. This will save your widgets, layout, and groupings as a new app."
          imageSrc="/assets/images/apps/save.png"
          imageAlt="Save dashboard as app preview"
          iconId="layout"
        />
        <FeatureCard
          title="Share Apps"
          description="Any App you create can be shared with other users across the OpenBB Workspace."
          imageSrc="/assets/images/apps/share.png"
          imageAlt="Share apps preview"
          iconId="share-07"
        />
      </div>
    </div>
  );
}
