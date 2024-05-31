import { useMemo } from 'react';
import { FixMe, BaseItem, BaseFieldName } from '../types';
import ChoiceField, { ChoiceFieldProps } from './ChoiceField';

type BooleanFieldProps<Item = BaseItem, FieldName = BaseFieldName, Nullable = false> = Omit<
  ChoiceFieldProps<Item, FieldName, boolean, Nullable>,
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
const BooleanField = <Item = BaseItem, FieldName = BaseFieldName, Nullable = false>(props: BooleanFieldProps<Item, FieldName, Nullable>) => {
  const getInitialStateFromItem = useMemo(() => {
    return props.getInitialStateFromItem || ((item: Item) => (item as FixMe)[props.name as FixMe] as boolean);
  }, [props.getInitialStateFromItem, props.name]);

  return (
    <ChoiceField<Item, FieldName, boolean, Nullable>
      name={props.name}
      singularDisplayName={props.singularDisplayName}
      pluralDisplayName={props.pluralDisplayName}
      csvExportColumnName={props.csvExportColumnName}
      columnWidth={props.columnWidth}
      sortable={props.sortable}
      nullable={props.nullable}
      getInitialStateFromItem={getInitialStateFromItem}
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

export default BooleanField;
