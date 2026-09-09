import type { SVGComponent } from "~/types/general.type";

const ChartBarIcon = ({ title, titleId, ...props }: SVGComponent) => (
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
      d="M12 13.333V6.666M8 13.333V2.667M4 13.334v-4"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default ChartBarIcon;
