import * as React from 'react';
import { Fragment, useMemo, useContext, useCallback, useEffect, useState } from 'react';
import { gray } from '@radix-ui/colors';

import {
  FixMe,
  BaseItem,
  BaseFieldName,
  BaseFieldState,
  ItemKey,
  Paginated,
  Filter,
  Sort,
  ForeignKeyUnset,
  ForeignKeyFullItem,
  ForeignKeyKeyOnlyItem,
} from '../types';
import { DataModel, DataModelsContext } from '../datamodel';
import Field, { FieldMetadata, NullableWrapper, EMPTY_FIELD_COLLECTION } from '../fields';
import useInFlightAbortControllers from '../utils/use-in-flight-abort-controllers';
import { useControls } from '../controls';
import { FieldsProvider, FieldCollection } from '../fields';
import { DetailFieldItem } from '../detail/fields';
import { ListTableItem } from '../list/table';
import ManuallyStickyTHead from '../utils/ManuallyStickyTHead';
import { SearchInput } from '../list/filter-bar';
import { ListData } from '../list';

import { MultiForeignKeyFieldProps } from './MultiForeignKeyField';

import styles from "../styles.module.css";
import Navigatable, { injectReturnToQueryParamIntoNavigatable } from '../navigatable';

type SingleForeignKeyFieldProps<
  Item = BaseItem,
  FieldName = BaseFieldName,
  RelatedItem = BaseItem,
  Nullable = false,
> = Pick<
  FieldMetadata<
    Item,
    FieldName,
    ForeignKeyKeyOnlyItem | ForeignKeyFullItem<RelatedItem> | (Nullable extends true ? ForeignKeyUnset | null : ForeignKeyUnset)
  >,
  | 'name'
  | 'singularDisplayName'
  | 'pluralDisplayName'
  | 'csvExportColumnName'
  | 'columnWidth'
  | 'sortable'
  | 'csvExportData'
