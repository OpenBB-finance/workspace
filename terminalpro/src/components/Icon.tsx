import { forwardRef, memo, type SVGProps, useMemo } from "react";
import { VERSION } from "~/lib/constants";
import { cn } from "./ds/utils";
import type { IconId } from "./Icon.types";

const Icon = forwardRef<SVGElement, { id: IconId } & SVGProps<SVGSVGElement>>(
  (props, _ref) => {
    const { id } = props;
    return useMemo(
      () => (
        <svg {...props} className={cn("w-4 h-4", props.className)}>
          <use href={`/assets/icons/sprite.svg?v=${VERSION}#${id}`} />
        </svg>
      ),
      [props],
    );
  },
);

Icon.displayName = "Icon";

export default memo(Icon);
