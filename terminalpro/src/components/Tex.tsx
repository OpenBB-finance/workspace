import KaTeX, { type KatexOptions, ParseError } from "katex";
import {
  type ComponentPropsWithoutRef,
  type ElementType,
  type FC,
  memo,
  type ReactElement,
  useEffect,
  useRef,
  useState,
} from "react";
import "katex/dist/katex.min.css";

const TeX: FC<TeXProps> = ({
  children,
  math,
  block,
  errorColor,
  renderError,
  settings,
  as: asComponent,
  ...props
}) => {
  const Component = asComponent || (block ? "div" : "span");
  const content = (children ?? math) as string;
  const [errorElement, setErrorElement] = useState(null as ReactElement | null);
  const renderElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setErrorElement(null);
    if (!(content && renderElementRef.current)) return;

    renderElementRef.current.innerHTML = "";
    try {
      KaTeX.render(content, renderElementRef.current!, {
        displayMode: !!block,
        errorColor,
        throwOnError: !!renderError,
        ...settings,
        output: "html",
      });
    } catch (error) {
      if (error instanceof ParseError || error instanceof TypeError) {
        if (renderError) {
          setErrorElement(renderError(error));
        } else {
          renderElementRef.current!.innerHTML = error.message;
        }
      } else {
        throw error;
      }
    }
  }, [block, content, errorColor, renderError, settings, renderElementRef]);

  return (
    <>
      {errorElement}
      <Component {...props} ref={renderElementRef} />
    </>
  );
};

export default memo(TeX);

type TeXProps = ComponentPropsWithoutRef<"div"> &
  Partial<{
    as: ElementType;
    math: string | number;
    block: boolean;
    errorColor: string;
    renderError: (error: ParseError | TypeError) => ReactElement;
    settings: KatexOptions;
  }>;

export const InlineMath: FC<Omit<TeXProps, "block">> = memo((props) => (
  <TeX {...props} block={false} />
));

export const BlockMath: FC<Omit<TeXProps, "block">> = memo((props) => (
  <TeX {...props} block={true} />
));
