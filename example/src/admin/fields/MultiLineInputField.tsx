import * as React from 'react';
import { useMemo, useRef } from 'react';

import { FixMe, BaseItem, BaseFieldName } from '../types';

import { useControls } from '../controls';
import Field, { NullableWrapper } from '../fields';
import { InputFieldProps } from '../fields/InputField';

type MultiLineInputFieldProps<
  Item = BaseItem,
  FieldName = BaseFieldName,
  Nullable = false,
> = Omit<InputFieldProps<Item, FieldName, Nullable>, 'type'>;

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
const MultiLineInputField = <
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
            onChange={setState as FixMe} // FIXME: why does this line have a type error without the cast? Fix this!
            onBlur={onBlur}
          />
        );

        return (
          <NullableWrapper<string, FieldName>
            nullable={props.nullable as boolean}
            name={props.name}
            state={state}
            setState={setState as FixMe} // FIXME: why does this line have a type error without the cast? Fix this!
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

export default MultiLineInputField;
