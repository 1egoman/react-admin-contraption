import * as React from 'react';
import { useMemo, useCallback } from 'react';

import { FixMe, JSONValue, BaseItem, BaseFieldName } from '../types';
import { useControls } from '../controls';
import Field, { FieldMetadata } from '../fields';

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
const NumberField = <Item = BaseItem, FieldName = BaseFieldName>(props: NumberFieldProps<Item, FieldName>) => {
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

export default NumberField;
