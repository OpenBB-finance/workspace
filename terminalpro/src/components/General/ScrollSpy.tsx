import {
  createContext,
  type MouseEventHandler,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/** All elements that visible on intersection observer */
const DATA_VISIBLE = "data-scrollspy-visible";
/** Active trigger(s) */
const DATA_ACTIVE = "data-scrollspy-active";

interface IScrollspyContext {
  activeId: string | null;
  setActiveId: (v: string | null) => void;
  dataAttrActive?: string;
}
const ScrollspyContext = createContext<IScrollspyContext>(null);

interface ScrollspyRootProps {
  children: ReactNode;
  /**
   * A data attribute of active trigger when observable element is intersecting
   * @default data-scrollspy-active
   */
  dataAttrActive?: string;
}

/**
 * ScrollSpyRoot must wrap ScrollSpy and ScrollTrigger, as providing context
 */
export function ScrollspyRoot(props: ScrollspyRootProps) {
  const { dataAttrActive = DATA_ACTIVE, children } = props;
  // Add context with activeId variable
  const [activeId, setActiveId] = useState<string | null>(null);
  return (
    <ScrollspyContext.Provider value={{ activeId, setActiveId, dataAttrActive }}>
      {children}
    </ScrollspyContext.Provider>
  );
}

interface SpyProps {
  children: ReactNode;
}

export function ScrollSpy(props: SpyProps) {
  const { children } = props;

  const ref = useRef<HTMLDivElement>(null);
  const [visibleElements, setVisibleElements] = useState<Element[]>([]);
  const { setActiveId } = useContext(ScrollspyContext);

  const [observer] = useState(
    new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const { id } = entry.target;
          if (entry.isIntersecting) {
            // Element appears on screen
            setVisibleElements((prev) => [...prev, entry.target]);
          } else {
            // Element goes off screen
            setVisibleElements((prev) => prev.filter((el) => el.id !== id));
          }
        });
      },
      { threshold: 0.2 },
    ),
  );

  function updateActiveId() {
    // Sort visible elements by top position from top to bottom
    const visibleElements = Array.from(
      ref.current?.querySelectorAll(`[${DATA_VISIBLE}]`) || [],
    );
    const sorted = visibleElements.sort((a, b) => {
      return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
    });

    const root = ref.current?.parentElement;
    if (!root) {
      setActiveId(sorted[0]?.id ?? null);
    }

    const paddingTop = Number.parseInt(
      getComputedStyle(root).getPropertyValue("padding-top"),
      10,
    );
    const isScrollable = root.scrollHeight > root.clientHeight;
    const isScrolledToTop = root.scrollTop <= paddingTop;
    const isScrolledToBottom = root.scrollHeight - root.scrollTop === root.clientHeight;

    if (sorted.length === 0) {
      setActiveId(null);
      return;
    }
    if (!isScrollable) {
      setActiveId(sorted[0].id);
      return;
    }
    if (isScrolledToTop) {
      setActiveId(sorted[0].id);
      return;
    }
    if (isScrolledToBottom) {
      setActiveId(sorted[sorted.length - 1].id);
      return;
    }

    if (sorted.length > 1) {
      // Calculate if the highest element is slightly scrolled up and takes less than 30% of the screen
      const highestBB = sorted[0].getBoundingClientRect();
      const rootBB = root.getBoundingClientRect();
      const isHighestOut =
        highestBB.top < rootBB.top - 50 &&
        highestBB.bottom < rootBB.top + rootBB.height * 0.3;
      if (isHighestOut) {
        setActiveId(sorted[1].id);
        return;
      }
    }

    setActiveId(sorted[0].id);
  }

  useEffect(() => {
    const root = ref.current?.parentElement;
    if (root) {
      root.addEventListener("scroll", updateActiveId, { passive: true });
    }
    // Fist time update hack
    setTimeout(updateActiveId, 100);

    return () => {
      observer.disconnect();
      root?.removeEventListener("scroll", updateActiveId);
    };
  }, []);

  useEffect(() => {
    observer.disconnect();
    const items = ref.current?.querySelectorAll("[id]");
    items?.forEach((item) => {
      observer.observe(item);
    });
    updateActiveId();
  }, [ref]);

  useEffect(() => {
    document.querySelectorAll(`[${DATA_VISIBLE}]`).forEach((trigger) => {
      trigger.removeAttribute(DATA_VISIBLE);
    });
    visibleElements.forEach((el) => {
      el.setAttribute(DATA_VISIBLE, "");
    });
  }, [visibleElements]);

  return (
    <div ref={ref} style={{ display: "contents" }}>
      {children}
    </div>
  );
}

interface TriggerProps {
  children: ReactNode;
  /** An id this element will spy for */
  id: string;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

/**
 * ScrollSpy will observe the element with id from data-scrollspy-id attribute and add
 * @param props
 * @returns
 */
export function ScrollTrigger(props: TriggerProps) {
  const { children, onClick, id, ...rest } = props;
  const { activeId, setActiveId, dataAttrActive } = useContext(ScrollspyContext);
  const ref = useRef<HTMLButtonElement>(null);

  function handleClick(e: ReactMouseEvent<HTMLButtonElement>) {
    const el = document.getElementById(id || "");
    if (el) {
      //! When scroll behavior is instant, the scroll event triggers before scrolling,
      //! so we need this hack to render the active state on the next tick.
      //! 50 ms hack is for Safari
      setTimeout(() => {
        setActiveId(id);
      }, 50);
    }
    onClick?.(e);
  }

  function updateActiveState() {
    if (activeId === id) {
      ref.current?.setAttribute(dataAttrActive, "");
    } else {
      ref.current?.removeAttribute(dataAttrActive);
    }
  }

  useEffect(updateActiveState, []);
  useEffect(updateActiveState, [id, activeId, dataAttrActive]);

  return (
    <a href={`#${id}`} className="contents">
      <button onClick={handleClick} ref={ref} {...rest}>
        {children}
      </button>
    </a>
  );
}
