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
  Paginated,
  Filter,
  Sort,
} from './types';

import { useControls } from './controls';
import { SelectOption } from './controls/Select';

import { DataModel, DataModels, DataModelsContext } from './datamodel';
export { DataModel, DataModels };

import Field, { FieldMetadata, FieldCollection, FieldsProvider, EMPTY_FIELD_COLLECTION, NullableWrapper } from './fields';
export { Field };

import InputField, { InputFieldProps } from './fields/InputField';
export { InputField };

import Launcher from './launcher';
export { Launcher };

import { useListDataContext, useDetailDataContext } from './data-context';
export { useListDataContext, useDetailDataContext };

import ListCSVExport from './csv-export';
export { ListCSVExport };

import useInFlightAbortControllers from './utils/use-in-flight-abort-controllers';
import ManuallyStickyTHead from './utils/ManuallyStickyTHead';

import { AdminContextProvider, StateCache } from './admin-context';
export { AdminContextProvider };
export type { StateCache };

import List, { ListData } from "./list";
export { List };

import { ListFilterBar, SearchInput } from './list/filter-bar';
export { ListFilterBar };

import ListActionBar from "./list/action-bar";
export { ListActionBar };

import FilterDefinition from './filter-definitions';
export { FilterDefinition };

import StringFilterDefinition from './filter-definitions/StringFilterDefinition';
export { StringFilterDefinition };

type MultiLineInputFieldProps<
  Item = BaseItem,
  FieldName = BaseFieldName,
  Nullable = false,
  State = Nullable extends true ? (string | null) : string,
> = Omit<InputFieldProps<Item, FieldName, Nullable, State>, 'type'>;

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
  FieldName = BaseFieldName,
  Nullable = false,
