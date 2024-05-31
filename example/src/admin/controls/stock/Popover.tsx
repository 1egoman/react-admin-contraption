import { Fragment, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import styles from "./Popover.module.css";

const Popover: React.FunctionComponent<{
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
        <div className={styles.backdrop} onClick={close} />,
        document.body
      ) : null}

      <div className={styles.popupWrapper}>
        <div>
          {target(toggle, open, close)}
        </div>

        {visible ? (
          <div className={styles.popup} style={{ display: visible ? 'flex' : 'none' }}>
            {children(close)}
          </div>
        ) : null}
      </div>
    </Fragment>
  );
};

export default Popover;
