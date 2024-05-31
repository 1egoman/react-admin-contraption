import * as React from 'react';
import { useMemo, useCallback } from 'react';

import { FixMe, BaseItem, BaseFieldName, BaseFieldState } from '../types';
import { useControls, SelectOption } from '../controls';
import Field, { FieldMetadata } from '../fields';

export type ChoiceFieldProps<Item = BaseItem, FieldName = BaseFieldName, State = BaseFieldState, Nullable = false> = Pick<
  FieldMetadata<Item, FieldName, Nullable extends true ? State | null : State>,
  | 'name'
  | 'singularDisplayName'
  | 'pluralDisplayName'
  | 'csvExportColumnName'
  | 'columnWidth'
  | 'sortable'
> & {
  getInitialStateFromItem?: (item: Item) => Nullable extends true ? State | null : State;
  getInitialStateWhenCreating: () => (Nullable extends true ? State | null : State);
  serializeStateToItem?: (partialItem: Partial<Item>, state: Nullable extends true ? State | null : State, initialItemAtPageLoad: Item | null) => Partial<Item>;
  choices: Array<{ id: State; disabled?: boolean; label: React.ReactNode; }>;

  nullable?: Nullable;

  displayMarkup?: FieldMetadata<Item, FieldName, Nullable extends true ? State | null : State>['displayMarkup'];
  inputMarkup?: FieldMetadata<Item, FieldName, Nullable extends true ? State | null : State>['modifyMarkup'];
  csvExportData?: FieldMetadata<Item, FieldName, Nullable extends true ? State | null : State>['csvExportData'];
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
const ChoiceField = <
  Item = BaseItem,
  FieldName = BaseFieldName,
  State = BaseFieldState,
  Nullable = false,
>(props: ChoiceFieldProps<Item, FieldName, State, Nullable>) => {
  const Controls = useControls();

  const getInitialStateFromItem = useMemo(() => {
    return props.getInitialStateFromItem || ((item: Item) => `${(item as FixMe)[props.name as FixMe]}` as State);
  }, [props.getInitialStateFromItem, props.name]);

  const injectAsyncDataIntoInitialStateOnDetailPage = useCallback(
    (state: Nullable extends true ? State | null : State) => Promise.resolve(state),
    []
  );

  return (
    <Field<Item, FieldName, Nullable extends true ? State | null : State>
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
              if (props.nullable && newValue === 'NULL') {
                setState(null as FixMe);
                return;
              }

              const choice = props.choices.find(c => `${c.id}` === newValue);
              if (!choice) {
                return;
              }
              setState(choice.id as FixMe); // FIXME: I don't get why this line has a type error without the cast... Fix this!
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

export default ChoiceField;
