import { useRef, useCallback, useEffect } from "react";

const useInFlightAbortControllers = (): [(abort: AbortController) => void, (abort: AbortController) => void] => {
  const inFlightRequestAbortControllers = useRef<Array<AbortController>>([]);
  const addInFlightAbortController = useCallback((abort: AbortController) => {
    inFlightRequestAbortControllers.current.push(abort);
  }, []);
  const removeInFlightAbortController = useCallback((abort: AbortController) => {
    inFlightRequestAbortControllers.current = inFlightRequestAbortControllers.current.filter(c => c !== abort);
  }, []);

  // When the component unmounts, terminate all in flight requests
  useEffect(() => {
    return () => {
      for (const abortController of inFlightRequestAbortControllers.current) {
        abortController.abort();
      }
    };
  }, []);

  return [addInFlightAbortController, removeInFlightAbortController];
};

export default useInFlightAbortControllers;
