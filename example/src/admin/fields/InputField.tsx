import { useRef, useMemo } from "react";

import { FixMe, BaseItem, BaseFieldName } from "../types";
import Field, { FieldMetadata, NullableWrapper } from ".";
import { useControls } from "../controls";


export type InputFieldProps<
  Item = BaseItem,
  Field = BaseFieldName,
  Nullable = false,
> = Pick<
  FieldMetadata<Item, Field, Nullable extends true ? (string | null) : string>,
  | 'name'
  | 'singularDisplayName'
  | 'pluralDisplayName'
  | 'csvExportColumnName'
  | 'columnWidth'
  | 'sortable'
  | 'getInitialStateWhenCreating'
  | 'csvExportData'
> & {
  getInitialStateFromItem?: (item: Item) => (Nullable extends true ? (string | null) : string);
  getInitialStateWhenCreating?: () => (Nullable extends true ? (string | null) : string) | undefined;
  serializeStateToItem?: (partialItem: Partial<Item>, state: Nullable extends true ? (string | null) : string, initialItemAtPageLoad: Item | null) => Partial<Item>;

  type?: HTMLInputElement['type'];
  nullable?: Nullable;
  displayMarkup?: FieldMetadata<Item, Field, Nullable extends true ? (string | null) : string>['displayMarkup'];
  inputMarkup?: FieldMetadata<Item, Field, Nullable extends true ? (string | null) : string>['modifyMarkup'];
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
const InputField = <
  Item = BaseItem,
  FieldName = BaseFieldName,
  Nullable = false,
>(props: InputFieldProps<Item, FieldName, Nullable>) => {
  const Controls = useControls();

  const inputRef = useRef<HTMLInputElement | null>(null);

  const getInitialStateFromItem = useMemo(() => {
    if (props.getInitialStateFromItem) {
      return props.getInitialStateFromItem;
    } else {
      return ((item: Item) => {
        const value = (item as FixMe)[props.name as FixMe];

        if (props.nullable && value === null) {
          return value;
        } else {
          return `${value}`;
        }
      });
    }
  }, [props.getInitialStateFromItem, props.name, props.nullable]);

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
      displayMarkup={props.displayMarkup || (state => state === null ? <em style={{color: 'silver'}}>null</em> : <span>{state}</span>)}
      modifyMarkup={(state, setState, item, onBlur) => {
        const input = props.inputMarkup ? props.inputMarkup(state, setState, item, onBlur) : (
          <Controls.TextInput
            ref={inputRef}
            type={props.type || "text"}
            value={state === null ? '' : `${state}`}
            disabled={state === null}
            onChange={setState as FixMe} // FIXME: the Nullable stuff causes a type error here, fix this!
            onBlur={onBlur}
          />
        );

        return (
          <NullableWrapper<string, FieldName>
            nullable={props.nullable as boolean}
            name={props.name}
            state={state}
            setState={setState as FixMe} // FIXME: the Nullable stuff causes a type error here, fix this!
            getInitialStateWhenCreating={async () => props.getInitialStateWhenCreating ? props.getInitialStateWhenCreating() || '' : ''}
            inputRef={inputRef}
          >
            {input}
          </NullableWrapper>
        );
      }}
      csvExportData={props.csvExportData}
    />
  );
};

export default InputField;
