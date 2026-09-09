import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import { useState } from "react";
import { twMerge } from "tailwind-merge";
import { Button } from "~/components/ds/atoms/Button";
import { BaseDialog } from "~/components/ds/dialogs/BaseDialog";
import Icon from "~/components/Icon";
import { SettingsLayout } from "~/components/LayoutAuth/Skeleton/SettingsLayout";
import WelcomeMessage from "~/components/LayoutAuth/WelcomeMessage";

export function DialogVideo({
  videoUrl,
  thumbnail,
}: {
  videoUrl: string;
  thumbnail: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="group relative flex h-[140px] w-full items-center justify-center rounded object-cover focus:outline-hidden xl:h-[140px]"
        aria-label="Watch the video"
        onClick={() => setOpen(true)}
      >
        <img
          className="rounded object-cover object-center"
          src={thumbnail}
          style={{ width: "100%", height: "100%" }}
        />
        <div className="pointer-events-none absolute flex h-[24px] w-[24px] items-center justify-center rounded-full bg-light-100 backdrop-blur-lg backdrop-filter transition-transform duration-300 ease-in-out group-hover:scale-110">
          <Icon id="bi-play-fill" className="h-4 w-4 text-light-900" />
        </div>
      </button>
      <BaseDialog
        open={open}
        onClose={() => setOpen(false)}
        className="max-h-[80vh] lg:max-w-3xl xl:max-w-5xl p-0"
      >
        <video
          className="h-full w-full rounded object-cover object-center"
          src={videoUrl}
          controls={true}
          autoPlay={true}
        />
      </BaseDialog>
    </>
  );
}

export function Card({
  children,
  title,
  extraClassname,
  actionTitle,
}: {
  children?: ReactNode;
  title?: string;
  extraClassname?: string;
  actionTitle?: {
    element: ReactNode;
    onClick: () => void;
  };
}) {
  return (
    <div
      className={twMerge(
        "flex h-[180px] flex-col gap-2.5 rounded bg-white p-2.5 body-xs-regular shadow-xs dark:bg-[#151518]",
        extraClassname,
      )}
    >
      {(title || actionTitle) && (
        <div className="flex justify-between">
          {title && <h4 className="body-sm-bold">{title}</h4>}
          {actionTitle && (
            <button
              onClick={actionTitle.onClick}
              className="inline-flex rounded bg-brand-main px-2.5 text-white"
            >
              {actionTitle.element}
            </button>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

import { getConfig } from "~/lib/runtimeConfig";

const uiShowExternalDocumentationLinksFF = getConfig().ui.showExternalDocLinks;

export default function MenuHomePage() {
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(false);

  const TOP_CARDS = [
    {
      title: "Interactive Walkthrough",
      buttonText: "Start Walkthrough",
      description:
        "Start with our step-by-step guide to create data-driven dashboards that connect data and AI agents for immediate insights.",
      isDisabled: false,
      icon: "search",
      onClick: () => {
        setShowWelcomeMessage(true);
      },
    },
    ...(uiShowExternalDocumentationLinksFF
      ? [
          {
            title: "Workspace Documentation",
            buttonText: "Read Documentation",
            description:
              "Access technical specifications for building custom data widgets, integrating AI agents, configuring role-based access controls, and much more.",
            isDisabled: false,
            icon: "book-open-01",
            href: "https://docs.openbb.co/workspace",
          },
        ]
      : []),
  ];
  return (
    <SettingsLayout title="Help and Documentation" tabs={[]} defaultTab="help">
      <TabsPrimitive.Content
        value="help"
        className="p-6 text-sm only-sm:h-screen flex flex-col flex-1 h-[calc(100vh-72px)]"
      >
        <div className="flex flex-row gap-2.5">
          {TOP_CARDS.map((card) => (
            <div
              className="flex w-full flex-col gap-2.5 dark:bg-dark-900 rounded-lg bg-white p-4"
              key={card.title}
            >
              <div className="inline-flex items-center gap-2 body-sm-bold dark:text-light-100 text-black">
                <div className="rounded-sm dark:bg-transparent size-6 bg-light-100 flex items-center justify-center">
                  <Icon
                    id={card.icon as "book-open-01" | "search"}
                    className="size-4 dark:text-brand-lighter text-brand-main"
                  />
                </div>
                {card.title}
              </div>
              <p className="body-xs-regular dark:text-light-100 text-light-800 mb-1.5">
                {card.description}
              </p>
              {card.href ? (
                <a
                  href={card.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-auto"
                >
                  <Button className="w-fit" size="sm">
                    {card.buttonText}
                    <Icon id="external-link-icon" className="size-4" />
                  </Button>
                </a>
              ) : (
                <Button
                  className="w-fit mt-auto"
                  size="sm"
                  onClick={card.onClick}
                  disabled={card.isDisabled}
                >
                  {card.buttonText}
                </Button>
              )}
            </div>
          ))}
        </div>
        <WelcomeMessage
          open={showWelcomeMessage}
          tier="openbbdeveloper"
          isHelpPage={true}
          onClose={() => setShowWelcomeMessage(false)}
        />
      </TabsPrimitive.Content>
    </SettingsLayout>
  );
}
