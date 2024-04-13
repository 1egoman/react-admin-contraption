import { LegacyRef, forwardRef, useCallback } from "react";
import styles from "./TextArea.module.css";

type TextAreaProps = {
  size?: 'regular' | 'small';
  placeholder?: string;
  disabled?: boolean;
  value: string;
  onChange: (newText: string) => void;
  onBlur?: () => void;
};

type TextAreaRefInterface = {
  focus: () => void;
};

const TextAreaWithRef: React.FunctionComponent<TextAreaProps & {
  includedRef: React.ForwardedRef<TextAreaRefInterface>;
}> = ({ size = 'regular', placeholder, disabled, value, onChange, onBlur, includedRef }) => {
  const wrappedOnChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.currentTarget.value);
  }, [onChange]);
  const wrappedOnBlur = useCallback(() => {
    if (onBlur) {
      onBlur()
    }
  }, [onBlur]);

  return (
    <textarea
      ref={includedRef as LegacyRef<HTMLTextAreaElement>}
      className={size === 'regular' ? styles.textAreaRegular : styles.textAreaSmall}
      placeholder={placeholder}
      disabled={disabled}
      value={value}
      onChange={wrappedOnChange}
      onBlur={wrappedOnBlur}
    />
  );
};

export default forwardRef<TextAreaRefInterface, TextAreaProps>((props, ref) => (
  <TextAreaWithRef {...props} includedRef={ref} />
));
