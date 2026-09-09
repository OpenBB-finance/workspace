import type { SVGComponent } from "~/types/general.type";

const PricingIcon = ({ title, titleId, ...props }: SVGComponent) => (
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
      d="M.5 6.438V1.5a1 1 0 0 1 1-1h5.373a1 1 0 0 1 .713.3l7.227 7.365a1 1 0 0 1 0 1.4l-5.109 5.208a1 1 0 0 1-1.427 0L.787 7.138a1 1 0 0 1-.287-.7Z"
      stroke="currentColor"
      strokeLinejoin="round"
    />
    <circle cx={4.262} cy={4.308} fill="currentColor" r={1.5} />
  </svg>
);

export default PricingIcon;
