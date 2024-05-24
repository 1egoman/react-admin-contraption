import * as React from 'react';
import {
  useMemo,
  useState,
  useEffect,
  useContext,
  useCallback,
} from 'react';
import debounce from "lodash.debounce";

import {
  BaseItem,
  BaseFieldName,
  BaseFieldState, 
} from '../types';
import Radiobutton from '../controls/Radiobutton';
import { DataModel } from '..';
import Navigatable from '../navigatable';

export const FieldsContext = React.createContext<[
  FieldCollection,
  (fields: (old: FieldCollection<FieldMetadata>) => FieldCollection<FieldMetadata>) => void,
] | null>(null);

export const FieldsProvider = <Item = BaseItem, FieldName = BaseFieldName>(props: {
  dataModel?: DataModel<Item>,
  onChangeFields: (newFields: FieldCollection<FieldMetadata<Item, FieldName>>) => void,
  children: React.ReactNode,
}) => {
  const [customFields, setCustomFields] = useState<FieldCollection<FieldMetadata<Item, FieldName>>>(
    (EMPTY_FIELD_COLLECTION as any) as FieldCollection<FieldMetadata<Item, FieldName>>
  );

  // Debouncing `onChangeFields` like this means that all field changes within the same tick are all
  // grouped together and onlt the most recent one is actually sent upwards. This avoids a ton of
  // extra rerenders.
  const debouncedOnChangeFields = useMemo(
    () => debounce(props.onChangeFields, 0),
    [props.onChangeFields]
  );

  useEffect(() => {
    if (customFields.metadata.length === 0 && props.dataModel) {
      debouncedOnChangeFields(props.dataModel.fields);
    } else {
      debouncedOnChangeFields(customFields);
    }
  }, [props.dataModel, customFields, debouncedOnChangeFields]);

  const fieldsContextData = useMemo(
    () => [
      (customFields as unknown) as FieldCollection<FieldMetadata>,
      (setCustomFields as unknown) as (updateFn: (oldFields: FieldCollection<FieldMetadata>) => FieldCollection<FieldMetadata>) => void,
    ] as [
      FieldCollection<FieldMetadata>,
      (updateFn: (oldFields: FieldCollection<FieldMetadata>) => FieldCollection<FieldMetadata>) => void,
    ],
    [customFields, setCustomFields]
  );

  return (
    <FieldsContext.Provider value={fieldsContextData}>
      {props.children}
    </FieldsContext.Provider>
  );
};

type FieldCollectionLayout = Array<
  | { type: 'field', name: FieldMetadata['name'] }
  | {
    type: 'section',
    id: string;
    label: React.ReactNode;
    contents: FieldCollectionLayout;
  }
>;

export type FieldCollection<M = FieldMetadata<BaseItem, BaseFieldName, BaseFieldState>> = {
  names: Array<FieldMetadata['name']>,
  layout: FieldCollectionLayout,
  metadata: Array<M>,
};
export const EMPTY_FIELD_COLLECTION: FieldCollection = { names: [], layout: [], metadata: [] };

