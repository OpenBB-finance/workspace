import type { SVGComponent } from "~/types/general.type";

const ChartIcon = ({ title, titleId, ...props }: SVGComponent) => (
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
      d="M13.14 10.593a6.666 6.666 0 1 1-8.806-8.706"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
    />
    <path
      d="M13.667 8A6.667 6.667 0 0 0 7 1.333V8h6.667Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
    />
  </svg>
);

export default ChartIcon;
