import type { SVGProps } from "react";

function SquareCheckIcon({
  showCheck = true,
  ...props
}: {
  showCheck?: boolean;
} & SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="none"
      viewBox="0 0 16 16"
      {...props}
    >
      {showCheck && (
        <path
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          d="M6 7.334l2 2 6.667-6.667"
        />
      )}
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M14 8v4.667A1.334 1.334 0 0112.667 14H3.333A1.334 1.334 0 012 12.667V3.333A1.333 1.333 0 013.333 2h7.334"
      />
    </svg>
  );
}

export default SquareCheckIcon;