>(props: MultiLineInputFieldProps<Item, FieldName, Nullable>) => {
  const Controls = useControls();

  const inputRef = useRef<HTMLInputElement | null>(null);

  const getInitialStateFromItem = useMemo(() => {
    return props.getInitialStateFromItem || ((item: Item) => `${(item as FixMe)[props.name as FixMe]}`);
  }, [props.getInitialStateFromItem, props.name]);

  const injectAsyncDataIntoInitialStateOnDetailPage = useMemo(() => {
    return (state: Nullable extends true ? (string | null) : string) => Promise.resolve(state)
  }, []);

  return (
    <Field<Item, FieldName, Nullable extends true ? (string | null) : string>
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


type ChoiceFieldProps<Item = BaseItem, FieldName = BaseFieldName, State = BaseFieldState> = Pick<
  FieldMetadata<Item, FieldName, State>,
  | 'name'
  | 'singularDisplayName'
  | 'pluralDisplayName'
  | 'csvExportColumnName'
  | 'columnWidth'
  | 'sortable'
> & {
  getInitialStateFromItem?: (item: Item) => State;
  getInitialStateWhenCreating: () => State | undefined;
  serializeStateToItem?: (initialItem: Partial<Item>, state: State) => Partial<Item>;
  choices: Array<{id: State; disabled?: boolean; label: React.ReactNode }>;

  nullable?: boolean;
  displayMarkup?: FieldMetadata<Item, FieldName, State>['displayMarkup'];
  inputMarkup?: FieldMetadata<Item, FieldName, State>['modifyMarkup'];
  csvExportData?: FieldMetadata<Item, FieldName, State>['csvExportData'];
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
export const ChoiceField = <Item = BaseItem, FieldName = BaseFieldName, State = BaseFieldState>(props: ChoiceFieldProps<Item, FieldName, State>) => {
  const Controls = useControls();

  const getInitialStateFromItem = useMemo(() => {
    return props.getInitialStateFromItem || ((item: Item) => `${(item as FixMe)[props.name as FixMe]}` as State);
  }, [props.getInitialStateFromItem, props.name]);

  const injectAsyncDataIntoInitialStateOnDetailPage = useCallback((state: State) => Promise.resolve(state), []);

  return (
    <Field<Item, FieldName, State>
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
          const idAsString = `${id}`;
          if (idAsString === stateAsString) {
            stateRepresentedByValue = true;
          }
          options.push({
            value: idAsString,
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
              if (newValue === 'NULL') {
                setState(null);
                return;
              }

              const choice = props.choices.find(c => `${c.id}` === newValue);
              if (!choice) {
                return;
              }
              setState(choice.id);
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



type NumberFieldProps<Item = BaseItem, FieldName = BaseFieldName> = Pick<
  FieldMetadata<Item, FieldName, number>,
  | 'name'
  | 'singularDisplayName'
  | 'pluralDisplayName'
  | 'csvExportColumnName'
  | 'columnWidth'
  | 'sortable'
> & {
  getInitialStateFromItem?: (item: Item) => number;
  getInitialStateWhenCreating?: () => number | undefined;
  serializeStateToItem?: (initialItem: Partial<Item>, state: number) => Partial<Item>;

  nullable?: boolean;
  inputMarkup?: FieldMetadata<Item, FieldName, [string, boolean]>['modifyMarkup'];
  csvExportData?: FieldMetadata<Item, FieldName, number>['csvExportData'];
};


/*
Example NumberField:
<NumberField<BattleWithParticipants, 'startedAt'>
  name="startedAt"
  singularDisplayName="Started At"
  pluralDisplayName="Started Ats"
/>
*/
export const NumberField = <Item = BaseItem, FieldName = BaseFieldName>(props: NumberFieldProps<Item, FieldName>) => {
  const Controls = useControls();

  const getInitialStateFromItem = useCallback((item: Item): [string, boolean] => {
    const value = props.getInitialStateFromItem ? props.getInitialStateFromItem(item) : (item as FixMe)[props.name as FixMe];
    return [`${value}`, false];
  }, [props.getInitialStateFromItem, props.name]);

  const getInitialStateWhenCreating = useCallback((): [string, boolean] | undefined => {
    const result = props.getInitialStateWhenCreating ? props.getInitialStateWhenCreating() : {};
    if (result) {
      return [`${result}`, false];
    } else {
      return undefined;
    }
  }, [props.getInitialStateWhenCreating]);

  const serializeStateToItem = useMemo(() => {
    const preexisting = props.serializeStateToItem || ((item: Partial<Item>, state: JSONValue) => ({
      ...item,
      [props.name as FixMe]: state,
    }));

    return (item: Partial<Item>, state: [string, boolean]) => {
      const [body, invalid] = state;
      if (invalid) {
        return item;
      }

      const value = parseFloat(body);
      if (isNaN(value)) {
        return item;
      }

      return preexisting(item, value);
    };
  }, [props.serializeStateToItem, props.name]);

  const csvExportData = useCallback((state: [string, boolean], item: Item) => {
    const [text, invalid] = state;
    if (invalid) {
      return '';
    }

    const value = parseFloat(text);
    if (isNaN(value)) {
      return '';
    }

    if (props.csvExportData) {
      return props.csvExportData(value, item);
    } else {
      return text;
    }
  }, [props.csvExportData]);

  const injectAsyncDataIntoInitialStateOnDetailPage = useCallback(async (state: [string, boolean]) => state, []);

  return (
    <Field<Item, FieldName, [string, boolean]>
      name={props.name}
      singularDisplayName={props.singularDisplayName}
      pluralDisplayName={props.pluralDisplayName}
      csvExportColumnName={props.csvExportColumnName}
      columnWidth={props.columnWidth}
      sortable={props.sortable}
      getInitialStateFromItem={getInitialStateFromItem}
      injectAsyncDataIntoInitialStateOnDetailPage={injectAsyncDataIntoInitialStateOnDetailPage}
      getInitialStateWhenCreating={getInitialStateWhenCreating}
      serializeStateToItem={serializeStateToItem}
      displayMarkup={([state, _invalid]) => {
        if (state.length > 30) {
          return (
            <span>{state.slice(0, 30)}...</span>
          );
        } else {
          return (
            <span>{state}</span>
          );
        }
      }}
      modifyMarkup={([text, invalid], setState, item, onBlur) => {
        const input = props.inputMarkup ? props.inputMarkup([text, invalid], setState, item, onBlur) : (
          <Controls.TextInput
            type="number"
            value={text}
            invalid={invalid}
            onChange={text => {
              const invalid = isNaN(parseFloat(text));
              setState([text, invalid]);
            }}
            onBlur={() => {
              if (invalid) {
                return;
              }

              onBlur();
            }}
          />
        );

        return input;
      }}
      csvExportData={csvExportData}
    />
  );
};


type BooleanFieldProps<Item = BaseItem, FieldName = BaseFieldName> = Omit<
  ChoiceFieldProps<Item, FieldName, boolean | null>,
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
export const BooleanField = <Item = BaseItem, FieldName = BaseFieldName>(props: BooleanFieldProps<Item, FieldName>) => {
  return (
    <ChoiceField<Item, FieldName, boolean | null>
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


export type ForeignKeyKeyOnlyItem<Key = ItemKey> = { type: "KEY_ONLY", key: Key };
export type ForeignKeyFullItem<Item> = { type: "FULL", item: Item };
export type ForeignKeyUnset = { type: "UNSET" };

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

  serializeStateToItem?: (initialItem: Partial<Item>, state: RelatedItem | null) => Partial<Item>;

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
export const SingleForeignKeyField = <Item = BaseItem, FieldName = BaseFieldName, RelatedItem = BaseItem, Nullable = false>(props: SingleForeignKeyFieldProps<Item, FieldName, RelatedItem, Nullable>) => {
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
    return props.getInitialStateWhenCreating || (() => ({ type: 'UNSET' }));
  }, [props.getInitialStateWhenCreating]);

  const injectAsyncDataIntoInitialStateOnDetailPage = useCallback(async (
    oldState: ForeignKeyKeyOnlyItem | ForeignKeyFullItem<RelatedItem> | ForeignKeyUnset | null,
    item: Item,
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

  const displayMarkup = useCallback((state: ForeignKeyKeyOnlyItem | ForeignKeyFullItem<RelatedItem> | ForeignKeyUnset | null) => {
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
    state: ForeignKeyKeyOnlyItem | ForeignKeyFullItem<RelatedItem> | ForeignKeyUnset | null,
    setState: (newState: ForeignKeyKeyOnlyItem | ForeignKeyFullItem<RelatedItem> | ForeignKeyUnset | null, blurAfterStateSet?: boolean) => void,
    item: Item | null,
  ) => {
    if (state && state.type === 'KEY_ONLY') {
      return (
        <span>Loading full object representation asyncronously...</span>
      );
    }

    const relatedFields = state ? (
      <ForeignKeyFieldModifyMarkup<Item, FieldName, RelatedItem>
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
          <NullableWrapper<ForeignKeyFullItem<RelatedItem> | ForeignKeyUnset, FieldName>
            nullable={props.nullable as boolean}
            name={props.name}
            state={state}
            setState={setState}
            // FIXME: the below getInitialStateWhenCreating can return null (and that is its default
            // value). The better way to do this probably is to make the
            // `ForeignKeyFieldModifyMarkup` component aware of `nullable` when in
            // SingleForeignKeyField mode and get rid of the `NullableWrapper` stuff in here.
            getInitialStateWhenCreating={() => getInitialStateAfterMakingNotNull(item)}
          />

          {state !== null ? relatedFields : null}
        </div>
      );
    } else {
      return relatedFields;
    }
  }, [props, createRelatedItem, getRelatedKey]);

  const csvExportData = useCallback((state: ForeignKeyKeyOnlyItem | ForeignKeyFullItem<RelatedItem> | ForeignKeyUnset | null, item: Item) => {
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
    initialItem: Partial<Item>,
    state: ForeignKeyKeyOnlyItem | ForeignKeyFullItem<RelatedItem> | ForeignKeyUnset | null,
  ): Partial<Item> => {
    const preexistingSerializeStateToItem = props.serializeStateToItem || ((initialItem: Partial<Item>, state: RelatedItem | null) => {
      // As a default, use the value from `getInitialStateFromItem` to determine if the item key
      // should be serialized or if the full object should be embedded.
      const initialState = props.getInitialStateFromItem(initialItem);

      if (!state || !initialState) {
        return { ...initialItem, [props.name as FixMe]: null };
      } else if (initialState.type === 'KEY_ONLY') {
        return { ...initialItem, [props.name as FixMe]: getRelatedKey(state) };
      } else {
        return { ...initialItem, [props.name as FixMe]: state };
      };
    });

    if (!state) {
      return preexistingSerializeStateToItem(initialItem, null);
    }
    if (state.type === "KEY_ONLY") {
      console.warn(`SingleForeignKeyField.serializeStateToItem ran with a field state of ${JSON.stringify(state)}, this is not allowed!`);
      return initialItem;
    }
    if (state.type === "UNSET") {
      console.warn(`SingleForeignKeyField.serializeStateToItem ran with a field state of ${JSON.stringify(state)}, this is not allowed!`);
      return initialItem;
    }
    return preexistingSerializeStateToItem(initialItem, state.item);
  }, [props.serializeStateToItem, props.getInitialStateFromItem, getRelatedKey]);

  return (
    <Field<Item, FieldName, ForeignKeyKeyOnlyItem | ForeignKeyFullItem<RelatedItem> | ForeignKeyUnset | null>
      name={props.name}
      singularDisplayName={singularDisplayName}
      pluralDisplayName={pluralDisplayName}
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

type MultiForeignKeyFieldProps<Item = BaseItem, FieldName = BaseFieldName, RelatedItem = BaseItem> = Pick<
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
export const MultiForeignKeyField = <Item = BaseItem, FieldName = BaseFieldName, RelatedItem = BaseItem>(props: MultiForeignKeyFieldProps<Item, FieldName, RelatedItem>) => {
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

const ForeignKeyFieldModifyMarkup = <Item = BaseItem, FieldName = BaseFieldName, RelatedItem = BaseItem>(props:
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
    foreignKeyFieldProps: SingleForeignKeyFieldProps<Item, FieldName, RelatedItem>,
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

                      return (
                        <ListTableItem
                          key={key as string}
                          item={relatedItem}
                          visibleFieldNames={relatedFields.names as Array<FieldName>}
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

                        relatedItem = field.serializeStateToItem(relatedItem, state);
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

import ListTable from './list/table';
export { ListTable };

import ListColumnSetSelector from './list/column-sets';
export { ListColumnSetSelector };

import Detail from './detail';
export { Detail };

import DetailFields from './detail/fields';
export { DetailFields };
