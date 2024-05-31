import { LegacyRef, forwardRef, useCallback } from "react";
import styles from "./Select.module.css";

import { SelectOption } from "..";

type SelectProps = {
  size?: 'regular' | 'small';
  value: SelectOption['value'];
  options: Array<SelectOption>;
  disabled?: boolean;
  width?: string | number;
  onChange: (optionValue: SelectOption['value']) => void;
  onBlur?: () => void;
};

type SelectRefInterface = {
  focus: () => void;
};

const SelectWithRef: React.FunctionComponent<SelectProps & {
  includedRef: React.ForwardedRef<SelectRefInterface>;
}> = ({ size = 'regular', options, disabled, value, width, onChange, onBlur, includedRef }) => {
  const wrappedOnChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.currentTarget.value);
  }, [onChange]);
  const wrappedOnBlur = useCallback(() => {
    if (onBlur) {
      onBlur();
    }
  }, [onBlur]);

  return (
    <select
      ref={includedRef as LegacyRef<HTMLSelectElement>}
      className={size === 'regular' ? styles.selectRegular : styles.selectSmall}
      disabled={disabled}
      value={value}
      onChange={wrappedOnChange}
      onBlur={wrappedOnBlur}
      style={{ width }}
    >
      {options.map(option => (
        <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>
      ))}
    </select>
  );
};

export default forwardRef<SelectRefInterface, SelectProps>((props, ref) => (
  <SelectWithRef {...props} includedRef={ref} />
));
