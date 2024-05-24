import * as React from 'react';
import {
  Fragment,
  useState,
  useEffect,
  useContext,
  useMemo,
  useRef,
} from 'react';

import styles from '../styles.module.css';

import { FixMe, BaseItem, BaseFieldName, BaseFieldState } from '../types';

import Navigatable, { imperativelyNavigateToNavigatable } from "../navigatable";
import { useControls } from '../controls';

import { DataModel, DataModelsContext } from '../datamodel';
import { FieldMetadata, FieldCollection, FieldsProvider, EMPTY_FIELD_COLLECTION } from '../fields';
import {
  useDetailDataContext,
} from '../data-context';

import useInFlightAbortControllers from '../utils/use-in-flight-abort-controllers';

import { useAdminContext } from '../admin-context';
import { DataContextDetail } from '.';


export const DetailFieldItem = <Item = BaseItem, FieldName = BaseFieldName, State = BaseFieldState>({
  item,
  field,
  fieldState,
  detailLinkGenerator,
  onUpdateFieldState,
}: Parameters<DetailFieldsProps<Item, FieldName>['renderFieldItem']>[0]) => {
  const [state, setState] = useState<State>(fieldState);
  useEffect(() => {
    setState(fieldState);
  }, [fieldState]);

  const otherContext = useMemo(() => ({
    detailLink: item && detailLinkGenerator ? detailLinkGenerator(item) : null
  }), [detailLinkGenerator]);

  if (field.modifyMarkup) {
    return (
      <div style={{ display: 'flex', flexDirection: 'row', gap: 8, flexWrap: 'wrap', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <strong>{field.singularDisplayName}:</strong>
        </div>
        {field.modifyMarkup(
          state,
          (s: State, blurAfterStateSet?: boolean) => {
            setState(s);
            if (blurAfterStateSet) {
              onUpdateFieldState(s);
            }
          },
          item,
          () => onUpdateFieldState(state)
        )}
      </div>
    );
  } else {
    return (
      <div>
        <strong>{field.singularDisplayName}</strong>: {field.displayMarkup(state, item, otherContext)}
      </div>
    );
  }
};

type DetailFieldsLayoutProps<Item = BaseItem, FieldName = BaseFieldName, State = BaseFieldState> = {
  item: Item | null;
  fields: FieldCollection<FieldMetadata<Item, FieldName>>;
  fieldStatesData: Map<FieldName, BaseFieldState>;
  setFieldStatesData: (fn: (old: Map<FieldName, BaseFieldState>) => Map<FieldName, BaseFieldState>) => void;

  currentLayout: FieldCollection<FieldMetadata<Item, FieldName>>["layout"];
  detailLinkGenerator: DataContextDetail<Item>['detailLinkGenerator'];

  renderFieldItem: (params: {
    item: Item | null,
    field: FieldMetadata<Item, FieldName, State>,
    fieldState: State,
    detailLinkGenerator: DataContextDetail<Item>['detailLinkGenerator'],
    onUpdateFieldState: (newState: State) => void,
  }) => React.ReactNode;
};

const DetailFieldsLayout = <
  Item = BaseItem,
  FieldName = BaseFieldName,
  State = BaseFieldState,
>(props: DetailFieldsLayoutProps<Item, FieldName, State>) => {
  const Controls = useControls();
  return (
    <Fragment>
      {props.currentLayout.map(layout => {
        switch (layout.type) {
          case "field": {
            const field = props.fields.metadata.find(field => field.name === layout.name);
            if (!field) {
              return null;
            }

            const fieldState = props.fieldStatesData.get(field.name);
            if (typeof fieldState === 'undefined') {
              return null;
            }

            return (
              <Fragment key={`field,${field.name}`}>
                {props.renderFieldItem({
                  item: props.item,
                  field,
                  fieldState,
                  detailLinkGenerator: props.detailLinkGenerator,
                  onUpdateFieldState: (newFieldState) => {
                    props.setFieldStatesData(old => {
                      const newFieldStates = new Map(old);
                      newFieldStates.set(field.name, newFieldState);
                      return newFieldStates;
                    });
                  },
                })}
              </Fragment>
            );
          }
          case "section": {
            return (
              <Controls.FieldSet
                key={`section,${layout.id}`}
                label={layout.label}
              >
                <div className={styles.detailFieldsLayoutInner}>
                  <DetailFieldsLayout
                    item={props.item}
                    fields={props.fields}
                    fieldStatesData={props.fieldStatesData}
                    setFieldStatesData={props.setFieldStatesData}
                    currentLayout={layout.contents}
                    renderFieldItem={props.renderFieldItem}
                  />
                </div>
              </Controls.FieldSet>
            );
          }
        }
      })}
    </Fragment>
  );
};



type DetailFieldsProps<Item = BaseItem, FieldName = BaseFieldName, State = BaseFieldState> = {
  renderFieldsWrapper?: (params: {
    detailDataContextData: DataContextDetail<Item>;
    children: React.ReactNode;
  }) => React.ReactNode;
  renderFieldItem?: DetailFieldsLayoutProps<Item, FieldName, State>['renderFieldItem'];
  children?: React.ReactNode;
};

const DetailFields = <Item = BaseItem, FieldName = BaseFieldName>({
  renderFieldsWrapper = ({ children }) => (
    <div className={styles.detailFields}>
      {children}
    </div>
  ),
  renderFieldItem = (props) => (
    <DetailFieldItem {...props} />
  ),
  children,
}: DetailFieldsProps<Item, FieldName>) => {
  // First, get the list context data
  const detailDataContextData = useDetailDataContext<Item>('DetailFields');

  const Controls = useControls();
  const adminContextData = useAdminContext();

  // Then get the data model context data
  const dataModelsContextData = useContext(DataModelsContext);
  if (!dataModelsContextData) {
    throw new Error('Error: <DetailFields ... /> was not rendered inside of a container component! Try rendering this inside of a <Detail> ... </Detail> component.');
  }
  const dataModel = dataModelsContextData[0].get(detailDataContextData.name) as DataModel<Item> | undefined;
  if (!dataModel) {
    throw new Error(`Error: <DetailFields ... /> cannot find data model with name ${detailDataContextData.name}!`);
  }

  const [
    addInFlightAbortController,
    removeInFlightAbortController,
  ] = useInFlightAbortControllers();

  const [updateKeepEditing, setUpdateKeepEditing] = useState(false);
  const [updateInProgress, setUpdateInProgress] = useState(false);
  const [createInProgress, setCreateInProgress] = useState(false);

  const [fields, setFields] = useState<FieldCollection<FieldMetadata<Item, FieldName>>>(EMPTY_FIELD_COLLECTION);

  // Store each state for each field centrally
  const [fieldStates, setFieldStates] = useState<
    | { status: "IDLE" }
    | { status: "LOADING" }
    | { status: "COMPLETE", data: Map<FieldName, BaseFieldState> }
    | { status: "ERROR", error: any }
  >({ status: "IDLE" });
  const fieldStatesRequestInProgress = useRef(false);
  const [fieldStatesRetryCounter, setFieldStatesRetryCounter] = useState(0);
  useEffect(() => {
    if (fieldStatesRequestInProgress.current) {
      return;
    }

    const abortController = new AbortController();
    addInFlightAbortController(abortController);

    setFieldStates({ status: "LOADING" });
    fieldStatesRequestInProgress.current = true;

    Promise.all(fields.metadata.map(async field => {
      if (detailDataContextData.isCreating) {
        if (field.getInitialStateWhenCreating) {
          return [
            field.name,
            field.getInitialStateWhenCreating(),
          ] as [FieldName, BaseFieldState | undefined];
        } else {
          return [field.name, undefined] as [FieldName, BaseFieldState | undefined];
        }
      } else {
        if (detailDataContextData.detailData.status !== 'COMPLETE') {
          return null;
        }
        const initialState = field.getInitialStateFromItem(detailDataContextData.detailData.data);

        // By calling `injectAsyncDataIntoInitialStateOnDetailPage`, the detail page can add more
        // stuff to the state asyncronously so that it can show more rich information about the
        // entity.
        return field.injectAsyncDataIntoInitialStateOnDetailPage(
          initialState,
          detailDataContextData.detailData.data,
          abortController.signal,
        ).then(updatedState => {
          return [field.name, updatedState] as [FieldName, BaseFieldState | undefined];
        });
      }
    })).then(fieldStatesPairs => {
      removeInFlightAbortController(abortController);
      const filteredFieldStatesPairs = fieldStatesPairs.filter((n): n is [FieldName, BaseFieldState | undefined] => n !== null);
      setFieldStates({ status: "COMPLETE", data: new Map(filteredFieldStatesPairs) });
      fieldStatesRequestInProgress.current = false;
    }).catch(error => {
      if (error.name === 'AbortError') {
        fieldStatesRequestInProgress.current = false;
        setFieldStatesRetryCounter(n => n + 1);
        return;
      }

      removeInFlightAbortController(abortController);
      console.error('Error loading field state:', error);
      setFieldStates({ status: "ERROR", error });

      console.error('Waiting 3000ms before retrying...');
      setTimeout(() => {
        fieldStatesRequestInProgress.current = false;
        setFieldStatesRetryCounter(n => n + 1);
      }, 3000);
    });

    return () => {
      setFieldStates({ status: 'IDLE' });

      abortController.abort();
      removeInFlightAbortController(abortController);
    };
  }, [detailDataContextData.detailData, fields, fieldStatesRetryCounter]);

  let detailFieldsChildren: React.ReactNode = null;
  if (detailDataContextData.isCreating) {
    detailFieldsChildren = fieldStates.status === "COMPLETE" ? (
      <DetailFieldsLayout
        item={null}
        fields={fields}
        fieldStatesData={fieldStates.data}
        setFieldStatesData={(fn) => {
          setFieldStates(old => {
            if (old.status !== 'COMPLETE') {
              return old;
            }
            return { status: 'COMPLETE', data: fn(old.data) };
          });
        }}
        currentLayout={fields.layout}
        detailLinkGenerator={detailDataContextData.detailLinkGenerator}
        renderFieldItem={renderFieldItem}
      />
    ) : "Loading fields...";
  } else {
    switch (detailDataContextData.detailData.status) {
      case 'IDLE':
      case 'LOADING':
        detailFieldsChildren = (
          <div className={styles.detailFieldsEmptyState}>
            Loading {detailDataContextData.singularDisplayName}...
          </div>
        );
        break;
      case 'ERROR':
        detailFieldsChildren = (
          <div className={styles.detailFieldsErrorState}>
            Error loading {detailDataContextData.singularDisplayName}: {detailDataContextData.detailData.error.message}
          </div>
        );
        break;
      case 'COMPLETE':
        const item = detailDataContextData.detailData.data;
        switch (fieldStates.status) {
          case "IDLE":
          case "LOADING":
            detailFieldsChildren = (
              <div className={styles.detailFieldsEmptyState}>
                Loading {detailDataContextData.singularDisplayName} fields...
              </div>
            );
            break;
          case "ERROR":
            detailFieldsChildren = (
              <div className={styles.detailFieldsEmptyState}>
                Error loading {detailDataContextData.singularDisplayName} fields!
              </div>
            );
            break;
          case "COMPLETE":
            detailFieldsChildren = fieldStates.status === "COMPLETE" ? (
              <DetailFieldsLayout
                item={item}
                fields={fields}
                fieldStatesData={fieldStates.data}
                setFieldStatesData={(fn) => {
                  setFieldStates(old => {
                    if (old.status !== 'COMPLETE') {
                      return old;
                    }
                    return { status: 'COMPLETE', data: fn(old.data) };
                  });
                }}
                currentLayout={fields.layout}
                detailLinkGenerator={detailDataContextData.detailLinkGenerator}
                renderFieldItem={renderFieldItem}
              />
            ) : "Loading fields...";
            break;
        }
        break;
    }
  }

  return (
    <FieldsProvider dataModel={dataModel} onChangeFields={setFields}>
      {renderFieldsWrapper({
        detailDataContextData,
        children: detailFieldsChildren,
      })}

      {/* The children should not render anything, this should purely be Fields */}
      {children}

      {detailDataContextData.isCreating ? (
        <Controls.AppBar
          intent="footer"
          actions={
            <Controls.Button
              disabled={createInProgress || !detailDataContextData.createItem}
              variant="primary"
              onClick={async () => {
                if (!detailDataContextData.createItem) {
                  return;
                }
                if (fieldStates.status !== 'COMPLETE') {
                  return;
                }

                setCreateInProgress(true);

                const abortController = new AbortController();
                addInFlightAbortController(abortController);

                // Aggregate all the state updates to form the update body
                let item: Partial<Item> = {};
                for (const field of fields.metadata) {
                  let state = fieldStates.data.get(field.name);
                  if (typeof state === 'undefined') {
                    continue;
                  }

                  if (field.createSideEffect) {
                    try {
                      state = await field.createSideEffect(item, state, abortController.signal);
                    } catch (error: FixMe) {
                      if (error.name === 'AbortError') {
                        // The component unmounted, and the request was terminated
                        return;
                      }

                      console.error(error);
                      alert(`Error creating ${detailDataContextData.singularDisplayName} related item ${field.singularDisplayName} on key ${detailDataContextData.itemKey}: ${error}`);
                      return;
                    }
                  }

                  item = field.serializeStateToItem(item, state);
                }

                let createResult: Item;
                try {
                  createResult = await detailDataContextData.createItem(item, abortController.signal);
                } catch (error: FixMe) {
                  setCreateInProgress(false);
                  if (error.name === 'AbortError') {
                    // The component unmounted, and the request was terminated
                    return;
                  }

                  console.error(error);
                  alert(`Error creating ${detailDataContextData.singularDisplayName} ${detailDataContextData.itemKey}: ${error}`);
                  return;
                }

                removeInFlightAbortController(abortController);
                setCreateInProgress(false);

                // After creating, update the view to show the created item...
                detailDataContextData.resetDetailDataAfterCreate(createResult);

                // ... and then navigate to the newly created item's detail page
                if (detailDataContextData.detailLinkGenerator) {
                  imperativelyNavigateToNavigatable(adminContextData, detailDataContextData.detailLinkGenerator(createResult));
                }
              }}
            >Create</Controls.Button>
          }
        />
      ) : (
        <Controls.AppBar
          intent="footer"
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Controls.Button
                disabled={updateInProgress || detailDataContextData.detailData.status !== 'COMPLETE' || !detailDataContextData.updateItem}
                variant="primary"
                onClick={async () => {
                  if (!detailDataContextData.updateItem) {
                    return;
                  }
                  if (!detailDataContextData.itemKey) {
                    return;
                  }
                  if (fieldStates.status !== 'COMPLETE') {
                    return;
                  }
                  if (detailDataContextData.detailData.status !== 'COMPLETE') {
                    return;
                  }

                  setUpdateInProgress(true);

                  const abortController = new AbortController();
                  addInFlightAbortController(abortController);

                  // Aggregate all the state updates to form the update body
                  let item: Partial<Item> = detailDataContextData.detailData.data;
                  for (const field of fields.metadata) {
                    let state = fieldStates.data.get(field.name);
                    if (typeof state === 'undefined') {
                      continue;
                    }

                    if (field.updateSideEffect) {
                      try {
                        state = await field.updateSideEffect(item, state, abortController.signal);
                      } catch (error: FixMe) {
                        if (error.name === 'AbortError') {
                          // The component unmounted, and the request was terminated
                          return;
                        }

                        console.error(error);
                        alert(`Error updating ${detailDataContextData.singularDisplayName} related item ${field.singularDisplayName} on key ${detailDataContextData.itemKey}: ${error}`);
                        return;
                      }
                    }

                    item = field.serializeStateToItem(item, state);
                  }

                  try {
                    await detailDataContextData.updateItem(detailDataContextData.itemKey, item, abortController.signal);
                  } catch (error: FixMe) {
                    setUpdateInProgress(true);
                    if (error.name === 'AbortError') {
                      // The component unmounted, and the request was terminated
                      return;
                    }

                    console.error(error);
                    alert(`Error updating ${detailDataContextData.singularDisplayName} ${detailDataContextData.itemKey}: ${error}`);
                    return;
                  }

                  removeInFlightAbortController(abortController);
                  setUpdateInProgress(false);
                  alert('Update successful!');

                  // After updating, go back to the list page
                  if (!updateKeepEditing) {
                    imperativelyNavigateToNavigatable(adminContextData, detailDataContextData.listLink);
                  }
                }}
              >Update</Controls.Button>
              {detailDataContextData.detailData.status === 'COMPLETE' && detailDataContextData.updateItem ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Controls.Checkbox
                    id="update-keep-editing"
                    checked={updateKeepEditing}
                    onChange={setUpdateKeepEditing}
                  />
                  <label htmlFor="update-keep-editing" style={{ cursor: 'pointer', userSelect: 'none' }}>Keep editing</label>
                </div>
              ) : null}
            </div>
          }
          actions={
            <Controls.Button
              disabled={detailDataContextData.detailData.status !== 'COMPLETE' || !detailDataContextData.deleteItem}
              onClick={async () => {
                if (!detailDataContextData.deleteItem) {
                  return;
                }
                if (!detailDataContextData.itemKey) {
                  // Deleting should not be allowed when creating a new item
                  return;
                }
                if (!confirm('Are you sure?')) {
                  return;
                }

                const abortController = new AbortController();
                addInFlightAbortController(abortController);
                try {
                  await detailDataContextData.deleteItem(detailDataContextData.itemKey, abortController.signal);
                } catch (error: FixMe) {
                  if (error.name === 'AbortError') {
                    // The component unmounted, and the request was terminated
                    return;
                  }

                  console.error(error);
                  alert(`Error deleting ${detailDataContextData.singularDisplayName} ${detailDataContextData.itemKey}: ${error}`);
                  return;
                }

                removeInFlightAbortController(abortController);

                // After deleting, go back to the list page
                imperativelyNavigateToNavigatable(adminContextData, detailDataContextData.listLink);
              }}
            >Delete</Controls.Button>
          }
        />
      )}
    </FieldsProvider>
  );
};

export default DetailFields;
