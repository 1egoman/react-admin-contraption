import styles from "./AppBar.module.css";

type AppBarProps = {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  intent: 'header' | 'footer';
  size?: 'regular' | 'small';
};

const AppBar: React.FunctionComponent<AppBarProps> = ({ size='regular', title, actions, intent }) => (
  <div
    className={size === 'regular' ? styles.appBarRegular : styles.appBarSmall}
    style={{
      backgroundColor: intent === 'header' ? 'var(--gray-2)' : 'var(--gray-4)',
      borderBottom: intent === 'header' ? '1px solid var(--gray-8)' : undefined,
      borderTop: intent === 'footer' ? '1px solid var(--gray-8)' : undefined,
    }}
  >
    {title ? (
      <div className={styles.title}>
        {title}
      </div>
    ) : null}
    {actions ? (
      <div className={styles.actions}>
        {actions}
      </div>
    ) : null}
  </div>
);

export default AppBar;
