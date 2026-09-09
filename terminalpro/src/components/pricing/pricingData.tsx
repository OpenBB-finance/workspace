import type { PricingCardProps } from "./PricingCard";

export interface PricingPlanData extends Omit<PricingCardProps, "button" | "loading"> {
  id: string;
  buttonConfig: {
    text: string;
    variant?: "primary" | "primary" | "outlined";
    action: "start-now" | "contact-us" | "external-link";
    externalUrl?: string;
    className?: string;
  };
}

export const pricingPlans: PricingPlanData[] = [
  {
    id: "workspace-community",
    tag: {
      text: "Interface Layer | Community",
      color: "#006699",
      backgroundColor: "#33BBFF4D",
    },
    title: "Workspace",
    subtitle: "",
    description:
      "For individuals, students, academics or teams evaluating OpenBB for adoption.",
    buttonConfig: {
      text: "Start now",
      variant: "primary",
      action: "start-now",
    },
    metadata: [
      {
        icon: "server-01",
        label: "Deployment",
        description: "Fully hosted and managed by OpenBB.",
      },
      {
        icon: "lock-01",
        label: "Privacy",
        description:
          "SOC2 compliant environment, ensuring availability, security and confidentiality.",
      },
      {
        icon: "message-chat-square",
        label: "Developer Support",
        description: (
          <>
            Visit our community{" "}
            <a
              href="https://discord.com/invite/xPHTuHCmuV"
              target="_blank"
              rel="noopener noreferrer"
              className="text-link-color underline"
            >
              Discord
            </a>{" "}
            channel.
          </>
        ),
      },
      {
        icon: "pricing-pick-plan",
        label: "Pricing",
        description: "Free.",
      },
    ],
    features: {
      title: "Features",
      items: [
        { text: "Unlimited Apps and dashboards." },
        { text: "OpenBB Copilot: 20 queries/day." },
        {
          text: (
            <>
              Installer to connect{" "}
              <a
                href="https://github.com/OpenBB-finance/OpenBB/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="text-link-color underline"
              >
                OpenBB Platform
              </a>{" "}
              to the Workspace.
            </>
          ),
        },
      ],
    },
  },
  {
    id: "workspace-pro",
    tag: {
      text: "Interface Layer | Commercial",
    },
    title: "Workspace",
    subtitle: "/Pro",
    description:
      "For teams looking for enterprise-grade features, Add-in for Excel, and support.",
    buttonConfig: {
      text: "Get in touch",
      variant: "primary",
      action: "contact-us",
    },
    metadata: [
      {
        icon: "server-01",
        label: "Deployment",
        description: "Private workspace on OpenBB Cloud, VPC, or on-premise.",
      },
      {
        icon: "lock-01",
        label: "Privacy",
        description: "No product analytics; minimal logs for diagnostics only.",
      },
      {
        icon: "message-chat-square",
        label: "Developer & Production support",
        description: "8h/day, 5d/week (EST) with primary contact & backup.",
      },
      {
        icon: "pricing-pick-plan",
        label: "Subscription price",
        description: "Seat-based subscription.",
      },
      {
        icon: "briefcase-01",
        label: "Services & Consulting",
        description: "Available upon request.",
      },
    ],
    features: {
      title: "Features",
      subtitle: "Everything in Community plus...",
      items: [
        {
          text: "Collaborative capabilities to share apps and dashboards internally within your team.",
        },
        {
          text: "Role-based access control to efficiently manage user permissions.",
        },
        { text: "Fair use of OpenBB Copilot." },
        {
          text: "Add-in for Excel to integrate data from Workspace widgets.",
        },
      ],
    },
    highlighted: true,
  },
  {
    id: "open-data-platform",
    tag: {
      text: "Data Layer | Open Source",
    },
    title: "Open Data Platform (ODP)",
    description:
      "Our flagship open source project for unified financial and economic data access.",
    buttonConfig: {
      text: "Head to GitHub",
      variant: "outlined",
      className:
        "border-light-300 dark:border-light-300 text-light-900 dark:text-light-900 hover:text-black dark:hover:text-black hover:border-light-400 dark:hover:border-light-400",
      action: "external-link",
      externalUrl: "https://github.com/OpenBB-finance/OpenBB/releases",
    },
    metadata: [
      {
        icon: "server-01",
        label: "Deployment",
        description: "Runs locally.",
      },
      {
        icon: "lock-01",
        label: "Privacy",
        description: "Data stays in your environment, no vendor lock-in.",
      },
      {
        icon: "message-chat-square",
        label: "Developer Support",
        description: "Community-driven via GitHub and Discord",
      },
      {
        icon: "pricing-pick-plan",
        label: "Pricing",
        description: "Free, forever.",
      },
    ],
    features: {
      title: "Features",
      items: [
        {
          text: "Unified access to FRED, IMF, BLS, FOMC, Congress, and many more.",
        },
        {
          text: "Multiple interfaces to access data: Python, REST API, Excel, Notebook and Workspace.",
        },
        {
          text: "Open and extensible - contribute new datasets and workflows; or work on private ones.",
        },
      ],
    },
  },
];
