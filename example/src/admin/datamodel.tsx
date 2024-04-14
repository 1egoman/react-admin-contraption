import * as React from 'react';
import {
  useMemo,
  useState,
  useEffect,
  useContext,
  useCallback,
} from 'react';

import {
  BaseItem,
  ItemKey,
  Paginated,
  Filter,
  Sort,
} from './types';

import Navigatable from "./navigatable";
import { FieldMetadata, FieldCollection, FieldsProvider, EMPTY_FIELD_COLLECTION } from './fields';

// A DataModel defines a type of data that will be shown in the admin interface.
//
// It takes a schema (`Item`) that defines the json serialized shape of a row of this data and
// defines how that tpe of data can be created, read, updated, and deleted.
export type DataModel<Item = BaseItem> = {
  singularDisplayName: string;
  pluralDisplayName: string;
  csvExportColumnName?: string;

  fetchPageOfData: (
    page: number,
    filters: Array<[Filter['name'], Filter['state']]>,
    sort: Sort | null,
    searchText: string,
    abort: AbortSignal,
  ) => Promise<Paginated<Item>>;
  fetchItem: (
    itemKey: ItemKey,
    abort: AbortSignal,
  ) => Promise<Item>;

  createItem: ((createData: Partial<Item>, abort: AbortSignal) => Promise<Item>) | null;
  updateItem: ((itemKey: ItemKey, updateData: Item, abort: AbortSignal) => Promise<void>) | null;
  deleteItem: ((itemKey: ItemKey, abort: AbortSignal) => Promise<void>) | null;

  listLink: Navigatable | null;

  keyGenerator: (item: Item) => ItemKey;
  detailLinkGenerator: ((item: Item) => Navigatable) | null;
  createLink: Navigatable | null;

  fields: FieldCollection<FieldMetadata<Item>>,
};

export const DataModelsContext = React.createContext<[
  Map<string, DataModel>,
  (updateFn: (oldDataModels: Map<string, DataModel>) => Map<string, DataModel>) => void,
] | null>(null);
export const DataModels: React.FunctionComponent<{ children: React.ReactNode }> = ({ children }) => {
  const [models, setModels] = useState<Map<string, DataModel>>(new Map());
  const modelsContextData = useMemo(() => [
    models,
    setModels,
  ] as [
    Map<string, DataModel>,
    (updateFn: (oldDataModels: Map<string, DataModel>) => Map<string, DataModel>) => void,
  ], [models, setModels]);

  return (
    <DataModelsContext.Provider value={modelsContextData}>
      {children}
    </DataModelsContext.Provider>
  );
};

type DataModelProps<Item = BaseItem> = Omit<
  DataModel<Item>,
  "fields" | "createItem" | "updateItem" | "deleteItem"
> & {
  name: string,
  createItem?: NonNullable<DataModel<Item>['createItem']>,
  updateItem?: NonNullable<DataModel<Item>['updateItem']>,
  deleteItem?: NonNullable<DataModel<Item>['deleteItem']>,
  listLink?: NonNullable<DataModel<Item>['listLink']>,
  detailLinkGenerator?: NonNullable<DataModel<Item>['detailLinkGenerator']>,
  createLink?: NonNullable<DataModel<Item>['createLink']>,
  children: React.ReactNode, // fields
};

export const DataModel = <Item = BaseItem>(props: DataModelProps<Item>) => {
  const dataModelsContextData = useContext(DataModelsContext);
  if (!dataModelsContextData) {
    throw new Error('Error: <DataModel ... /> was not rendered inside of a container component! Try rendering this inside of a <DataModels> ... </DataModels>.');
  }

  // NOTE: the DataModelsContext stores a heterogeneous of `DataModel<..., ...>` entries in an array
  // However, downstream stuff expects a `DataModel<Item>` - so cast it explicitly below
  const [setDataModel] = useMemo(() => {
    const [_dataModels, setDataModels] = dataModelsContextData;

    return [
      // (dataModels.get(props.name) as any) as DataModel<Item>,
      (updateFn: (old: DataModel<Item> | null) => DataModel<Item> | null) => {
        setDataModels(old => {
          const copy = new Map(old);
          const dataModel = ((copy.get(props.name) as any) as DataModel<Item> | undefined)
          const result = (updateFn(dataModel || null) as any) as DataModel;
          if (result) {
            copy.set(props.name, result);
            return copy;
          } else {
            return old;
          }
        });
      },
    ];
  }, [dataModelsContextData, props.name]);

  useEffect(() => {
    setDataModel((old) => {
      const base: Omit<DataModel<Item>, "fields"> = {
        singularDisplayName: props.singularDisplayName,
        pluralDisplayName: props.pluralDisplayName,
        csvExportColumnName: props.csvExportColumnName,
        fetchPageOfData: props.fetchPageOfData,
        fetchItem: props.fetchItem,
        createItem: props.createItem || null,
        updateItem: props.updateItem || null,
        deleteItem: props.deleteItem || null,
        listLink: props.listLink || null,
        keyGenerator: props.keyGenerator,
        detailLinkGenerator: props.detailLinkGenerator || null,
        createLink: props.createLink || null,
      };

      if (old) {
        return { ...old, ...base };
      } else {
        return { ...base, fields: EMPTY_FIELD_COLLECTION };
      }
    });
  }, [
    props.singularDisplayName,
    props.pluralDisplayName,
    props.csvExportColumnName,
    props.fetchPageOfData,
    props.fetchItem,
    props.createItem,
    props.updateItem,
    props.deleteItem,
    props.listLink,
    props.keyGenerator,
    props.detailLinkGenerator,
    props.createLink,
  ]);

  const onChangeFields = useCallback((newFields: FieldCollection<FieldMetadata<Item>>) => {
    setDataModel(old => {
      if (old) {
        return { ...old, fields: newFields };
      } else {
        return null;
      }
    });
  }, []);

  return (
    <FieldsProvider onChangeFields={onChangeFields}>
      {props.children}
    </FieldsProvider>
  );
};
