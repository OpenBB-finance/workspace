// @ts-expect-error - ignored for now
import Confetti from "react-confetti";
import { useWindowSize } from "usehooks-ts";

export default () => {
  const { width, height } = useWindowSize();
  return <Confetti width={width} height={height} />;
};
