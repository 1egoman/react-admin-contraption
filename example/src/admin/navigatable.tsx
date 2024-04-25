import { LinkProps } from "next/link";

import { AdminContextData } from "./admin-context";


type Navigatable =
  | { type: 'href', href: string, target?: '_blank' }
  | ({ type: 'next-link' } & LinkProps)
  | { type: 'function', onClick: () => void };

export const imperativelyNavigateToNavigatable = (adminContext: AdminContextData, navigatable: Navigatable | null) => {
  switch (navigatable?.type) {
    case 'href':
      if (navigatable.target) {
        window.open(navigatable.href, navigatable.target);
      } else {
        window.location.href = navigatable.href;
      }
      return;
    case 'next-link':
      if (!adminContext.nextRouter) {
        console.error('Error running imperativelyNavigateToNavigatable: adminContext.nextRouter is not defined!');
        return;
      }

      // FIXME: this probably isn't perfect and mishandles some parameters, but will likely work for
      // now
      if (navigatable.replace) {
        adminContext.nextRouter.replace(navigatable.href, navigatable.as, navigatable);
      } else {
        adminContext.nextRouter.push(navigatable.href, navigatable.as, navigatable);
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
