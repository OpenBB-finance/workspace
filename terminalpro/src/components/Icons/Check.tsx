import type { SVGComponent } from "~/types/general.type";

const CheckIcon = ({ title, titleId, ...props }: SVGComponent) => (
  <svg
    viewBox="0 0 14 11"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      d="M13 1.5 4.75 9.75 1 6"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default CheckIcon;
