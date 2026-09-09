import type { SVGComponent } from "~/types/general.type";

const UpdatesIcon = ({ title, titleId, ...props }: SVGComponent) => (
  <svg
    viewBox="0 0 18 18"
    width={18}
    height={18}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <g
      clipPath="url(#aokokokdwoa213)"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8.602 1.44a7.5 7.5 0 1 1-4.85 2.183" />
      <path d="M9 4.875V9l2.25 1.5M.789 4.155l3.622-.97.873 3.26" />
    </g>
    <defs>
      <clipPath id="aokokokdwoa213">
        <path fill="currentColor" d="M0 0h18v18H0z" strokeWidth={1.5} />
      </clipPath>
    </defs>
  </svg>
);

export default UpdatesIcon;
