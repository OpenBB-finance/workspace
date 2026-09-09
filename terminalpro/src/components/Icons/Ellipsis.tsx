import type { SVGComponent } from "~/types/general.type";

const EllipsisIcon = ({ title, titleId, ...props }: SVGComponent) => (
  <svg
    viewBox="0 0 20 5"
    width={20}
    height={5}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-labelledby={titleId}
    {...props}
  >
    {title ? <title id={titleId}>{title}</title> : null}
    <circle cx={2} cy={2.201} r={2} fill="currentColor" />
    <circle cx={10} cy={2.201} r={2} fill="currentColor" />
    <circle cx={18} cy={2.201} r={2} fill="currentColor" />
  </svg>
);

export default EllipsisIcon;
