import type { SVGProps } from "react";

interface SvgrProps {
  title?: string;
  titleId?: string;
}

export type SVGComponent = SVGProps<SVGSVGElement> & SvgrProps;
