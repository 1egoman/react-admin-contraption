import * as React from 'react';
import {
  Fragment,
  useMemo,
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import { gray } from '@radix-ui/colors';

import styles from './styles.module.css';

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
} from './types';

import Navigatable, { NavigationButton, imperativelyNavigateToNavigatable } from "./navigatable";

type DataModel<I = BaseItem, F = BaseFieldName> = {
  singularDisplayName: string;
  pluralDisplayName: string;

  fetchPageOfData: (
    page: number,
    filters: Array<[Filter['name'], Filter['state']]>,
    sort: Sort | null,
    searchText: string,
    abort: AbortSignal,
  ) => Promise<Paginated<I>>;
  fetchItem: (
    itemKey: ItemKey,
    abort: AbortSignal,
  ) => Promise<I>;

  createItem: ((createData: Partial<I>, abort: AbortSignal) => Promise<I>) | null;
  updateItem: ((itemKey: ItemKey, updateData: I, abort: AbortSignal) => Promise<void>) | null;
  deleteItem: ((itemKey: ItemKey, abort: AbortSignal) => Promise<void>) | null;

  listLink?: null | Navigatable;

  keyGenerator: (item: I) => ItemKey;
  detailLinkGenerator?: null | ((item: I) => Navigatable);
  createLink?: null | Navigatable;

  fields: FieldCollection<FieldMetadata<I, F>>,
};

const DataModelsContext = React.createContext<[
  Map<string, DataModel>,
  (updateFn: (oldDataModels: Map<string, DataModel>) => Map<string, DataModel>) => void,
] | null>(null);
export const DataModels: React.FunctionComponent<{ children: React.ReactNode }> = ({ children }) => {
  const [models, setModels] = useState<Map<string, DataModel>>(new Map());
  const modelsContextData = useMemo(() => [
    models,
    setModels,
  ] as [
    Map<string, DataModel>,
    (updateFn: (oldDataModels: Map<string, DataModel>) => Map<string, DataModel>) => void,
  ], [models, setModels]);

  return (
    <DataModelsContext.Provider value={modelsContextData}>
      {children}
    </DataModelsContext.Provider>
  );
};

type DataModelProps<I = BaseItem> = Omit<DataModel<I>, "fields"> & { name: string, children: React.ReactNode };

export const DataModel = <I = BaseItem, F = BaseFieldName>(props: DataModelProps<I>) => {
  const dataModelsContextData = useContext(DataModelsContext);
  if (!dataModelsContextData) {
    throw new Error('Error: <DataModel ... /> was not rendered inside of a container component! Try rendering this inside of a <DataModels> ... </DataModels>.');
  }

  // NOTE: the DataModelsContext stores a heterogeneous of `DataModel<..., ...>` entries in an array
  // However, downstream stuff expects a `DataModel<I, F>` - so cast it explicitly below
  const [dataModel, setDataModel] = useMemo(() => {
    const [dataModels, setDataModels] = dataModelsContextData;

    return [
      (dataModels.get(props.name) as any) as DataModel<I, F>,
      (updateFn: (old: DataModel<I, F> | null) => DataModel<I, F> | null) => {
        setDataModels(old => {
          const copy = new Map(old);
          const dataModel = ((copy.get(props.name) as any) as DataModel<I, F> | undefined)
          const result = (updateFn(dataModel || null) as any) as DataModel;
          if (result) {
            copy.set(props.name, result);
            return copy;
          } else {
            return old;
          }
        });
      },
    ];
  }, [dataModelsContextData, props.name]);

  useEffect(() => {
    setDataModel((old) => {
      const base = {
        singularDisplayName: props.singularDisplayName,
        pluralDisplayName: props.pluralDisplayName,
        fetchPageOfData: props.fetchPageOfData,
        fetchItem: props.fetchItem,
        createItem: props.createItem,
        updateItem: props.updateItem,
        deleteItem: props.deleteItem,
        listLink: props.listLink,
        keyGenerator: props.keyGenerator,
        detailLinkGenerator: props.detailLinkGenerator,
        createLink: props.createLink,
      };

      if (old) {
        return { ...old, ...base };
      } else {
        return { ...base, fields: EMPTY_FIELD_COLLECTION };
      }
    });
  }, [
    props.singularDisplayName,
    props.pluralDisplayName,
    props.fetchPageOfData,
    props.fetchItem,
    props.createItem,
    props.updateItem,
    props.deleteItem,
    props.listLink,
    props.keyGenerator,
    props.detailLinkGenerator,
    props.createLink,
  ]);

  // NOTE: similarly to the above, `dataModel.fields` is Array<FieldMetadata<I, F>> but the data
  // that needs to be explosed down below doesn't have the generics because I can't figure out how
  // to make that work with a react context.
  const fieldsContextData = useMemo(
    () => ([
      dataModel ? dataModel.fields : EMPTY_FIELD_COLLECTION,
      (updateFn: (old: FieldsCollection<FieldMetadata<I, F>>) => FieldsCollection<FieldMetadata<I, F>>) => {
        setDataModel(old => {
          if (old) {
            return { ...old, fields: updateFn(old.fields) };
          } else {
            return null;
          }
        });
      },
    ] as any) as [
      Array<FieldMetadata>,
      (fields: (old: Array<FieldMetadata>) => Array<FieldMetadata>) => void,
    ],
    [dataModel, setDataModel]
  );

  return (
    <FieldsContext.Provider value={fieldsContextData}>
      {props.children}
    </FieldsContext.Provider>
  );
};

