import { LegacyRef, forwardRef, useCallback } from "react";
import styles from "./TextInput.module.css";
import { red } from "@radix-ui/colors";

type TextInputProps = {
  size?: 'regular' | 'small';
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  value: string;
  onChange: (newText: string) => void;
  onBlur?: () => void;
};

type TextInputRefInterface = {
  focus: () => void;
};

const TextInputWithRef: React.FunctionComponent<TextInputProps & {
  includedRef: React.ForwardedRef<TextInputRefInterface>;
}> = ({ size = 'regular', type, placeholder, disabled, value, onChange, onBlur, includedRef, invalid }) => {
  const wrappedOnChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.currentTarget.value);
  }, [onChange]);
  const wrappedOnBlur = useCallback(() => {
    if (onBlur) {
      onBlur()
    }
  }, [onBlur]);

  return (
    <input
      ref={includedRef as LegacyRef<HTMLInputElement>}
      type={type || "text"}
      className={size === 'regular' ? styles.inputRegular : styles.inputSmall}
      style={{
        borderRadius: invalid ? 2 : undefined,
        outline: invalid ? '0px solid transparent' : undefined,
        border: invalid ? `2px solid ${red.red9}` : undefined,
      }}
      placeholder={placeholder}
      disabled={disabled}
      value={value}
      onChange={wrappedOnChange}
      onBlur={wrappedOnBlur}
    />
  );
};

export default forwardRef<TextInputRefInterface, TextInputProps>((props, ref) => (
  <TextInputWithRef {...props} includedRef={ref} />
));
