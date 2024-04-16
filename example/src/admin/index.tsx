import * as React from 'react';
import { NextRouter } from 'next/router';
import {
  Fragment,
  useMemo,
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback,
} from 'react';
import { gray } from '@radix-ui/colors';

import styles from './styles.module.css';
// import "./global.css";

import {
  FixMe,
  JSONValue,
  BaseItem,
  BaseFieldName,
  BaseFieldState, 
  ItemKey,
  ALL_ITEMS,
  CheckedItemKeys,
  Paginated,
  Filter,
  Sort,
  FILTER_NOT_SET_YET,
} from './types';

import Navigatable, { imperativelyNavigateToNavigatable } from "./navigatable";
import { Controls, useControls } from './controls';
import { SelectOption } from './controls/Select';

import { DataModel, DataModels, DataModelsContext } from './datamodel';
export { DataModel, DataModels };

import Field, { FieldMetadata, FieldCollection, FieldsProvider, EMPTY_FIELD_COLLECTION, NullableWrapper } from './fields';
export { Field };

import InputField, { InputFieldProps } from './fields/InputField';
export { InputField };

import Launcher from './launcher';
export { Launcher };

import ListCSVExport from './csv-export';

export const useInFlightAbortControllers = () => {
  const inFlightRequestAbortControllers = useRef<Array<AbortController>>([]);
  const addInFlightAbortController = useCallback((abort: AbortController) => {
    inFlightRequestAbortControllers.current.push(abort);
  }, []);
  const removeInFlightAbortController = useCallback((abort: AbortController) => {
    inFlightRequestAbortControllers.current = inFlightRequestAbortControllers.current.filter(c => c !== abort);
  }, []);

  // When the component unmounts, terminate all in flight requests
  useEffect(() => {
    return () => {
      for (const abortController of inFlightRequestAbortControllers.current) {
        abortController.abort();
      }
    };
  }, []);

  return [addInFlightAbortController, removeInFlightAbortController];
};

const SearchInput: React.FunctionComponent<{
  pluralDisplayName: string;
  value: string;
  onChange: (text: string) => void;
}> = ({ pluralDisplayName, value, onChange }) => {
  const Controls = useControls();

  const [text, setText] = useState('');
  useEffect(() => {
    setText(value);
  }, [value]);

  return (
    <Controls.TextInput
      placeholder={`Search ${pluralDisplayName}...`}
      value={text}
      onChange={setText}
      onBlur={() => onChange(text)}
    />
  );
}

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
type AbstractNextRouter = Pick<NextRouter, 'push' | 'replace'>;

export type AdminContextData = {
  stateCache?: StateCache;
  nextRouter?: AbstractNextRouter;

  controls?: Controls,
};
export const AdminContext = React.createContext<AdminContextData | null>(null);
export const AdminContextProvider: React.FunctionComponent<AdminContextData & { children: React.ReactNode }> = ({ children, ...rest }) => (
  <AdminContext.Provider value={rest}>
    {children}
  </AdminContext.Provider>
);




const DataContext = React.createContext<
  | DataContextList
  | DataContextDetail
  | null
>(null);






type DataContextList<I = BaseItem, F = BaseFieldName> = {
  type: 'list';
  name: string;
  singularDisplayName: string;
  pluralDisplayName: string;
  csvExportColumnName?: string;

  listData: ListData<I>;
  onLoadNextPage: () => Promise<void>;
  fetchAllListData: () => Promise<Array<I>>;

  checkable: boolean;
  checkedItemKeys: CheckedItemKeys;
  onChangeCheckedItemKeys: (keys: CheckedItemKeys) => void;

  filters: Array<Filter>;
  onChangeFilters: (newFilters: Array<Filter>) => void;

  sort: Sort | null;
  onChangeSort: (newSort: Sort) => void;

  searchText: string;
  onChangeSearchText: (newSearchText: string) => void;

  columnSet: 'all' | string | Array<F>;
  onChangeColumnSet: (newColumnSet: 'all' | string | Array<F>) => void;

  keyGenerator: (item: I) => ItemKey;
  detailLinkGenerator: null | ((item: I) => Navigatable);

  createLink: null | Navigatable;
};

export type ListData<T> =
  | { status: 'IDLE' }
  | { status: 'LOADING_INITIAL' }
  | {
    status: 'COMPLETE';
    nextPageAvailable: boolean;
    totalCount: number;
    data: Array<T>;
    lastLoadedPage: number;
  }
  | {
    status: 'ERROR_INITIAL';
    error: Error;
  }
  | { status: 'LOADING_NEXT_PAGE', data: Array<T>, loadingPage: number }

type ListProps<I = BaseItem> = {
  name: string;

  checkable?: boolean;
  children?: React.ReactNode;
} & Partial<Pick<
  DataModel<I>,
  | "singularDisplayName"
  | "pluralDisplayName"
  | "csvExportColumnName"
  | "fetchPageOfData"
  | "keyGenerator"
  | "detailLinkGenerator"
  | "createLink"
>>;

export const List = <I = BaseItem>(props: ListProps<I>) => {
  const {
    name,
    checkable = false,
    children,
  } = props;

  // First, get the data model that the list component uses:
  const dataModelsContextData = useContext(DataModelsContext);
  if (!dataModelsContextData) {
    throw new Error('Error: <List ... /> was not rendered inside of a container component! Try rendering this inside of a <DataModels> ... </DataModels>.');
  }
  const dataModel = dataModelsContextData[0].get(name) as DataModel<I> | undefined;
  const singularDisplayName = props.singularDisplayName || dataModel?.singularDisplayName || '';
  const pluralDisplayName = props.pluralDisplayName || dataModel?.pluralDisplayName || '';
  const csvExportColumnName = props.csvExportColumnName || dataModel?.csvExportColumnName || '';
  const fetchPageOfData = props.fetchPageOfData || dataModel?.fetchPageOfData || null;
  const keyGenerator = props.keyGenerator || dataModel?.keyGenerator || null;
  const detailLinkGenerator = props.detailLinkGenerator || dataModel?.detailLinkGenerator || null;
  const createLink = props.createLink || dataModel?.createLink || null;


  const adminContextData = useContext(AdminContext);
  const stateCache = adminContextData?.stateCache;

  const [listData, setListData] = useState<ListData<I>>({ status: 'IDLE' });

  // When the component unmounts, terminate all in flight requests
  const [
    addInFlightAbortController,
    removeInFlightAbortController,
  ] = useInFlightAbortControllers();

  const [checkedItemKeys, setCheckedItemKeys] = useState<CheckedItemKeys>([]);

  const [sort, setSort] = useState<Sort | null>(null);
  const [searchText, setSearchText] = useState<string>('');

  const [filters, setFilters] = useState<Array<Filter>>([]);
  const [filterMetadata, setFilterMetadata] = useState<Array<FilterMetadata>>([]);

  const [columnSet, setColumnSet] = useState<'all' | string | Array<BaseFieldName>>('all' as const);

  // If defined, read the initial filters state from the fitler cache
  const [stateCacheInitiallyRead, setStateCacheInitiallyRead] = useState(false);
  useEffect(() => {
    if (!stateCache) {
      return;
    }
    if (stateCacheInitiallyRead) {
      return;
    }

    // FIXME: this timeout is so that `filterMetadata` can be fully populated before this runs
    const timeout = setTimeout(() => {
      stateCache.read().then(([filterPairs, sort, searchText, columnSet]) => {
        const nextFilters: Array<Filter> = [];
        for (const [name, rawState] of filterPairs) {
          // Attempt to find a filter definition that matches this new name selection
          let metadata: FilterMetadata | null = null;
          for (const item of filterMetadata) {
            const nameMatches = name.every((e, i) => e === item.name[i]);
            if (nameMatches) {
              metadata = item;
              break;
            }
          }

          if (!metadata) {
            continue;
          }

          const deserializer = metadata.deserialize || JSON.parse;
          let state: JSONValue;
          try {
            state = deserializer(rawState);
          } catch (err) {
            console.error(`Error deserializing state for filter ${name}: ${err}`);
            return;
          }

          const isValid = metadata.onIsValid(state);
          nextFilters.push({
            name,
            workingState: state,
            isValid,
            isComplete: isValid && metadata.onIsComplete(state),
            state,
          });
        }

        setFilters(nextFilters);
        setSort(sort);
        setSearchText(searchText);
        setColumnSet(columnSet as FixMe);

        setStateCacheInitiallyRead(true);
      }).catch(err => {
        console.error('Error reading initial state from stateCache:', err);
      });
    }, 100);
    return () => clearTimeout(timeout);
  }, [stateCache, filterMetadata, stateCacheInitiallyRead, setStateCacheInitiallyRead]);

  // FIXME: this is kinda a hack - the goal here is to ensure that `filtersThatAreFullyCompleted` is
  // set to be a list of filters that are completed that ONLY changes reference when a filter
  // changes from being not completed to completed or vice versa.
  const filtersThatAreFullyCompletedJson = JSON.stringify(
    filters
      .filter(filter => filter.isComplete)
      .map((filter) => [filter.name, filter.state])
  );
  const filtersThatAreFullyCompleted = useMemo(() => {
    return JSON.parse(filtersThatAreFullyCompletedJson) as Array<[Filter['name'], Filter['state']]>;
  }, [filtersThatAreFullyCompletedJson]);

  // If defined, write the filters / sort / search state when it changes to the state cache
  useEffect(() => {
    if (!stateCache) {
      return;
    }
    if (!stateCacheInitiallyRead) {
      return;
    }

    const nameAndSerializedState: Array<[Filter['name'], string]> = [];
    for (const [name, state] of filtersThatAreFullyCompleted) {
      // Attempt to find a filter definition that matches this new name selection
      let metadata: FilterMetadata | null = null;
      for (const item of filterMetadata) {
        const nameMatches = name.every((e, i) => e === item.name[i]);
        if (nameMatches) {
          metadata = item;
          break;
        }
      }

      if (!metadata) {
        continue;
      }

      const serializer = metadata.serialize || JSON.stringify;
      let rawState: string;
      try {
        rawState = serializer(state);
      } catch (err) {
        console.error(`Error serializing state for filter ${name}: ${err}`);
        return;
      }

      nameAndSerializedState.push([name, rawState]);
    }

    stateCache.store(nameAndSerializedState, sort, searchText, columnSet)
      .catch(err => console.error('Error storing filters:', err));
  }, [stateCache, stateCacheInitiallyRead, filtersThatAreFullyCompleted, sort, searchText, columnSet]);

  // When the component initially loads, fetch the first page of data
  useEffect(() => {
    if (!fetchPageOfData) {
      return;
    }

    const abortController = new AbortController();

    // Wait for the statecache to be read before making the initial request
    if (stateCache && !stateCacheInitiallyRead) {
      return;
    }

    const fetchFirstPageOfData = async () => {
      setCheckedItemKeys([]);
      setListData({ status: 'LOADING_INITIAL' });

      addInFlightAbortController(abortController);
      let result: Paginated<I>;
      try {
        result = await fetchPageOfData(1, filtersThatAreFullyCompleted, sort, searchText, abortController.signal);
      } catch (error: FixMe) {
        if (error.name === 'AbortError') {
          // The effect unmounted, and the request was terminated
          return;
        }

        setListData({ status: 'ERROR_INITIAL', error });
        return;
      }
      removeInFlightAbortController(abortController);

      setListData({
        status: 'COMPLETE',
        lastLoadedPage: 1,
        nextPageAvailable: result.nextPageAvailable,
        totalCount: result.totalCount,
        data: result.data,
      });
    };

    fetchFirstPageOfData().catch(error => {
      console.error(error);
    });

    return () => {
      setListData({ status: 'IDLE' });

      abortController.abort();
      removeInFlightAbortController(abortController);
    };
  }, [stateCache, stateCacheInitiallyRead, setListData, fetchPageOfData, filtersThatAreFullyCompleted, sort, searchText]);

  const onLoadNextPage = useCallback(async () => {
    if (!fetchPageOfData) {
      return;
    }
    if (listData.status !== 'COMPLETE') {
      return;
    }
    const abort = new AbortController();

    const page = listData.lastLoadedPage + 1;
    setListData({
      status: 'LOADING_NEXT_PAGE',
      data: listData.data,
      loadingPage: page,
    });

    let result: Paginated<I>;
    try {
      result = await fetchPageOfData(page, filtersThatAreFullyCompleted, sort, searchText, abort.signal);
    } catch (error: FixMe) {
      if (error.name === 'AbortError') {
        // NOTE: right now this shouldn't ever happen, but potentially this could be handled in the
        // future
        return;
      }

      setListData({ status: 'ERROR_INITIAL', error });
      return;
    }

    setListData({
      status: 'COMPLETE',
      lastLoadedPage: page,
      nextPageAvailable: result.nextPageAvailable,
      totalCount: result.totalCount,
      data: [...listData.data, ...result.data],
    });
  }, [listData, setListData, fetchPageOfData, filtersThatAreFullyCompleted, sort, searchText]);

  const filterMetadataContextData = useMemo(
    () => [filterMetadata, setFilterMetadata] as [
      Array<FilterMetadata>,
      (filters: (old: Array<FilterMetadata>) => Array<FilterMetadata>) => void,
    ],
    [filterMetadata, setFilterMetadata]
  );

  const fetchAllListData = useMemo(() => {
    if (!fetchPageOfData) {
      return null;
    }

    return (signal: AbortSignal) => {
      const recurse = (page: number): Promise<Array<I>> => {
        return fetchPageOfData(page, filtersThatAreFullyCompleted, sort, searchText, signal).then(pageOfResults => {
          if (!pageOfResults.nextPageAvailable) {
            return pageOfResults.data;
          }

          return recurse(page+1).then(results => {
            return [...results, ...pageOfResults.data];
          });
        });
      };

      return recurse(1);
    };
  }, [fetchPageOfData, filtersThatAreFullyCompleted, sort, searchText]);

  const dataContextData: DataContextList<I, BaseFieldName> | null = useMemo(() => {
    if (!keyGenerator) {
      return null;
    }
    if (!fetchAllListData) {
      return null;
    }

    return {
      type: 'list' as const,
      name,
      singularDisplayName,
      pluralDisplayName,
      csvExportColumnName,

      listData,
      onLoadNextPage,
      fetchAllListData,

      checkable,
      checkedItemKeys,
      onChangeCheckedItemKeys: setCheckedItemKeys,

      filters,
      onChangeFilters: setFilters,

      sort,
      onChangeSort: setSort,

      searchText,
      onChangeSearchText: setSearchText,

      columnSet,
      onChangeColumnSet: setColumnSet,

      keyGenerator,
      detailLinkGenerator,
      createLink,
    };
  }, [
    name,
    singularDisplayName,
    pluralDisplayName,
    csvExportColumnName,
    listData,
    onLoadNextPage,
    fetchAllListData,
    filtersThatAreFullyCompleted,
    checkable,
    checkedItemKeys,
    setCheckedItemKeys,
    filters,
    setFilters,
    sort,
    setSort,
    searchText,
    setSearchText,
    columnSet,
    setColumnSet,
    keyGenerator,
    detailLinkGenerator,
    createLink,
  ]);

  if (!dataContextData) {
    return (
      <span>Waiting for data model {name} to be added to DataModelsContext...</span>
    );
  }

  return (
    <DataContext.Provider value={(dataContextData as any) as DataContextList<BaseItem, BaseFieldName>}>
      <FilterMetadataContext.Provider value={filterMetadataContextData}>
        <div className={styles.list}>
          {children}
        </div>
      </FilterMetadataContext.Provider>
    </DataContext.Provider>
  );
};