> & {
  // Determines how one can extract information about a RelatedItem from an Item.
  //
  // A few possible things can be returned:
  // - If the Item purely contains an identifier for a RelatedItem (ie, { id: 'xxx', relatedId:
  //   'yyy', ...}) then one should return { type: 'KEY_ONLY', key: 'yyy' }.
  // - If the Item contains an embedded RelatedItem (ie, { id: 'xxx', related: { id: 'yyy', ...},
  //   ...}) then one should return { type: 'FULL', item: { id: 'yyy', ... } }.
  // - If the field is nullable and the Item is not associated with the RelatedItem, then
  //   return null.
  getInitialStateFromItem: (item: Item) => (Nullable extends true ? ForeignKeyKeyOnlyItem | ForeignKeyFullItem<RelatedItem> | null : ForeignKeyKeyOnlyItem | ForeignKeyFullItem<RelatedItem>);

  // When on the detail page, a full on `RelatedItem` is required and just the key from the
  // `RelatedItem` isn't enough. This function allows the detail page to map the return value of
  // `getInitialStateFromItem` (which may not be a FULL RelatedItem) into a FULL RelatedItem. This
  // likely involves making a network request.
  injectAsyncDataIntoInitialStateOnDetailPage?: (
    oldState: Nullable extends true ? ForeignKeyKeyOnlyItem | ForeignKeyFullItem<RelatedItem> | null : ForeignKeyKeyOnlyItem | ForeignKeyFullItem<RelatedItem>,
    item: Item | null,
    signal: AbortSignal,
  ) => Promise<ForeignKeyFullItem<RelatedItem>>;

  // When creating a new Item, what should the RelatedItem foreign key be set to initially?
  getInitialStateWhenCreating?: () => ForeignKeyKeyOnlyItem | ForeignKeyFullItem<RelatedItem> | (Nullable extends true ? ForeignKeyUnset | null : ForeignKeyUnset);

  serializeStateToItem?: (partialItem: Partial<Item>, state: RelatedItem | null, initialItemAtPageLoad: Item | null) => Partial<Item>;

  nullable?: boolean;
  relatedName: string;
  getRelatedKey?: (relatedItem: RelatedItem) => ItemKey;

  fetchPageOfRelatedData?: (
    page: number,
    item: Item | null,
    filters: Array<[Filter["name"], Filter["state"]]>,
    sort: Sort | null,
    searchText: string,
    abort: AbortSignal,
  ) => Promise<Paginated<RelatedItem>>;
  createRelatedItem?: (item: Item | null, relatedItem: Partial<RelatedItem>, signal: AbortSignal) => Promise<RelatedItem>;

  searchable?: boolean;

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
const SingleForeignKeyField = <Item = BaseItem, FieldName = BaseFieldName, RelatedItem = BaseItem, Nullable = false>(props: SingleForeignKeyFieldProps<Item, FieldName, RelatedItem, Nullable>) => {
  type InternalStateType = ForeignKeyKeyOnlyItem | ForeignKeyFullItem<RelatedItem> | (Nullable extends true ? ForeignKeyUnset | null : ForeignKeyUnset);

  const dataModelsContextData = useContext(DataModelsContext);
  if (!dataModelsContextData) {
    throw new Error('Error: <SingleForeignKeyField ... /> was not rendered inside of a container component! Try rendering this inside of a <DataModels> ... </DataModels>.');
  }
  const relatedDataModel = dataModelsContextData[0].get(props.relatedName) as DataModel<RelatedItem> | undefined;

  const singularDisplayName = props.singularDisplayName || relatedDataModel?.singularDisplayName || '';
  const pluralDisplayName = props.pluralDisplayName || relatedDataModel?.pluralDisplayName || '';
  const getRelatedKey = useMemo(
    () => props.getRelatedKey || relatedDataModel?.keyGenerator || ((input: RelatedItem) => (input as FixMe).id as ItemKey),
    [props.getRelatedKey, relatedDataModel],
  );

  const [
    addInFlightAbortController,
    removeInFlightAbortController,
  ] = useInFlightAbortControllers();

  const getInitialStateWhenCreating = useMemo(() => {
    return props.getInitialStateWhenCreating || (() => ({ type: 'UNSET' as const }));
  }, [props.getInitialStateWhenCreating]);

  const injectAsyncDataIntoInitialStateOnDetailPage = useCallback(async (
    oldState: InternalStateType | null,
    item: Item | null,
    signal: AbortSignal,
  ): Promise<ForeignKeyFullItem<RelatedItem> | null> => {
    if (oldState === null) {
      return null;
    }
    if (oldState.type === "UNSET") {
      return null;
    }

    if (props.injectAsyncDataIntoInitialStateOnDetailPage) {
      return props.injectAsyncDataIntoInitialStateOnDetailPage(oldState, item, signal);
    } else {
      // If no custom `injectAsyncDataIntoInitialStateOnDetailPage` is defined, then use the
      // `relatedDataModel.fetchItem` to do the conversion to a FULL object if need be
      switch (oldState.type) {
        case "KEY_ONLY":
          if (!relatedDataModel) {
            throw new Error('Error running autogenerated SingleForeignKeyField.injectAsyncDataIntoInitialStateOnDetailPage - relatedDataModel is unset!');
          }
          return {
            type: 'FULL',
            item: await relatedDataModel.fetchItem(oldState.key, signal),
          };
        case "FULL":
          return oldState;
      }
    }
  }, [props.injectAsyncDataIntoInitialStateOnDetailPage, relatedDataModel]);

  const getInitialStateAfterMakingNotNull = useCallback(async (item: Item | null) => {
    const initialState = getInitialStateWhenCreating();
    if (!initialState) {
      // If it defaults to null, then when going back to the "value" option, leave it unselected
      return { type: 'UNSET' } as ForeignKeyUnset;
    }
    if (initialState.type === "UNSET") {
      return { type: 'UNSET' } as ForeignKeyUnset;
    }

    const abort = new AbortController();
    addInFlightAbortController(abort)
    const result = await injectAsyncDataIntoInitialStateOnDetailPage(initialState, item, abort.signal);
    removeInFlightAbortController(abort);
    return result;
  }, [
    getInitialStateWhenCreating,
    addInFlightAbortController,
    removeInFlightAbortController,
    injectAsyncDataIntoInitialStateOnDetailPage,
  ]);

  const displayMarkup = useCallback((state: InternalStateType) => {
    if (state === null) {
      return <span>null</span>;
    } else if (state.type === "KEY_ONLY") {
      return (
        <span>{state.key}</span>
      );
    } else if (state.type === "UNSET") {
      return (
        <span style={{ color: 'silver' }}>unset</span>
      );
    } else {
      return (
        <span>{getRelatedKey(state.item)}</span>
      );
    }
  }, [getRelatedKey]);

  const createRelatedItem = useMemo(() => {
    if (props.createRelatedItem) {
      return async (item: Item | null, relatedItem: Partial<RelatedItem>) => {
        const abort = new AbortController();
        addInFlightAbortController(abort);
        const result = await props.createRelatedItem!(item, relatedItem, abort.signal);
        removeInFlightAbortController(abort);
        return result;
      };
    }

    if (relatedDataModel && relatedDataModel.createItem) {
      return async (_item: Item | null, relatedItem: Partial<RelatedItem>) => {
        const abort = new AbortController();
        addInFlightAbortController(abort);
        const result = await relatedDataModel.createItem!(relatedItem, abort.signal);
        removeInFlightAbortController(abort);
        return result;
      }
    }

    return null;
  }, [props.createRelatedItem, relatedDataModel, addInFlightAbortController, removeInFlightAbortController]);

  const modifyMarkup = useCallback((
    state: InternalStateType,
    setState: (newState: InternalStateType, blurAfterStateSet?: boolean) => void,
    item: Item | null,
  ) => {
    if (state && state.type === 'KEY_ONLY') {
      return (
        <span>Loading full object representation asyncronously...</span>
      );
    }

    const relatedFields = state ? (
      <ForeignKeyFieldModifyMarkup<Item, FieldName, RelatedItem, Nullable>
        mode="detail"
        item={item}
        relatedItem={state.type !== "UNSET" ? state.item : null}
        checkboxesWidth={null}
        onChangeRelatedItem={newRelatedItem => setState({ type: "FULL", item: newRelatedItem }, true)}
        foreignKeyFieldProps={props}
        createRelatedItem={createRelatedItem}
        getRelatedKey={getRelatedKey}
      >
        {props.children}
      </ForeignKeyFieldModifyMarkup>
    ) : null;

    if (props.nullable) {
      return (
        <div style={{ width: '100%' }}>
          <NullableWrapper<NonNullable<InternalStateType>, FieldName>
            nullable={props.nullable as boolean}
            name={props.name}
            state={state}

            // FIXME: There is probably a better way to define setState that works better with the
            // Nullable switching stuff...
            setState={setState as unknown as (newState: NonNullable<InternalStateType> | null, blurAfterStateSet?: boolean | undefined) => void}

            // FIXME: the below getInitialStateWhenCreating can return null (and that is its default
            // value). The better way to do this probably is to make the
            // `ForeignKeyFieldModifyMarkup` component aware of `nullable` when in
            // SingleForeignKeyField mode and get rid of the `NullableWrapper` stuff in here.
            getInitialStateWhenCreating={async () => {
              const result = await getInitialStateAfterMakingNotNull(item);
              if (!result) {
                throw new Error(`Error: SingleForeignKeyField.getInitialStateWhenCreating returned null, which means that unnullifying ${props.name} won't work. Figure out a way to fix this!`);
              }
              return result;
            }}
          />

          {state !== null ? relatedFields : null}
        </div>
      );
    } else {
      return relatedFields;
    }
  }, [props, createRelatedItem, getRelatedKey]);

  const csvExportData = useCallback((state: InternalStateType, item: Item) => {
    if (props.csvExportData) {
      return props.csvExportData(state, item);
    }

    if (state === null) {
      return 'null';
    }

    switch (state.type) {
      case "KEY_ONLY":
        return state.key;
      case "FULL":
        return getRelatedKey(state.item);
      case "UNSET":
        return "";
    }
  }, [props.csvExportData, getRelatedKey]);

  const serializeStateToItem = useCallback((
    partialItem: Partial<Item>,
    state: InternalStateType,
    initialItem: Item | null,
  ): Partial<Item> => {
    const preexistingSerializeStateToItem = props.serializeStateToItem || ((partialItem: Partial<Item>, state: RelatedItem | null, initialItem: Item | null) => {
      // As a default, use the value from `getInitialStateFromItem` to determine if the item key
      // should be serialized or if the full object should be embedded.
      const initialState = initialItem ? props.getInitialStateFromItem(initialItem) : getInitialStateWhenCreating();

      if (!state || !initialState) {
        return { ...partialItem, [props.name as FixMe]: null };
      } else if (initialState.type === 'KEY_ONLY') {
        return { ...partialItem, [props.name as FixMe]: getRelatedKey(state) };
      } else {
        return { ...partialItem, [props.name as FixMe]: state };
      };
    });

    if (!state) {
      return preexistingSerializeStateToItem(partialItem, null, initialItem);
    }
    if (state.type === "KEY_ONLY") {
      console.warn(`SingleForeignKeyField.serializeStateToItem ran with a field state of ${JSON.stringify(state)}, this is not allowed!`);
      return partialItem;
    }
    if (state.type === "UNSET") {
      console.warn(`SingleForeignKeyField.serializeStateToItem ran with a field state of ${JSON.stringify(state)}, this is not allowed!`);
      return partialItem;
    }
    return preexistingSerializeStateToItem(partialItem, state.item, initialItem);
  }, [props.serializeStateToItem, props.getInitialStateFromItem, getRelatedKey]);

  return (
    <Field<Item, FieldName, InternalStateType>
      name={props.name}
      singularDisplayName={singularDisplayName}
      pluralDisplayName={pluralDisplayName}
      csvExportColumnName={props.csvExportColumnName}
      columnWidth={props.columnWidth}
      sortable={props.sortable}

      // FIXME: both of the below props have type errors, because they have quite a bit of logic to
      // handle `null`s and I can't figure out how to make the types work right...
      getInitialStateFromItem={props.getInitialStateFromItem as FixMe}
      injectAsyncDataIntoInitialStateOnDetailPage={injectAsyncDataIntoInitialStateOnDetailPage as FixMe}

      getInitialStateWhenCreating={getInitialStateWhenCreating}
      serializeStateToItem={serializeStateToItem}
      displayMarkup={displayMarkup}
      modifyMarkup={modifyMarkup}
      csvExportData={csvExportData}
    />
  );
};

export default SingleForeignKeyField;


export const ForeignKeyFieldModifyMarkup = <Item = BaseItem, FieldName = BaseFieldName, RelatedItem = BaseItem, Nullable = false>(props:
  | {
    mode: 'list',
    item: Item | null,
    relatedItems: Array<RelatedItem>,
    onChangeRelatedItems: (newRelatedItems: Array<RelatedItem>) => void,
    disabled?: boolean;
    checkboxesWidth: null | string | number;
    foreignKeyFieldProps: MultiForeignKeyFieldProps<Item, FieldName, RelatedItem>,
    getRelatedKey: (relatedItem: RelatedItem) => ItemKey;
    createRelatedItem: ((item: Item | null, relatedItem: Partial<RelatedItem>) => Promise<RelatedItem>) | null;
    children: React.ReactNode;
  }
  | {
    mode: 'detail',
    item: Item | null,
    relatedItem: RelatedItem | null,
    onChangeRelatedItem: (newRelatedItem: RelatedItem) => void,
    disabled?: boolean;
    checkboxesWidth: null | string | number;
    foreignKeyFieldProps: SingleForeignKeyFieldProps<Item, FieldName, RelatedItem, Nullable>,
    getRelatedKey: (relatedItem: RelatedItem) => ItemKey;
    createRelatedItem: ((item: Item | null, relatedItem: Partial<RelatedItem>) => Promise<RelatedItem>) | null;
    children: React.ReactNode;
  }
) => {
  const dataModelsContextData = useContext(DataModelsContext);
  if (!dataModelsContextData) {
    throw new Error('Error: <ForeignKeyFieldModifyMarkup ... /> was not rendered inside of a container component! Try rendering this inside of a <DataModels> ... </DataModels>.');
  }
  const relatedDataModel = dataModelsContextData[0].get(props.foreignKeyFieldProps.relatedName) as DataModel<RelatedItem> | undefined;

  const Controls = useControls();

  const fetchPageOfRelatedData = useMemo(() => {
    if (props.foreignKeyFieldProps.fetchPageOfRelatedData) {
      return props.foreignKeyFieldProps.fetchPageOfRelatedData;
    }

    if (relatedDataModel) {
      return (
        page: number,
        _item: Item | null,
        filters: Array<[Filter["name"], Filter["state"]]>,
        sort: Sort | null,
        searchText: string,
        signal: AbortSignal,
      ) => {
        return relatedDataModel.fetchPageOfData(page, filters, sort, searchText, signal);
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

  const [relatedData, setRelatedData] = useState<ListData<RelatedItem>>({ status: 'IDLE' });
  const [relatedDataSort, setRelatedDataSort] = useState<Sort | null>(null);
  const [relatedDataSearchText, setRelatedDataSearchText] = useState<string>('');

  // When the component initially loads, fetch the first page of data
  useEffect(() => {
    if (!fetchPageOfRelatedData) {
      return;
    }

    const abortController = new AbortController();

    const fetchFirstPageOfData = async () => {
      setRelatedData({ status: 'LOADING_INITIAL' });

      addInFlightAbortController(abortController);
      let result: Paginated<RelatedItem>;
      try {
        result = await fetchPageOfRelatedData(1, props.item, [], relatedDataSort, relatedDataSearchText, abortController.signal);
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
  }, [setRelatedData, props.item, relatedDataSort, relatedDataSearchText, fetchPageOfRelatedData]);

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

    let result: Paginated<RelatedItem>;
    try {
      result = await fetchPageOfRelatedData(page, props.item, [], relatedDataSort, relatedDataSearchText, abort.signal);
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
  }, [relatedData, setRelatedData, props.item, relatedDataSort, relatedDataSearchText, fetchPageOfRelatedData]);

  const [relatedFields, setRelatedFields] = useState<FieldCollection<FieldMetadata<RelatedItem, FieldName>>>(
    (EMPTY_FIELD_COLLECTION as any) as FieldCollection<FieldMetadata<RelatedItem, FieldName>>
  );

  // Allow a custom set of fields to be defined in the creation form. If these fields aren't
  // defined, then use the fields defined for the table for the creation form.
  const [relatedCreationFields, setRelatedCreationFields] = useState<FieldCollection<FieldMetadata<RelatedItem, FieldName>>>(
    (EMPTY_FIELD_COLLECTION as any) as FieldCollection<FieldMetadata<RelatedItem, FieldName>>
  );

  // When in creation mode, store each state for each field centrally
  const [relatedCreationFieldStates, setRelatedCreationFieldStates] = useState<Map<FieldName, BaseFieldState>>(new Map());
  useEffect(() => {
    if (itemSelectionMode !== 'create') {
      return;
    }

    const newRelatedCreationFieldStates = new Map<FieldName, BaseFieldState | undefined>();
    for (const relatedField of relatedCreationFields.metadata) {
      newRelatedCreationFieldStates.set(
        relatedField.name,
        relatedField.getInitialStateWhenCreating ? relatedField.getInitialStateWhenCreating() : undefined,
      );
    }

    setRelatedCreationFieldStates(newRelatedCreationFieldStates);
  }, [itemSelectionMode, relatedCreationFields]);

  if (!relatedDataModel || !fetchPageOfRelatedData) {
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
        <div className={styles.foreignKeyFieldModifyMarkupWrapper}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 64 }}>
            <em style={{color: gray.gray9}}>
              Loading related data...
            </em>
          </div>
          <Controls.AppBar intent="footer" size="small" title={null} />
        </div>
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
      let rowKeys = rows.map(row => props.getRelatedKey(row));

      // Pin the initial related item to the top of the list
      //
      // This doesn't just pin the currently related item, it pins the initial,
      // because the initial won't change.
      if (props.mode === 'list') {
        if (itemSelectionMode === 'select') {
          rows = relatedData.data;
          rowKeys = rows.map(row => props.getRelatedKey(row));
          if (initialRelatedItems) {
            for (const relatedItem of initialRelatedItems) {
              const key = props.getRelatedKey(relatedItem);
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
          rowKeys = rows.map(row => props.getRelatedKey(row));
          if (initialRelatedItem) {
            const key = props.getRelatedKey(initialRelatedItem);
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
          {props.foreignKeyFieldProps.searchable ? (
            <Controls.AppBar
              intent="header"
              size="small"
              actions={
                <SearchInput
                  pluralDisplayName={props.foreignKeyFieldProps.pluralDisplayName}
                  size="small"
                  value={relatedDataSearchText}
                  onChange={setRelatedDataSearchText}
                />
              }
            />
          ) : null}

          {relatedFields.names.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 64 }}>
              <em style={{color: gray.gray9}}>
                No {props.foreignKeyFieldProps.singularDisplayName.toLowerCase()} fields specified
              </em>
            </div>
          ) : (
            <div className={styles.foreignKeyFieldTableWrapper}>
              {rows.length > 0 ? (
                <table>
                  <ManuallyStickyTHead>
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
                            style={{ width: relatedFieldMetadata.columnWidth }}
                            onClick={relatedFieldMetadata.sortable ? () => {
                              if (!relatedDataSort) {
                                // Initially set the sort
                                setRelatedDataSort({
                                  fieldName: relatedFieldMetadata.name,
                                  direction: 'desc'
                                } as Sort);
                              } else if (relatedDataSort.fieldName !== relatedFieldMetadata.name) {
                                // A different column was selected, so initially set the sort for this new column
                                setRelatedDataSort({
                                  fieldName: relatedFieldMetadata.name,
                                  direction: 'desc'
                                } as Sort);
                              } else {
                                // Cycle the sort to the next value
                                switch (relatedDataSort.direction) {
                                  case 'desc':
                                    setRelatedDataSort({
                                      fieldName: relatedFieldMetadata.name,
                                      direction: 'asc',
                                    } as Sort);
                                    return;
                                  case 'asc':
                                    setRelatedDataSort(null);
                                    return;
                                }
                              }
                            } : undefined}
                          >
                            {relatedFieldMetadata.singularDisplayName}
                            {relatedDataSort && relatedDataSort.fieldName === relatedFieldMetadata.name ? (
                              <span className={styles.tableWrapperSortIndicator}>
                                {relatedDataSort.direction === 'desc' ? <Fragment>&darr;</Fragment> : <Fragment>&uarr;</Fragment>}
                              </span>
                            ) : null}
                          </th>
                        );
                      })}
                      {/* Add a column for the details button */}
                      {relatedDataModel?.detailLinkGenerator ? (
                        <Fragment>
                          <th />
                          {/* FIXME: the below 100 should be configured by detailLinkColumnWidth! */}
                          <th style={{minWidth: 100}} />
                        </Fragment>
                      ) : null}
                    </tr>
                  </ManuallyStickyTHead>
                  <tbody>
                    {rows.map(relatedItem => {
                      const key = props.getRelatedKey(relatedItem);
                      const checked = Boolean(props.mode === 'list' ? (
                        props.relatedItems && props.relatedItems.find(i => props.getRelatedKey(i) === key)
                      ) : props.relatedItem && props.getRelatedKey(props.relatedItem) === key);

                      let detailLink: Navigatable | undefined = undefined;
                      if (relatedDataModel?.detailLinkGenerator) {
                        detailLink = relatedDataModel.detailLinkGenerator(relatedItem);
                        detailLink = injectReturnToQueryParamIntoNavigatable(
                          detailLink,
                          // FIXME: the below probably should take into account next.js route stuff!!
                          window.location.href.replace(location.origin, ''),
                        );
                      }

                      return (
                        <ListTableItem
                          key={key as string}
                          item={relatedItem}
                          visibleFieldNames={relatedFields.names as Array<FieldName>}
                          fields={relatedFields}
                          checkable={true}
                          checkType={props.mode === 'list' ? 'checkbox' : 'radio'}
                          detailLink={detailLink}
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
                                  props.relatedItems.filter(i => props.getRelatedKey(i) !== key)
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
              <Controls.AppBar
                intent="header"
                size="small"
                title={<strong>Create new {relatedDataModel.singularDisplayName}:</strong>}
              />
              <div className={styles.foreignKeyFieldCreationWrapper}>
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
                    <DetailFieldItem
                      key={relatedField.name as string}
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
                  );
                })}
              </div>

              <Controls.AppBar
                intent="footer"
                size="small"
                title={
                  <Fragment>
                    <Controls.Button size="small" onClick={() => setItemSelectionMode('none')}>Cancel</Controls.Button>
                    <Controls.Button size="small" variant="primary" onClick={async () => {
                      if (!props.createRelatedItem) {
                        return;
                      }

                      // Aggregate all the state updates to form the update body
                      let relatedItem: Partial<RelatedItem> = {};
                      for (const field of relatedCreationFields.metadata) {
                        let state = relatedCreationFieldStates.get(field.name);
                        if (typeof state === 'undefined') {
                          continue;
                        }

                        relatedItem = field.serializeStateToItem(relatedItem, state, null);
                      }

                      // FIXME: add abort controller
                      let newlyCreatedRelatedItem: RelatedItem;
                      try {
                        newlyCreatedRelatedItem = await props.createRelatedItem(props.item, relatedItem);
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
                    {props.createRelatedItem ? (
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
