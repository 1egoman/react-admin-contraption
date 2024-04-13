import * as React from 'react';

import Filter from './filters';

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

type AdminContextData = {
  stateCache?: StateCache;
};
const AdminContext = React.createContext<AdminContextData | null>(null);
export const AdminContextProvider: React.FunctionComponent<AdminContextData & { children: React.ReactNode }> = ({ children, ...rest }) => (
  <AdminContext.Provider value={rest}>
    {children}
  </AdminContext.Provider>
);
