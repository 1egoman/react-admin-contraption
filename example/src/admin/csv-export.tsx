import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { stringify } from "csv-stringify";

import { BaseFieldName, BaseItem, CheckedItemKeys, FixMe, ItemKey } from "./types";

import styles from "./styles.module.css";
import { FieldCollection, FieldMetadata } from "./fields";
import { ListData } from "./list";
import useInFlightAbortControllers from "./utils/use-in-flight-abort-controllers";
import { useControls } from "./controls";

// a little function to help us with reordering the result
function reorder<T>(list: Array<T>, startIndex: number, endIndex: number): Array<T> {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed!);

  return result;
}

function listsPairWiseMatch<T>(listA: Array<T>, listB: Array<T>): boolean {
  return listA.length === listB.length && listA.every((n, index) => n === listB[index]);
}

type CSVExportPreviewTableProps<Item = BaseItem, FieldName = BaseFieldName> = Pick<
  ListCSVExportProps<Item, FieldName>,
  | 'fields'
  | 'listData'
> & {
  shouldIncludeRowInPreview: (item: Item) => boolean;
  columnNamesInOrder: Array<FieldName>;
  onChangeColumnNamesInOrder: (newNamesInOrderFn: Array<FieldName> | ((old: Array<FieldName>) => Array<FieldName>)) => void;
  disabled?: boolean;
};

