import * as React from 'react';
import { Fragment, useState, useContext } from 'react';

import styles from '../styles.module.css';

import {
  FixMe,
  BaseItem,
  BaseFieldName,
  ALL_ITEMS,
  Sort,
} from '../types';
import Navigatable from "../navigatable";
import { useControls } from '../controls';
import { DataModel, DataModelsContext } from '../datamodel';
import { FieldMetadata, FieldCollection, FieldsProvider, EMPTY_FIELD_COLLECTION } from '../fields';
import { DataContextList } from '.';
import { useListDataContext } from '../data-context';
import ListCSVExport from '../csv-export';
import ListColumnSetSelector from './column-sets';
import ManuallyStickyTHead from '../utils/ManuallyStickyTHead';

export type ListTableItemProps<Item, FieldName> = {
  item: Item,
  visibleFieldNames: Array<FieldName>;
  fields: FieldCollection<FieldMetadata<Item, FieldName>>,

  detailLink?: Navigatable,

  checkable: boolean,
  checkType: 'checkbox' | 'radio',
  checked: boolean,
  checkboxDisabled: boolean,
  onChangeChecked: (checked: boolean, shiftKey?: boolean) => void,
};

export const ListTableItem = <Item = BaseItem, FieldName = BaseFieldName>({
  item,
  visibleFieldNames,
  fields,
  detailLink,
  checkable,
  checkType,
  checked,
  onChangeChecked,
}: ListTableItemProps<Item, FieldName>) => {
  const Controls = useControls();
  return (
    <tr>
      {checkable ? (
        <td
          className={styles.floatingCheckbox}
          onClick={e => onChangeChecked(
            !checked,
            (e.nativeEvent as FixMe).shiftKey
          )}
          // Ensure that clicking on checkboxes doesn't accidentally select stuff in the table
          onMouseDown={() => { document.body.style.userSelect = 'none'; }}
          onMouseUp={() => { document.body.style.userSelect = ''; }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {checkType === "checkbox" ? (
              <Controls.Checkbox
                checked={checked}
                onChange={onChangeChecked}
              />
            ) : (
              <Controls.Radiobutton
                checked={checked}
                onChange={onChangeChecked}
              />
            )}
          </div>
        </td>
      ) : null}
      {visibleFieldNames.map(name => {
        const field = fields.metadata.find(f => f.name === name);
        if (!field) {
          return null;
        }

        return (
          <td key={field.name as string}>
            {field.displayMarkup(field.getInitialStateFromItem(item), item)}
          </td>
        );
      })}
      {detailLink ? (
        <Fragment>
          {/* This element acts as a spacer to ensure there is enough room all the way at the right for "details" */}
          <td style={{visibility: 'hidden'}}>
            <Controls.NavigationButton navigatable={detailLink}>Details...</Controls.NavigationButton>
          </td>
          <td className={styles.floatingDetails}>
            <Controls.NavigationButton navigatable={detailLink}>Details...</Controls.NavigationButton>
          </td>
        </Fragment>
      ) : null}
    </tr>
  );
};

type ListTableProps<Item, FieldName> = {
  detailLinkColumnWidth?: null | string | number;
  checkboxesColumnWidth?: null | string | number;
  columnSets?: { [name: string]: Array<FieldName> };
  renderColumnSetSelector?: (params: {
    fields: FieldCollection<FieldMetadata<Item, FieldName>>;
    columnSets: { [name: string]: Array<FieldName> };
    columnSet: 'all' | string | Array<FieldName>;
    onChangeColumnSet: (newColumnSet: 'all' | string | Array<FieldName>) => void;
  }) => React.ReactNode;

  renderNextPageIndicator?: (params: {
    loadingNextPage: boolean;
    nextPageAvailable: boolean;
    onLoadNextPage: () => Promise<void>;
  }) => React.ReactNode;
  renderTableWrapper?: (params: {
    listDataContextData: DataContextList<Item, FieldName>;
    fields: FieldCollection<FieldMetadata<Item, FieldName>>;
    detailLinkEnabled: boolean;
    detailLinkWidth: null | string | number;
    checkboxesWidth: null | string | number;
    visibleFieldNames: Array<FieldName>;
    columnSets?: { [name: string]: Array<FieldName> };
    renderColumnSetSelector?: (params: {
      fields: FieldCollection<FieldMetadata<Item, FieldName>>;
      columnSets: { [name: string]: Array<FieldName> };
      columnSet: 'all' | string | Array<FieldName>;
      onChangeColumnSet: (newColumnSet: 'all' | string | Array<FieldName>) => void;
    }) => React.ReactNode;
    childrenContainsItems: boolean;
    children: React.ReactNode;
  }) => React.ReactNode;
  renderTableItem?: (params: ListTableItemProps<Item, FieldName>) => React.ReactNode;
  children?: React.ReactNode;
};

const ListTable = <Item = BaseItem, FieldName = BaseFieldName>({
  detailLinkColumnWidth = null,
  checkboxesColumnWidth = 32 /* px */,
  columnSets,
  renderColumnSetSelector = ({fields, columnSets, columnSet, onChangeColumnSet}) => (
    <ListColumnSetSelector<Item, FieldName>
      fields={fields}
      columnSets={columnSets}
      columnSet={columnSet}
      onChangeColumnSet={onChangeColumnSet}
    />
  ),
  renderNextPageIndicator = ({ loadingNextPage, nextPageAvailable, onLoadNextPage }) => {
    if (loadingNextPage) {
      return (
        <div className={styles.tableNextPageIndicator}>
          <div className={styles.tableNextPageLoading}>Loading next page...</div>
        </div>
      );
    }
    if (!nextPageAvailable) {
      return null;
    }

    return (
      <div className={styles.tableNextPageIndicator}>
        <button className={styles.tableNextPageButton} onClick={onLoadNextPage}>Load more...</button>
      </div>
    );
  },
  renderTableWrapper = ({
    listDataContextData,
    fields,
    detailLinkEnabled,
    detailLinkWidth,
    checkboxesWidth,
    visibleFieldNames,
    columnSets,
    renderColumnSetSelector,
    childrenContainsItems,
    children,
  }) => {
    const Controls = useControls();

    const allChecked = listDataContextData.checkedItemKeys === ALL_ITEMS ? (
      true
    ) : (
      listDataContextData.listData.status === 'COMPLETE' ? (
        listDataContextData.listData.data.length === listDataContextData.checkedItemKeys.length
      ) : false
    );

    return (
      <div className={styles.tableWrapper}>
        <table>
          <ManuallyStickyTHead>
            <tr>
              {/* Add a column for the checkboxes */}
              {listDataContextData.checkable ? (
                <th
                  style={{ minWidth: checkboxesWidth || undefined }}
                  className={styles.floatingCheckbox}
                  onClick={() => {
                    if (listDataContextData.listData.status !== 'COMPLETE') {
                      return;
                    }
                    const newAllChecked = !allChecked;
                    if (newAllChecked) {
                      const keys = listDataContextData.listData.data.map(item => listDataContextData.keyGenerator(item));
                      listDataContextData.onChangeCheckedItemKeys(keys);
                    } else {
                      listDataContextData.onChangeCheckedItemKeys([]);
                    }
                  }}
                >
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Controls.Checkbox
                      disabled={!childrenContainsItems}
                      checked={allChecked}
                      onChange={checked => {
                        if (listDataContextData.listData.status !== 'COMPLETE') {
                          return;
                        }

                        if (checked) {
                          const keys = listDataContextData.listData.data.map(item => listDataContextData.keyGenerator(item));
                          listDataContextData.onChangeCheckedItemKeys(keys);
                        } else {
                          listDataContextData.onChangeCheckedItemKeys([]);
                        }
                      }}
                    />
                  </div>
                </th>
              ) : null}
              {visibleFieldNames.map(name => {
                const fieldMetadata = fields.metadata.find(f => f.name === name);
                if (!fieldMetadata) {
                  return null;
                }

                return (
                  <th
                    key={fieldMetadata.name as string}
                    className={fieldMetadata.sortable ? styles.sortable : undefined}
                    style={{minWidth: fieldMetadata.columnWidth, maxWidth: fieldMetadata.columnWidth}}
                    onClick={fieldMetadata.sortable ? () => {
                      if (!listDataContextData.sort) {
                        // Initially set the sort
                        listDataContextData.onChangeSort({
                          fieldName: fieldMetadata.name,
                          direction: 'desc'
                        } as Sort);
                      } else if (listDataContextData.sort.fieldName !== fieldMetadata.name) {
                        // A different column was selected, so initially set the sort for this new column
                        listDataContextData.onChangeSort({
                          fieldName: fieldMetadata.name,
                          direction: 'desc'
                        } as Sort);
                      } else {
                        // Cycle the sort to the next value
                        switch (listDataContextData.sort.direction) {
                          case 'desc':
                            listDataContextData.onChangeSort({
                              fieldName: fieldMetadata.name,
                              direction: 'asc',
                            } as Sort);
                            return;
                          case 'asc':
                            listDataContextData.onChangeSort(null);
                            return;
                        }
                      }
                    } : undefined}
                  >
                    {fieldMetadata.singularDisplayName}
                    {listDataContextData.sort && listDataContextData.sort.fieldName === fieldMetadata.name ? (
                      <span className={styles.tableWrapperSortIndicator}>
                        {listDataContextData.sort.direction === 'desc' ? <Fragment>&darr;</Fragment> : <Fragment>&uarr;</Fragment>}
                      </span>
                    ) : null}
                  </th>
                );
              })}
              <th className={styles.listTableHeaderActionsWrapper}>
                {(
                  columnSets &&
                  Object.keys(columnSets).filter(k => k !== 'all').length > 0 && // Make sure more than just "all" is visible
                  renderColumnSetSelector
                ) ? (
                  renderColumnSetSelector({
                    fields,
                    columnSets,
                    columnSet: listDataContextData.columnSet,
                    onChangeColumnSet: listDataContextData.onChangeColumnSet,
                  })
                ) : null}

                <ListCSVExport<Item, FieldName>
                  pluralDisplayName={listDataContextData.pluralDisplayName}
                  fields={fields}
                  fetchListDataFromServer={listDataContextData.fetchListDataFromServer}
                  listData={listDataContextData.listData}
                  filtersHaveBeenAppliedToListData={listDataContextData.filters.length > 0}
                  columnSets={columnSets}
                  keyGenerator={listDataContextData.keyGenerator}
                  checkedItemKeys={listDataContextData.checkedItemKeys}
                />
              </th>
            </tr>
          </ManuallyStickyTHead>
          {childrenContainsItems ? (
            <tbody>
              {children}
            </tbody>
          ) : null}
        </table>
        {!childrenContainsItems ? children : null}
      </div>
    );
  },
  renderTableItem = (props) => (
    <ListTableItem {...props} />
  ),
  children,
}: ListTableProps<Item, FieldName>) => {
  // First, get the list context data
  const listDataContextData = useListDataContext<Item, FieldName>('ListTable');

  // Then get the data model context data
  const dataModelsContextData = useContext(DataModelsContext);
  if (!dataModelsContextData) {
    throw new Error('Error: <ListTable ... /> was not rendered inside of a container component! Try rendering this inside of a <DataModels> ... </DataModels>.');
  }
  const dataModel = dataModelsContextData[0].get(listDataContextData.name) as DataModel<Item> | undefined;
  if (!dataModel) {
    throw new Error(`Error: <ListTable ... /> cannot find data model with name ${listDataContextData.name}!`);
  }

  const [fields, setFields] = useState<FieldCollection<FieldMetadata<Item, FieldName>>>(
    (EMPTY_FIELD_COLLECTION as any) as FieldCollection<FieldMetadata<Item, FieldName>>
  );

  // Convert the column set into the columns to render in the table
  let visibleFieldNames: Array<FieldName> = [];
  if (listDataContextData.columnSet === 'all' && columnSets && !columnSets.all) {
    visibleFieldNames = fields.names as Array<FieldName>;
  } else if (Array.isArray(listDataContextData.columnSet)) {
    // A manual list of fields
    visibleFieldNames = listDataContextData.columnSet as Array<FieldName>;
  } else {
    const columns = columnSets ? columnSets[listDataContextData.columnSet] : null;
    if (columns) {
      visibleFieldNames = columns;
    } else {
      // Default to all columns if no columnset can be found
      visibleFieldNames = fields.metadata.map(f => f.name);
    }
  }

  let tableItemsChildren: React.ReactNode = null;
  switch (listDataContextData.listData.status) {
    case 'IDLE':
    case 'LOADING_INITIAL':
      tableItemsChildren = (
        <div className={styles.listTableEmptyState}>
          Loading {listDataContextData.pluralDisplayName}...
        </div>
      );
      break;
    case 'ERROR_INITIAL':
      tableItemsChildren = (
        <div className={styles.listTableErrorState}>
          Error loading {listDataContextData.pluralDisplayName}: {listDataContextData.listData.error.message}
        </div>
      );
      break;
    case 'COMPLETE':
    case 'LOADING_NEXT_PAGE':
      if (listDataContextData.listData.data.length > 0) {
        tableItemsChildren = (
          <Fragment>
            {listDataContextData.listData.data.map((item, index) => {
              const key = listDataContextData.keyGenerator(item);
              return (
                <Fragment key={key}>
                  {renderTableItem({
                    item,
                    fields,
                    visibleFieldNames,
                    detailLink: listDataContextData.detailLinkGenerator ? listDataContextData.detailLinkGenerator(item) : undefined,
                    checkable: listDataContextData.checkable,
                    checkType: 'checkbox',
                    checked: listDataContextData.checkedItemKeys === ALL_ITEMS ? true : listDataContextData.checkedItemKeys.includes(key),
                    checkboxDisabled: listDataContextData.checkedItemKeys === ALL_ITEMS,
                    onChangeChecked: (checked: boolean, shiftKey?: boolean) => {
                      if (listDataContextData.listData.status !== 'COMPLETE') {
                        return;
                      }
                      if (listDataContextData.checkedItemKeys === ALL_ITEMS) {
                        return;
                      }

                      if (shiftKey) {
                        // Shift was held, so a range of items should be checked
                        //
                        // NOTE: this probably should instead use the last changed checkbox index, as
                        // that would then allow for shift-selections in reverse order as well
                        //
                        // Find the previous item that is in the new `checked` state
                        let previousItem = item;
                        let previousItemIndex = index;
                        for (let i = index-1; i >= 0; i -= 1) {
                          previousItemIndex = i;
                          previousItem = listDataContextData.listData.data[i]!;

                          const previousItemChecked = listDataContextData.checkedItemKeys.includes(listDataContextData.keyGenerator(previousItem));
                          if (previousItemChecked === checked) {
                            // This is the other side of the bulk check operation!
                            break;
                          }
                        }

                        // Set the checked value for the items in the check range
                        let newCheckedItemKeys = listDataContextData.checkedItemKeys.slice();
                        for (let i = previousItemIndex+1; i <= index; i += 1) {
                          const key = listDataContextData.keyGenerator(listDataContextData.listData.data[i]!);
                          if (checked) {
                            newCheckedItemKeys = [ ...newCheckedItemKeys, key ];
                          } else {
                            newCheckedItemKeys = newCheckedItemKeys.filter(k => k !== key);
                          }
                        }
                        listDataContextData.onChangeCheckedItemKeys(newCheckedItemKeys);
                      } else {
                        // Shift was not held, so a single item is being checked or unchecked
                        if (checked) {
                          listDataContextData.onChangeCheckedItemKeys([
                            ...listDataContextData.checkedItemKeys,
                            key,
                          ]);
                        } else {
                          listDataContextData.onChangeCheckedItemKeys(listDataContextData.checkedItemKeys.filter(k => k !== key));
                        }
                      }
                    },
                  })}
                </Fragment>
              );
            })}
          </Fragment>
        );
      } else {
        tableItemsChildren = (
          <div className={styles.listTableEmptyState}>
            No {listDataContextData.pluralDisplayName} found
          </div>
        );
      }
      break;
  }

  return (
    <FieldsProvider dataModel={dataModel} onChangeFields={setFields}>
      <div className={styles.listTable}>
        {renderTableWrapper({
          listDataContextData,
          fields,
          detailLinkEnabled: listDataContextData.detailLinkGenerator !== null,
          detailLinkWidth: detailLinkColumnWidth,
          checkboxesWidth: checkboxesColumnWidth,
          visibleFieldNames,
          columnSets,
          renderColumnSetSelector,
          childrenContainsItems: (
            listDataContextData.listData.status === 'LOADING_NEXT_PAGE' ||
            (listDataContextData.listData.status === 'COMPLETE' && listDataContextData.listData.data.length > 0)
          ),
          children: tableItemsChildren,
        })}

        {renderNextPageIndicator({
          loadingNextPage: listDataContextData.listData.status === 'LOADING_NEXT_PAGE',
          nextPageAvailable: listDataContextData.listData.status === 'COMPLETE' ? listDataContextData.listData.nextPageAvailable : false,
          onLoadNextPage: listDataContextData.onLoadNextPage,
        })}

        {/* The children should not render anything, this should purely be Fields */}
        {children}
      </div>
    </FieldsProvider>
  );
};

export default ListTable;
