import { useCallback, useMemo } from "react";

import { BaseItem, BaseFieldName, FixMe } from "../types";
import Field, { FieldMetadata } from ".";
import { useControls } from "../controls";

export type PrimaryKeyFieldProps<
  Item = BaseItem,
  Field = BaseFieldName,
  Nullable = false,
> = Pick<
  FieldMetadata<Item, Field, Nullable extends true ? (string | null) : string>,
  | 'name'
  | 'singularDisplayName'
  | 'pluralDisplayName'
  | 'csvExportColumnName'
  | 'sortable'
  | 'columnWidth'
  | 'getInitialStateWhenCreating'
  | 'modifyMarkup'
  | 'csvExportData'
> & {
  nullable?: Nullable;
  getInitialStateFromItem?: FieldMetadata<Item, Field, Nullable extends true ? (string | null) : string>['getInitialStateFromItem'];
  serializeStateToItem?: FieldMetadata<Item, Field, Nullable extends true ? (string | null) : string>['serializeStateToItem'];
  displayMarkup?: FieldMetadata<Item, Field, Nullable extends true ? (string | null) : string>['displayMarkup'];
};

/*
Example PrimaryKeyField:
<PrimaryKeyField<BattleWithParticipants, 'startedAt'>
  name="startedAt"
  singularDisplayName="Started At"
  pluralDisplayName="Started Ats"
  columnWidth="200px"
  sortable
/>
*/
const PrimaryKeyField = <
  Item = BaseItem,
  FieldName = BaseFieldName,
  Nullable = false,
>(props: PrimaryKeyFieldProps<Item, FieldName, Nullable>) => {
  const Controls = useControls();

  const injectAsyncDataIntoInitialStateOnDetailPage = useMemo(() => {
    return (state: Nullable extends true ? (string | null) : string) => Promise.resolve(state)
  }, []);

  const defaultDisplayMarkup: NonNullable<(typeof props)['displayMarkup']> = useCallback((state, _item, { detailLink }) => {
    if (state === null) {
      return (
        <em style={{color: 'silver'}}>null</em>
      );
    } else {
      return (
        <Controls.NavigationLink navigatable={detailLink}>{state}</Controls.NavigationLink>
      );
    }
  }, []);

  return (
    <Field<Item, FieldName, Nullable extends true ? (string | null) : string>
      name={props.name}
      singularDisplayName={props.singularDisplayName}
      pluralDisplayName={props.pluralDisplayName}
      csvExportColumnName={props.csvExportColumnName}
      columnWidth={props.columnWidth}
      sortable={props.sortable}
      getInitialStateFromItem={props.getInitialStateFromItem || (item => (item as FixMe)[props.name])}
      injectAsyncDataIntoInitialStateOnDetailPage={injectAsyncDataIntoInitialStateOnDetailPage}
      getInitialStateWhenCreating={props.getInitialStateWhenCreating || (() => '')}
      serializeStateToItem={props.serializeStateToItem || (item => item)}
      displayMarkup={props.displayMarkup || defaultDisplayMarkup}
      modifyMarkup={props.modifyMarkup}
      csvExportData={props.csvExportData}
    />
  );
};

export default PrimaryKeyField;
