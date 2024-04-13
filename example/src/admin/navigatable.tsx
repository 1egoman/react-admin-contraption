import { LinkProps } from "next/link";

type Navigatable =
  | { type: 'href', href: string, target?: '_blank' }
  | ({ type: 'next-link' } & LinkProps)
  | { type: 'function', onClick: () => void };

export const imperativelyNavigateToNavigatable = (navigatable: Navigatable | null) => {
  switch (navigatable?.type) {
    case 'href':
      if (navigatable.target === '_blank') {
        window.open(navigatable.href, '_blank');
      } else {
        window.location.href = navigatable.href;
      }
      return;
    case 'next-link':
      // TODO: how does one imperatively navigate to a next route without having access to
      // `useRouter()`?
      alert('Not yet implemented.');
      return;
    case 'function':
      navigatable.onClick();
      return;
    default:
      return;
  }
};

export default Navigatable;
