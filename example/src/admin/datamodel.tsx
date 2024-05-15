import * as React from 'react';
import {
  Fragment,
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
import { RemoteFields } from '.';

// A DataModel defines a type of data that will be shown in the admin interface.
//
// It takes a schema (`Item`) that defines the json serialized shape of a row of this data and
// defines how that tpe of data can be created, read, updated, and deleted.
export type DataModel<Item = BaseItem> = {
  singularDisplayName: string;
  pluralDisplayName: string;

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
  updateItem: ((itemKey: ItemKey, updateData: Partial<Item>, abort: AbortSignal) => Promise<void>) | null;
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

export const RemoteDataModelsContext = React.createContext<RemoteDataModelDefinition | null>(null);

export type RemoteDataModelDefinitionColumn = (
  | { type: 'primaryKey' }
  | { type: 'text', nullable?: boolean }
  | { type: 'number', nullable?: boolean }
  | { type: 'boolean', nullable?: boolean }
  | { type: 'json' }
  | { type: 'datetime', nullable?: boolean }
  | { type: 'singleForeignKey', to: string, nullable?: boolean }
  | { type: 'multiForeignKey', to: string }
) & { singularDisplayName: string; pluralDisplayName: string };

export type RemoteDataModelDefinition = {
  fetchPageOfData: (dataModelName: string) => DataModel["fetchPageOfData"];
  fetchItem: (dataModelName: string) => DataModel["fetchItem"];
  createItem?: (dataModelName: string) => NonNullable<DataModel["createItem"]>;
  updateItem?: (dataModelName: string) => NonNullable<DataModel["updateItem"]>;
  deleteItem?: (dataModelName: string) => NonNullable<DataModel["deleteItem"]>;

  listLink: (dataModelName: string) => Navigatable;
  detailLinkGenerator: (dataModelName: string, item: any) => Navigatable; // TODO
  createLink: (dataModelName: string) => Navigatable;

  definitions: {
    [dataModelName: string]: {
      singularDisplayName: DataModel['singularDisplayName'];
      pluralDisplayName: DataModel['pluralDisplayName'];
      columns: { [fieldName: string]: RemoteDataModelDefinitionColumn };
    };
  };
};

export const DataModels: React.FunctionComponent<{
  fetchRemoteDataModels?: () => Promise<RemoteDataModelDefinition>;
  children: React.ReactNode;
}> = ({ fetchRemoteDataModels, children }) => {
  const [models, setModels] = useState<Map<string, DataModel>>(new Map());
  const modelsContextData = useMemo(() => [
    models,
    setModels,
  ] as [
    Map<string, DataModel>,
    (updateFn: (oldDataModels: Map<string, DataModel>) => Map<string, DataModel>) => void,
  ], [models, setModels]);

  // Remote data models allow a server to define data models that can be used in app to avoid
  // keeping full model definitions in app.
  const [remoteDataModels, setRemoteDataModels] = useState<
    | { status: 'IDLE' }
    | { status: 'LOADING' }
    | { status: 'COMPLETE', data: RemoteDataModelDefinition }
    | { status: 'ERROR', error: any }
  >({ status: 'IDLE' })
  useEffect(() => {
    if (!fetchRemoteDataModels) {
      return;
    }

    setRemoteDataModels({ status: 'LOADING' });
    fetchRemoteDataModels().then(remoteDataModels => {
      setRemoteDataModels({ status: 'COMPLETE', data: remoteDataModels });
    }).catch(error => {
      setRemoteDataModels({ status: 'ERROR', error });
    });
  }, [fetchRemoteDataModels]);

  const remoteDataModelsContextData = useMemo(() => {
    if (remoteDataModels.status !== "COMPLETE") {
      return null;
    }

    return remoteDataModels.data;
  }, [remoteDataModels])

  return (
    <DataModelsContext.Provider value={modelsContextData}>
      <RemoteDataModelsContext.Provider value={remoteDataModelsContextData}>
        {children}
      </RemoteDataModelsContext.Provider>
    </DataModelsContext.Provider>
  );
};

type DataModelProps<Item = BaseItem> = Omit<
  DataModel<Item>,
  | "createItem"
  | "updateItem"
  | "deleteItem"
  | "listLink"
  | "detailLinkGenerator"
  | "createLink"
  | "fields"
> & {
  createItem?: NonNullable<DataModel<Item>['createItem']>,
  updateItem?: NonNullable<DataModel<Item>['updateItem']>,
  deleteItem?: NonNullable<DataModel<Item>['deleteItem']>,
  listLink?: NonNullable<DataModel<Item>['listLink']>,
  detailLinkGenerator?: NonNullable<DataModel<Item>['detailLinkGenerator']>,
  createLink?: NonNullable<DataModel<Item>['createLink']>,

  name: string,
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
          const dataModel = ((copy.get(props.name) as unknown) as DataModel<Item> | undefined)
          const result = (updateFn(dataModel || null) as unknown) as DataModel;
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

// Extracts data from any remote data models defined serverside constructs `DataModel` definitions
// out of them. Use `include` or `exclude` to pick which should be kept - you may want to make a
// custom implementation for one locally, etc
export const RemoteDataModels: React.FunctionComponent<{
  include?: Array<string>,
  exclude?: Array<string>,
}> = ({ include, exclude }) => {
  const remoteDataModels = useContext(RemoteDataModelsContext);
  if (!remoteDataModels) {
    // FIXME: maybe throw an error here instead of failing silently if the context is empty?
    return null;
  }

  return (
    <Fragment>
      {Object.entries(remoteDataModels.definitions).map(([name, remoteFields]) => {
        if (exclude && exclude.includes(name)) {
          return null;
        }
        if (include && !include.includes(name)) {
          return null;
        }

        const primaryKeyResult = Object.entries(remoteFields.columns).find(([_key, field]) => field.type === "primaryKey")
        if (!primaryKeyResult) {
          return null;
        }
        const primaryKeyName = primaryKeyResult[0];

        return (
          <DataModel<any>
            key={name}
            name={name}
            singularDisplayName={remoteFields.singularDisplayName}
            pluralDisplayName={remoteFields.pluralDisplayName}

            fetchPageOfData={remoteDataModels.fetchPageOfData(name)}
            fetchItem={remoteDataModels.fetchItem(name)}
            createItem={remoteDataModels.createItem ? remoteDataModels.createItem(name) : undefined}
            updateItem={remoteDataModels.updateItem ? remoteDataModels.updateItem(name) : undefined}
            deleteItem={remoteDataModels.deleteItem ? remoteDataModels.deleteItem(name) : undefined}

            listLink={remoteDataModels.listLink(name)}

            keyGenerator={item => item[primaryKeyName]}
            detailLinkGenerator={item => remoteDataModels.detailLinkGenerator(name, item[primaryKeyName])}
            createLink={remoteDataModels.createLink(name)}
          >
            <RemoteFields name={name} />
          </DataModel>
        );
      })}
    </Fragment>
  );
};
