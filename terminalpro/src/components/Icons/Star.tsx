import type { SVGComponent } from "~/types/general.type";

const StarIcon = ({ title, titleId, ...props }: SVGComponent) => (
  <svg
    viewBox="0 0 12 12"
    width={12}
    height={12}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      d="m6 .5 1.632 3.72 3.868.482-2.86 2.78.76 4.018-3.4-2-3.4 2 .76-4.017L.5 4.702l3.868-.483L6 .5Z"
      fill="currentColor"
      stroke="currentColor"
      strokeLinejoin="round"
    />
  </svg>
);

export default StarIcon;
