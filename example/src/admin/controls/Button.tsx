import Link from "next/link";

import Navigatable from "../navigatable";
import styles from "./Button.module.css";

const Button: React.FunctionComponent<{
  size?: 'regular' | 'small';
  disabled?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}> = ({ size = 'regular', disabled, onClick, children }) => {
  return (
    <button
      className={size === 'regular' ? styles.buttonRegular : styles.buttonSmall}
      onClick={onClick}
      disabled={disabled}
    >{children}</button>
  );
};

export const IconButton: React.FunctionComponent<{
  size?: 'regular' | 'small';
  children: React.ReactNode;
  onClick: () => void;
}> = ({ size = 'regular', onClick, children }) => {
  return (
    <button
      onClick={onClick}
      style={{
        cursor: 'pointer',
        fontSize: size === 'regular' ? 16 : 14,
        width: size === 'regular' ? 32 : 24,
        height: size === 'regular' ? 32 : 24,
      }}
    >{children}</button>
  );
};

export const NavigationButton: React.FunctionComponent<{
  navigatable: Navigatable | null,
  children: React.ReactNode,
}> = ({ navigatable, children }) => {
  switch (navigatable?.type) {
    case 'href':
      return (
        <a href={navigatable.href} target={navigatable.target}>{children}</a>
      );
    case 'next-link':
      const { type, ...rest } = navigatable;
      return (
        <Link {...rest}>
          {children}
        </Link>
      );
    case 'function':
      return (
        <Button onClick={navigatable.onClick}>
          {children}
        </Button>
      );
    default:
      return null;
  }
};


export default Button;
