import * as React from "react";
import { useContext } from "react";
import { NextRouter } from "next/router";

import { Controls } from './controls';
import { Filter, Sort } from "./types";

export type StateCache = {
  store: (
    filters: Array<[Filter['name'], string]>,
    sort: Sort | null,
    searchText: string,
    columnSet: 'all' | string | Array<string>,
  ) => Promise<void>;
  read: () => Promise<[
    Array<[Filter['name'], string]>,
    Sort | null,
    string,
    'all' | string | Array<string>,
  ]>;
};

// NOTE: only the methods that are used are defined below so that if somebody wanted to implement
// their own router (ie, another framework, overriding things, etc) it wouldn't be such a PITA
type AbstractNextRouter = Pick<NextRouter, 'push' | 'replace' | 'query'>;

export type AdminContextData = {
  stateCache?: StateCache;
  nextRouter?: AbstractNextRouter;

  controls?: Controls,
};

// NOIE: Because All properties are optional within `AdminContextData`, this context does not have
// an unset state. This is different from most of the rest of the contexts in this app!
const AdminContext = React.createContext<AdminContextData>({});

export const useAdminContext = () => useContext(AdminContext);

export const AdminContextProvider: React.FunctionComponent<AdminContextData & { children: React.ReactNode }> = ({ children, ...rest }) => (
  <AdminContext.Provider value={rest}>
    {children}
  </AdminContext.Provider>
);
