import { useCallback, useMemo } from "react";

import { FixMe, BaseItem, BaseFieldName, JSONValue } from "../types";
import Field, { FieldMetadata } from ".";
import { useControls } from "../controls";


type JSONFieldProps<Item = BaseItem, Field = BaseFieldName> = Pick<
  FieldMetadata<Item, Field, string>,
  | 'name'
  | 'singularDisplayName'
  | 'pluralDisplayName'
  | 'csvExportColumnName'
  | 'columnWidth'
  | 'sortable'
> & {
  getInitialStateFromItem?: (item: Item) => JSONValue;
  getInitialStateWhenCreating?: () => JSONValue | undefined;
  serializeStateToItem?: (initialItem: Partial<Item>, state: JSONValue) => Partial<Item>;

  type?: HTMLInputElement['type'];
  inputMarkup?: FieldMetadata<Item, Field, [string, boolean]>['modifyMarkup'];
  csvExportData?: FieldMetadata<Item, Field, JSONValue>['csvExportData'];
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
const JSONField = <
  Item = BaseItem,
  FieldName = BaseFieldName,
>(props: JSONFieldProps<Item, FieldName>) => {
  const Controls = useControls();

  const getInitialStateFromItem = useCallback((item: Item): [string, boolean] => {
    const value = props.getInitialStateFromItem ? props.getInitialStateFromItem(item) : (item as FixMe)[props.name as FixMe];
    return [JSON.stringify(value, null, 2), false];
  }, [props.getInitialStateFromItem, props.name]);

  const getInitialStateWhenCreating = useCallback((): [string, boolean] | undefined => {
    const result = JSON.stringify(
      props.getInitialStateWhenCreating ? props.getInitialStateWhenCreating() : {}
    );
    if (result) {
      return [result, false];
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
      return preexisting(item, JSON.parse(body));
    };
  }, [props.serializeStateToItem, props.name]);

  const csvExportData = useCallback((state: [string, boolean], item: Item) => {
    const [text, invalid] = state;
    if (invalid) {
      return '';
    }

    if (props.csvExportData) {
      return props.csvExportData(JSON.parse(text) as JSONValue, item);
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
          <Controls.TextArea
            monospace
            value={text}
            invalid={invalid}
            onChange={text => {
              let invalid = false;
              try {
                JSON.parse(text);
              } catch {
                invalid = true;
              }

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

export default JSONField;