const CSVExportPreviewTable = <Item = BaseItem, FieldName = BaseFieldName>(props: CSVExportPreviewTableProps<Item, FieldName>) => {
  const Controls = useControls();

  const fieldOptions = useMemo(() => {
    return props.fields.metadata.map(metadata => ({
      value: metadata.name as string,
      label: metadata.csvExportColumnName || metadata.singularDisplayName,
    }));
  }, [props.fields, props.columnNamesInOrder]);

  const fieldNames = useMemo(() => props.fields.names as Array<FieldName>, [props.fields]);

  const onDragEnd = useCallback((result: DropResult) => {
    if (result.destination === null) {
      return;
    }

    const newColumnNamesInOrder = reorder(
      props.columnNamesInOrder,
      result.source.index,
      result.destination.index
    );
    props.onChangeColumnNamesInOrder(newColumnNamesInOrder);
  }, [props.columnNamesInOrder, props.onChangeColumnNamesInOrder]);

  return (
    /* adapted from https://codesandbox.io/p/sandbox/react-beautiful-dnd-zh2wy?file=%2Findex.js%3A81%2C31 */
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable key="columns" droppableId="columns" direction="horizontal">
        {(provided, _snapshot) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            key="columns"
          >
            <div style={{ display: 'flex' }}>
              <div className={styles.csvExportPreviewTable}>
                {props.columnNamesInOrder.map((name, index) => {
                  const field = props.fields.metadata.find(m => m.name === name);
                  if (!field) {
                    return null;
                  }

                  let cells: React.ReactNode = null;
                  switch (props.listData.status) {
                    case 'IDLE':
                    case 'LOADING_INITIAL':
                      cells = (
                        <div className={styles.csvExportPreviewTableColumnData}>
                          Loading...
                        </div>
                      );
                      break;

                    case 'ERROR_INITIAL':
                      cells = (
                        <div className={styles.csvExportPreviewTableColumnData}>
                          Error loading!
                        </div>
                      );
                      break;

                    case 'COMPLETE':
                    case 'LOADING_NEXT_PAGE':

                      const rows = props.listData.data.filter(props.shouldIncludeRowInPreview);
                      cells = (
                        <Fragment>
                          {rows.slice(0, 5).map(item => (
                            <div className={styles.csvExportPreviewTableColumnData}>
                              {field.csvExportData ? (
                                field.csvExportData(field.getInitialStateFromItem(item), item)
                              ) : `${(item as FixMe)[name]}`}
                            </div>
                          ))}
                          {rows.length > 5 ? (
                            <div className={styles.csvExportPreviewTableColumnData}>...</div>
                          ) : null}
                        </Fragment>
                      );
                      break;
                  }

                  return (
                    <Draggable key={name as string} draggableId={name as string} index={index}>
                      {(provided, _snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={styles.csvExportPreviewTableColumn}
                        >
                          <div className={styles.csvExportPreviewTableColumnHeader}>
                            <Controls.AppBar
                              intent="header"
                              size="small"
                              title={
                                <Fragment>
                                  <div className={styles.csvExportPreviewTableColumnHeaderHandle}>&#8801;</div>
                                </Fragment>
                              }
                              actions={
                                <Fragment>
                                  <div className={styles.csvExportPreviewTableColumnHeaderSelect}>
                                    <Controls.Select
                                      size="small"
                                      value={name as string}
                                      options={fieldOptions}
                                      width="100%"
                                      disabled={props.disabled}
                                      onChange={newName => {
                                        const newNameAsFieldName = newName as FieldName;
                                        const copy = props.columnNamesInOrder.slice();
                                        if (copy.indexOf(newNameAsFieldName) >= 0) {
                                          copy.splice(copy.indexOf(newNameAsFieldName), 1);
                                        }
                                        copy[props.columnNamesInOrder.indexOf(name)] = newNameAsFieldName;
                                        props.onChangeColumnNamesInOrder(copy);
                                      }}
                                    />
                                  </div>
                                  <div className={styles.csvExportPreviewTableColumnHeaderRemove}>
                                    <Controls.IconButton
                                      disabled={props.disabled || props.columnNamesInOrder.length < 2}
                                      onClick={() => {
                                        const copy = props.columnNamesInOrder.slice();
                                        copy.splice(props.columnNamesInOrder.indexOf(name), 1);
                                        props.onChangeColumnNamesInOrder(copy);
                                      }}
                                      size="small"
                                    >&times;</Controls.IconButton>
                                  </div>
                                </Fragment>
                              }
                            />
                          </div>
                          {cells}
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
              <div className={styles.csvExportPreviewTableAddButtonWrapper}>
                <Controls.AppBar
                  intent="header"
                  size="small"
                  actions={
                    <div className={styles.csvExportPreviewTableAddButton}>
                      <Controls.IconButton
                        disabled={fieldNames.length === props.columnNamesInOrder.length}
                        onClick={() => {
                          const nextUnSpecifiedColumnName = fieldNames.find(n => !props.columnNamesInOrder.includes(n));
                          if (!nextUnSpecifiedColumnName) {
                            return;
                          }

                          props.onChangeColumnNamesInOrder(columnNames => [
                            ...columnNames,
                            nextUnSpecifiedColumnName as FieldName,
                          ]);
                        }}
                        size="small"
                      >+</Controls.IconButton>
                    </div>
                  }
                />
              </div>
            </div>
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};

type ListCSVExportProps<Item = BaseItem, FieldName = BaseFieldName> = {
  pluralDisplayName: string;
  fields: FieldCollection<FieldMetadata<Item, FieldName>>;

  listData: ListData<Item>;
  fetchListDataFromServer: (signal: AbortSignal) => Promise<Array<Item>>;
  filtersHaveBeenAppliedToListData: boolean;

  columnSets?: { [name: string]: Array<FieldName> };

  // If specified, only export these rows
  checkedItemKeys?: CheckedItemKeys;
  keyGenerator: (item: Item) => ItemKey;
};

const ListCSVExport = <Item = BaseItem, FieldName = BaseFieldName>(props: ListCSVExportProps<Item, FieldName>) => {
  const Controls = useControls();

  const [ addInFlightAbortController, removeInFlightAbortController ] = useInFlightAbortControllers();

  // FIXME: the types don't seem to properly make this Array<FieldName>, it makes it Array<string>
  // instead. Figure out why this is, but in the meantime, just mahually cast it:
  const fieldNames = useMemo(() => props.fields.names as Array<FieldName>, [props.fields]);

  const [columnNamesInOrder, setColumnNamesInOrder] = useState(fieldNames);
  useEffect(() => {
    setColumnNamesInOrder(fieldNames);
  }, [fieldNames])

  const shouldIncludeRowInPreview = useCallback((item: Item) => {
    // If there are checked items and the item isn't checked, then skip it
    if (!Array.isArray(props.checkedItemKeys)) {
      return true;
    }
    if (props.checkedItemKeys.length === 0) {
      return true;
    }

    return props.checkedItemKeys.includes(props.keyGenerator(item));
  }, [props.checkedItemKeys, props.keyGenerator]);

  const [exportInProgress, setExportInProgress] = useState(false);
  const exportAbortController = useRef<AbortController | null>(null);
  const onClickExport = useCallback(async (closeModal: () => void) => {
    if (props.listData.status !== 'COMPLETE') {
      return;
    }
    setExportInProgress(true);

    let sourceData: Array<Item>;
    if (Array.isArray(props.checkedItemKeys) && props.checkedItemKeys.length > 0) {
      sourceData = props.listData.data.filter(shouldIncludeRowInPreview);
    } else {
      // If there isn't any data explicitly selected, then get the full dataset from the server
      exportAbortController.current = new AbortController();
      addInFlightAbortController(exportAbortController.current);
      sourceData = await props.fetchListDataFromServer(exportAbortController.current.signal);
      if (exportAbortController.current.signal.aborted) {
        return;
      }
      removeInFlightAbortController(exportAbortController.current);
    }

    const rows = sourceData.map(item => {
      const row: Array<string> = [];

      for (const columnName of columnNamesInOrder) {
        const field = props.fields.metadata.find(m => m.name === columnName);
        if (!field) {
          continue;
        }

        row.push(field.csvExportData ? (
          field.csvExportData(field.getInitialStateFromItem(item), item)
        ) : `${(item as FixMe)[columnName]}`);
      }

      return row;
    });

    // Add headers to top of rows list
    rows.unshift(columnNamesInOrder.map(name => {
      const field = props.fields.metadata.find(m => m.name === name);
      if (!field) {
        return '';
      }

      return field.csvExportColumnName || field.singularDisplayName;
    }));

    stringify(rows, (err, result) => {
      if (err) {
        alert('Error generating csv!');
        console.error("Error generating csv:", err);
        return;
      }

      const blob = new Blob([result]);
      const url = URL.createObjectURL(blob);

      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${props.pluralDisplayName.toLowerCase()}.csv`;

      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      URL.revokeObjectURL(url);

      setExportInProgress(false);
      closeModal();
    });
  }, [
    props.fields,
    props.listData,
    props.fetchListDataFromServer,
    columnNamesInOrder,
    props.pluralDisplayName,
    shouldIncludeRowInPreview,
  ]);

  return (
    <Controls.Modal
      target={toggle => (
        <Controls.Button onClick={toggle}>Export</Controls.Button>
      )}
    >
      {(close) => (
        <div className={styles.listCSVExportModal}>
          <Controls.AppBar
            size="regular"
            intent="header"
            title={<span className={styles.listCSVExportModalHeaderName}>Export as CSV</span>}
            actions={
              <Controls.IconButton size="small" onClick={close}>
                &times;
              </Controls.IconButton>
            }
          />

          <div className={styles.listCSVExportBody}>
            <div className={styles.listCSVExportBodySidebar}>
              <span
                style={{ cursor: 'pointer', backgroundColor: listsPairWiseMatch(columnNamesInOrder, fieldNames) ? 'var(--gray-5)' : undefined }}
                onClick={() => setColumnNamesInOrder(fieldNames)}
              >all</span>

              {props.columnSets ? (
                <Fragment>
                  <br />
                  <span>column sets</span>
                  {Object.entries(props.columnSets).map(([columnSetName, columns]) => (
                    <span
                      key={columnSetName}
                      style={{ cursor: 'pointer', backgroundColor: listsPairWiseMatch(columnNamesInOrder, columns) ? 'var(--gray-5)' : undefined }}
                      onClick={() => setColumnNamesInOrder(columns)}
                    >{columnSetName}</span>
                  ))}
                </Fragment>
              ) : null}

              <br />
              <span>custom</span>
            </div>
            <div className={styles.listCSVExportBodyTable}>
              <CSVExportPreviewTable
                fields={props.fields}
                listData={props.listData}
                shouldIncludeRowInPreview={shouldIncludeRowInPreview}
                columnNamesInOrder={columnNamesInOrder}
                onChangeColumnNamesInOrder={setColumnNamesInOrder}
                disabled={exportInProgress}
              />
            </div>
          </div>

          <Controls.AppBar
            size="regular"
            intent="footer"
            actions={exportInProgress ? (
              <Fragment>
                <em style={{ color: "var(--gray-10)" }}>Exporting...</em>
                <Controls.Button
                  onClick={() => {
                    if (exportAbortController.current) {
                      exportAbortController.current.abort();
                      setExportInProgress(false);
                    }
                  }}
                >Cancel</Controls.Button>
              </Fragment>
            ) : (
              <Controls.Button
                onClick={() => onClickExport(close)}
                disabled={exportInProgress}
                variant="primary"
              >
                {props.filtersHaveBeenAppliedToListData ? 'Export Filtered Data' : 'Export Data'}
              </Controls.Button>
            )}
          />
        </div>
      )}
    </Controls.Modal>
  );
};

export default ListCSVExport;
