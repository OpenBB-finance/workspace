import type { SVGComponent } from "~/types/general.type";

const CustomizeIcon = ({ title, titleId, ...props }: SVGComponent) => (
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
      d="M3 15.75V10.5M3 7.5V2.25M9 15.75V9M9 6V2.25M15 15.75V12M15 9V2.25M.75 10.5h4.5M6.75 6h4.5M12.75 12h4.5"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default CustomizeIcon;
