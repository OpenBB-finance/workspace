import { useMemo } from "react";
import { useWindowSize } from "usehooks-ts";

const MOBILE_UA_REGEX = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i;

const useIsMobile = (): boolean => {
  const { width = 0 } = useWindowSize();

  return useMemo(
    () => MOBILE_UA_REGEX.test(window.navigator.userAgent) || width < 768,
    [width],
  );
};

export default useIsMobile;