type MultiLineInputFieldProps<
  Item = BaseItem,
  Field = BaseFieldName,
  Nullable = false,
  State = Nullable extends true ? (string | null) : string,
> = Omit<InputFieldProps<Item, Field, Nullable, State>, 'type'>;

/*
Example MultiLineInputField:
<MultiLineInputField<BattleWithParticipants, 'startedAt'>
  name="startedAt"
  singularDisplayName="Started At"
  pluralDisplayName="Started Ats"
  columnWidth="200px"
  sortable
/>
*/
export const MultiLineInputField = <
  Item = BaseItem,
  Field = BaseFieldName,
  Nullable = false,
>(props: MultiLineInputFieldProps<Item, Field, Nullable>) => {
  const Controls = useControls();

  const inputRef = useRef<HTMLInputElement | null>(null);

  const getInitialStateFromItem = useMemo(() => {
    return props.getInitialStateFromItem || ((item: Item) => `${(item as FixMe)[props.name as FixMe]}`);
  }, [props.getInitialStateFromItem, props.name]);

  const injectAsyncDataIntoInitialStateOnDetailPage = useMemo(() => {
    return (state: Nullable extends true ? (string | null) : string) => Promise.resolve(state)
  }, []);

  return (
    <Field<Item, Field, Nullable extends true ? (string | null) : string>
      name={props.name}
      singularDisplayName={props.singularDisplayName}
      pluralDisplayName={props.pluralDisplayName}
      csvExportColumnName={props.csvExportColumnName}
      columnWidth={props.columnWidth}
      sortable={props.sortable}
      getInitialStateFromItem={getInitialStateFromItem}
      injectAsyncDataIntoInitialStateOnDetailPage={injectAsyncDataIntoInitialStateOnDetailPage}
      getInitialStateWhenCreating={props.getInitialStateWhenCreating || (() => '')}
      serializeStateToItem={props.serializeStateToItem || ((initialItem, state) => ({ ...initialItem, [props.name as FixMe]: state }))}
      displayMarkup={state => {
        if (state === null) {
          return (
            <em style={{color: 'silver'}}>null</em>
          );
        } else if (state.length > 30) {
          return (
            <span>{state.slice(0, 30)}...</span>
          );
        } else {
          return (
            <span>{state}</span>
          );
        }
      }}
      modifyMarkup={(state, setState, item, onBlur) => {
        const input = props.inputMarkup ? props.inputMarkup(state, setState, item, onBlur) : (
          <Controls.TextArea
            value={state === null ? '' : `${state}`}
            disabled={state === null}
            onChange={setState}
            onBlur={onBlur}
          />
        );

        if (props.nullable) {
          return (
            <div style={{display: 'inline-flex', gap: 8, alignItems: 'center'}}>
              <div style={{display: 'flex', gap: 4, alignItems: 'center'}}>
                <Controls.Radiobutton
                  checked={state !== null}
                  onChange={checked => {
                    if (checked) {
                      setState('');
                      onBlur();
                      setTimeout(() => {
                        if (inputRef.current) {
                          inputRef.current.focus();
                        }
                      }, 0);
                    }
                  }}
                />
                <div onClick={() => {
                  if (state === null) {
                    setState('');
                    onBlur();
                    setTimeout(() => {
                      if (inputRef.current) {
                        inputRef.current.focus();
                      }
                    }, 0);
                  }
                }}>{input}</div>
              </div>
              <div style={{display: 'flex', gap: 4, alignItems: 'center'}}>
                <Controls.Radiobutton
                  checked={state === null}
                  id={`${props.name}-null`}
                  onChange={checked => {
                    if (checked) {
                      setState(null);
                      onBlur();
                    }
                  }}
                />
                <label htmlFor={`${props.name}-null`}>null</label>
              </div>
            </div>
          );
        } else {
          return input;
        }
      }}
      csvExportData={props.csvExportData}
    />
  );
};


type ChoiceFieldProps<I = BaseItem, F = BaseFieldName, S = BaseFieldState> = Pick<
  FieldMetadata<I, F, S>,
  | 'name'
  | 'singularDisplayName'
  | 'pluralDisplayName'
  | 'csvExportColumnName'
  | 'columnWidth'
  | 'sortable'
> & {
  getInitialStateFromItem?: (item: I) => S;
  getInitialStateWhenCreating: () => S | undefined;
  serializeStateToItem?: (initialItem: Partial<I>, state: S) => Partial<I>;
  choices: Array<{id: S; disabled?: boolean; label: React.ReactNode }>;

  nullable?: boolean;
  displayMarkup?: FieldMetadata<I, F, S>['displayMarkup'];
  inputMarkup?: FieldMetadata<I, F, S>['modifyMarkup'];
  csvExportData?: FieldMetadata<I, F, S>['csvExportData'];
};

/*
Example ChoiceField:
<ChoiceField<BattleWithParticipants, 'startedAt'>
  name="startedAt"
  singularDisplayName="Started At"
  pluralDisplayName="Started Ats"
  columnWidth="200px"
  sortable
  choices={[
    {id: 'foo', label: 'Foo'},
    {id: 'bar', label: 'Bar'},
  ]}
/>
*/
export const ChoiceField = <I = BaseItem, F = BaseFieldName, S = BaseFieldState>(props: ChoiceFieldProps<I, F, S>) => {
  const Controls = useControls();

  const getInitialStateFromItem = useMemo(() => {
    return props.getInitialStateFromItem || ((item: I) => `${(item as FixMe)[props.name as FixMe]}` as S);
  }, [props.getInitialStateFromItem, props.name]);

  const injectAsyncDataIntoInitialStateOnDetailPage = useCallback((state: S) => Promise.resolve(state), []);

  return (
    <Field<I, F, S>
      name={props.name}
      singularDisplayName={props.singularDisplayName}
      pluralDisplayName={props.pluralDisplayName}
      csvExportColumnName={props.csvExportColumnName}
      columnWidth={props.columnWidth}
      sortable={props.sortable}
      getInitialStateFromItem={getInitialStateFromItem}
      injectAsyncDataIntoInitialStateOnDetailPage={injectAsyncDataIntoInitialStateOnDetailPage}
      getInitialStateWhenCreating={props.getInitialStateWhenCreating}
      serializeStateToItem={props.serializeStateToItem || ((initialItem, state) => ({ ...initialItem, [props.name as FixMe]: state }))}
      displayMarkup={props.displayMarkup || (state => state === null ? <em style={{color: 'silver'}}>null</em> : <span>{`${state}`}</span>)}
      modifyMarkup={(state, setState, item, onBlur) => {
        if (props.inputMarkup) {
          return props.inputMarkup(state, setState, item, onBlur);
        }

        const stateAsString = `${state}`;

        const options: Array<SelectOption> = [];

        if (props.nullable) {
          options.push({ value: 'NULL', label: 'null' });
        }

        let stateRepresentedByValue = false;
        for (const { id, disabled, label } of props.choices) {
          if (id === stateAsString) {
            stateRepresentedByValue = true;
          }
          options.push({
            value: id as string,
            disabled,
            label,
          });
        }

        // If there isn't a value for the given state, add a disabled placeholder item
        if (!stateRepresentedByValue) {
          options.push({ disabled: true, value: stateAsString, label: stateAsString });
        }

        return (
          <Controls.Select
            value={stateAsString}
            onChange={newValue => {
              const castedNewValue = newValue as S;
              setState(castedNewValue === 'NULL' ? null : castedNewValue);
            }}
            onBlur={() => onBlur()}
            options={options}
          />
        );
      }}
      csvExportData={props.csvExportData}
    />
  );
};


type BooleanFieldProps<I = BaseItem, F = BaseFieldName> = Omit<
  ChoiceFieldProps<I, F, boolean | null>,
  | 'choices'
>;

/*
Example BooleanField:
<BooleanField<BattleWithParticipants, 'startedAt'>
  name="startedAt"
  singularDisplayName="Started At"
  pluralDisplayName="Started Ats"
  columnWidth="200px"
  sortable
/>
*/
export const BooleanField = <I = BaseItem, F = BaseFieldName>(props: BooleanFieldProps<I, F>) => {
  return (
    <ChoiceField<I, F, boolean | null>
      name={props.name}
      singularDisplayName={props.singularDisplayName}
      pluralDisplayName={props.pluralDisplayName}
      csvExportColumnName={props.csvExportColumnName}
      columnWidth={props.columnWidth}
      sortable={props.sortable}
      nullable={props.nullable}
      getInitialStateFromItem={props.getInitialStateFromItem}
      getInitialStateWhenCreating={props.getInitialStateWhenCreating}
      serializeStateToItem={props.serializeStateToItem || ((initialItem, state) => ({ ...initialItem, [props.name as FixMe]: state }))}
      displayMarkup={props.displayMarkup || (state => state === null ? <em style={{color: 'silver'}}>null</em> : <span>{`${state}`}</span>)}
      choices={[
        {id: true, label: 'true'},
        {id: false, label: 'false'},
      ]}
      csvExportData={props.csvExportData}
    />
  );
};


type SingleForeignKeyFieldProps<I = BaseItem, F = BaseFieldName, J = BaseItem> = Pick<
  FieldMetadata<I, F, J | null>,
  | 'name'
  | 'singularDisplayName'
  | 'pluralDisplayName'
  | 'csvExportColumnName'
  | 'columnWidth'
  | 'sortable'
  | 'getInitialStateWhenCreating'
  | 'csvExportData'
> & {
  getInitialStateFromItem?: (item: I) => J;
  injectAsyncDataIntoInitialStateOnDetailPage?: (oldState: J, item: I, signal: AbortSignal) => Promise<J>;
  getInitialStateWhenCreating?: () => J | null;
  serializeStateToItem?: (initialItem: Partial<I>, state: J) => Partial<I>;

  nullable?: boolean;
  relatedName: string;
  getRelatedKey?: (relatedItem: J) => ItemKey;

  fetchPageOfRelatedData?: (page: number, item: I, abort: AbortSignal) => Promise<Paginated<J>>;
  createRelatedItem?: (item: Partial<I>, relatedItem: Partial<J>) => Promise<J>;
  updateRelatedItem?: (item: Partial<I>, relatedItem: Partial<J>) => Promise<J>;

  creationFields?: React.ReactNode;

  children?: React.ReactNode;
};


