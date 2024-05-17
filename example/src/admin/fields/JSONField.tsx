import { useCallback, useMemo } from "react";

import { FixMe, BaseItem, BaseFieldName, JSONValue } from "../types";
import Field, { FieldMetadata } from ".";
import { useControls } from "../controls";


type JSONFieldProps<Item = BaseItem, Field = BaseFieldName, JSONType = JSONValue> = Pick<
  FieldMetadata<Item, Field, string>,
  | 'name'
  | 'singularDisplayName'
  | 'pluralDisplayName'
  | 'csvExportColumnName'
  | 'columnWidth'
  | 'sortable'
> & {
  getInitialStateFromItem?: (item: Item) => JSONType;
  getInitialStateWhenCreating?: () => JSONType | undefined;
  serializeStateToItem?: (partialItem: Partial<Item>, state: JSONType, initialItem: Item | null) => Partial<Item>;

  type?: HTMLInputElement['type'];
  inputMarkup?: FieldMetadata<Item, Field, [string, boolean]>['modifyMarkup'];
  csvExportData?: FieldMetadata<Item, Field, JSONType>['csvExportData'];
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
  JSONType = JSONValue,
>(props: JSONFieldProps<Item, FieldName, JSONType>) => {
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

    return (partialItem: Partial<Item>, state: [string, boolean], initialItemAtPageLoad: Item | null) => {
      const [body, invalid] = state;
      if (invalid) {
        return partialItem;
      }
      return preexisting(partialItem, JSON.parse(body), initialItemAtPageLoad);
    };
  }, [props.serializeStateToItem, props.name]);

  const csvExportData = useCallback((state: [string, boolean], item: Item) => {
    const [text, invalid] = state;
    if (invalid) {
      return '';
    }

    if (props.csvExportData) {
      return props.csvExportData(JSON.parse(text) as JSONType, item);
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
