import type { SVGComponent } from "~/types/general.type";

const PersonIcon = ({ title, titleId, ...props }: SVGComponent) => (
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
    <path
      strokeWidth={1.5}
      d="M15 15.75v-1.5a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v1.5M9 8.25a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default PersonIcon;
