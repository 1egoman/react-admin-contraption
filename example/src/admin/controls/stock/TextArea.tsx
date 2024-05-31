import { LegacyRef, forwardRef, useCallback } from "react";
import styles from "./TextArea.module.css";
import { red } from "@radix-ui/colors";

type TextAreaProps = {
  size?: 'regular' | 'small';
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  monospace?: boolean;
  value: string;
  onChange: (newText: string) => void;
  onBlur?: () => void;
};

type TextAreaRefInterface = {
  focus: () => void;
};

const TextAreaWithRef: React.FunctionComponent<TextAreaProps & {
  includedRef: React.ForwardedRef<TextAreaRefInterface>;
}> = ({ size = 'regular', placeholder, disabled, invalid, value, onChange, onBlur, includedRef }) => {
  const wrappedOnChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.currentTarget.value);
  }, [onChange]);

  return (
    <textarea
      ref={includedRef as LegacyRef<HTMLTextAreaElement>}
      className={size === 'regular' ? styles.textAreaRegular : styles.textAreaSmall}
      placeholder={placeholder}
      disabled={disabled}
      value={value}
      onChange={wrappedOnChange}
      onBlur={onBlur}
      style={{
        borderRadius: invalid ? 2 : undefined,
        outline: invalid ? '0px solid transparent' : undefined,
        border: invalid ? `2px solid ${red.red9}` : undefined,
      }}
    />
  );
};

export default forwardRef<TextAreaRefInterface, TextAreaProps>((props, ref) => (
  <TextAreaWithRef {...props} includedRef={ref} />
));
