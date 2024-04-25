import * as React from 'react';
import {
  Fragment,
  useMemo,
  useState,
  useEffect,
  useContext,
} from 'react';

import styles from '../styles.module.css';

import { FixMe, BaseItem, ItemKey } from '../types';
import Navigatable from "../navigatable";
import { useControls } from '../controls';
import { DataModel, DataModelsContext } from '../datamodel';
import { DataContextProvider } from '../data-context';
import useInFlightAbortControllers from '../utils/use-in-flight-abort-controllers';
import DetailFields from './fields';


export type DataContextDetail<Item = BaseItem> = {
  type: 'detail';
  itemKey: ItemKey | null;

  isCreating: boolean;

  name: string;
  singularDisplayName: string;
  pluralDisplayName: string;

  detailData: DetailData<Item>;
  resetDetailDataAfterCreate: (item: Item) => void;

  createItem: ((createData: Partial<Item>, abort: AbortSignal) => Promise<Item>) | null;
  updateItem: ((itemKey: ItemKey, updateData: Partial<Item>, abort: AbortSignal) => Promise<void>) | null;
  deleteItem: ((itemKey: ItemKey, abort: AbortSignal) => Promise<void>) | null;

  detailLinkGenerator: null | ((item: Item) => Navigatable);
  listLink: null | Navigatable;
};

type DetailData<T> =
  | { status: 'IDLE' }
  | { status: 'LOADING' }
  | {
    status: 'COMPLETE';
    data: T;
  }
  | {
    status: 'ERROR';
    error: Error;
  };

type DetailProps<Item = BaseItem> = {
  name: string;
  itemKey?: ItemKey | null;
  title?: (item: Item) => React.ReactNode;
  actions?: (item: Item) => React.ReactNode;
  children?: React.ReactNode;
} & Partial<Pick<
  DataModel<Item>,
  | "singularDisplayName"
  | "pluralDisplayName"
  | "fetchItem"
  | "createItem"
  | "updateItem"
  | "deleteItem"
  | "detailLinkGenerator"
  | "listLink"
>>;

const Detail = <Item = BaseItem>(props: DetailProps<Item>) => {
  const {
    name,
    itemKey = null,
    children = (
      <DetailFields />
    ),
  } = props;

  const Controls = useControls();

  // First, get the data model that the list component uses:
  const dataModelsContextData = useContext(DataModelsContext);
  if (!dataModelsContextData) {
    throw new Error('Error: <Detail ... /> was not rendered inside of a container component! Try rendering this inside of a <DataModels> ... </DataModels>.');
  }
  const dataModel = dataModelsContextData[0].get(name) as DataModel<Item> | undefined;
  const singularDisplayName = props.singularDisplayName || dataModel?.singularDisplayName || '';
  const pluralDisplayName = props.pluralDisplayName || dataModel?.pluralDisplayName || '';
  const fetchItem = props.fetchItem || dataModel?.fetchItem || null;
  const createItem = props.createItem || dataModel?.createItem || null;
  const updateItem = props.updateItem || dataModel?.updateItem || null;
  const deleteItem = props.deleteItem || dataModel?.deleteItem || null;
  const detailLinkGenerator = props.detailLinkGenerator || dataModel?.detailLinkGenerator || null;
  const listLink = props.listLink || dataModel?.listLink || null;

  const [detailData, setDetailData] = useState<DetailData<Item>>({ status: 'IDLE' });

  const [
    addInFlightAbortController,
    removeInFlightAbortController,
  ] = useInFlightAbortControllers();

  // When the component initially loads, fetch the item
  useEffect(() => {
    if (!fetchItem) {
      return;
    }
    if (itemKey === null) {
      // Don't fetch data in creation mode
      return;
    }

    const abortController = new AbortController();

    const fetchDataItem = async () => {
      setDetailData({ status: 'LOADING' });

      addInFlightAbortController(abortController);
      let result: Item;
      try {
        result = await fetchItem(itemKey, abortController.signal);
      } catch (error: FixMe) {
        if (error.name === 'AbortError') {
          // The effect unmounted, and the request was terminated
          return;
        }

        setDetailData({ status: 'ERROR', error });
        return;
      }
      removeInFlightAbortController(abortController);

      setDetailData({
        status: 'COMPLETE',
        data: result,
      });
    };

    fetchDataItem().catch(error => {
      console.error(error);
    });

    return () => {
      setDetailData({ status: 'IDLE' });

      abortController.abort();
      removeInFlightAbortController(abortController);
    };
  }, [setDetailData, fetchItem]);

  const dataContextData: DataContextDetail<Item> | null = useMemo(() => {
    if (!fetchItem) {
      return null;
    }
    return {
      type: 'detail' as const,
      itemKey,
      isCreating: itemKey === null,
      name,
      singularDisplayName,
      pluralDisplayName,
      detailData,
      resetDetailDataAfterCreate: (item: Item) => setDetailData({ status: 'COMPLETE', data: item }),
      createItem,
      updateItem,
      deleteItem,
      listLink,
      detailLinkGenerator,
    };
  }, [
    itemKey,
    name,
    singularDisplayName,
    pluralDisplayName,
    detailData,
    setDetailData,
    createItem,
    updateItem,
    deleteItem,
    listLink,
    detailLinkGenerator,
  ]);

  if (!dataContextData) {
    return (
      <span>Waiting for data model {name} to be added to DataModelsContext...</span>
    );
  }

  return (
    <DataContextProvider<Item> value={dataContextData}>
      <div className={styles.detail}>
        <Controls.AppBar
          intent="header"
          title={
            <Fragment>
              <Controls.NavigationButton navigatable={dataContextData.listLink}>&larr; Back</Controls.NavigationButton>
              {dataContextData.isCreating ? (
                <strong>
                  Create {dataContextData.singularDisplayName[0].toUpperCase()}{dataContextData.singularDisplayName.slice(1)}
                </strong>
              ) : (
                <Fragment>
                  {props.title ? (
                    <strong>
                      {dataContextData.detailData.status === 'COMPLETE' ? props.title(dataContextData.detailData.data) : null}
                    </strong>
                  ) : (
                    <strong>
                      {dataContextData.singularDisplayName[0].toUpperCase()}{dataContextData.singularDisplayName.slice(1)}{' '}
                      {dataContextData.itemKey}
                    </strong>
                  )}
                </Fragment>
              )}
            </Fragment>
          }
          actions={detailData.status === "COMPLETE" && props.actions ? props.actions(detailData.data) : null}
        />

        {children}
      </div>
    </DataContextProvider>
  );
};

export default Detail;
