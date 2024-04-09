type Navigatable =
  | { type: 'href', href: string, target?: '_blank' }
  | { type: 'function', onClick: () => void };

export const NavigationButton: React.FunctionComponent<{
  navigatable: Navigatable | null,
  children: React.ReactNode,
}> = ({ navigatable, children }) => {
  switch (navigatable?.type) {
    case 'href':
      return (
        <a href={navigatable.href} target={navigatable.target}>{children}</a>
      );
    case 'function':
      return (
        <button onClick={navigatable.onClick}>{children}</button>
      );
    default:
      return null;
  }
};

export const imperativelyNavigateToNavigatable = (navigatable: Navigatable | null) => {
  switch (navigatable?.type) {
    case 'href':
      if (navigatable.target === '_blank') {
        window.open(navigatable.href, '_blank');
      } else {
        window.location.href = navigatable.href;
      }
      return;
    case 'function':
      navigatable.onClick();
      return;
    default:
      return;
  }
};

export default Navigatable;
