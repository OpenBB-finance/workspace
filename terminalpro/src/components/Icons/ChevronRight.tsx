import type { SVGComponent } from "~/types/general.type";

const ChevronRightIcon = ({ title, titleId, ...props }: SVGComponent) => (
  <svg
    viewBox="0 0 24 24"
    width={24}
    height={24}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      d="m9 18 6-6-6-6"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

ChevronRightIcon.displayName = "ChevronRightIcon";

export default ChevronRightIcon;
