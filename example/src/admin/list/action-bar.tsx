import { Fragment } from "react";
import { BaseItem, ALL_ITEMS, FixMe } from "../types";
import { useControls } from "../controls";
import { useListDataContext } from "..";

import styles from '../styles.module.css';

type ListActionBarProps<Item = BaseItem, CanSelectAllAcrossPages = false> = {
  canSelectAllAcrossPages?: CanSelectAllAcrossPages;
  children?: (
    items: CanSelectAllAcrossPages extends true ? (Array<Item> | typeof ALL_ITEMS) : Array<Item>,
  ) => React.ReactNode;
};

const ListActionBar = <Item = BaseItem, CanSelectAllAcrossPages = false>({
  canSelectAllAcrossPages = (false as FixMe),
  children = (() => null),
}: ListActionBarProps<Item, CanSelectAllAcrossPages>) => {
  const listDataContextData = useListDataContext<Item>('ListActionBar');

  const Controls = useControls();

  // This control is hidden when nothing is checked
  if (
    listDataContextData.checkedItemKeys !== ALL_ITEMS &&
    listDataContextData.checkedItemKeys.length === 0
  ) {
    return null;
  }

  if (listDataContextData.listData.status !== 'COMPLETE') {
    return (
      <div className={styles.listActionBar}>
        <em>Loading...</em>
      </div>
    );
  }

  const numberOfCheckedItems = listDataContextData.checkedItemKeys === ALL_ITEMS ? (
    listDataContextData.listData.totalCount
  ) : listDataContextData.checkedItemKeys.length;
  const areAllInMemoryItemsChecked = listDataContextData.listData.data.length === numberOfCheckedItems;

  return (
    <Fragment>
      <Controls.AppBar
        size="regular"
        intent="header"
        title={
          <Fragment>
            <span>{numberOfCheckedItems} {numberOfCheckedItems === 1 ? listDataContextData.singularDisplayName : listDataContextData.pluralDisplayName}</span>
            <Controls.Button onClick={() => listDataContextData.onChangeCheckedItemKeys([])}>
              Deselect
            </Controls.Button>
            |
            {/* FIXME: get `fields` in here so I can add this! */}
            {/* <ListCSVExport<Item, FieldName> */}
            {/*   pluralDisplayName={listDataContextData.pluralDisplayName} */}
            {/*   fields={dataContext.f} */}
            {/*   // fetchPageOfData={listDataContextData.fe} */}
            {/*   listData={listDataContextData.listData} */}
            {/*   columnSets={columnSets} */}
            {/*   keyGenerator={listDataContextData.keyGenerator} */}
            {/*   checkedItemKeys={listDataContextData.checkedItemKeys} */}
            {/* /> */}
            {listDataContextData.checkedItemKeys === ALL_ITEMS ? (
              children(ALL_ITEMS)
            ) : children(
              listDataContextData.listData.data.filter((item) => {
                const key = listDataContextData.keyGenerator(item)
                return listDataContextData.checkedItemKeys.includes(key);
              })
            )}
          </Fragment>
        }
      />

      {/* If enabled, give the user the ability to be able to select all pages of data that match the query */}
      {canSelectAllAcrossPages && (areAllInMemoryItemsChecked || listDataContextData.checkedItemKeys === ALL_ITEMS) ? (
        <Fragment>
          {listDataContextData.checkedItemKeys !== ALL_ITEMS ? (
            <div
              className={styles.listActionBarSelectAllBanner}
              onClick={() => listDataContextData.onChangeCheckedItemKeys(ALL_ITEMS)}
            >
              {numberOfCheckedItems}{' '}
              {numberOfCheckedItems === 1 ? listDataContextData.singularDisplayName : listDataContextData.pluralDisplayName}{' '}
              on screen selected.&nbsp;
              <span style={{textDecoration: 'underline', cursor: 'pointer'}}>
                Select all {listDataContextData.listData.totalCount}{' '}
                {listDataContextData.listData.totalCount === 1 ? (
                  listDataContextData.singularDisplayName
                ) : listDataContextData.pluralDisplayName}{' '}
                that match this query...
              </span>
            </div>
          ) : (
            <div
              className={styles.listActionBarSelectAllBanner}
              onClick={() => listDataContextData.onChangeCheckedItemKeys(ALL_ITEMS)}
            >
              Selected all {listDataContextData.listData.totalCount}{' '}
              {listDataContextData.listData.totalCount === 1 ? (
                listDataContextData.singularDisplayName
              ) : listDataContextData.pluralDisplayName}{' '}
              that match this query...
            </div>
          )}
        </Fragment>
      ) : null}
    </Fragment>
  );
};

export default ListActionBar;
