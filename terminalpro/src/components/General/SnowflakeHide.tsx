import { memo, type ReactNode, useMemo } from "react";

type SnowflakeHideProps = {
  children: ReactNode;
  render?: ReactNode;
};

const inSnowflakeNativeApp = import.meta.env.VITE_SNOWFLAKE_NATIVE_APP === "true";

const SnowflakeHide = memo<SnowflakeHideProps>(({ children, render = null }) => {
  return useMemo(
    () => (inSnowflakeNativeApp ? render : children),
    [inSnowflakeNativeApp, render, children],
  );
});

export default SnowflakeHide;
