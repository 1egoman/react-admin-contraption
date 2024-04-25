import * as React from 'react';
import { useMemo, useContext, useCallback } from 'react';

import {
  FixMe,
  BaseItem,
  BaseFieldName,
  ItemKey,
  Paginated,
  Filter,
  Sort,
  ForeignKeyKeyOnlyItem,
  ForeignKeyFullItem,
} from '../types';

import { DataModel, DataModelsContext } from '../datamodel';
import Field, { FieldMetadata } from '../fields';

import useInFlightAbortControllers from '../utils/use-in-flight-abort-controllers';
import { ForeignKeyFieldModifyMarkup } from './SingleForeignKeyField';

export type MultiForeignKeyFieldProps<Item = BaseItem, FieldName = BaseFieldName, RelatedItem = BaseItem> = Pick<
  FieldMetadata<Item, FieldName, ForeignKeyKeyOnlyItem<Array<ItemKey>> | ForeignKeyFullItem<Array<RelatedItem>>>,
  | 'name'
  | 'singularDisplayName'
  | 'pluralDisplayName'
  | 'csvExportColumnName'
  | 'columnWidth'
  | 'sortable'
  | 'getInitialStateWhenCreating'
  | 'csvExportData'
> & {
  // Determines how one can extract information about a set of RelatedItems from an Item.
  //
  // A few possible things can be returned:
  // - If the Item purely contains a list of identifiers for RelatedItems (ie, { id: 'xxx', relatedIds:
  //   ['yyy', 'zzz'], ...}) then one should return
  //   [{ type: 'KEY_ONLY', key: 'yyy' }, { type: 'KEY_ONLY', key: 'zzz'}].
  // - If the Item contains a list of embedded RelatedItems (ie, { id: 'xxx', related: [{ id:
  //   'yyy', ...}, { id: 'zzz', ... }],
  //   then one should return [{type: 'FULL', item: {id: 'yyy', ... }}, { type: 'FULL', item: {id: 'zzz', ... }}].
  getInitialStateFromItem: (item: Item) => ForeignKeyKeyOnlyItem<Array<ItemKey>> | ForeignKeyFullItem<Array<RelatedItem>>;

  // When on the detail page, a full on `RelatedItem` is required and just the key from the
  // `RelatedItem` isn't enough. This function allows the detail page to map the return value of
  // `getInitialStateFromItem` (which may not be a FULL RelatedItem) into a FULL RelatedItem. This
  // likely involves making a network request.
  injectAsyncDataIntoInitialStateOnDetailPage?: (
    oldState: ForeignKeyKeyOnlyItem<Array<ItemKey>> | ForeignKeyFullItem<Array<RelatedItem>>,
    item: Item | null,
    signal: AbortSignal,
  ) => Promise<ForeignKeyFullItem<Array<RelatedItem>>>;

  serializeStateToItem?: (initialItem: Partial<Item>, state: Array<RelatedItem>) => Partial<Item>;

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
Example MultiForeignKeyField:
<MultiForeignKeyField<BattleWithParticipants, 'startedAt', BattleParticipant>
  name="beat"
  singularDisplayName="Beat"
  pluralDisplayName="Beats"
  columnWidth="200px"
  sortable
/>
*/
const MultiForeignKeyField = <Item = BaseItem, FieldName = BaseFieldName, RelatedItem = BaseItem>(props: MultiForeignKeyFieldProps<Item, FieldName, RelatedItem>) => {
  const dataModelsContextData = useContext(DataModelsContext);
  if (!dataModelsContextData) {
    throw new Error('Error: <MultiForeignKeyField ... /> was not rendered inside of a container component! Try rendering this inside of a <DataModel> ... </DataModel>.');
  }
  const relatedDataModel = dataModelsContextData[0].get(props.relatedName) as DataModel<RelatedItem> | undefined;
  const getRelatedKey = useMemo(
    () => props.getRelatedKey || relatedDataModel?.keyGenerator || ((input: RelatedItem) => (input as FixMe).id as ItemKey),
    [props.getRelatedKey, relatedDataModel],
  );

  const [
    addInFlightAbortController,
    removeInFlightAbortController,
  ] = useInFlightAbortControllers();

  const getInitialStateWhenCreating = useMemo(() => {
    return props.getInitialStateWhenCreating || (() => ({ type: 'FULL' as const, item: [] }));
  }, [props.getInitialStateWhenCreating]);

  const serializeStateToItem = useCallback((
    initialItem: Partial<Item>,
    state: ForeignKeyKeyOnlyItem<Array<ItemKey>> | ForeignKeyFullItem<Array<RelatedItem>>,
  ): Partial<Item> => {
    const preexistingSerializeStateToItem = props.serializeStateToItem || ((initialItem: Partial<Item>, state: Array<RelatedItem>) => {
      // As a default, use the value from `getInitialStateFromItem` to determine if the item key
      // should be serialized or if the full object should be embedded.
      const initialState = props.getInitialStateFromItem(initialItem);

      if (state.length === 0) {
        return { ...initialItem, [props.name as FixMe]: [] };
      } else if (initialState.type === 'KEY_ONLY') {
        return { ...initialItem, [props.name as FixMe]: state.map(getRelatedKey) };
      } else {
        return { ...initialItem, [props.name as FixMe]: state };
      };
    });

    if (state.type === "KEY_ONLY") {
      console.warn(`MultiForeignKeyField.serializeStateToItem ran with a field state of ${JSON.stringify(state)}, this is not allowed!`);
      return initialItem;
    } else {
      return preexistingSerializeStateToItem(initialItem, state.item);
    }
  }, [props.serializeStateToItem, props.getInitialStateFromItem, getRelatedKey]);

  const injectAsyncDataIntoInitialStateOnDetailPage = useCallback(async (
    oldState: ForeignKeyKeyOnlyItem<Array<ItemKey>> | ForeignKeyFullItem<Array<RelatedItem>>,
    item: Item,
    signal: AbortSignal,
  ): Promise<ForeignKeyFullItem<Array<RelatedItem>>> => {
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
            // FIXME: this is a n+1 query! I think in practice `n` will be pretty small so maybe
            // this won't turn out to be a bottleneck. But it would be good to fix this!
            item: await Promise.all(oldState.key.map(async key => relatedDataModel.fetchItem(key, signal))),
          };
        case "FULL":
          return oldState;
      }
    }
  }, [props.injectAsyncDataIntoInitialStateOnDetailPage, relatedDataModel]);

  const computeStateKeyList = useCallback((state: ForeignKeyKeyOnlyItem<Array<ItemKey>> | ForeignKeyFullItem<Array<RelatedItem>>) => {
    if (state.type === "FULL") {
      return state.item.map(getRelatedKey);
    } else {
      return state.key;
    }
  }, [getRelatedKey]);

  const csvExportData = useCallback((state: ForeignKeyKeyOnlyItem<Array<ItemKey>> | ForeignKeyFullItem<Array<RelatedItem>>, item: Item) => {
    if (props.csvExportData) {
      return props.csvExportData(state, item);
    }

    return computeStateKeyList(state).join(',');
  }, [props.csvExportData, computeStateKeyList]);

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

  const displayMarkup = useCallback((state: ForeignKeyKeyOnlyItem<Array<ItemKey>> | ForeignKeyFullItem<Array<RelatedItem>>) => (
    <span>{computeStateKeyList(state).join(', ')}</span>
  ), [computeStateKeyList]);

  const modifyMarkup = useCallback((
    state: ForeignKeyKeyOnlyItem<Array<ItemKey>> | ForeignKeyFullItem<Array<RelatedItem>>,
    setState: (newState: ForeignKeyKeyOnlyItem<Array<ItemKey>> | ForeignKeyFullItem<Array<RelatedItem>>, blurAfterStateSet?: boolean) => void,
    item: Item | null,
  ) => {
    if (state.type === 'KEY_ONLY') {
      return (
        <span>Loading full object representation asyncronously...</span>
      );
    }

    return (
      <ForeignKeyFieldModifyMarkup<Item, FieldName, RelatedItem>
        mode="list"
        item={item}
        relatedItems={state.item}
        checkboxesWidth={null}
        onChangeRelatedItems={newRelatedItems => setState({ type: 'FULL', item: newRelatedItems }, true)}
        foreignKeyFieldProps={props}
        createRelatedItem={createRelatedItem}
        getRelatedKey={getRelatedKey}
      >
        {props.children}
      </ForeignKeyFieldModifyMarkup>
    );
  }, [props, createRelatedItem, getRelatedKey]);

  return (
    <Field<Item, FieldName, ForeignKeyKeyOnlyItem<Array<ItemKey>> | ForeignKeyFullItem<Array<RelatedItem>>>
      name={props.name}
      singularDisplayName={props.singularDisplayName}
      pluralDisplayName={props.pluralDisplayName}
      csvExportColumnName={props.csvExportColumnName}
      columnWidth={props.columnWidth}
      sortable={props.sortable}
      getInitialStateFromItem={props.getInitialStateFromItem}
      injectAsyncDataIntoInitialStateOnDetailPage={injectAsyncDataIntoInitialStateOnDetailPage}
      getInitialStateWhenCreating={getInitialStateWhenCreating}
      serializeStateToItem={serializeStateToItem}
      displayMarkup={displayMarkup}
      modifyMarkup={modifyMarkup}
      csvExportData={csvExportData}
    />
  );
};

export default MultiForeignKeyField;
