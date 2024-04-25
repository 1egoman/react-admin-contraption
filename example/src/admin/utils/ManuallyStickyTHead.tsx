import { useRef, useEffect } from "react";

// This component renders a `thead` element that will implement behavior very similar to `position:
// sticky; top: 0px`.
//
// In theory, this should be able to be position sticky... but the table styling I ended up with
// seems to result in that not working right for some reason. So, this is my workaround for now.
const ManuallyStickyTHead: React.FunctionComponent<{children: React.ReactNode}> = ({ children }) => {
  const tHeadRef = useRef<HTMLTableSectionElement | null>(null);

  const previousY = useRef<number | null>(null);
  const locked = useRef<boolean>(false);
  const lastPositionY = useRef<number | null>(null);

  useEffect(() => {
    if (!tHeadRef.current) {
      return;
    }

    let handle: number | null = null;
    const frame = () => {
      if (!tHeadRef.current) {
        return;
      }
      const position = tHeadRef.current.getBoundingClientRect();
      if (position.y !== previousY.current) {
        if (!locked.current && position.y < 0) {
          // Lock header to top of screen
          locked.current = true;
          lastPositionY.current = -1 * position.y;
          tHeadRef.current.style.transform = `translateY(${lastPositionY.current}px)`;
        } else if (typeof lastPositionY.current === 'number' && locked.current) {
          lastPositionY.current -= position.y;
          if (typeof lastPositionY.current === 'number' && lastPositionY.current > 0) {
            tHeadRef.current.style.transform = `translateY(${lastPositionY.current}px)`;
          } else {
            // Unlock header from top of screen
            locked.current = false;
            tHeadRef.current.style.transform = `translateY(0px)`;
          }
        }
        previousY.current = position.y;
      }

      handle = requestAnimationFrame(frame);
      // handle = setTimeout(frame, 500);
    };
    handle = requestAnimationFrame(frame);
    // handle = setTimeout(frame, 500);

    return () => {
      if (handle !== null) {
        cancelAnimationFrame(handle);
        // clearTimeout(handle);
      }
    }
  }, []);

  return (
    <thead ref={tHeadRef}>
      {children}
    </thead>
  );
};

export default ManuallyStickyTHead;
