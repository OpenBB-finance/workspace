import type { SVGComponent } from "~/types/general.type";

const CloseIcon = ({ title, titleId, ...props }: SVGComponent) => (
  <svg
    width={16}
    height={16}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default CloseIcon;
