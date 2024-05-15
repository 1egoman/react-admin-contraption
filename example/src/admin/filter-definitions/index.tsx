import * as React from 'react';
import { useEffect, useContext } from 'react';

import { JSONValue, Filter } from '../types';

export const FilterMetadataContext = React.createContext<[
  Array<FilterMetadata>,
  (filters: (old: Array<FilterMetadata>) => Array<FilterMetadata>) => void,
] | null>(null);

export type FilterMetadata<FilterState extends JSONValue = JSONValue> = {
  name: Array<string>;
  getInitialState: () => FilterState;
  onIsValid: (state: FilterState) => boolean;
  onIsComplete: (state: FilterState) => boolean;
  serialize?: (state: FilterState) => string;
  deserialize?: (raw: string) => FilterState
  children: (
    state: FilterState,
    setState: (newState: FilterState) => void,
    filter: Filter<FilterState>,
    onBlur: () => void,
  ) => React.ReactNode;
};

const FilterDefinition = <State extends JSONValue = JSONValue>(props: FilterMetadata<State>) => {
  const filterMetadataContextData = useContext(FilterMetadataContext);
  if (!filterMetadataContextData) {
    throw new Error('Error: <Filter ... /> was not rendered inside of a container component! Try rendering this inside of a <ListFilterBar> ... </ListFilterBar>.');
  }

  const [_filterMetadata, setFilterMetadata] = filterMetadataContextData;

  useEffect(() => {
    const filterMetadata: FilterMetadata<State> = {
      name: props.name,
      getInitialState: props.getInitialState,
      onIsComplete: props.onIsComplete,
      onIsValid: props.onIsValid,
      serialize: props.serialize,
      deserialize: props.deserialize,
      children: props.children,
    };

    const castedFilterMetadata = (filterMetadata as unknown) as FilterMetadata<JSONValue>;
    setFilterMetadata(old => [ ...old, castedFilterMetadata ]);

    return () => {
      setFilterMetadata(old => old.filter(f => f !== castedFilterMetadata));
    };
  }, [
    props.name,
    props.getInitialState,
    props.onIsValid,
    props.onIsComplete,
    props.serialize,
    props.deserialize,
    props.children,
  ]);

  return null;
};

export default FilterDefinition;
