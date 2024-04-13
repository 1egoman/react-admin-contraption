import { useCallback } from "react";

import { FixMe } from "../types";
import styles from "./Checkbox.module.css";

const Checkbox: React.FunctionComponent<{
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
      type="checkbox"
      id={id}
      className={styles.checkbox}
      style={{ cursor: 'pointer' }}
      disabled={disabled}
      checked={checked}
      onChange={wrappedOnChange}
    />
  );
};

export default Checkbox;