const SearchInput: React.FunctionComponent<{
  pluralDisplayName: string;
  value: string;
  onChange: (text: string) => void;
}> = ({ pluralDisplayName, value, onChange }) => {
  const [text, setText] = useState('');
  useEffect(() => {
    setText(value);
  }, [value]);

  return (
    <input
      className={styles.searchInput}
      type="text"
      placeholder={`Search ${pluralDisplayName}...`}
      value={text}
      onChange={e => setText(e.currentTarget.value)}
      onBlur={() => onChange(text)}
    />
  );
}


const FILTER_NOT_SET_YET = 'NOT SET YET';

export type Filter<S extends JSONValue = JSONValue> = {
  name: Array<string | 'NOT SET YET'>;
  isComplete: boolean;
  isValid: boolean;
  workingState: S | 'NOT SET YET';
  state: S | 'NOT SET YET';
};

export type Sort<F = BaseFieldName> = {
  fieldName: F;
  direction: 'asc' | 'desc';
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




const DataContext = React.createContext<
  | DataContextList
  | DataContextDetail
  | null
>(null);






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

type DataContextList<I = BaseItem, F = BaseFieldName> = {
  type: 'list';
  name: string;
  singularDisplayName: string;
  pluralDisplayName: string;

  listData: ListData<I>;
  onLoadNextPage: () => Promise<void>;

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

type ListData<T> =
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
  const dataModel = dataModelsContextData[0].get(name) as DataModel<I, BaseFieldName> | undefined;
  const singularDisplayName = props.singularDisplayName || dataModel?.singularDisplayName || '';
  const pluralDisplayName = props.pluralDisplayName || dataModel?.pluralDisplayName || '';
  const fetchPageOfData = props.fetchPageOfData || dataModel?.fetchPageOfData || null;
  const keyGenerator = props.keyGenerator || dataModel?.keyGenerator || null;
  const detailLinkGenerator = props.detailLinkGenerator || dataModel?.detailLinkGenerator || null;
  const createLink = props.createLink || dataModel?.createLink || null;


  const adminContextData = useContext(AdminContext);
  const stateCache = adminContextData?.stateCache;

  const [listData, setListData] = useState<ListData<I>>({ status: 'IDLE' });

  // When the component unmounts, terminate all in flight requests
  const inFlightRequestAbortControllers = useRef<Array<AbortController>>([]);
  const addInFlightAbortController = useCallback((abort: AbortController) => {
    inFlightRequestAbortControllers.current.push(abort);
  }, []);
  const removeInFlightAbortController = useCallback((abort: AbortController) => {
    inFlightRequestAbortControllers.current = inFlightRequestAbortControllers.current.filter(c => c !== abort);
  }, []);
  useEffect(() => {
    return () => {
      for (const abortController of inFlightRequestAbortControllers.current) {
        abortController.abort();
      }
    };
  }, []);

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

  const dataContextData: DataContextList<I, BaseFieldName> | null = useMemo(() => {
    if (!keyGenerator) {
      return null;
    }

    return {
      type: 'list' as const,
      name,
      singularDisplayName,
      pluralDisplayName,
      listData,

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
      onLoadNextPage,
    };
  }, [
    name,
    singularDisplayName,
    pluralDisplayName,
    listData,
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
    onLoadNextPage,
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











const FieldsContext = React.createContext<[
  FieldCollection,
  (fields: (old: FieldCollection<FieldMetadata>) => FieldCollection<FieldMetadata>) => void,
] | null>(null);

type FieldCollection<M = FieldMetadata<BaseItem, BaseFieldName, BaseFieldState>> = {
  names: Array<FieldMetadata['name']>,
  metadata: Array<M>,
};
const EMPTY_FIELD_COLLECTION: FieldCollection = { names: [], metadata: [] };

type FieldMetadata<I = BaseItem, F = BaseFieldName, S = BaseFieldState> = {
  name: F;
  singularDisplayName: string;
  pluralDisplayName: string;

  sortable?: boolean;
  columnWidth?: string | number;

  // Serialize back and forth between the state (internal representation) and the item (external
  // representation)
  getInitialStateFromItem: (item: I) => S;
  injectAsyncDataIntoInitialStateOnDetailPage: (oldState: S, item: I, signal: AbortSignal) => Promise<S>;
  getInitialStateWhenCreating?: () => S | undefined;
  serializeStateToItem: (initialItem: Partial<I>, state: S) => Partial<I>;

  // When specified, these functions are called prior to `serializeStateToItem` and allows related
  // models to be saved to the database
  createSideEffect?: (item: Partial<I>, state: S, signal: AbortSignal) => Promise<S>;
  updateSideEffect?: (item: Partial<I>, state: S, signal: AbortSignal) => Promise<S>;

  // The presentation of the field when in a read only context
  displayMarkup: (state: S, item: I) => React.ReactNode;

  // The presentation of the component in a read-write context
  modifyMarkup?: (
    state: S,
    setState: (newState: S, blurAfterStateSet?: boolean) => void,
    item: I,
    onBlur: () => void, // Call onBlur once the user has completed editing the state
  ) => React.ReactNode;
};

/*
Example Field:
<Field<BattleWithParticipants, 'startedAt', string>
  name="startedAt"
  singularDisplayName="Started At"
  pluralDisplayName="Started Ats"
  columnWidth="200px"
  sortable
  getInitialStateFromItem={battle => Promise.resolve(battle.startedAt)}
  getInitialStateWhenCreating={() => ''}
  serializeStateToItem={(initialItem, state) => ({ ...initialItem, startedAt: state })}
  displayMarkup={state => <small>{state}</small>}
  modifyMarkup={(state, setState, item, onBlur) => <input type="text" value={state} onChange={e => setState(e.currentTarget.value)} onBlur={() => onBlur()} />}
/>
*/
export const Field = <I = BaseItem, F = BaseFieldName, S = BaseFieldState>(props: FieldMetadata<I, F, S>) => {
  const fieldsContextData = useContext(FieldsContext);
  if (!fieldsContextData) {
    throw new Error('Error: <Field ... /> was not rendered inside of a container component! Try rendering this inside of a <ListTable> ... </ListTable>.');
  }

  const [_fields, setFields] = fieldsContextData;

  useEffect(() => {
    const name = props.name as string;
    setFields(old => ({ ...old, names: [...old.names, name] }));
    return () => {
      setFields(old => ({ ...old, names: old.names.filter(n => n !== name) }));
    };
  }, [props.name]);

  useEffect(() => {
    const fieldMetadata: FieldMetadata<I, F, S> = {
      name: props.name,
      pluralDisplayName: props.pluralDisplayName,
      singularDisplayName: props.singularDisplayName,
      getInitialStateFromItem: props.getInitialStateFromItem,
      injectAsyncDataIntoInitialStateOnDetailPage: props.injectAsyncDataIntoInitialStateOnDetailPage,
      getInitialStateWhenCreating: props.getInitialStateWhenCreating,
      columnWidth: props.columnWidth,
      sortable: props.sortable,
      serializeStateToItem: props.serializeStateToItem,
      displayMarkup: props.displayMarkup,
      modifyMarkup: props.modifyMarkup,
    };

    // NOTE: convert FieldMetadata<I, F, S> into a generic `FieldMetadata` with base values so it
    // can be put into the field state
    const castedFieldMetadata = (fieldMetadata as any) as FieldMetadata<BaseItem, BaseFieldName, BaseFieldState>;

    setFields(old => ({...old, metadata: [ ...old.metadata, castedFieldMetadata ]}));

    return () => {
      setFields(old => ({ ...old, metadata: old.metadata.filter(f => f !== castedFieldMetadata) }));
    };
  }, [
    props.name,
    props.pluralDisplayName,
    props.singularDisplayName,
    props.columnWidth,
    props.sortable,
    props.getInitialStateFromItem,
    props.injectAsyncDataIntoInitialStateOnDetailPage,
    props.getInitialStateWhenCreating,
    props.serializeStateToItem,
    props.displayMarkup,
    props.modifyMarkup,
  ]);

  return null;
};

type InputFieldProps<
  Item = BaseItem,
  Field = BaseFieldName,
  Nullable = false,
  State = Nullable extends true ? (string | null) : string,
> = Pick<
  FieldMetadata<Item, Field, State>,
  | 'name'
  | 'singularDisplayName'
  | 'pluralDisplayName'
  | 'columnWidth'
  | 'sortable'
  | 'getInitialStateWhenCreating'
> & {
  getInitialStateFromItem?: (item: Item) => State;
  getInitialStateWhenCreating?: () => State | undefined;
  serializeStateToItem?: (initialItem: Partial<Item>, state: State) => Partial<Item>;

  type?: HTMLInputElement['type'];
  nullable?: Nullable;
  inputMarkup?: FieldMetadata<Item, Field, State>['modifyMarkup'];
};

/*
Example InputField:
<InputField<BattleWithParticipants, 'startedAt'>
  name="startedAt"
  singularDisplayName="Started At"
  pluralDisplayName="Started Ats"
  columnWidth="200px"
  sortable
/>
*/
export const InputField = <
  Item = BaseItem,
  Field = BaseFieldName,
  Nullable = false,
>(props: InputFieldProps<Item, Field, Nullable>) => {
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
      columnWidth={props.columnWidth}
      sortable={props.sortable}
      getInitialStateFromItem={getInitialStateFromItem}
      injectAsyncDataIntoInitialStateOnDetailPage={injectAsyncDataIntoInitialStateOnDetailPage}
      getInitialStateWhenCreating={props.getInitialStateWhenCreating || (() => '')}
      serializeStateToItem={props.serializeStateToItem || ((initialItem, state) => ({ ...initialItem, [props.name as FixMe]: state }))}
      displayMarkup={state => state === null ? <em style={{color: 'silver'}}>null</em> : <span>{state}</span>}
      modifyMarkup={(state, setState, item, onBlur) => {
        const input = props.inputMarkup ? props.inputMarkup(state, setState, item, onBlur) : (
          <input
            ref={inputRef}
            type={props.type || "text"}
            value={state === null ? '' : `${state}`}
            disabled={state === null}
            onChange={e => setState(e.currentTarget.value)}
            onBlur={() => onBlur()}
          />
        );

        if (props.nullable) {
          return (
            <div style={{display: 'inline-flex', gap: 8, alignItems: 'center'}}>
              <div style={{display: 'flex', gap: 4, alignItems: 'center'}}>
                <input
                  type="radio"
                  checked={state !== null}
                  onChange={e => {
                    if (e.currentTarget.checked) {
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
                <input
                  type="radio"
                  checked={state === null}
                  id={`${props.name}-null`}
                  onChange={e => {
                    if (e.currentTarget.checked) {
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
    />
  );
};


type ChoiceFieldProps<I = BaseItem, F = BaseFieldName, S = BaseFieldState> = Pick<
  FieldMetadata<I, F, S>,
  | 'name'
  | 'singularDisplayName'
  | 'pluralDisplayName'
  | 'columnWidth'
  | 'sortable'
  | 'getInitialStateWhenCreating'
> & {
  getInitialStateFromItem?: (item: I) => S;
  serializeStateToItem?: (initialItem: Partial<I>, state: S) => Partial<I>;
  choices: Array<{id: S; disabled?: boolean; label: React.ReactNode }>;

  nullable?: boolean;
  displayMarkup?: FieldMetadata<I, F, S>['displayMarkup'];
  inputMarkup?: FieldMetadata<I, F, S>['modifyMarkup'];
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
  const getInitialStateFromItem = useMemo(() => {
    return props.getInitialStateFromItem || ((item: I) => `${(item as FixMe)[props.name as FixMe]}` as S);
  }, [props.getInitialStateFromItem, props.name]);

  const injectAsyncDataIntoInitialStateOnDetailPage = useCallback((state: S) => Promise.resolve(state), []);

  return (
    <Field<I, F, S>
      name={props.name}
      singularDisplayName={props.singularDisplayName}
      pluralDisplayName={props.pluralDisplayName}
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

        return (
          <select
            style={{minWidth: 100}}
            value={`${state}`}
            onChange={e => {
              const value = e.currentTarget.value as S;
              setState(value === 'NULL' ? null : value);
            }}
            onBlur={() => onBlur()}
          >
            {props.nullable ? (
              <option value="NULL">null</option>
            ) : null}
            {props.choices.map(choice => (
              <option
                key={`${choice.id}`}
                value={`${choice.id}`}
                disabled={choice.disabled || false}
              >
                {choice.label}
              </option>
            ))}
          </select>
        );
      }}
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
    />
  );
};


type SingleForeignKeyFieldProps<I = BaseItem, F = BaseFieldName, J = BaseItem> = Pick<
  FieldMetadata<I, F, J>,
  | 'name'
  | 'singularDisplayName'
  | 'pluralDisplayName'
  | 'columnWidth'
  | 'sortable'
  | 'getInitialStateWhenCreating'
> & {
  getInitialStateFromItem?: (item: I) => J;
  injectAsyncDataIntoInitialStateOnDetailPage?: (oldState: J, item: I, signal: AbortSignal) => Promise<J>;
  getInitialStateWhenCreating?: () => J | undefined;
  serializeStateToItem?: (initialItem: Partial<I>, state: J) => Partial<I>;

  nullable?: boolean;
  relatedName: string;
  getRelatedKey?: (relatedItem: J) => ItemKey;

  fetchPageOfRelatedData?: (page: number, item: I, abort: AbortSignal) => Promise<Paginated<J>>;
  generateNewRelatedItem: () => J;
  createRelatedItem: (item: Partial<I>, relatedItem: Partial<J>) => Promise<J>;
  updateRelatedItem: (item: Partial<I>, relatedItem: Partial<J>) => Promise<J>;

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
  const relatedDataModel = dataModelsContextData[0].get(props.relatedName) as DataModel<J, F> | undefined;

  const singularDisplayName = props.singularDisplayName || relatedDataModel?.singularDisplayName || '';
  const pluralDisplayName = props.pluralDisplayName || relatedDataModel?.pluralDisplayName || '';
  const getRelatedKey = props.getRelatedKey || relatedDataModel?.keyGenerator;

  const getInitialStateFromItem = useMemo(() => {
    return props.getInitialStateFromItem || ((item: I) => (item as FixMe)[props.name as FixMe] as J)
  }, [props.getInitialStateFromItem, props.name]);

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
    state: J,
    setState: (newState: J, blurAfterStateSet?: boolean) => void,
    item: I,
    onBlur: () => void,
  ) => {
    const relatedFields = state !== null ? (
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
    ) : null;

    if (props.nullable) {
      return (
        <div>
          <div style={{display: 'inline-flex', gap: 8, alignItems: 'center'}}>
            <div style={{display: 'flex', gap: 4, alignItems: 'center'}}>
              <input
                type="radio"
                checked={state !== null}
                id={`${props.name}-value`}
                onChange={e => {
                  if (e.currentTarget.checked) {
                    setState(props.generateNewRelatedItem());
                  }
                }}
              />
              <label htmlFor={`${props.name}-value`}>Value</label>
            </div>
            <div style={{display: 'flex', gap: 4, alignItems: 'center'}}>
              <input
                type="radio"
                checked={state === null}
                id={`${props.name}-null`}
                onChange={e => {
                  if (e.currentTarget.checked) {
                    setState(null);
                  }
                }}
              />
              <label htmlFor={`${props.name}-null`}>null</label>
            </div>
          </div>
          {relatedFields}
        </div>
      );
    } else {
      return relatedFields;
    }
  }, [props]);

  return (
    <Field<I, F, J>
      name={props.name}
      singularDisplayName={singularDisplayName}
      pluralDisplayName={pluralDisplayName}
      columnWidth={props.columnWidth}
      sortable={props.sortable}
      getInitialStateFromItem={getInitialStateFromItem}
      injectAsyncDataIntoInitialStateOnDetailPage={injectAsyncDataIntoInitialStateOnDetailPage}
      getInitialStateWhenCreating={props.getInitialStateWhenCreating}
      serializeStateToItem={serializeStateToItem}
      // createSideEffect={props.createRelatedItem}
      // updateSideEffect={props.updateRelatedItem}
      displayMarkup={displayMarkup}
      modifyMarkup={modifyMarkup}
    />
  );
};

type MultiForeignKeyFieldProps<I = BaseItem, F = BaseFieldName, J = BaseItem> = Pick<
  FieldMetadata<I, F, J>,
  | 'name'
  | 'singularDisplayName'
  | 'pluralDisplayName'
  | 'columnWidth'
  | 'sortable'
  | 'getInitialStateWhenCreating'
> & {
  getInitialStateFromItem?: (item: I) => Array<J>;
  injectAsyncDataIntoInitialStateOnDetailPage?: (oldState: Array<J>, item: I, signal: AbortSignal) => Promise<Array<J>>;
  getInitialStateWhenCreating?: () => Array<J> | undefined;
  serializeStateToItem?: (initialItem: Partial<I>, state: Array<J>) => Partial<I>;

  relatedName: string;
  getRelatedKey?: (relatedItem: J) => ItemKey;

  fetchPageOfRelatedData?: (page: number, item: I, abort: AbortSignal) => Promise<Paginated<J>>;
  createRelatedItem: (item: I, relatedItem: Partial<J>) => Promise<J>;
  updateRelatedItem: (item: I, relatedItem: Partial<J>) => Promise<J>;

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

  const injectAsyncDataIntoInitialStateOnDetailPage = useMemo(() => {
    return props.injectAsyncDataIntoInitialStateOnDetailPage || ((state: Array<J>) => Promise.resolve(state));
  }, [props.injectAsyncDataIntoInitialStateOnDetailPage, props.name]);

  return (
    <Field<I, F, Array<J>>
      name={props.name}
      singularDisplayName={props.singularDisplayName}
      pluralDisplayName={props.pluralDisplayName}
      columnWidth={props.columnWidth}
      sortable={props.sortable}
      getInitialStateFromItem={getInitialStateFromItem}
      injectAsyncDataIntoInitialStateOnDetailPage={injectAsyncDataIntoInitialStateOnDetailPage}
      getInitialStateWhenCreating={props.getInitialStateWhenCreating}
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
    relatedItem: J,
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
  const relatedDataModel = dataModelsContextData[0].get(props.foreignKeyFieldProps.relatedName) as DataModel<J, F> | undefined;

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

  // When the component unmounts, terminate all in flight requests
  const inFlightRequestAbortControllers = useRef<Array<AbortController>>([]);
  const addInFlightAbortController = useCallback((abort: AbortController) => {
    inFlightRequestAbortControllers.current.push(abort);
  }, []);
  const removeInFlightAbortController = useCallback((abort: AbortController) => {
    inFlightRequestAbortControllers.current = inFlightRequestAbortControllers.current.filter(c => c !== abort);
  }, []);

  useEffect(() => {
    return () => {
      for (const abortController of inFlightRequestAbortControllers.current) {
        abortController.abort();
      }
    };
  }, []);

  const [initialRelatedItem] = useState(props.mode === "detail" ? props.relatedItem : null);
  const [initialRelatedItems] = useState(props.mode === "list" ? props.relatedItems : null);


  const [itemSelectionMode, setItemSelectionMode] = useState<'none' | 'select' | 'create'>('none');

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

  const [
    [relatedFieldsSource, relatedFields],
    setRelatedFields,
  ] = useState<["idle" | "children" | "datamodel", FieldCollection<FieldMetadata<J, F>>]>(["idle", EMPTY_FIELD_COLLECTION]);
  useEffect(() => {
    if (!relatedDataModel) {
      return;
    }
    if (relatedFieldsSource === "children") {
      return;
    }

    setRelatedFields(["datamodel", relatedDataModel.fields]);
  }, [relatedDataModel]);

  const relatedFieldsContextData = useMemo(
    () => [
      (relatedFields as any) as FieldCollection<FieldMetadata<BaseItem, BaseFieldName, BaseFieldState>>,
      ((updateFn) => setRelatedFields(
        (old) => ["children" as const, updateFn(old[1])] as ["children", FieldCollection<FieldMetadata<J, F>>]
      ) as any) as (fields: (old: FieldCollection<FieldMetadata>) => FieldCollection<FieldMetadata>) => void,
    ] as [
      FieldCollection<FieldMetadata>,
      (fields: (old: FieldCollection<FieldMetadata>) => FieldCollection<FieldMetadata>) => void,
    ],
    [relatedFields, setRelatedFields]
  );

  // Allow a custom set of fields to be defined in the creation form. If these fields aren't
  // defined, then use the fields defined for the table for the creation form.
  const [
    relatedCreationFieldsOverride,
    setRelatedCreationFieldsOverride
  ] = useState<FieldCollection<FieldMetadata<J, F>>>(EMPTY_FIELD_COLLECTION);
  const relatedCreationFieldsContextData = useMemo(
    () => [
      (relatedCreationFieldsOverride as any) as FieldCollection<FieldMetadata<BaseItem, BaseFieldName, BaseFieldState>>,
      (setRelatedCreationFieldsOverride as any) as (fields: (old: FieldCollection<FieldMetadata>) => FieldCollection<FieldMetadata>) => void,
    ] as [
      FieldCollection<FieldMetadata>,
      (fields: (old: FieldCollection<FieldMetadata>) => FieldCollection<FieldMetadata>) => void,
    ],
    [relatedFields, setRelatedFields]
  );
  const relatedCreationFields = relatedCreationFieldsOverride.names.length > 0 ? relatedCreationFieldsOverride : relatedFields;

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
      let rows = props.mode === 'list' ? props.relatedItems : [props.relatedItem];
      let rowKeys = rows.map(row => getRelatedKey(row));

      // Pin the initial related item to the top of the list
      //
      // This doesn't just pin the currently related item, it pins the initial,
      // because the initial won't change.
      if (props.mode === 'list' && initialRelatedItems) {
        if (itemSelectionMode === 'select') {
          rows = relatedData.data;
          rowKeys = rows.map(row => getRelatedKey(row));
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
      } else if (props.mode === 'detail' && initialRelatedItem) {
        if (itemSelectionMode === 'select') {
          rows = relatedData.data;
          rowKeys = rows.map(row => getRelatedKey(row));
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

      return (
        <div style={{ border: '1px solid silver', padding: 2 }}>
          {relatedFields.names.length === 0 ? (
            <em style={{color: gray.gray9}}>
              No {props.foreignKeyFieldProps.singularDisplayName.toLowerCase()} fields specified
            </em>
          ) : (
            <div style={{overflowY: 'auto'}}>
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
                      props.relatedItems.find(i => getRelatedKey(i) === key)
                    ) : getRelatedKey(props.relatedItem) === key);

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
            </div>
          )}
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

              <button onClick={() => setItemSelectionMode('none')}>Hide</button>
              <button onClick={() => setItemSelectionMode('create')}>Create New...</button>
            </Fragment>
          ) : null}
          {itemSelectionMode === 'create' ? (
            <Fragment>
              <span>Create new {props.foreignKeyFieldProps.singularDisplayName}</span>

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

              <button onClick={() => setItemSelectionMode('none')}>Cancel</button>
              <button onClick={async () => {
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
              }}>Create</button>
            </Fragment>
          ) : null}
          {itemSelectionMode === 'none' ? (
            <Fragment>
              <button onClick={() => setItemSelectionMode('select')}>Show More...</button>
              <button onClick={() => setItemSelectionMode('create')}>Create New...</button>
            </Fragment>
          ) : null}

          {/* The children should not render anything, this should purely be Fields for the related items */}
          <FieldsContext.Provider value={relatedFieldsContextData}>
            {props.children}
          </FieldsContext.Provider>

          {/* The creationFields should not render anything, this should purely be Fields for creating the related item */}
          <FieldsContext.Provider value={relatedCreationFieldsContextData}>
            {props.foreignKeyFieldProps.creationFields}
          </FieldsContext.Provider>
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
  return (
    <tr>
      {checkable ? (
        <td
          className={styles.floatingCheckbox}
          onClick={e => onChangeChecked(
            !checked,
            (e.nativeEvent as FixMe).shiftKey
          )}
        >
          <input
            style={{cursor: 'pointer'}}
            type={checkType}
            checked={checked}
            onClick={e => e.stopPropagation()}
            onChange={e => onChangeChecked(
              e.currentTarget.checked,
              (e.nativeEvent as FixMe).shiftKey
            )}
          />
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
            <NavigationButton navigatable={detailLink}>Details...</NavigationButton>
          </td>
          <td className={styles.floatingDetails}>
            <NavigationButton navigatable={detailLink}>Details...</NavigationButton>
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
      <div className={styles.listActionBar}>
        <span>{numberOfCheckedItems} {numberOfCheckedItems === 1 ? listDataContextData.singularDisplayName : listDataContextData.pluralDisplayName}</span>
        <button onClick={() => listDataContextData.onChangeCheckedItemKeys([])}>Deselect</button>
        |
        {listDataContextData.checkedItemKeys === ALL_ITEMS ? (
          children(ALL_ITEMS)
        ) : children(
          listDataContextData.listData.data.filter((item) => {
            const key = listDataContextData.keyGenerator(item)
            return listDataContextData.checkedItemKeys.includes(key);
          })
        )}
      </div>

      {/* If enabled, give the user the ability to be able to select all pages of data that match the query */}
      {canSelectAllAcrossPages && (areAllInMemoryItemsChecked || listDataContextData.checkedItemKeys === ALL_ITEMS) ? (
        <Fragment>
          {areAllInMemoryItemsChecked ? (
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
          ) : null}
          {listDataContextData.checkedItemKeys === ALL_ITEMS ? (
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
          ) : null}
        </Fragment>
      ) : null}
    </Fragment>
  );
};








const FilterMetadataContext = React.createContext<[
  Array<FilterMetadata>,
  (filters: (old: Array<FilterMetadata>) => Array<FilterMetadata>) => void,
] | null>(null);

type FilterMetadata<S extends JSONValue = JSONValue> = {
  name: Array<string>;
  getInitialState: () => S;
  onIsValid: (state: S) => boolean;
  onIsComplete: (state: S) => boolean;
  serialize?: (state: S) => string;
  deserialize?: (raw: string) => S
  children: (
    state: S,
    setState: (newState: S) => void,
    filter: Filter<S>,
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
      <button
        key={name}
        onClick={() => listDataContextData.onChangeFilters(filterPresetCallback(listDataContextData.filters))}
      >{name}</button>
    );
  });

  return (
    <div className={styles.listFilterBar}>
      <div className={styles.listFilterBarFilters}>
        {listDataContextData.filters.length > 0 ? (
          <Fragment>
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
              if (!metadata) {
                return null;
              }

              return (
                <div key={filterIndex} style={{display: 'flex', gap: 4}}>
                  {filter.name.map((entry, entryIndex) => (
                    <select
                      value={entry}
                      key={entryIndex}
                      onChange={e => {
                        // Given the adjustment in filter name, figure out what the new filter name
                        // would be
                        const newFilterNamePrefix = filter.name.slice(0, entryIndex);
                        newFilterNamePrefix[entryIndex] = e.currentTarget.value;

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
                    >
                      <option value={FILTER_NOT_SET_YET} disabled>Pick filter...</option>
                      {getPeerOptionsForFilterPath(filter.name.slice(0, entryIndex+1)).map(choice => (
                        <option value={choice} key={choice}>{choice}</option>
                      ))}
                    </select>
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
                  <button onClick={() => {
                    listDataContextData.onChangeFilters(
                      listDataContextData.filters.filter((_f, i) => i !== filterIndex)
                    );
                  }}>&times;</button>
                </div>
              );
            })}
          </Fragment>
        ) : null}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
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
          >Add filter</button>
          |
          {filterPresetButtons.length === 0 ? <small style={{color: 'silver', marginTop: 3}}>No presets</small> : filterPresetButtons}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        {addable && listDataContextData.createLink ? (
          <NavigationButton navigatable={listDataContextData.createLink}>
            &#65291; Add {listDataContextData.singularDisplayName}
          </NavigationButton>
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

      {/* The children should not render anything, this should purely be Filters */}
      {children}
    </div>
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
                  <input
                    type="checkbox"
                    style={{cursor: 'pointer'}}
                    disabled={!childrenContainsItems}
                    checked={allChecked}
                    onClick={e => e.stopPropagation()}
                    onChange={e => {
                      if (listDataContextData.listData.status !== 'COMPLETE') {
                        return;
                      }

                      if (e.currentTarget.checked) {
                        const keys = listDataContextData.listData.data.map(item => listDataContextData.keyGenerator(item));
                        listDataContextData.onChangeCheckedItemKeys(keys);
                      } else {
                        listDataContextData.onChangeCheckedItemKeys([]);
                      }
                    }}
                  />
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
              {columnSets && renderColumnSetSelector ? (
                <th className={styles.floatingColumnSetSelectorWrapper}>
                  {renderColumnSetSelector({
                    fields,
                    columnSets,
                    columnSet: listDataContextData.columnSet,
                    onChangeColumnSet: listDataContextData.onChangeColumnSet,
                  })}
                </th>
              ) : null}
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
  const listDataContextData = dataContext as DataContextList<I, F>;

  // Then get the data model context data
  const dataModelsContextData = useContext(DataModelsContext);
  if (!dataModelsContextData) {
    throw new Error('Error: <ListTable ... /> was not rendered inside of a container component! Try rendering this inside of a <DataModels> ... </DataModels>.');
  }
  const dataModel = dataModelsContextData[0].get(listDataContextData.name) as DataModel<I, F> | undefined;
  if (!dataModel) {
    throw new Error(`Error: <ListTable ... /> cannot find data model with name ${listDataContextData.name}!`);
  }

  const [
    [fieldsSource, fields],
    setFields,
  ] = useState<["idle" | "children" | "datamodel", FieldCollection<FieldMetadata<I, F>>]>(["idle", EMPTY_FIELD_COLLECTION]);
  useEffect(() => {
    if (!dataModel) {
      return;
    }
    if (fieldsSource === "children") {
      return;
    }

    setFields(["datamodel", dataModel.fields]);
  }, [dataModel]);

  const fieldsContextData = useMemo(
    () => [
      (fields as any) as FieldCollection<FieldMetadata<BaseItem, BaseFieldName, BaseFieldState>>,
      ((updateFn) => setFields(
        (old) => ["children" as const, updateFn(old[1])] as ["children", FieldCollection<FieldMetadata<I, F>>]
      ) as any) as (fields: (old: FieldCollection<FieldMetadata>) => FieldCollection<FieldMetadata>) => void,
    ] as [
      FieldCollection<FieldMetadata>,
      (fields: (old: FieldCollection<FieldMetadata>) => FieldCollection<FieldMetadata>) => void,
    ],
    [fields, setFields]
  );

  // Convert the column set into the columns to render in the table
  let visibleFieldNames: Array<F> = [];
  if (listDataContextData.columnSet === 'all') {
    visibleFieldNames = fields.names as Array<F>;
  } else if (Array.isArray(listDataContextData.columnSet)) {
    // A manual list of fields
    visibleFieldNames = listDataContextData.columnSet as Array<F>;
  } else {
    const columns = columnSets[listDataContextData.columnSet];
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
                    detailLink: listDataContextData.detailLinkGenerator ? listDataContextData.detailLinkGenerator(item) : null,
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
    <FieldsContext.Provider value={fieldsContextData}>
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
    </FieldsContext.Provider>
  );
};






export const ListColumnSetSelector = <I = BaseItem, F = BaseFieldName>(props: {
  fields: FieldCollection<FieldMetadata<I, F>>;
  columnSets: { [name: string]: Array<F> }
  columnSet: 'all' | string | Array<F>;
  onChangeColumnSet: (newColumnSet: 'all' | string | Array<F>) => void;
}) => {
  const [open, setOpen] = useState(false);

  // const 

  return (
    <Fragment>
      <button style={{width: 24, height: 24}} onClick={() => setOpen(!open)}>&#9707;</button>
      {open ? createPortal(
        (
          <div className={styles.listColumnSetModalBackdrop}>
            <div className={styles.listColumnSetModal}>
              <div className={styles.listColumnSetModalHeader}>
                <span>Column Sets</span>
                <button style={{width: 24, height: 24}} onClick={() => setOpen(false)}>x</button>
              </div>

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
        ),
        document.body
      ) : null}
    </Fragment>
  );
};











type DataContextDetail<I = BaseItem> = {
  type: 'detail';
  itemKey: ItemKey | null;

  isCreating: boolean;

  name: string;
  singularDisplayName: string;
  pluralDisplayName: string;

  detailData: DetailData<I>;

  createItem: ((createData: Partial<I>, abort: AbortSignal) => Promise<I>) | null;
  updateItem: ((itemKey: ItemKey, updateData: I, abort: AbortSignal) => Promise<void>) | null;
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
  const dataModel = dataModelsContextData[0].get(name) as DataModel<I, BaseFieldName> | undefined;
  const singularDisplayName = props.singularDisplayName || dataModel?.singularDisplayName || '';
  const pluralDisplayName = props.pluralDisplayName || dataModel?.pluralDisplayName || '';
  const fetchItem = props.fetchItem || dataModel?.fetchItem || null;
  const createItem = props.createItem || dataModel?.createItem || null;
  const updateItem = props.updateItem || dataModel?.updateItem || null;
  const deleteItem = props.deleteItem || dataModel?.deleteItem || null;
  const detailLinkGenerator = props.detailLinkGenerator || dataModel?.detailLinkGenerator || null;
  const listLink = props.listLink || dataModel?.listLink || null;

  const [detailData, setDetailData] = useState<DetailData<I>>({ status: 'IDLE' });

  // When the component unmounts, terminate all in flight requests
  const inFlightRequestAbortControllers = useRef<Array<AbortController>>([]);
  const addInFlightAbortController = useCallback((abort: AbortController) => {
    inFlightRequestAbortControllers.current.push(abort);
  }, []);
  const removeInFlightAbortController = useCallback((abort: AbortController) => {
    inFlightRequestAbortControllers.current = inFlightRequestAbortControllers.current.filter(c => c !== abort);
  }, []);
  useEffect(() => {
    return () => {
      for (const abortController of inFlightRequestAbortControllers.current) {
        abortController.abort();
      }
    };
  }, []);


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
      <div>
        <strong>{field.singularDisplayName}</strong>: {field.modifyMarkup(
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

  // Then get the data model context data
  const dataModelsContextData = useContext(DataModelsContext);
  if (!dataModelsContextData) {
    throw new Error('Error: <DetailFields ... /> was not rendered inside of a container component! Try rendering this inside of a <Detail> ... </Detail> component.');
  }
  const dataModel = dataModelsContextData[0].get(detailDataContextData.name) as DataModel<I, BaseFieldName> | undefined;
  if (!dataModel) {
    throw new Error(`Error: <DetailFields ... /> cannot find data model with name ${detailDataContextData.name}!`);
  }

  // When the component unmounts, terminate all in flight requests
  const inFlightRequestAbortControllers = useRef<Array<AbortController>>([]);
  const addInFlightAbortController = useCallback((abort: AbortController) => {
    inFlightRequestAbortControllers.current.push(abort);
  }, []);
  const removeInFlightAbortController = useCallback((abort: AbortController) => {
    inFlightRequestAbortControllers.current = inFlightRequestAbortControllers.current.filter(c => c !== abort);
  }, []);
  useEffect(() => {
    return () => {
      for (const abortController of inFlightRequestAbortControllers.current) {
        abortController.abort();
      }
    };
  }, []);

  const [
    [fieldsSource, fields],
    setFields,
] = useState<["idle" | "children" | "datamodel", FieldCollection<FieldMetadata<I, F>>]>(["idle", EMPTY_FIELD_COLLECTION]);
  useEffect(() => {
    if (!dataModel) {
      return;
    }
    if (fieldsSource === "children") {
      return;
    }

    setFields(["datamodel", dataModel.fields]);
  }, [dataModel]);

  const fieldsContextData = useMemo(
    () => [
      (fields as any) as FieldCollection<FieldMetadata<BaseItem, BaseFieldName, BaseFieldState>>,
      ((updateFn) => setFields(
        (old) => ["children" as const, updateFn(old[1])] as ["children", FieldCollection<FieldMetadata<I, F>>]
      ) as any) as (fields: (old: FieldCollection<FieldMetadata>) => FieldCollection<FieldMetadata>) => void,
    ] as [
      FieldCollection<FieldMetadata>,
      (fields: (old: FieldCollection<FieldMetadata>) => FieldCollection<FieldMetadata>) => void,
    ],
    [fields, setFields]
  );

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
        return [
          field.name,
          field.getInitialStateWhenCreating ? field.getInitialStateWhenCreating() : undefined,
        ] as [F, BaseFieldState | undefined];
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
            <div key={field.name as string}>
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
            </div>
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
                    <div key={field.name as string}>
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
                    </div>
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
    <FieldsContext.Provider value={fieldsContextData}>
      <div className={styles.detailHeader}>
        <NavigationButton navigatable={detailDataContextData.listLink}>&larr; Back</NavigationButton>
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
      </div>

      {renderFieldsWrapper({
        detailDataContextData,
        children: detailFieldsChildren,
      })}

      {/* The children should not render anything, this should purely be Fields */}
      {children}

      {detailDataContextData.isCreating ? (
        <div className={styles.detailActions}>
          <button
            disabled={!detailDataContextData.createItem}
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

              try {
                await detailDataContextData.createItem(item, abortController.signal);
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
              imperativelyNavigateToNavigatable(detailDataContextData.detailLinkGenerator(item as I));
            }}
          >Create</button>
        </div>
      ) : (
        <div className={styles.detailActions}>
          <button
            disabled={detailDataContextData.detailData.status !== 'COMPLETE' || !detailDataContextData.updateItem}
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
            }}
          >Update</button>
          <button
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
              imperativelyNavigateToNavigatable(detailDataContextData.listLink);
            }}
          >Delete</button>
        </div>
      )}
    </FieldsContext.Provider>
  );
};
