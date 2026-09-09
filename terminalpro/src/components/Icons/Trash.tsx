import type { SVGComponent } from "~/types/general.type";

const TrashIcon = ({ title, titleId, ...props }: SVGComponent) => (
  <svg
    viewBox="0 0 16 16"
    width={16}
    height={16}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      d="M2 4h12M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.667a1.333 1.333 0 0 1 1.333 1.334V4m2 0v9.333a1.333 1.333 0 0 1-1.333 1.334H4.667a1.334 1.334 0 0 1-1.333-1.334V4h9.333Z"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default TrashIcon;
