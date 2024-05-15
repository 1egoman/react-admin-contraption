import { useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  FixMe,
  JSONValue,
  BaseItem,
  BaseFieldName,
  ItemKey,
  CheckedItemKeys,
  Paginated,
  Filter,
  Sort,
} from '../types';
import { DataModel, DataModelsContext } from '../datamodel';
import { DataContextProvider } from '../data-context';
import { useAdminContext } from '../admin-context';
import useInFlightAbortControllers from "../utils/use-in-flight-abort-controllers";
import { FilterMetadataContext, FilterMetadata } from '../filter-definitions';
import Navigatable from '../navigatable';

import styles from '../styles.module.css';

export type DataContextList<Item = BaseItem, FieldName = BaseFieldName> = {
  type: 'list';
  name: string;
  singularDisplayName: string;
  pluralDisplayName: string;

  listData: ListData<Item>;
  onLoadNextPage: () => Promise<void>;
  fetchListDataFromServer: (signal: AbortSignal) => Promise<Array<Item>>;

  checkable: boolean;
  checkedItemKeys: CheckedItemKeys;
  onChangeCheckedItemKeys: (keys: CheckedItemKeys) => void;

  filters: Array<Filter>;
  onChangeFilters: (newFilters: Array<Filter>) => void;

  sort: Sort | null;
  onChangeSort: (newSort: Sort | null) => void;

  searchText: string;
  onChangeSearchText: (newSearchText: string) => void;

  columnSet: 'all' | string | Array<FieldName>;
  onChangeColumnSet: (newColumnSet: 'all' | string | Array<FieldName>) => void;

  keyGenerator: (item: Item) => ItemKey;
  detailLinkGenerator: null | ((item: Item) => Navigatable);

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

type ListProps<Item = BaseItem> = {
  name: string;

  checkable?: boolean;
  children?: React.ReactNode;
} & Partial<Pick<
  DataModel<Item>,
  | "singularDisplayName"
  | "pluralDisplayName"
  | "fetchPageOfData"
  | "keyGenerator"
  | "detailLinkGenerator"
  | "createLink"
>>;

const List = <Item = BaseItem>(props: ListProps<Item>) => {
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
  const dataModel = dataModelsContextData[0].get(name) as DataModel<Item> | undefined;
  const singularDisplayName = props.singularDisplayName || dataModel?.singularDisplayName || '';
  const pluralDisplayName = props.pluralDisplayName || dataModel?.pluralDisplayName || '';
  const fetchPageOfData = props.fetchPageOfData || dataModel?.fetchPageOfData || null;
  const keyGenerator = props.keyGenerator || dataModel?.keyGenerator || null;
  const detailLinkGenerator = props.detailLinkGenerator || dataModel?.detailLinkGenerator || null;
  const createLink = props.createLink || dataModel?.createLink || null;


  const adminContextData = useAdminContext();
  const stateCache = adminContextData?.stateCache;

  const [listData, setListData] = useState<ListData<Item>>({ status: 'IDLE' });

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
      let result: Paginated<Item>;
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

    let result: Paginated<Item>;
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

  const fetchListDataFromServer = useMemo(() => {
    if (!fetchPageOfData) {
      return null;
    }

    return (signal: AbortSignal) => {
      const recurse = (page: number): Promise<Array<Item>> => {
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

  const dataContextData: DataContextList<Item, BaseFieldName> | null = useMemo(() => {
    if (!keyGenerator) {
      return null;
    }
    if (!fetchListDataFromServer) {
      return null;
    }

    return {
      type: 'list' as const,
      name,
      singularDisplayName,
      pluralDisplayName,

      listData,
      onLoadNextPage,
      fetchListDataFromServer,

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
    listData,
    onLoadNextPage,
    fetchListDataFromServer,
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
    <DataContextProvider<Item> value={dataContextData}>
      <FilterMetadataContext.Provider value={filterMetadataContextData}>
        <div className={styles.list}>
          {children}
        </div>
      </FilterMetadataContext.Provider>
    </DataContextProvider>
  );
};

export default List;
