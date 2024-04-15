import { useRef, useMemo } from "react";

import { FixMe, BaseItem, BaseFieldName } from "../types";
import Field, { FieldMetadata, NullableWrapper } from ".";
import TextInput from "../controls/TextInput";


export type InputFieldProps<
  Item = BaseItem,
  Field = BaseFieldName,
  // FIXME: this Nullable thing isn't quire right, either get rid of it and make state always
  // `string | null` or figure out why it isn't working properly
  Nullable = false,
  State = Nullable extends true ? (string | null) : string,
> = Pick<
  FieldMetadata<Item, Field, State>,
  | 'name'
  | 'singularDisplayName'
  | 'pluralDisplayName'
  | 'csvExportColumnName'
  | 'columnWidth'
  | 'sortable'
  | 'getInitialStateWhenCreating'
  | 'csvExportData'
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
const InputField = <
  Item = BaseItem,
  FieldName = BaseFieldName,
  Nullable = false,
>(props: InputFieldProps<Item, FieldName, Nullable>) => {
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
      displayMarkup={state => state === null ? <em style={{color: 'silver'}}>null</em> : <span>{state}</span>}
      modifyMarkup={(state, setState, item, onBlur) => {
        const input = props.inputMarkup ? props.inputMarkup(state, setState, item, onBlur) : (
          <TextInput
            ref={inputRef}
            type={props.type || "text"}
            value={state === null ? '' : `${state}`}
            disabled={state === null}
            onChange={setState}
            onBlur={onBlur}
          />
        );

        return (
          <NullableWrapper<string, FieldName>
            nullable={props.nullable as boolean}
            name={props.name}
            state={state}
            setState={setState}
            getInitialStateWhenCreating={props.getInitialStateWhenCreating}
            onBlur={onBlur}
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