// A FieldMetadata defines a specification for what a field within a data model looks like.
export type FieldMetadata<Item = BaseItem, FieldName = BaseFieldName, State = BaseFieldState> = {
  name: FieldName;
  singularDisplayName: string;
  pluralDisplayName: string;

  // When set, defines the column name to use for the header of a csv export containing this field.
  // Note that if unset, the csv export process defaults to `singularDisplayName`.
  csvExportColumnName?: string;

  sortable?: boolean;
  columnWidth?: string | number;

  // Serialize back and forth between the state (internal representation) and the item (external
  // representation)
  getInitialStateFromItem: (item: Item) => State;
  getInitialStateWhenCreating?: () => State | undefined;
  serializeStateToItem: (initialItem: Partial<Item>, state: State) => Partial<Item>;

  // When in the detail view, a common pattern is to show more information about the item. Only when
  // a field is rendered on the detail view, this function is called to allow extra information to
  // be "injected" into the state to facilutate this.
  //
  // Note that to do the opposite (ie, inject data in the list view), make whatever request you
  // need in the `fetchPageOfData` function on the data model and then in `getInitialStateFromItem`,
  // make sure to include whatever data you need in the field state.
  //
  // FIXME: this probably should be made optional!!
  injectAsyncDataIntoInitialStateOnDetailPage: (oldState: State, item: Item, signal: AbortSignal) => Promise<State>;

  /**
  * When specified, these functions are called prior to `serializeStateToItem` and allows related
  * models to be saved to the database
  * FIXME: remove this
  *
  * @deprecated Don't use this, it ended up being a bad idea that needs to be removed
  */
  createSideEffect?: (item: Partial<Item>, state: State, signal: AbortSignal) => Promise<State>;
  /**
  * When specified, these functions are called prior to `serializeStateToItem` and allows related
  * models to be saved to the database
  * FIXME: remove this
  *
  * @deprecated Don't use this, it ended up being a bad idea that needs to be removed
  */
  updateSideEffect?: (item: Partial<Item>, state: State, signal: AbortSignal) => Promise<State>;

  // The presentation of the field when in a read only context
  //
  // Note that the `item` parameter is null when creating (ie, there's no pre-existing item known)
  displayMarkup: (state: State, item: Item | null, other: { detailLink: Navigatable | null }) => React.ReactNode;

  // The presentation of the component in a read-write context. `state` and `setState` act just like
  // the parameters that are returned from a `useState` hook and allow the field to update its local
  // state.
  //
  // Note that the `item` parameter is null when creating (ie, there's no pre-existing item known)
  //
  // Note that if not set, this field is read only, and only the `displayMarkup` is shown in both
  // read and read/write contexts.
  modifyMarkup?: (
    state: State,
    setState: (newState: State, blurAfterStateSet?: boolean) => void,
    item: Item | null,
    onBlur: () => void, // Call onBlur once the user has completed editing the state
  ) => React.ReactNode;

  // When performing a csv export, this is the data that this field maps to within the csv
  // If this is not specified, the default is `item[fieldName].toString()`
  csvExportData?: (state: State, item: Item) => string,
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
const Field = <I = BaseItem, F = BaseFieldName, S = BaseFieldState>(props: FieldMetadata<I, F, S>) => {
  const fieldsContextData = useContext(FieldsContext);
  if (!fieldsContextData) {
    throw new Error('Error: <Field ... /> was not rendered inside of a container component! Try rendering this inside of a <ListTable> ... </ListTable>.');
  }

  const [_fields, setFields] = fieldsContextData;

  useEffect(() => {
    const name = props.name as string;
    setFields(old => ({
      ...old,
      names: [...old.names, name],
    }));
    return () => {
      setFields(old => ({ ...old, names: old.names.filter(n => n !== name) }));
    };
  }, [props.name]);

  const fieldSectionPath = useContext(FieldSectionsContext);
  useEffect(() => {
    const name = props.name as string;
    setFields(old => {
      const layout = old.layout.slice();

      let pointer = layout;
      for (const section of fieldSectionPath) {
        let newSectionIndex = pointer.findIndex(entry => entry.type === "section" && entry.id === section.id);
        let newSection = pointer[newSectionIndex];

        if (newSectionIndex >= 0 && newSection.type === "field") {
          break;
        }
        if (newSectionIndex >= 0 && newSection.type === "section") {
          const newContents = newSection.contents.slice();
          pointer[newSectionIndex] = { ...newSection, contents: newContents };
          pointer = newContents;
          continue;
        }

        newSection = {
          type: 'section',
          id: section.id,
          label: section.label,
          contents: [],
        };
        pointer.push(newSection);
        pointer = newSection.contents;
      }
      pointer.push({ type: 'field', name });

      return { ...old, layout };
    });
    return () => {
      setFields(old => {
        const recurse = (layout: FieldCollectionLayout): FieldCollectionLayout => {
          return layout.flatMap(item => {
            if (item.type === "field" && item.name === name) {
              // Remove the leaf field added
              return [];
            } else if (item.type === "section") {
              const newContents = recurse(item.contents);
              if (newContents.length > 0) {
                return [{...item, contents: newContents }];
              } else {
                // Remove empty sections
                return [];
              }
            } else {
              return [item];
            }
          });
        };

        return { ...old, layout: recurse(old.layout) };
      });
    };
  }, [props.name, fieldSectionPath]);

  useEffect(() => {
    const fieldMetadata: FieldMetadata<I, F, S> = {
      name: props.name,
      pluralDisplayName: props.pluralDisplayName,
      singularDisplayName: props.singularDisplayName,
      csvExportColumnName: props.csvExportColumnName,
      getInitialStateFromItem: props.getInitialStateFromItem,
      injectAsyncDataIntoInitialStateOnDetailPage: props.injectAsyncDataIntoInitialStateOnDetailPage,
      getInitialStateWhenCreating: props.getInitialStateWhenCreating,
      columnWidth: props.columnWidth,
      sortable: props.sortable,
      serializeStateToItem: props.serializeStateToItem,
      displayMarkup: props.displayMarkup,
      modifyMarkup: props.modifyMarkup,
      csvExportData: props.csvExportData,
    };

    // NOTE: convert FieldMetadata<I, F, S> into a generic `FieldMetadata` with base values so it
    // can be put into the field state
    const castedFieldMetadata = (fieldMetadata as unknown) as FieldMetadata;

    setFields(old => ({...old, metadata: [ ...old.metadata, castedFieldMetadata ]}));

    return () => {
      setFields(old => ({ ...old, metadata: old.metadata.filter(f => f !== castedFieldMetadata) }));
    };
  }, [
    props.name,
    props.pluralDisplayName,
    props.singularDisplayName,
    props.csvExportColumnName,
    props.columnWidth,
    props.sortable,
    props.getInitialStateFromItem,
    props.injectAsyncDataIntoInitialStateOnDetailPage,
    props.getInitialStateWhenCreating,
    props.serializeStateToItem,
    props.displayMarkup,
    props.modifyMarkup,
    props.csvExportData,
  ]);

  return null;
};

export default Field;


// The FieldSection allows fields on the detail page to be subdivided into sections
export const FieldSectionsContext = React.createContext<Array<{ id: string, label: React.ReactNode }>>([]);
export const FieldSection: React.FunctionComponent<{ label: string, children: React.ReactNode }> = ({ label, children }) => {
  const context = useContext(FieldSectionsContext);

  const sectionId = label;
  const newContextValue = useMemo(() => [...context, { id: sectionId, label }], [context, sectionId, label]);

  return (
    <FieldSectionsContext.Provider value={newContextValue}>
      {children}
    </FieldSectionsContext.Provider>
  );
};


type NullableWrapperProps<State = BaseFieldState, FieldName = BaseFieldName> = {
  nullable?: boolean;
  name: FieldName;
  state: State | null;
  setState: (newState: State | null, blurAfterStateSet?: boolean) => void;
  getInitialStateWhenCreating: () => State;
  inputRef?: React.MutableRefObject<{ focus: () => void } | null>;
  children?: React.ReactNode;
};

// The NullableWrapper is a compone that a field can use within its `modifyMarkup` to easily handle
// nullable fields in a standardized way.
//
// When enabled, This component renders its children next to the "set" radiobutton and adds a
// second radiobutton for "null" - when the "null" one is selected, the field state is set to null.
// And, when the "set" radiobutton is selected, the initial control value is stored into the field
// state (`getInitialStateWhenCreating`) and the field is focused if a ref is passed in as `inputRef`.
export const NullableWrapper = <
  State = BaseFieldState,
  FieldName = BaseFieldName
>(props: NullableWrapperProps<State, FieldName>) => {
  // FIXME: there's something not working right here with switching back and forth where the non
  // null radio button needs to be clicked twice for it to be set

  const onMakeNotNull = useCallback(() => {
    props.setState(props.getInitialStateWhenCreating(), true);

    // Focus the control now that it is the active one
    if (props.inputRef?.current) {
      setTimeout(() => {
        if (!props.inputRef?.current) {
          return;
        }

        if (props.inputRef.current) {
          props.inputRef.current.focus();
        }
      }, 0);
    }
  }, [props.setState, props.getInitialStateWhenCreating, props.inputRef]);

  const onMakeNull = useCallback(() => {
    props.setState(null, true);
  }, [props.setState]);

  if (!props.nullable) {
    return props.children;
  }

  return (
    <div style={{display: 'inline-flex', gap: 8, alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 4, alignItems: 'center'}}>
        <Radiobutton
          checked={props.state !== null}
          onChange={(checked) => {
            if (checked) {
              onMakeNotNull();
            }
          }}
        />
        <div
          style={{ position: 'relative' }}
          onClick={() => {
            if (props.state === null) {
              onMakeNotNull();
            }
          }}
        >
          {/*
          Disabled fields likely have something like `user-select: none;`. So, put this
          div on top so that it will soak up click events and make the input no longer null.
          */}
          {props.state === null ? (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} />
          ) : null}
          {props.children || "Value"} {/* If unset, use the generic "value" */}
        </div>
      </div>
      <div style={{display: 'flex', gap: 4, alignItems: 'center'}}>
        <Radiobutton
          checked={props.state === null}
          id={`${props.name}-null`}
          onChange={checked => {
            if (checked) {
              onMakeNull();
            }
          }}
        />
        <label htmlFor={`${props.name}-null`}>null</label>
      </div>
    </div>
  );
};
