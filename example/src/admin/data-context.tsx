import * as React from "react";
import { useContext } from "react";

import { BaseFieldName, BaseItem } from "./types";
import { DataContextList } from "./list";
import { DataContextDetail } from "./detail";


const DataContext = React.createContext<
  | DataContextList
  | DataContextDetail
  | null
>(null);

export const useListDataContext = <Item = BaseItem, FieldName = BaseFieldName>(sourceComponentName?: string) => {
  const value = useContext(DataContext);
  if (value && value.type !== "list") {
    if (sourceComponentName) {
      throw new Error(`<${sourceComponentName}>...</${sourceComponentName}> was not rendered inside of a <List> ... </List> component! This is required.`);
    } else {
      throw new Error(`Admin DataContext has type of '${value.type}', expected 'list'!`);
    }
  }
  return (value as unknown) as DataContextList<Item, FieldName>;
};
export const useDetailDataContext = <Item = BaseItem>(sourceComponentName?: string) => {
  const value = useContext(DataContext);
  if (value && value.type !== "detail") {
    if (sourceComponentName) {
      throw new Error(`<${sourceComponentName}>...</${sourceComponentName}> was not rendered inside of a <Detail> ... </Detail> component! This is required.`);
    } else {
      throw new Error(`Admin DataContext has type of '${value.type}', expected 'detail'!`);
    }
  }
  return (value as unknown) as DataContextDetail<Item>;
};

export const DataContextProvider = <I = BaseItem>(
  { value, children }: { value: DataContextList<I> | DataContextDetail<I>, children: React.ReactNode }
) => (
  <DataContext.Provider value={value as any as (DataContextList | DataContextDetail)}>
    {children}
  </DataContext.Provider>
);