/*
Example SingleForeignKeyField:
<SingleForeignKeyField<BattleWithParticipants, 'startedAt', BattleParticipant>
  name="beat"
  singularDisplayName="Beat"
  pluralDisplayName="Beats"
  columnWidth="200px"
  sortable
/>
*/
export const SingleForeignKeyField = <I = BaseItem, F = BaseFieldName, J = BaseItem>(props: SingleForeignKeyFieldProps<I, F, J>) => {
  const dataModelsContextData = useContext(DataModelsContext);
  if (!dataModelsContextData) {
    throw new Error('Error: <SingleForeignKeyField ... /> was not rendered inside of a container component! Try rendering this inside of a <DataModels> ... </DataModels>.');
  }
  const relatedDataModel = dataModelsContextData[0].get(props.relatedName) as DataModel<J> | undefined;

  const singularDisplayName = props.singularDisplayName || relatedDataModel?.singularDisplayName || '';
  const pluralDisplayName = props.pluralDisplayName || relatedDataModel?.pluralDisplayName || '';
  const getRelatedKey = props.getRelatedKey || relatedDataModel?.keyGenerator;

  const getInitialStateFromItem = useMemo(() => {
    return props.getInitialStateFromItem || ((item: I) => (item as FixMe)[props.name as FixMe] as J)
  }, [props.getInitialStateFromItem, props.name]);

  const getInitialStateWhenCreating = useMemo(() => {
    return props.getInitialStateWhenCreating || (() => null);
  }, [props.getInitialStateWhenCreating]);

  const injectAsyncDataIntoInitialStateOnDetailPage = useMemo(() => {
    return props.injectAsyncDataIntoInitialStateOnDetailPage || ((state: J) => Promise.resolve(state));
  }, [props.injectAsyncDataIntoInitialStateOnDetailPage]);

  const serializeStateToItem = useMemo(() => {
    return props.serializeStateToItem || ((initialItem: Partial<I>, state: J) => ({
      ...initialItem,
      [props.name as FixMe]: state,
    }));
  }, [props.name]);

  const displayMarkup = useCallback((state: J) => {
    if (state === null) {
      return <span>null</span>;
    }

    return (
      <span>{getRelatedKey ? getRelatedKey(state) : (state as FixMe).id}</span>
    );
  }, [getRelatedKey]);

  const modifyMarkup = useCallback((
    state: J | null,
    setState: (newState: J | null, blurAfterStateSet?: boolean) => void,
    item: I,
    onBlur: () => void,
  ) => {
    const relatedFields = (
      <ForeignKeyFieldModifyMarkup
        mode="detail"
        item={item}
        relatedItem={state}
        checkboxesWidth={null}
        onChangeRelatedItem={newRelatedItem => setState(newRelatedItem, true)}
        foreignKeyFieldProps={props}
        getRelatedKey={getRelatedKey}
      >
        {props.children}
      </ForeignKeyFieldModifyMarkup>
    );

    if (props.nullable) {
      return (
        <div>
          <NullableWrapper<J, F>
            nullable={props.nullable as boolean}
            name={props.name}
            state={state}
            setState={setState}
            // FIXME: the below getInitialStateWhenCreating can return null (and that is its default
            // value). The better way to do this probably is to make the
            // `ForeignKeyFieldModifyMarkup` component aware of `nullable` when in
            // SingleForeignKeyField mode and get rid of the `NullableWrapper` stuff in here.
            getInitialStateWhenCreating={getInitialStateWhenCreating}
            onBlur={onBlur}
          >
            Value
          </NullableWrapper>

          {state !== null ? relatedFields : null}
        </div>
      );
    } else {
      return relatedFields;
    }
  }, [props]);

  const csvExportData = useCallback((state: J | null, item: I) => {
    if (props.csvExportData) {
      return props.csvExportData;
    }

    if (state === null) {
      return 'null';
    } else if (getRelatedKey) {
      return getRelatedKey(state);
    } else {
      return `${(item as FixMe).id}`;
    }
  }, [props.csvExportData, getRelatedKey]);

  return (
    <Field<I, F, J | null>
      name={props.name}
      singularDisplayName={singularDisplayName}
      pluralDisplayName={pluralDisplayName}
      csvExportColumnName={props.csvExportColumnName}
      columnWidth={props.columnWidth}
      sortable={props.sortable}
      getInitialStateFromItem={getInitialStateFromItem}
      injectAsyncDataIntoInitialStateOnDetailPage={injectAsyncDataIntoInitialStateOnDetailPage}
      getInitialStateWhenCreating={getInitialStateWhenCreating}
      serializeStateToItem={serializeStateToItem}
      // createSideEffect={props.createRelatedItem}
      // updateSideEffect={props.updateRelatedItem}
      displayMarkup={displayMarkup}
      modifyMarkup={modifyMarkup}
      csvExportData={csvExportData}
    />
  );
};

type MultiForeignKeyFieldProps<I = BaseItem, F = BaseFieldName, J = BaseItem> = Pick<
  FieldMetadata<I, F, J>,
  | 'name'
  | 'singularDisplayName'
  | 'pluralDisplayName'
  | 'csvExportColumnName'
  | 'columnWidth'
  | 'sortable'
  | 'getInitialStateWhenCreating'
  | 'csvExportData'
> & {
  getInitialStateFromItem?: (item: I) => Array<J>;
  injectAsyncDataIntoInitialStateOnDetailPage?: (oldState: Array<J>, item: I, signal: AbortSignal) => Promise<Array<J>>;
  getInitialStateWhenCreating?: () => Array<J> | undefined;
  serializeStateToItem?: (initialItem: Partial<I>, state: Array<J>) => Partial<I>;

  relatedName: string;
  getRelatedKey?: (relatedItem: J) => ItemKey;

  fetchPageOfRelatedData?: (page: number, item: I, abort: AbortSignal) => Promise<Paginated<J>>;
  createRelatedItem?: (item: I, relatedItem: Partial<J>) => Promise<J>;
  updateRelatedItem?: (item: I, relatedItem: Partial<J>) => Promise<J>;

  creationFields?: React.ReactNode;

  children?: React.ReactNode;
};

/*
Example MultiForeignKeyField:
<MultiForeignKeyField<BattleWithParticipants, 'startedAt', BattleParticipant>
  name="beat"
  singularDisplayName="Beat"
  pluralDisplayName="Beats"
  columnWidth="200px"
  sortable
/>
*/
export const MultiForeignKeyField = <I = BaseItem, F = BaseFieldName, J = BaseItem>(props: MultiForeignKeyFieldProps<I, F, J>) => {
  const getInitialStateFromItem = useMemo(() => {
    return props.getInitialStateFromItem || ((item: I) => (item as FixMe)[props.name as FixMe] as Array<J>);
  }, [props.getInitialStateFromItem, props.name]);

  const getInitialStateWhenCreating = useMemo(() => {
    return props.getInitialStateWhenCreating || (() => []);
  }, [props.getInitialStateWhenCreating]);

  const injectAsyncDataIntoInitialStateOnDetailPage = useMemo(() => {
    return props.injectAsyncDataIntoInitialStateOnDetailPage || ((state: Array<J>) => Promise.resolve(state));
  }, [props.injectAsyncDataIntoInitialStateOnDetailPage, props.name]);

  const csvExportData = useCallback((state: Array<J>) => {
    if (props.csvExportData) {
      return props.csvExportData;
    }

    if (props.getRelatedKey) {
      return state.map(relatedItem => props.getRelatedKey!(relatedItem)).join(', ');
    } else {
      return state.map(relatedItem => `${(relatedItem as FixMe).id}`).join(', ');
    }
  }, [props.csvExportData, props.getRelatedKey]);

  return (
    <Field<I, F, Array<J>>
      name={props.name}
      singularDisplayName={props.singularDisplayName}
      pluralDisplayName={props.pluralDisplayName}
      csvExportColumnName={props.csvExportColumnName}
      columnWidth={props.columnWidth}
      sortable={props.sortable}
      getInitialStateFromItem={getInitialStateFromItem}
      injectAsyncDataIntoInitialStateOnDetailPage={injectAsyncDataIntoInitialStateOnDetailPage}
      getInitialStateWhenCreating={getInitialStateWhenCreating}
      serializeStateToItem={props.serializeStateToItem || ((initialItem, state) => ({ ...initialItem, [props.name as FixMe]: state }))}
      displayMarkup={state => {
        const keys = state.map(i => {
          if (props.getRelatedKey) {
            return props.getRelatedKey(i);
          } else {
            return (i as FixMe).id;
          }
        });
        return (
          <span>{keys.join(', ')}</span>
        );
      }}
      modifyMarkup={(state, setState, item, _onBlur) => (
        <ForeignKeyFieldModifyMarkup<I, F, J>
          mode="list"
          item={item}
          relatedItems={state}
          checkboxesWidth={null}
          onChangeRelatedItems={newRelatedItems => setState(newRelatedItems, true)}
          foreignKeyFieldProps={props}
          getRelatedKey={props.getRelatedKey}
        >
          {props.children}
        </ForeignKeyFieldModifyMarkup>
      )}
      csvExportData={csvExportData}
    />
  );
};

