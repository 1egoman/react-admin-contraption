import { useCallback } from "react";

import { FixMe } from "../types";
import styles from "./Radiobutton.module.css";

const Radiobutton: React.FunctionComponent<{
  disabled?: boolean;
  id?: string;
  checked: boolean;
  onChange: (checked: boolean, shiftKey: boolean) => void;
}> = ({ disabled, id, checked, onChange }) => {
  const wrappedOnChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.currentTarget.checked, (e.nativeEvent as FixMe).shiftKey);
  }, [onChange]);

  return (
    <input
      type="radio"
      className={styles.radio}
      id={id}
      style={{ cursor: 'pointer' }}
      disabled={disabled}
      checked={checked}
      onChange={wrappedOnChange}
    />
  );
};

export default Radiobutton;
