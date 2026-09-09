import type { SVGComponent } from "~/types/general.type";

const LinkIcon = ({ title, titleId, ...props }: SVGComponent) => (
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
      d="M11.25 5.25h2.25a3.75 3.75 0 0 1 0 7.5h-2.25m-4.5 0H4.5a3.75 3.75 0 1 1 0-7.5h2.25M6 9h6"
      strokeWidth={1.5}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default LinkIcon;