const ForeignKeyFieldModifyMarkup = <I = BaseItem, F = BaseFieldName, J = BaseItem>(props:
  | {
    mode: 'list',
    item: I,
    relatedItems: Array<J>,
    onChangeRelatedItems: (newRelatedItems: Array<J>) => void,
    disabled?: boolean;
    checkboxesWidth: null | string | number;
    foreignKeyFieldProps: MultiForeignKeyFieldProps<I, F, J>,
    getRelatedKey?: (relatedItem: J) => ItemKey;
    children: React.ReactNode;
  }
  | {
    mode: 'detail',
    item: I,
    relatedItem: J | null,
    onChangeRelatedItem: (newRelatedItem: J) => void,
    disabled?: boolean;
    checkboxesWidth: null | string | number;
    foreignKeyFieldProps: SingleForeignKeyFieldProps<I, F, J>,
    getRelatedKey?: (relatedItem: J) => ItemKey;
    children: React.ReactNode;
  }
) => {
  const dataModelsContextData = useContext(DataModelsContext);
  if (!dataModelsContextData) {
    throw new Error('Error: <ForeignKeyFieldModifyMarkup ... /> was not rendered inside of a container component! Try rendering this inside of a <DataModels> ... </DataModels>.');
  }
  const relatedDataModel = dataModelsContextData[0].get(props.foreignKeyFieldProps.relatedName) as DataModel<J> | undefined;

  const Controls = useControls();

  const getRelatedKey = props.getRelatedKey || relatedDataModel?.keyGenerator || null;
  const fetchPageOfRelatedData = useMemo(() => {
    if (props.foreignKeyFieldProps.fetchPageOfRelatedData) {
      return props.foreignKeyFieldProps.fetchPageOfRelatedData;
    }

    if (relatedDataModel) {
      return (page: number, _item: I, signal: AbortSignal) => {
        return relatedDataModel.fetchPageOfData(page, [], null, '', signal);
      };
    }

    return null;
  }, [props.foreignKeyFieldProps.fetchPageOfRelatedData, relatedDataModel]);

  const [
    addInFlightAbortController,
    removeInFlightAbortController,
  ] = useInFlightAbortControllers();

  const [initialRelatedItem] = useState(props.mode === "detail" ? props.relatedItem : null);
  const [initialRelatedItems] = useState(props.mode === "list" ? props.relatedItems : null);

  const isInitiallyEmpty = useMemo(() => props.mode === 'detail' ? props.relatedItem === null : props.relatedItems.length === 0, []);
  const [itemSelectionMode, setItemSelectionMode] = useState<'none' | 'select' | 'create'>(
    // If there isn't anything selected when the component loads, start on the "select" view so the
    // user doesn't immediatley see an empty state.
    isInitiallyEmpty ? 'select' : 'none'
  );

  const [relatedData, setRelatedData] = useState<ListData<J>>({ status: 'IDLE' });

  // When the component initially loads, fetch the first page of data
  useEffect(() => {
    if (!fetchPageOfRelatedData) {
      return;
    }

    const abortController = new AbortController();

    const fetchFirstPageOfData = async () => {
      setRelatedData({ status: 'LOADING_INITIAL' });

      addInFlightAbortController(abortController);
      let result: Paginated<J>;
      try {
        result = await fetchPageOfRelatedData(1, props.item, abortController.signal);
      } catch (error: FixMe) {
        if (error.name === 'AbortError') {
          // The effect unmounted, and the request was terminated
          return;
        }

        setRelatedData({ status: 'ERROR_INITIAL', error });
        return;
      }
      removeInFlightAbortController(abortController);

      setRelatedData({
        status: 'COMPLETE',
        lastLoadedPage: 1,
        nextPageAvailable: result.nextPageAvailable,
        totalCount: result.totalCount,
        data: result.data,
      });
    };

    fetchFirstPageOfData().catch(error => {
      console.error(error);
    });

    return () => {
      setRelatedData({ status: 'IDLE' });

      abortController.abort();
      removeInFlightAbortController(abortController);
    };
  }, [setRelatedData, props.item, fetchPageOfRelatedData]);

  const onLoadNextPage = useCallback(async () => {
    if (!fetchPageOfRelatedData) {
      return;
    }

    if (relatedData.status !== 'COMPLETE') {
      return;
    }
    const abort = new AbortController();

    const page = relatedData.lastLoadedPage + 1;
    setRelatedData({
      status: 'LOADING_NEXT_PAGE',
      data: relatedData.data,
      loadingPage: page,
    });

    let result: Paginated<J>;
    try {
      result = await fetchPageOfRelatedData(page, props.item, abort.signal);
    } catch (error: FixMe) {
      if (error.name === 'AbortError') {
        // NOTE: right now this shouldn't ever happen, but potentially this could be handled in the
        // future
        return;
      }

      setRelatedData({ status: 'ERROR_INITIAL', error });
      return;
    }

    setRelatedData({
      status: 'COMPLETE',
      lastLoadedPage: page,
      nextPageAvailable: result.nextPageAvailable,
      totalCount: result.totalCount,
      data: [...relatedData.data, ...result.data],
    });
  }, [relatedData, setRelatedData, props.item, fetchPageOfRelatedData]);

  const [relatedFields, setRelatedFields] = useState<FieldCollection<FieldMetadata<J, F>>>(
    (EMPTY_FIELD_COLLECTION as any) as FieldCollection<FieldMetadata<J, F>>
  );

  // Allow a custom set of fields to be defined in the creation form. If these fields aren't
  // defined, then use the fields defined for the table for the creation form.
  const [relatedCreationFields, setRelatedCreationFields] = useState<FieldCollection<FieldMetadata<J, F>>>(
    (EMPTY_FIELD_COLLECTION as any) as FieldCollection<FieldMetadata<J, F>>
  );

  // When in creation mode, store each state for each field centrally
  const [relatedCreationFieldStates, setRelatedCreationFieldStates] = useState<Map<F, BaseFieldState>>(new Map());
  useEffect(() => {
    if (itemSelectionMode !== 'create') {
      return;
    }

    const newRelatedCreationFieldStates = new Map<F, BaseFieldState | undefined>();
    for (const relatedField of relatedCreationFields.metadata) {
      newRelatedCreationFieldStates.set(
        relatedField.name,
        relatedField.getInitialStateWhenCreating ? relatedField.getInitialStateWhenCreating() : undefined,
      );
    }

    setRelatedCreationFieldStates(newRelatedCreationFieldStates);
  }, [itemSelectionMode, relatedCreationFields]);

  if (!relatedDataModel || !getRelatedKey || !fetchPageOfRelatedData) {
    return (
      <span>Waiting for related data model {props.foreignKeyFieldProps.relatedName} to be added to DataModelsContext...</span>
    );
  }

  const loadingNextPage = relatedData.status === 'LOADING_NEXT_PAGE';
  const nextPageAvailable = relatedData.status === 'COMPLETE' ? relatedData.nextPageAvailable : false;

  switch (relatedData.status) {
    case 'IDLE':
    case 'LOADING_INITIAL':
      return (
        <div>Loading related data...</div>
      );
    case 'ERROR_INITIAL':
      return (
        <div>Error loading related data: {relatedData.error.message}</div>
      );
    case 'COMPLETE':
    case 'LOADING_NEXT_PAGE':
      let rows = props.mode === 'list' ? (
        props.relatedItems
      ) : (props.relatedItem ? [props.relatedItem] : []);
      let rowKeys = rows.map(row => getRelatedKey(row));

      // Pin the initial related item to the top of the list
      //
      // This doesn't just pin the currently related item, it pins the initial,
      // because the initial won't change.
      if (props.mode === 'list') {
        if (itemSelectionMode === 'select') {
          rows = relatedData.data;
          rowKeys = rows.map(row => getRelatedKey(row));
          if (initialRelatedItems) {
            for (const relatedItem of initialRelatedItems) {
              const key = getRelatedKey(relatedItem);
              const index = rowKeys.indexOf(key);
              if (index >= 0) {
                rows.splice(index, 1);
                rowKeys.splice(index, 1);
              }
              rows.unshift(relatedItem);
              rowKeys.unshift(key);
            }
          }
        }
      } else if (props.mode === 'detail') {
        if (itemSelectionMode === 'select') {
          rows = relatedData.data;
          rowKeys = rows.map(row => getRelatedKey(row));
          if (initialRelatedItem) {
            const key = getRelatedKey(initialRelatedItem);
            const index = rowKeys.indexOf(key);
            if (index >= 0) {
              rows.splice(index, 1);
              rowKeys.splice(index, 1);
            }
            rows.unshift(initialRelatedItem);
            rowKeys.unshift(key);
          }
        }
      }

      return (
        <div className={styles.foreignKeyFieldModifyMarkupWrapper}>
          {relatedFields.names.length === 0 ? (
            <em style={{color: gray.gray9}}>
              No {props.foreignKeyFieldProps.singularDisplayName.toLowerCase()} fields specified
            </em>
          ) : (
            <div style={{overflowY: 'auto'}}>
              {rows.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      {/* Add a column for the checkboxes */}
                      <th style={{width: props.checkboxesWidth === null ? undefined : props.checkboxesWidth}}>
                      </th>
                      {relatedFields.names.map(relatedFieldMetadataName => {
                        const relatedFieldMetadata = relatedFields.metadata.find(f => f.name === relatedFieldMetadataName);
                        if (!relatedFieldMetadata) {
                          return null;
                        }

                        return (
                          <th
                            key={relatedFieldMetadata.name as string}
                            className={relatedFieldMetadata.sortable ? styles.sortable : undefined}
                            style={{width: relatedFieldMetadata.columnWidth}}
                            // onClick={relatedFieldMetadata.sortable ? () => {
                            //   if (!listDataContextData.sort) {
                            //     // Initially set the sort
                            //     listDataContextData.onChangeSort({
                            //       fieldName: relatedFieldMetadata.name,
                            //       direction: 'desc'
                            //     } as Sort);
                            //   } else if (listDataContextData.sort.fieldName !== relatedFieldMetadata.name) {
                            //     // A different column was selected, so initially set the sort for this new column
                            //     listDataContextData.onChangeSort({
                            //       fieldName: relatedFieldMetadata.name,
                            //       direction: 'desc'
                            //     } as Sort);
                            //   } else {
                            //     // Cycle the sort to the next value
                            //     switch (listDataContextData.sort.direction) {
                            //       case 'desc':
                            //         listDataContextData.onChangeSort({
                            //           fieldName: relatedFieldMetadata.name,
                            //           direction: 'asc',
                            //         } as Sort);
                            //         return;
                            //       case 'asc':
                            //         listDataContextData.onChangeSort(null);
                            //         return;
                            //     }
                            //   }
                            // } : undefined}
                          >
                            {relatedFieldMetadata.singularDisplayName}
                            {/*
                            {listDataContextData.sort && listDataContextData.sort.fieldName === relatedFieldMetadata.name ? (
                              <span className={styles.tableWrapperSortIndicator}>
                                {listDataContextData.sort.direction === 'desc' ? <Fragment>&darr;</Fragment> : <Fragment>&uarr;</Fragment>}
                              </span>
                            ) : null}
                            */}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(relatedItem => {
                      const key = getRelatedKey(relatedItem);
                      const checked = Boolean(props.mode === 'list' ? (
                        props.relatedItems && props.relatedItems.find(i => getRelatedKey(i) === key)
                      ) : props.relatedItem && getRelatedKey(props.relatedItem) === key);

                      return (
                        <ListTableItem
                          key={key as string}
                          item={relatedItem}
                          visibleFieldNames={relatedFields.names as Array<F>}
                          fields={relatedFields}
                          checkable={true}
                          checkType={props.mode === 'list' ? 'checkbox' : 'radio'}
                          detailLink={relatedDataModel?.detailLinkGenerator ? relatedDataModel.detailLinkGenerator(relatedItem) : undefined}
                          checked={checked}
                          checkboxDisabled={false}
                          onChangeChecked={(checked) => {
                            if (relatedData.status !== 'COMPLETE') {
                              return;
                            }

                            if (props.mode === 'detail') {
                              props.onChangeRelatedItem(relatedItem);
                              return;
                            } else {
                              // Shift was not held, so a single item is being checked or unchecked
                              if (checked) {
                                props.onChangeRelatedItems([...props.relatedItems, relatedItem]);
                              } else {
                                props.onChangeRelatedItems(
                                  props.relatedItems.filter(i => getRelatedKey(i) !== key)
                                );
                              }
                            }
                          }}
                        />
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 64 }}>
                  <em style={{color: gray.gray9}}>
                    No {props.mode === 'detail' ? props.foreignKeyFieldProps.singularDisplayName.toLowerCase() : props.foreignKeyFieldProps.pluralDisplayName.toLowerCase()} selected
                  </em>
                </div>
              )}
            </div>
          )}
          {itemSelectionMode === 'create' ? (
            <Fragment>
              <span>Create new {relatedDataModel.singularDisplayName}</span>

              {relatedCreationFields.names.map(relatedFieldName => {
                const relatedField = relatedCreationFields.metadata.find(f => f.name === relatedFieldName);
                if (!relatedField) {
                  return null;
                }

                const relatedFieldState = relatedCreationFieldStates.get(relatedField.name);
                if (typeof relatedFieldState === 'undefined') {
                  return null;
                }

                return (
                  <div key={relatedField.name as string} style={{marginLeft: 24}}>
                    <DetailFieldItem
                      item={null}
                      field={relatedField}
                      fieldState={relatedFieldState}
                      onUpdateFieldState={(newRelatedFieldState) => {
                        setRelatedCreationFieldStates(old => {
                          const newRelatedFieldStates = new Map(old);
                          newRelatedFieldStates.set(relatedField.name, newRelatedFieldState);
                          return newRelatedFieldStates;
                        });
                      }}
                    />
                  </div>
                );
              })}

              <Controls.AppBar
                intent="footer"
                size="small"
                title={
                  <Fragment>
                    <Controls.Button size="small" onClick={() => setItemSelectionMode('none')}>Cancel</Controls.Button>
                    <Controls.Button size="small" onClick={async () => {
                      if (!props.foreignKeyFieldProps.createRelatedItem) {
                        return;
                      }

                      // Aggregate all the state updates to form the update body
                      let relatedItem: Partial<J> = {};
                      for (const field of relatedCreationFields.metadata) {
                        let state = relatedCreationFieldStates.get(field.name);
                        if (typeof state === 'undefined') {
                          continue;
                        }

                        relatedItem = field.serializeStateToItem(relatedItem, state);
                      }

                      // FIXME: add abort controller
                      let newlyCreatedRelatedItem: J;
                      try {
                        newlyCreatedRelatedItem = await props.foreignKeyFieldProps.createRelatedItem(props.item, relatedItem);
                      } catch (error: FixMe) {
                        // if (error.name === 'AbortError') {
                        //   // The effect unmounted, and the request was terminated
                        //   return;
                        // }

                        alert(`Error creating ${props.foreignKeyFieldProps.singularDisplayName}: ${error}`);
                        return;
                      }

                      setRelatedData({
                        ...relatedData,
                        data: [...relatedData.data, newlyCreatedRelatedItem],
                      });
                      if (props.mode === 'detail') {
                        props.onChangeRelatedItem(newlyCreatedRelatedItem);
                      } else {
                        props.onChangeRelatedItems([...props.relatedItems, newlyCreatedRelatedItem]);
                      }

                      setItemSelectionMode('none');
                    }}>Create</Controls.Button>
                  </Fragment>
                }
              />
            </Fragment>
          ) : (
            <Fragment>
              {itemSelectionMode === 'select' ? (
                <Fragment>
                  {loadingNextPage ? (
                    <div className={styles.tableNextPageIndicator}>
                      <div className={styles.tableNextPageLoading}>Loading next page...</div>
                    </div>
                  ) : null}
                  {!loadingNextPage && nextPageAvailable ? (
                    <div className={styles.tableNextPageIndicator}>
                      <button className={styles.tableNextPageButton} onClick={onLoadNextPage}>Load more...</button>
                    </div>
                  ) : null}
                </Fragment>
              ) : null}

              <Controls.AppBar
                intent="footer"
                size="small"
                title={
                  <Fragment>
                    {itemSelectionMode === 'none' ? (
                      <Controls.Button size="small" onClick={() => setItemSelectionMode('select')}>Show More...</Controls.Button>
                    ) : (
                      <Controls.Button size="small" onClick={() => setItemSelectionMode('none')}>Hide</Controls.Button>
                    )}
                    {props.foreignKeyFieldProps.createRelatedItem ? (
                      <Controls.Button
                        size="small"
                        variant="primary"
                        onClick={() => setItemSelectionMode('create')}
                      >Create New...</Controls.Button>
                    ) : null}
                  </Fragment>
                }
              />
            </Fragment>
          )}

          {/* The children should not render anything, this should purely be Fields for the related items */}
          <FieldsProvider dataModel={relatedDataModel} onChangeFields={setRelatedFields}>
            {props.children}
          </FieldsProvider>

          {/* The creationFields should not render anything, this should purely be Fields for creating the related item */}
          <FieldsProvider dataModel={relatedDataModel} onChangeFields={setRelatedCreationFields}>
            {props.foreignKeyFieldProps.creationFields}
          </FieldsProvider>
        </div>
      );
  }
};








export const ListTableItem = <I = BaseItem, F = BaseFieldName>({
  item,
  visibleFieldNames,
  fields,
  detailLink,
  checkable,
  checkType,
  checked,
  onChangeChecked,
}: Parameters<ListTableProps<I, F>['renderTableItem']>[0]) => {
  const Controls = useControls();
  return (
    <tr>
      {checkable ? (
        <td
          className={styles.floatingCheckbox}
          onClick={e => onChangeChecked(
            !checked,
            (e.nativeEvent as FixMe).shiftKey
          )}
          // Ensure that clicking on checkboxes doesn't accidentally select stuff in the table
          onMouseDown={() => { document.body.style.userSelect = 'none'; }}
          onMouseUp={() => { document.body.style.userSelect = ''; }}
        >
          <div onClick={e => e.stopPropagation()}>
            {checkType === "checkbox" ? (
              <Controls.Checkbox
                checked={checked}
                onChange={onChangeChecked}
              />
            ) : (
              <Controls.Radiobutton
                checked={checked}
                onChange={onChangeChecked}
              />
            )}
          </div>
        </td>
      ) : null}
      {visibleFieldNames.map(name => {
        const field = fields.metadata.find(f => f.name === name);
        if (!field) {
          return null;
        }

        return (
          <td key={field.name as string}>
            {field.displayMarkup(field.getInitialStateFromItem(item), item)}
          </td>
        );
      })}
      {detailLink ? (
        <Fragment>
          {/* This element acts as a spacer to ensure there is enough room all the way at the right for "details" */}
          <td style={{visibility: 'hidden'}}>
            <Controls.NavigationButton navigatable={detailLink}>Details...</Controls.NavigationButton>
          </td>
          <td className={styles.floatingDetails}>
            <Controls.NavigationButton navigatable={detailLink}>Details...</Controls.NavigationButton>
          </td>
        </Fragment>
      ) : null}
    </tr>
  );
};






type ListActionBarProps<I = BaseItem> = {
  canSelectAllAcrossPages?: boolean;
  children: (
    items: Array<I> | typeof ALL_ITEMS,
  ) => React.ReactNode;
};

export const ListActionBar = <I = BaseItem>({
  canSelectAllAcrossPages = false,
  children,
}: ListActionBarProps<I>) => {
  const dataContext = useContext(DataContext);
  if (!dataContext || dataContext.type !== 'list') {
    throw new Error('Error: <ListActionBar ... /> was not rendered inside of a <List> ... </List> component!');
  }
  const listDataContextData = dataContext as DataContextList<I>;

  const Controls = useControls();

  // This control is hidden when nothing is checked
  if (
    listDataContextData.checkedItemKeys !== ALL_ITEMS &&
    listDataContextData.checkedItemKeys.length === 0
  ) {
    return null;
  }

  if (listDataContextData.listData.status !== 'COMPLETE') {
    return (
      <div className={styles.listActionBar}>
        <em>Loading...</em>
      </div>
    );
  }

  const numberOfCheckedItems = listDataContextData.checkedItemKeys === ALL_ITEMS ? (
    listDataContextData.listData.totalCount
  ) : listDataContextData.checkedItemKeys.length;
  const areAllInMemoryItemsChecked = listDataContextData.listData.data.length === numberOfCheckedItems;

  return (
    <Fragment>
      <Controls.AppBar
        size="regular"
        intent="header"
        title={
          <Fragment>
            <span>{numberOfCheckedItems} {numberOfCheckedItems === 1 ? listDataContextData.singularDisplayName : listDataContextData.pluralDisplayName}</span>
            <Controls.Button onClick={() => listDataContextData.onChangeCheckedItemKeys([])}>
              Deselect
            </Controls.Button>
            |
            {/* FIXME: get `fields` in here so I can add this! */}
            {/* <ListCSVExport<I, F> */}
            {/*   pluralDisplayName={listDataContextData.pluralDisplayName} */}
            {/*   fields={dataContext.f} */}
            {/*   // fetchPageOfData={listDataContextData.fe} */}
            {/*   listData={listDataContextData.listData} */}
            {/*   columnSets={columnSets} */}
            {/*   keyGenerator={listDataContextData.keyGenerator} */}
            {/*   checkedItemKeys={listDataContextData.checkedItemKeys} */}
            {/* /> */}
            {listDataContextData.checkedItemKeys === ALL_ITEMS ? (
              children(ALL_ITEMS)
            ) : children(
              listDataContextData.listData.data.filter((item) => {
                const key = listDataContextData.keyGenerator(item)
                return listDataContextData.checkedItemKeys.includes(key);
              })
            )}
          </Fragment>
        }
      />

      {/* If enabled, give the user the ability to be able to select all pages of data that match the query */}
      {canSelectAllAcrossPages && areAllInMemoryItemsChecked ? (
        <Fragment>
          {listDataContextData.checkedItemKeys !== ALL_ITEMS ? (
            <div
              className={styles.listActionBarSelectAllBanner}
              onClick={() => listDataContextData.onChangeCheckedItemKeys(ALL_ITEMS)}
            >
              {numberOfCheckedItems}{' '}
              {numberOfCheckedItems === 1 ? listDataContextData.singularDisplayName : listDataContextData.pluralDisplayName}{' '}
              on screen selected.&nbsp;
              <span style={{textDecoration: 'underline', cursor: 'pointer'}}>
                Select all {listDataContextData.listData.totalCount}{' '}
                {listDataContextData.listData.totalCount === 1 ? (
                  listDataContextData.singularDisplayName
                ) : listDataContextData.pluralDisplayName}{' '}
                that match this query...
              </span>
            </div>
          ) : (
            <div
              className={styles.listActionBarSelectAllBanner}
              onClick={() => listDataContextData.onChangeCheckedItemKeys(ALL_ITEMS)}
            >
              Selected all {listDataContextData.listData.totalCount}{' '}
              {listDataContextData.listData.totalCount === 1 ? (
                listDataContextData.singularDisplayName
              ) : listDataContextData.pluralDisplayName}{' '}
              that match this query...
            </div>
          )}
        </Fragment>
      ) : null}
    </Fragment>
  );
};








const FilterMetadataContext = React.createContext<[
  Array<FilterMetadata>,
  (filters: (old: Array<FilterMetadata>) => Array<FilterMetadata>) => void,
] | null>(null);

type FilterMetadata<FilterState extends JSONValue = JSONValue> = {
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

export const FilterDefinition = <S extends JSONValue = JSONValue>(props: FilterMetadata<S>) => {
  const filterMetadataContextData = useContext(FilterMetadataContext);
  if (!filterMetadataContextData) {
    throw new Error('Error: <Filter ... /> was not rendered inside of a container component! Try rendering this inside of a <ListFilterBar> ... </ListFilterBar>.');
  }

  const [_filterMetadata, setFilterMetadata] = filterMetadataContextData;

  useEffect(() => {
    const filterMetadata: FilterMetadata<S> = {
      name: props.name,
      getInitialState: props.getInitialState,
      onIsComplete: props.onIsComplete,
      onIsValid: props.onIsValid,
      serialize: props.serialize,
      deserialize: props.deserialize,
      children: props.children,
    };
    setFilterMetadata(old => [
      ...old,
      filterMetadata as (typeof old)[0], // FIXME: the generics make this complex, maybe more complex than it should be
    ]);

    return () => {
      setFilterMetadata(old => old.filter(f => f !== filterMetadata));
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

type StringFilterDefinitionProps = Partial<FilterMetadata<string>> & {
  name: FilterMetadata<string>['name'];
};

export const StringFilterDefinition = (props: StringFilterDefinitionProps) => {
  const Controls = useControls();

  const getInitialState = useMemo(() => props.getInitialState || (() => ""), [props.getInitialState]);
  const onIsComplete = useMemo(() => props.onIsComplete || ((state: string) => state.length > 0), [props.onIsComplete]);
  const onIsValid = useMemo(() => props.onIsValid || ((state: string) => state.length > 0), [props.onIsValid]);
  const serialize = useMemo(() => props.serialize || ((state: string) => state), [props.serialize]);
  const deserialize = useMemo(() => props.deserialize || ((state: string) => state), [props.deserialize]);

  const children = useMemo(() => props.children || ((
    state: string,
    setState: (newState: string) => void,
    filter: Filter<string>,
    onBlur: () => void
  ) => (
    <Controls.TextInput
      size="small"
      value={state}
      onChange={setState}
      onBlur={onBlur}
      invalid={!filter.isValid}
    />
  )), [props.children]);

  return (
    <FilterDefinition<string>
      name={props.name}
      getInitialState={getInitialState}
      onIsComplete={onIsComplete}
      onIsValid={onIsValid}
      serialize={serialize}
      deserialize={deserialize}
    >
      {children}
    </FilterDefinition>
  );
};






type ListFilterBarProps = {
  addable?: boolean;
  searchable?: boolean;
  filterPresets?: { [name: string]: (old: Array<Filter>) => Array<Filter> };
  children: React.ReactNode;
};

export const ListFilterBar = <I = BaseItem>({
  addable = true,
  searchable,
  filterPresets = {},
  children,
}: ListFilterBarProps) => {
  const dataContext = useContext(DataContext);
  if (!dataContext || dataContext.type !== 'list') {
    throw new Error('Error: <ListFilterBar ... /> was not rendered inside of a <List> ... </List> component!');
  }
  const listDataContextData = dataContext as DataContextList<I>;

  const Controls = useControls();

  const filterMetadataContextData = useContext(FilterMetadataContext);
  if (!filterMetadataContextData) {
    throw new Error('Error: <Filter ... /> was not rendered inside of a container component! Try rendering this inside of a <ListFilterBar> ... </ListFilterBar>.');
  }
  const [filterMetadata, _setFilterMetadata] = filterMetadataContextData;

  // Create a tree structure of possible filter names
  const filterMetadataNameHierarchy = useMemo(() => {
    type Hierarchy = Map<string, Hierarchy | true>;
    let hierarchy: Hierarchy = new Map();

    for (const entry of filterMetadata) {
      if (entry.name.length === 0) {
        throw new Error('<FilterDefinition /> name prop must be at least 1 string long!');
      }

      let lastPointer = hierarchy;
      let pointer = hierarchy;

      for (const nameSection of entry.name) {
        let nextPointer = pointer.get(nameSection);
        if (!nextPointer) {
          nextPointer = new Map();
          pointer.set(nameSection, nextPointer);
        }
        if (nextPointer === true) {
          nextPointer = new Map([
            ["default", true],
          ]);
          pointer.set(nameSection, nextPointer);
        }
        lastPointer = pointer;
        pointer = nextPointer;
      }

      lastPointer.set(entry.name.at(-1), true);
    }

    return hierarchy;
  }, [filterMetadata]);

  // This control is hidden when nothing is checked
  if (listDataContextData.checkedItemKeys === ALL_ITEMS) {
    return null;
  }
  if (listDataContextData.checkedItemKeys.length > 0) {
    return null;
  }

  const filterPresetButtons = Object.entries(filterPresets).map(([name, filterPresetCallback]) => {
    return (
      <Controls.Button
        key={name}
        onClick={() => listDataContextData.onChangeFilters(filterPresetCallback(listDataContextData.filters))}
      >{name}</Controls.Button>
    );
  });


  return (
    <Fragment>
      <Controls.AppBar
        intent="header"
        size="regular"
        title={
          <span className={styles.listFilterBarTitle}>
            {dataContext.pluralDisplayName.slice(0, 1).toUpperCase()}
            {dataContext.pluralDisplayName.slice(1)}
          </span>
        }
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', overflow: 'visible' }}>
            {addable && listDataContextData.createLink ? (
              <Controls.NavigationButton variant="primary" navigatable={listDataContextData.createLink}>
                &#65291; Add {listDataContextData.singularDisplayName}
              </Controls.NavigationButton>
            ) : null}

            {filterMetadata.length > 0 ? (
              <Controls.Popover
                target={toggle => (
                  <Controls.Button onClick={toggle}>
                    {listDataContextData.filters.length > 0 ? `Filters (${listDataContextData.filters.length})` : 'Filters'}
                  </Controls.Button>
                )}
              >
                {close => (
                  <div className={styles.filterPopup}>
                    <Controls.AppBar
                      intent="header"
                      size="small"
                      title={<span className={styles.filterPopupHeaderName}>Filters</span>}
                      actions={
                        <Controls.IconButton size="small" onClick={close}>
                          &times;
                        </Controls.IconButton>
                      }
                    />

                    <div className={styles.filterPopupBody}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 200 }}>
                        {listDataContextData.filters.map((filter, filterIndex) => {
                          const getPeerOptionsForFilterPath = (path: Array<string>) => {
                            let pointer: typeof filterMetadataNameHierarchy | true = filterMetadataNameHierarchy;
                            let lastPointer = pointer;

                            for (const entry of path) {
                              if (typeof pointer === 'undefined') {
                                return [];
                              }
                              if (pointer === true) {
                                return [];
                              }
                              lastPointer = pointer;
                              pointer = pointer.get(entry);
                            }

                            return Array.from(lastPointer.keys());
                          };

                          // Attempt to find a filter definition that matches this new name selection
                          let metadata: FilterMetadata | null = null;
                          for (const item of filterMetadata) {
                            const nameMatches = filter.name.every((e, i) => e === item.name[i]);
                            if (nameMatches) {
                              metadata = item;
                              break;
                            }
                          }

                          return (
                            <div key={filterIndex} style={{ display: 'flex', justifyContent: 'space-between', gap: 4, alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: 14, width: 48 }}>
                                  {filterIndex === 0 ? 'where' : 'and'}
                                </span>
                                {filter.name.map((entry, entryIndex) => (
                                  <Controls.Select
                                    size="small"
                                    value={entry}
                                    key={entryIndex}
                                    onChange={newValue => {
                                      // Given the adjustment in filter name, figure out what the new filter name
                                      // would be
                                      const newFilterNamePrefix = filter.name.slice(0, entryIndex);
                                      newFilterNamePrefix[entryIndex] = newValue;

                                      // Attempt to find a filter definition that matches this new name selection
                                      let newFilterMetadata: FilterMetadata | null = null;
                                      for (const item of filterMetadata) {
                                        const namePrefixMatches = newFilterNamePrefix.every((e, i) => e === item.name[i]);
                                        if (namePrefixMatches) {
                                          newFilterMetadata = item;
                                          break;
                                        }
                                      }
                                      if (!newFilterMetadata) {
                                        return;
                                      }
                                      const newFilterMetadataNonNull = newFilterMetadata;

                                      // Update the given filter to now be of type `newFilterMetadata`
                                      listDataContextData.onChangeFilters(
                                        listDataContextData.filters.map((f, i) => {
                                          if (i === filterIndex) {
                                            const initialState = newFilterMetadataNonNull.getInitialState();
                                            const isValid = newFilterMetadataNonNull.onIsValid(initialState);
                                            return {
                                              name: newFilterMetadataNonNull.name,
                                              isValid,
                                              isComplete: isValid && newFilterMetadataNonNull.onIsComplete(initialState),
                                              workingState: initialState,
                                              state: initialState,
                                            };
                                          } else {
                                            return f;
                                          }
                                        }),
                                      );
                                    }}
                                    options={[
                                      { value: FILTER_NOT_SET_YET, disabled: true, label: "Pick filter..." },
                                      ...getPeerOptionsForFilterPath(filter.name.slice(0, entryIndex+1)).map(choice => ({
                                        value: choice,
                                        label: choice,
                                      })),
                                    ]}
                                  />
                                ))}
                                {metadata ? metadata.children(
                                  filter.workingState,
                                  // Call this function to change the state
                                  (newState) => {
                                    listDataContextData.onChangeFilters(
                                      listDataContextData.filters.map((f, i) => {
                                        if (i === filterIndex) {
                                          return { ...f, workingState: newState };
                                        } else {
                                          return f;
                                        }
                                      }),
                                    );
                                  },
                                  filter,
                                  // Call this function to indicate that editing is complete
                                  () => {
                                    listDataContextData.onChangeFilters(
                                      listDataContextData.filters.map((f, i) => {
                                        if (i === filterIndex) {
                                          const isValid =  metadata.onIsValid(f.workingState);
                                          return {
                                            ...f,
                                            state: f.workingState,
                                            isValid,
                                            isComplete: isValid && metadata.onIsComplete(f.workingState),
                                          };
                                        } else {
                                          return f;
                                        }
                                      }),
                                    );
                                  },
                                ) : null}
                              </div>
                              <Controls.IconButton size="small" onClick={() => {
                                listDataContextData.onChangeFilters(
                                  listDataContextData.filters.filter((_f, i) => i !== filterIndex)
                                );
                              }}>&times;</Controls.IconButton>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <Controls.AppBar
                      intent="footer"
                      size="small"
                      title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, userSelect: 'none' }}>
                          <Controls.Button
                            size="small"
                            variant="primary"
                            onClick={() => {
                              listDataContextData.onChangeFilters([
                                ...listDataContextData.filters,
                                {
                                  name: [FILTER_NOT_SET_YET],
                                  workingState: FILTER_NOT_SET_YET,
                                  state: FILTER_NOT_SET_YET,
                                  isValid: false,
                                  isComplete: false,
                                },
                              ])
                            }}
                          >Add filter</Controls.Button>
                          <div style={{
                            borderLeft: `1.5px solid var(--gray-12)`,
                            paddingLeft: 8,
                          }}>
                            {filterPresetButtons.length === 0 ? (
                              <small style={{color: 'var(--gray-10)', marginTop: 3}}>No presets</small>
                            ) : filterPresetButtons}
                          </div>
                        </div>
                      }
                    />
                  </div>
                )}
              </Controls.Popover>
            ) : null}

            {searchable ? (
              <div className={styles.listFilterBarSearch}>
                <SearchInput
                  pluralDisplayName={listDataContextData.pluralDisplayName}
                  value={listDataContextData.searchText}
                  onChange={text => listDataContextData.onChangeSearchText(text)}
                />
              </div>
            ) : null}
          </div>
        }
      />

      {/* The children should not render anything, this should purely be Filters */}
      {children}
    </Fragment>
  );
};




const ManuallyStickyTHead: React.FunctionComponent<{children: React.ReactNode}> = ({ children }) => {
  const tHeadRef = useRef<HTMLTableSectionElement | null>(null);

  const previousY = useRef<number | null>(null);
  const locked = useRef<boolean>(false);
  const lastPositionY = useRef<number | null>(null);

  useEffect(() => {
    if (!tHeadRef.current) {
      return;
    }

    let handle: number | null = null;
    const frame = () => {
      if (!tHeadRef.current) {
        return;
      }
      const position = tHeadRef.current.getBoundingClientRect();
      if (position.y !== previousY.current) {
        if (!locked.current && position.y < 0) {
          // Lock header to top of screen
          locked.current = true;
          lastPositionY.current = -1 * position.y;
          tHeadRef.current.style.transform = `translateY(${lastPositionY.current}px)`;
        } else if (typeof lastPositionY.current === 'number' && locked.current) {
          lastPositionY.current -= position.y;
          if (typeof lastPositionY.current === 'number' && lastPositionY.current > 0) {
            tHeadRef.current.style.transform = `translateY(${lastPositionY.current}px)`;
          } else {
            // Unlock header from top of screen
            locked.current = false;
            tHeadRef.current.style.transform = `translateY(0px)`;
          }
        }
        previousY.current = position.y;
      }

      handle = requestAnimationFrame(frame);
      // handle = setTimeout(frame, 500);
    };
    handle = requestAnimationFrame(frame);
    // handle = setTimeout(frame, 500);

    return () => {
      if (handle !== null) {
        cancelAnimationFrame(handle);
        // clearTimeout(handle);
      }
    }
  }, []);

  return (
    <thead ref={tHeadRef}>
      {children}
    </thead>
  );
};




type ListTableProps<I, F> = {
  detailLinkColumnWidth?: null | string | number;
  checkboxesColumnWidth?: null | string | number;
  columnSets?: { [name: string]: Array<F> };
  renderColumnSetSelector?: (params: {
    fields: FieldCollection<FieldMetadata<I, F>>;
    columnSets: { [name: string]: Array<F> };
    columnSet: 'all' | string | Array<F>;
    onChangeColumnSet: (newColumnSet: 'all' | string | Array<F>) => void;
  }) => React.ReactNode;

  renderNextPageIndicator?: (params: {
    loadingNextPage: boolean;
    nextPageAvailable: boolean;
    onLoadNextPage: () => Promise<void>;
  }) => React.ReactNode;
  renderTableWrapper?: (params: {
    listDataContextData: DataContextList<I, F>;
    fields: FieldCollection<FieldMetadata<I, F>>;
    detailLinkEnabled: boolean;
    detailLinkWidth: null | string | number;
    checkboxesWidth: null | string | number;
    visibleFieldNames: Array<F>;
    columnSets?: { [name: string]: Array<F> };
    renderColumnSetSelector?: (params: {
      fields: FieldCollection<FieldMetadata<I, F>>;
      columnSets: { [name: string]: Array<F> };
      columnSet: 'all' | string | Array<F>;
      onChangeColumnSet: (newColumnSet: 'all' | string | Array<F>) => void;
    }) => React.ReactNode;
    childrenContainsItems: boolean;
    children: React.ReactNode;
  }) => React.ReactNode;
  renderTableItem?: (params: {
    item: I,
    visibleFieldNames: Array<F>;
    fields: FieldCollection<FieldMetadata<I, F>>,

    detailLink?: Navigatable,

    checkable: boolean,
    checkType: 'checkbox' | 'radio',
    checked: boolean,
    checkboxDisabled: boolean,
    onChangeChecked: (checked: boolean, shiftKey?: boolean) => void,
  }) => React.ReactNode;
  children?: React.ReactNode;
};

export const ListTable = <I = BaseItem, F = BaseFieldName>({
  detailLinkColumnWidth = null,
  checkboxesColumnWidth = 32 /* px */,
  columnSets,
  renderColumnSetSelector = ({fields, columnSets, columnSet, onChangeColumnSet}) => (
    <ListColumnSetSelector<I, F>
      fields={fields}
      columnSets={columnSets}
      columnSet={columnSet}
      onChangeColumnSet={onChangeColumnSet}
    />
  ),
  renderNextPageIndicator = ({ loadingNextPage, nextPageAvailable, onLoadNextPage }) => {
    if (loadingNextPage) {
      return (
        <div className={styles.tableNextPageIndicator}>
          <div className={styles.tableNextPageLoading}>Loading next page...</div>
        </div>
      );
    }
    if (!nextPageAvailable) {
      return null;
    }

    return (
      <div className={styles.tableNextPageIndicator}>
        <button className={styles.tableNextPageButton} onClick={onLoadNextPage}>Load more...</button>
      </div>
    );
  },
  renderTableWrapper = ({
    listDataContextData,
    fields,
    detailLinkEnabled,
    detailLinkWidth,
    checkboxesWidth,
    visibleFieldNames,
    columnSets,
    renderColumnSetSelector,
    childrenContainsItems,
    children,
  }) => {
    const Controls = useControls();

    const allChecked = listDataContextData.checkedItemKeys === ALL_ITEMS ? (
      true
    ) : (
      listDataContextData.listData.status === 'COMPLETE' ? (
        listDataContextData.listData.data.length === listDataContextData.checkedItemKeys.length
      ) : false
    );

    return (
      <div className={styles.tableWrapper}>
        <table>
          <ManuallyStickyTHead>
            <tr>
              {/* Add a column for the checkboxes */}
              {listDataContextData.checkable ? (
                <th
                  style={{ minWidth: checkboxesWidth || undefined }}
                  className={styles.floatingCheckbox}
                  onClick={() => {
                    if (listDataContextData.listData.status !== 'COMPLETE') {
                      return;
                    }
                    const newAllChecked = !allChecked;
                    if (newAllChecked) {
                      const keys = listDataContextData.listData.data.map(item => listDataContextData.keyGenerator(item));
                      listDataContextData.onChangeCheckedItemKeys(keys);
                    } else {
                      listDataContextData.onChangeCheckedItemKeys([]);
                    }
                  }}
                >
                  <div onClick={e => e.stopPropagation()}>
                    <Controls.Checkbox
                      disabled={!childrenContainsItems}
                      checked={allChecked}
                      onChange={checked => {
                        if (listDataContextData.listData.status !== 'COMPLETE') {
                          return;
                        }

                        if (checked) {
                          const keys = listDataContextData.listData.data.map(item => listDataContextData.keyGenerator(item));
                          listDataContextData.onChangeCheckedItemKeys(keys);
                        } else {
                          listDataContextData.onChangeCheckedItemKeys([]);
                        }
                      }}
                    />
                  </div>
                </th>
              ) : null}
              {visibleFieldNames.map(name => {
                const fieldMetadata = fields.metadata.find(f => f.name === name);
                if (!fieldMetadata) {
                  return null;
                }

                return (
                  <th
                    key={fieldMetadata.name as string}
                    className={fieldMetadata.sortable ? styles.sortable : undefined}
                    style={{minWidth: fieldMetadata.columnWidth, maxWidth: fieldMetadata.columnWidth}}
                    onClick={fieldMetadata.sortable ? () => {
                      if (!listDataContextData.sort) {
                        // Initially set the sort
                        listDataContextData.onChangeSort({
                          fieldName: fieldMetadata.name,
                          direction: 'desc'
                        } as Sort);
                      } else if (listDataContextData.sort.fieldName !== fieldMetadata.name) {
                        // A different column was selected, so initially set the sort for this new column
                        listDataContextData.onChangeSort({
                          fieldName: fieldMetadata.name,
                          direction: 'desc'
                        } as Sort);
                      } else {
                        // Cycle the sort to the next value
                        switch (listDataContextData.sort.direction) {
                          case 'desc':
                            listDataContextData.onChangeSort({
                              fieldName: fieldMetadata.name,
                              direction: 'asc',
                            } as Sort);
                            return;
                          case 'asc':
                            listDataContextData.onChangeSort(null);
                            return;
                        }
                      }
                    } : undefined}
                  >
                    {fieldMetadata.singularDisplayName}
                    {listDataContextData.sort && listDataContextData.sort.fieldName === fieldMetadata.name ? (
                      <span className={styles.tableWrapperSortIndicator}>
                        {listDataContextData.sort.direction === 'desc' ? <Fragment>&darr;</Fragment> : <Fragment>&uarr;</Fragment>}
                      </span>
                    ) : null}
                  </th>
                );
              })}
              {/* Add a column for the detail link */}
              {detailLinkEnabled ? (
                <th style={{ minWidth: detailLinkWidth || undefined }}></th>
              ) : null}
              <th className={styles.listTableHeaderActionsWrapper}>
                {columnSets && renderColumnSetSelector ? (
                  renderColumnSetSelector({
                    fields,
                    columnSets,
                    columnSet: listDataContextData.columnSet,
                    onChangeColumnSet: listDataContextData.onChangeColumnSet,
                  })
                ) : null}

                <ListCSVExport<I, F>
                  pluralDisplayName={listDataContextData.pluralDisplayName}
                  fields={fields}
                  fetchAllListData={listDataContextData.fetchAllListData}
                  listData={listDataContextData.listData}
                  columnSets={columnSets}
                  keyGenerator={listDataContextData.keyGenerator}
                  checkedItemKeys={listDataContextData.checkedItemKeys}
                />
              </th>
            </tr>
          </ManuallyStickyTHead>
          {childrenContainsItems ? (
            <tbody>
              {children}
            </tbody>
          ) : null}
        </table>
        {!childrenContainsItems ? children : null}
      </div>
    );
  },
  renderTableItem = (props) => (
    <ListTableItem {...props} />
  ),
  children,
}: ListTableProps<I, F>) => {
  // First, get the list context data
  const dataContext = useContext(DataContext);
  if (!dataContext || dataContext.type !== 'list') {
    throw new Error('Error: <ListTable ... /> was not rendered inside of a <List> ... </List> component!');
  }
  const listDataContextData = (dataContext as any) as DataContextList<I, F>;

  // Then get the data model context data
  const dataModelsContextData = useContext(DataModelsContext);
  if (!dataModelsContextData) {
    throw new Error('Error: <ListTable ... /> was not rendered inside of a container component! Try rendering this inside of a <DataModels> ... </DataModels>.');
  }
  const dataModel = dataModelsContextData[0].get(listDataContextData.name) as DataModel<I> | undefined;
  if (!dataModel) {
    throw new Error(`Error: <ListTable ... /> cannot find data model with name ${listDataContextData.name}!`);
  }

  const [fields, setFields] = useState<FieldCollection<FieldMetadata<I, F>>>(
    (EMPTY_FIELD_COLLECTION as any) as FieldCollection<FieldMetadata<I, F>>
  );

  // Convert the column set into the columns to render in the table
  let visibleFieldNames: Array<F> = [];
  if (listDataContextData.columnSet === 'all') {
    visibleFieldNames = fields.names as Array<F>;
  } else if (Array.isArray(listDataContextData.columnSet)) {
    // A manual list of fields
    visibleFieldNames = listDataContextData.columnSet as Array<F>;
  } else {
    const columns = columnSets ? columnSets[listDataContextData.columnSet] : null;
    if (columns) {
      visibleFieldNames = columns;
    } else {
      // Default to all columns if no columnset can be found
      visibleFieldNames = fields.metadata.map(f => f.name);
    }
  }

  let tableItemsChildren: React.ReactNode = null;
  switch (listDataContextData.listData.status) {
    case 'IDLE':
    case 'LOADING_INITIAL':
      tableItemsChildren = (
        <div className={styles.listTableEmptyState}>
          Loading {listDataContextData.pluralDisplayName}...
        </div>
      );
      break;
    case 'ERROR_INITIAL':
      tableItemsChildren = (
        <div className={styles.listTableErrorState}>
          Error loading {listDataContextData.pluralDisplayName}: {listDataContextData.listData.error.message}
        </div>
      );
      break;
    case 'COMPLETE':
    case 'LOADING_NEXT_PAGE':
      if (listDataContextData.listData.data.length > 0) {
        tableItemsChildren = (
          <Fragment>
            {listDataContextData.listData.data.map((item, index) => {
              const key = listDataContextData.keyGenerator(item);
              return (
                <Fragment key={key}>
                  {renderTableItem({
                    item,
                    fields,
                    visibleFieldNames,
                    detailLink: listDataContextData.detailLinkGenerator ? listDataContextData.detailLinkGenerator(item) : undefined,
                    checkable: listDataContextData.checkable,
                    checkType: 'checkbox',
                    checked: listDataContextData.checkedItemKeys === ALL_ITEMS ? true : listDataContextData.checkedItemKeys.includes(key),
                    checkboxDisabled: listDataContextData.checkedItemKeys === ALL_ITEMS,
                    onChangeChecked: (checked: boolean, shiftKey?: boolean) => {
                      if (listDataContextData.listData.status !== 'COMPLETE') {
                        return;
                      }
                      if (listDataContextData.checkedItemKeys === ALL_ITEMS) {
                        return;
                      }

                      if (shiftKey) {
                        // Shift was held, so a range of items should be checked
                        //
                        // NOTE: this probably should instead use the last changed checkbox index, as
                        // that would then allow for shift-selections in reverse order as well
                        //
                        // Find the previous item that is in the new `checked` state
                        let previousItem = item;
                        let previousItemIndex = index;
                        for (let i = index-1; i >= 0; i -= 1) {
                          previousItemIndex = i;
                          previousItem = listDataContextData.listData.data[i];

                          const previousItemChecked = listDataContextData.checkedItemKeys.includes(listDataContextData.keyGenerator(previousItem));
                          if (previousItemChecked === checked) {
                            // This is the other side of the bulk check operation!
                            break;
                          }
                        }

                        // Set the checked value for the items in the check range
                        let newCheckedItemKeys = listDataContextData.checkedItemKeys.slice();
                        for (let i = previousItemIndex+1; i <= index; i += 1) {
                          const key = listDataContextData.keyGenerator(listDataContextData.listData.data[i]);
                          if (checked) {
                            newCheckedItemKeys = [ ...newCheckedItemKeys, key ];
                          } else {
                            newCheckedItemKeys = newCheckedItemKeys.filter(k => k !== key);
                          }
                        }
                        listDataContextData.onChangeCheckedItemKeys(newCheckedItemKeys);
                      } else {
                        // Shift was not held, so a single item is being checked or unchecked
                        if (checked) {
                          listDataContextData.onChangeCheckedItemKeys([
                            ...listDataContextData.checkedItemKeys,
                            key,
                          ]);
                        } else {
                          listDataContextData.onChangeCheckedItemKeys(listDataContextData.checkedItemKeys.filter(k => k !== key));
                        }
                      }
                    },
                  })}
                </Fragment>
              );
            })}
          </Fragment>
        );
      } else {
        tableItemsChildren = (
          <div className={styles.listTableEmptyState}>
            No {listDataContextData.pluralDisplayName} found
          </div>
        );
      }
      break;
  }

  return (
    <FieldsProvider dataModel={dataModel} onChangeFields={setFields}>
      <div className={styles.listTable}>
        {renderTableWrapper({
          listDataContextData,
          fields,
          detailLinkEnabled: listDataContextData.detailLinkGenerator !== null,
          detailLinkWidth: detailLinkColumnWidth,
          checkboxesWidth: checkboxesColumnWidth,
          visibleFieldNames,
          columnSets,
          renderColumnSetSelector,
          childrenContainsItems: (
            listDataContextData.listData.status === 'LOADING_NEXT_PAGE' ||
            (listDataContextData.listData.status === 'COMPLETE' && listDataContextData.listData.data.length > 0)
          ),
          children: tableItemsChildren,
        })}

        {renderNextPageIndicator({
          loadingNextPage: listDataContextData.listData.status === 'LOADING_NEXT_PAGE',
          nextPageAvailable: listDataContextData.listData.status === 'COMPLETE' ? listDataContextData.listData.nextPageAvailable : false,
          onLoadNextPage: listDataContextData.onLoadNextPage,
        })}

        {/* The children should not render anything, this should purely be Fields */}
        {children}
      </div>
    </FieldsProvider>
  );
};






export const ListColumnSetSelector = <I = BaseItem, F = BaseFieldName>(props: {
  fields: FieldCollection<FieldMetadata<I, F>>;
  columnSets: { [name: string]: Array<F> }
  columnSet: 'all' | string | Array<F>;
  onChangeColumnSet: (newColumnSet: 'all' | string | Array<F>) => void;
}) => {
  const Controls = useControls();
  return (
    <Controls.Popover
      target={toggle => (
        <Controls.IconButton onClick={toggle}>&#9707;</Controls.IconButton>
      )}
    >
      {close => (
        <div className={styles.listColumnSetPopup}>
          <Controls.AppBar
            intent="header"
            size="small"
            title={<span className={styles.listColumnSetPopupHeaderName}>Column Sets</span>}
            actions={
              <Controls.IconButton size="small" onClick={close}>
                &times;
              </Controls.IconButton>
            }
          />

          <div className={styles.listColumnSetBody}>
            <h3>All columns</h3>
            <ul>
              <li
                onClick={() => props.onChangeColumnSet('all')}
                style={{cursor: 'pointer', backgroundColor: props.columnSet === 'all' ? 'red' : 'transparent'}}
              >
                All
              </li>
            </ul>
            <br />

            <h3>Server defined column sets</h3>
            <ul>
              {Object.entries(props.columnSets).map(([name, columns]) => {
                return (
                  <li
                    key={name}
                    onClick={() => props.onChangeColumnSet(name)}
                    style={{cursor: 'pointer', backgroundColor: props.columnSet === name ? 'red' : 'transparent'}}
                  >
                    {name}<br/>
                    <small>{columns.map(name => props.fields.metadata.find(f => f.name === name)?.singularDisplayName || name).join(', ')}</small>
                  </li>
                );
              })}
            </ul>
            <br />

            <h3>Custom Columns</h3>
            TODO
          </div>
        </div>
      )}
    </Controls.Popover>
  );
};











type DataContextDetail<I = BaseItem> = {
  type: 'detail';
  itemKey: ItemKey | null;

  isCreating: boolean;

  name: string;
  singularDisplayName: string;
  pluralDisplayName: string;
  csvExportColumnName?: string;

  detailData: DetailData<I>;

  createItem: ((createData: Partial<I>, abort: AbortSignal) => Promise<I>) | null;
  updateItem: ((itemKey: ItemKey, updateData: Partial<I>, abort: AbortSignal) => Promise<void>) | null;
  deleteItem: ((itemKey: ItemKey, abort: AbortSignal) => Promise<void>) | null;

  detailLinkGenerator: null | ((item: I) => Navigatable);
  listLink: null | Navigatable;
};

type DetailData<T> =
  | { status: 'IDLE' }
  | { status: 'LOADING' }
  | {
    status: 'COMPLETE';
    data: T;
  }
  | {
    status: 'ERROR';
    error: Error;
  };

type DetailProps<I = BaseItem> = {
  name: string;
  itemKey?: ItemKey | null;
  children?: React.ReactNode;
} & Partial<Pick<
  DataModel<I>,
  | "singularDisplayName"
  | "pluralDisplayName"
  | "csvExportColumnName"
  | "fetchItem"
  | "createItem"
  | "updateItem"
  | "deleteItem"
  | "detailLinkGenerator"
  | "listLink"
>>;

export const Detail = <I = BaseItem>(props: DetailProps<I>) => {
  const {
    name,
    itemKey = null,
    children = (
      <DetailFields />
    ),
  } = props;

  // First, get the data model that the list component uses:
  const dataModelsContextData = useContext(DataModelsContext);
  if (!dataModelsContextData) {
    throw new Error('Error: <Detail ... /> was not rendered inside of a container component! Try rendering this inside of a <DataModels> ... </DataModels>.');
  }
  const dataModel = dataModelsContextData[0].get(name) as DataModel<I> | undefined;
  const singularDisplayName = props.singularDisplayName || dataModel?.singularDisplayName || '';
  const pluralDisplayName = props.pluralDisplayName || dataModel?.pluralDisplayName || '';
  const csvExportColumnName = props.csvExportColumnName || dataModel?.csvExportColumnName || '';
  const fetchItem = props.fetchItem || dataModel?.fetchItem || null;
  const createItem = props.createItem || dataModel?.createItem || null;
  const updateItem = props.updateItem || dataModel?.updateItem || null;
  const deleteItem = props.deleteItem || dataModel?.deleteItem || null;
  const detailLinkGenerator = props.detailLinkGenerator || dataModel?.detailLinkGenerator || null;
  const listLink = props.listLink || dataModel?.listLink || null;

  const [detailData, setDetailData] = useState<DetailData<I>>({ status: 'IDLE' });

  const [
    addInFlightAbortController,
    removeInFlightAbortController,
  ] = useInFlightAbortControllers();

  // When the component initially loads, fetch the item
  useEffect(() => {
    if (!fetchItem) {
      return;
    }
    if (itemKey === null) {
      // Don't fetch data in creation mode
      return;
    }

    const abortController = new AbortController();

    const fetchDataItem = async () => {
      setDetailData({ status: 'LOADING' });

      addInFlightAbortController(abortController);
      let result: I;
      try {
        result = await fetchItem(itemKey, abortController.signal);
      } catch (error: FixMe) {
        if (error.name === 'AbortError') {
          // The effect unmounted, and the request was terminated
          return;
        }

        setDetailData({ status: 'ERROR', error });
        return;
      }
      removeInFlightAbortController(abortController);

      setDetailData({
        status: 'COMPLETE',
        data: result,
      });
    };

    fetchDataItem().catch(error => {
      console.error(error);
    });

    return () => {
      setDetailData({ status: 'IDLE' });

      abortController.abort();
      removeInFlightAbortController(abortController);
    };
  }, [setDetailData, fetchItem]);

  const dataContextData: DataContextDetail<I> | null = useMemo(() => {
    if (!fetchItem) {
      return null;
    }
    return {
      type: 'detail' as const,
      itemKey,
      isCreating: itemKey === null,
      name,
      singularDisplayName,
      pluralDisplayName,
      csvExportColumnName,
      detailData,
      createItem,
      updateItem,
      deleteItem,
      listLink,
      detailLinkGenerator,
    };
  }, [
    itemKey,
    name,
    singularDisplayName,
    pluralDisplayName,
    csvExportColumnName,
    detailData,
    createItem,
    updateItem,
    deleteItem,
    listLink,
    detailLinkGenerator,
  ]);

  if (!dataContextData) {
    return (
      <span>Waiting for data model {name} to be added to DataModelsContext...</span>
    );
  }

  return (
    <DataContext.Provider value={dataContextData as DataContextDetail}>
      <div className={styles.detail}>
        {children}
      </div>
    </DataContext.Provider>
  );
};








export const DetailFieldItem = <I = BaseItem, F = BaseFieldName, S = BaseFieldState>({
  item,
  field,
  fieldState,
  onUpdateFieldState,
}: Parameters<DetailFieldsProps<I, F>['renderFieldItem']>[0]) => {
  const [state, setState] = useState<S>(fieldState);
  useEffect(() => {
    setState(fieldState);
  }, [fieldState]);

  if (field.modifyMarkup) {
    return (
      <div style={{ display: 'flex', flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <strong>{field.singularDisplayName}:</strong>
        </div>
        {field.modifyMarkup(
          state,
          (s: S, blurAfterStateSet?: boolean) => {
            setState(s);
            if (blurAfterStateSet) {
              onUpdateFieldState(s);
            }
          },
          item,
          () => onUpdateFieldState(state)
        )}
      </div>
    );
  } else {
    return (
      <div>
        <strong>{field.singularDisplayName}</strong>: {field.displayMarkup(state, item)}
      </div>
    );
  }
};






type DetailFieldsProps<I = BaseItem, F = BaseFieldName, S = BaseFieldState> = {
  renderFieldsWrapper?: (params: {
    detailDataContextData: DataContextDetail<I>;
    children: React.ReactNode;
  }) => React.ReactNode;
  renderFieldItem?: (params: {
    item: I | null,
    field: FieldMetadata<I, F, S>,
    fieldState: S,
    onUpdateFieldState: (newState: S) => void,
  }) => React.ReactNode;
  children?: React.ReactNode;
};

export const DetailFields = <I = BaseItem, F = BaseFieldName>({
  renderFieldsWrapper = ({ children }) => (
    <div className={styles.detailFields}>
      {children}
    </div>
  ),
  renderFieldItem = (props) => (
    <DetailFieldItem {...props} />
  ),
  children,
}: DetailFieldsProps<I, F>) => {
  // First, get the list context data
  const dataContext = useContext(DataContext);
  if (!dataContext || dataContext.type !== 'detail') {
    throw new Error('Error: <DetailFields ... /> was not rendered inside of a <Detail> ... </Detail> component!');
  }
  const detailDataContextData = dataContext as DataContextDetail<I>;

  const Controls = useControls();
  const adminContextData = useContext(AdminContext);
  if (!adminContextData) {
    throw new Error('Error: <DetailFields ... /> was not rendered inside of a <AdminContextProvider> ...</AdminContextProvider> component!');
  }

  // Then get the data model context data
  const dataModelsContextData = useContext(DataModelsContext);
  if (!dataModelsContextData) {
    throw new Error('Error: <DetailFields ... /> was not rendered inside of a container component! Try rendering this inside of a <Detail> ... </Detail> component.');
  }
  const dataModel = dataModelsContextData[0].get(detailDataContextData.name) as DataModel<I, BaseFieldName> | undefined;
  if (!dataModel) {
    throw new Error(`Error: <DetailFields ... /> cannot find data model with name ${detailDataContextData.name}!`);
  }

  const [
    addInFlightAbortController,
    removeInFlightAbortController,
  ] = useInFlightAbortControllers();

  const [updateKeepEditing, setUpdateKeepEditing] = useState(false);

  const [fields, setFields] = useState<FieldCollection<FieldMetadata<I, F>>>(EMPTY_FIELD_COLLECTION);

  // Store each state for each field centrally
  const [fieldStates, setFieldStates] = useState<
    | { status: "IDLE" }
    | { status: "LOADING" }
    | { status: "COMPLETE", data: Map<F, BaseFieldState> }
    | { status: "ERROR", error: any }
  >({ status: "IDLE" });
  useEffect(() => {
    const abortController = new AbortController();
    addInFlightAbortController(abortController);

    setFieldStates({ status: "LOADING" });
    Promise.all(fields.metadata.map(async field => {
      if (detailDataContextData.isCreating) {
        if (field.getInitialStateWhenCreating) {
          return [
            field.name,
            field.getInitialStateWhenCreating(),
          ] as [F, BaseFieldState | undefined];
        } else {
          return [field.name, undefined] as [F, BaseFieldState | undefined];
        }
      } else {
        if (detailDataContextData.detailData.status !== 'COMPLETE') {
          return null;
        }
        const initialState = field.getInitialStateFromItem(detailDataContextData.detailData.data);

        // By calling `injectAsyncDataIntoInitialStateOnDetailPage`, the detail page can add more
        // stuff to the state asyncronously so that it can show more rich information about the
        // entity.
        return field.injectAsyncDataIntoInitialStateOnDetailPage(
          initialState,
          detailDataContextData.detailData.data,
          abortController.signal,
        ).then(updatedState => {
          return [field.name, updatedState] as [F, BaseFieldState | undefined];
        });
      }
    })).then(fieldStatesPairs => {
      removeInFlightAbortController(abortController);
      const filteredFieldStatesPairs = fieldStatesPairs.filter((n): n is [F, BaseFieldState | undefined] => n !== null);
      setFieldStates({ status: "COMPLETE", data: new Map(filteredFieldStatesPairs) });
    }).catch(error => {
      removeInFlightAbortController(abortController);
      console.error('Error loading field state:', error);
      setFieldStates({ status: "ERROR", error });
    });

    return () => {
      setFieldStates({ status: 'IDLE' });

      abortController.abort();
      removeInFlightAbortController(abortController);
    };
  }, [detailDataContextData.detailData, fields]);

  let detailFieldsChildren: React.ReactNode = null;
  if (detailDataContextData.isCreating) {
    detailFieldsChildren = (
      <Fragment>
        {fields.names.map(fieldName => {
          if (fieldStates.status !== 'COMPLETE') {
            return null;
          }

          const field = fields.metadata.find(field => field.name === fieldName);
          if (!field) {
            return null;
          }

          const fieldState = fieldStates.data.get(field.name);
          if (typeof fieldState === 'undefined') {
            return null;
          }

          return (
            <Fragment key={field.name as string}>
              {renderFieldItem({
                item: null,
                field,
                fieldState,
                onUpdateFieldState: (newFieldState) => {
                  setFieldStates(old => {
                    if (old.status !== 'COMPLETE') {
                      return old;
                    }
                    const newFieldStates = new Map(old.data);
                    newFieldStates.set(field.name, newFieldState);
                    return { status: 'COMPLETE', data: newFieldStates };
                  });
                },
              })}
            </Fragment>
          );
        })}
      </Fragment>
    );
  } else {
    switch (detailDataContextData.detailData.status) {
      case 'IDLE':
      case 'LOADING':
        detailFieldsChildren = (
          <div className={styles.detailFieldsEmptyState}>
            Loading {detailDataContextData.singularDisplayName}...
          </div>
        );
        break;
      case 'ERROR':
        detailFieldsChildren = (
          <div className={styles.detailFieldsErrorState}>
            Error loading {detailDataContextData.singularDisplayName}: {detailDataContextData.detailData.error.message}
          </div>
        );
        break;
      case 'COMPLETE':
        const item = detailDataContextData.detailData.data;
        detailFieldsChildren = (
          <Fragment>
            {fields.names.map(fieldName => {
              const field = fields.metadata.find(field => field.name === fieldName);
              if (!field) {
                return null;
              }

              switch (fieldStates.status) {
                case "IDLE":
                case "LOADING":
                  return (
                    <div key={field.name as string}>Loading...</div>
                  );
                case "COMPLETE":
                  const fieldState = fieldStates.data.get(field.name);
                  if (typeof fieldState === 'undefined') {
                    return null;
                  }
                  return (
                    <Fragment key={field.name as string}>
                      {renderFieldItem({
                        item,
                        field,
                        fieldState,
                        onUpdateFieldState: (newFieldState) => {
                          setFieldStates(old => {
                            if (old.status !== 'COMPLETE') {
                              return old;
                            }
                            const newFieldStates = new Map(old.data);
                            newFieldStates.set(field.name, newFieldState);
                            return { status: 'COMPLETE', data: newFieldStates };
                          });
                        },
                      })}
                    </Fragment>
                  );
                case "ERROR":
                  return (
                    <div key={field.name as string}>Error loading field state!</div>
                  );
              }
            })}
          </Fragment>
        );
        break;
    }
  }

  return (
    <FieldsProvider dataModel={dataModel} onChangeFields={setFields}>
      <Controls.AppBar
        intent="header"
        title={
          <Fragment>
            <Controls.NavigationButton navigatable={detailDataContextData.listLink}>&larr; Back</Controls.NavigationButton>
            {detailDataContextData.isCreating ? (
              <strong>
                Create {detailDataContextData.singularDisplayName[0].toUpperCase()}{detailDataContextData.singularDisplayName.slice(1)}
              </strong>
            ) : (
              <strong>
                {detailDataContextData.singularDisplayName[0].toUpperCase()}{detailDataContextData.singularDisplayName.slice(1)}{' '}
                {detailDataContextData.itemKey}
              </strong>
            )}
          </Fragment>
        }
      />

      {renderFieldsWrapper({
        detailDataContextData,
        children: detailFieldsChildren,
      })}

      {/* The children should not render anything, this should purely be Fields */}
      {children}

      {detailDataContextData.isCreating ? (
        <Controls.AppBar
          intent="footer"
          actions={
            <Controls.Button
              disabled={!detailDataContextData.createItem}
              variant="primary"
              onClick={async () => {
                if (!detailDataContextData.createItem) {
                  return;
                }
                if (fieldStates.status !== 'COMPLETE') {
                  return;
                }

                const abortController = new AbortController();
                addInFlightAbortController(abortController);

                // Aggregate all the state updates to form the update body
                let item: Partial<I> = {};
                for (const field of fields.metadata) {
                  let state = fieldStates.data.get(field.name);
                  if (typeof state === 'undefined') {
                    continue;
                  }

                  if (field.createSideEffect) {
                    try {
                      state = await field.createSideEffect(item, state, abortController.signal);
                    } catch (error: FixMe) {
                      if (error.name === 'AbortError') {
                        // The component unmounted, and the request was terminated
                        return;
                      }

                      console.error(error);
                      alert(`Error creating ${detailDataContextData.singularDisplayName} related item ${field.singularDisplayName} on key ${detailDataContextData.itemKey}: ${error}`);
                      return;
                    }
                  }

                  item = field.serializeStateToItem(item, state);
                }

                let createResult: I;
                try {
                  createResult = await detailDataContextData.createItem(item, abortController.signal);
                } catch (error: FixMe) {
                  if (error.name === 'AbortError') {
                    // The component unmounted, and the request was terminated
                    return;
                  }

                  console.error(error);
                  alert(`Error creating ${detailDataContextData.singularDisplayName} ${detailDataContextData.itemKey}: ${error}`);
                  return;
                }

                removeInFlightAbortController(abortController);

                // After creating, navigate to the newly created item's detail page
                if (detailDataContextData.detailLinkGenerator) {
                  imperativelyNavigateToNavigatable(adminContextData, detailDataContextData.detailLinkGenerator(createResult));
                }
              }}
            >Create</Controls.Button>
          }
        />
      ) : (
        <Controls.AppBar
          intent="footer"
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Controls.Button
                disabled={detailDataContextData.detailData.status !== 'COMPLETE' || !detailDataContextData.updateItem}
                variant="primary"
                onClick={async () => {
                  if (!detailDataContextData.updateItem) {
                    return;
                  }
                  if (!detailDataContextData.itemKey) {
                    return;
                  }
                  if (fieldStates.status !== 'COMPLETE') {
                    return;
                  }
                  if (detailDataContextData.detailData.status !== 'COMPLETE') {
                    return;
                  }

                  const abortController = new AbortController();
                  addInFlightAbortController(abortController);

                  // Aggregate all the state updates to form the update body
                  let item: Partial<I> = detailDataContextData.detailData.data;
                  for (const field of fields.metadata) {
                    let state = fieldStates.data.get(field.name);
                    if (typeof state === 'undefined') {
                      continue;
                    }

                    if (field.updateSideEffect) {
                      try {
                        state = await field.updateSideEffect(item, state, abortController.signal);
                      } catch (error: FixMe) {
                        if (error.name === 'AbortError') {
                          // The component unmounted, and the request was terminated
                          return;
                        }

                        console.error(error);
                        alert(`Error updating ${detailDataContextData.singularDisplayName} related item ${field.singularDisplayName} on key ${detailDataContextData.itemKey}: ${error}`);
                        return;
                      }
                    }

                    item = field.serializeStateToItem(item, state);
                  }

                  try {
                    await detailDataContextData.updateItem(detailDataContextData.itemKey, item, abortController.signal);
                  } catch (error: FixMe) {
                    if (error.name === 'AbortError') {
                      // The component unmounted, and the request was terminated
                      return;
                    }

                    console.error(error);
                    alert(`Error updating ${detailDataContextData.singularDisplayName} ${detailDataContextData.itemKey}: ${error}`);
                    return;
                  }

                  removeInFlightAbortController(abortController);
                  alert('Update successful!');

                  // After updating, go back to the list page
                  if (!updateKeepEditing) {
                    imperativelyNavigateToNavigatable(adminContextData, detailDataContextData.listLink);
                  }
                }}
              >Update</Controls.Button>
              {detailDataContextData.detailData.status === 'COMPLETE' && detailDataContextData.updateItem ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Controls.Checkbox
                    id="update-keep-editing"
                    checked={updateKeepEditing}
                    onChange={setUpdateKeepEditing}
                  />
                  <label htmlFor="update-keep-editing" style={{ cursor: 'pointer', userSelect: 'none' }}>Keep editing</label>
                </div>
              ) : null}
            </div>
          }
          actions={
            <Controls.Button
              disabled={detailDataContextData.detailData.status !== 'COMPLETE' || !detailDataContextData.deleteItem}
              onClick={async () => {
                if (!detailDataContextData.deleteItem) {
                  return;
                }
                if (!confirm('Are you sure?')) {
                  return;
                }

                const abortController = new AbortController();
                addInFlightAbortController(abortController);
                try {
                  await detailDataContextData.deleteItem(detailDataContextData.itemKey, abortController.signal);
                } catch (error: FixMe) {
                  if (error.name === 'AbortError') {
                    // The component unmounted, and the request was terminated
                    return;
                  }

                  console.error(error);
                  alert(`Error deleting ${detailDataContextData.singularDisplayName} ${detailDataContextData.itemKey}: ${error}`);
                  return;
                }

                removeInFlightAbortController(abortController);

                // After deleting, go back to the list page
                imperativelyNavigateToNavigatable(adminContextData, detailDataContextData.listLink);
              }}
            >Delete</Controls.Button>
          }
        />
      )}
    </FieldsProvider>
  );
};
