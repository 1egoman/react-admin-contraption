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

// Pulls the `returnto` query param from the query string and uses this to generate a `Navigatable`
export const generateNavigatableFromReturnToQueryParam = (adminContext: AdminContextData, paramName = 'returnto'): Navigatable | null => {
  const returnToQueryParamValueRaw = adminContext.nextRouter ? (
    adminContext.nextRouter.query[paramName]
  ) : (new URL(window.location.href)).searchParams.get(paramName);

  if (!returnToQueryParamValueRaw) {
    return null;
  }

  return {
    type: adminContext.nextRouter ? 'next-link' : 'href',
    href: `${returnToQueryParamValueRaw}`,
  };
};

// Given a `Navigatable` and a `returnto` value, inject this `returnto` value into the navigatable
// and return a new copy.
export const injectReturnToQueryParamIntoNavigatable = (
  navigatable: Navigatable,
  returnToValue: string,
  paramName = 'returnto'
): Navigatable => {
  switch (navigatable.type) {
    case 'href':
    case 'next-link':
      const url = typeof navigatable.href === 'string' ? new URL(navigatable.href, window.location.href) : navigatable.href;
      const search = new URLSearchParams(url.search || undefined);
      search.set(paramName, returnToValue);
      url.search = search.toString();

      if (navigatable.type === 'href') {
        return { ...navigatable, href: url.toString() };
      } else {
        return { ...navigatable, href: url };
      }

    case 'function':
      // Note: It's not possible to inject a returnto value into a function call navigatable,
      // there's no stored url!
      return navigatable;
  }
};

export default Navigatable;
