import { Fragment, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import styles from "./Modal.module.css";

const Modal: React.FunctionComponent<{
  target: (toggle: () => void, open: () => void, close: () => void) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
}> = ({ target, children }) => {
  const [visible, setVisible] = useState(false);

  const [toggle, open, close] = useMemo(() => {
    return [() => setVisible(n => !n), () => setVisible(true), () => setVisible(false)];
  }, [setVisible]);

  return (
    <Fragment>
      {visible ? createPortal(
        <div className={styles.backdrop} onClick={close}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            {children(close)}
          </div>
        </div>,
        document.body
      ) : null}

      {target(toggle, open, close)}
    </Fragment>
  );
};

export default Modal;
