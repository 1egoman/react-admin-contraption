import { useCallback, useMemo, useRef } from "react";

import { DataModel, RemoteDataModelDefinition } from "../../datamodel";
import { BaseItem, Filter, FixMe, ItemKey, Sort } from "../../types"
import { DataStoreProvider } from "../datastores";


type RemoteDataModelsServerActionsParams = {
  pageSize?: number;
};

const PAGE_SIZE = 20;

type RemoteDataModelsServerActionsCallArgs =
  | { type: 'getDataModels' }
  | {
    type: 'fetchPageOfData'
    modelName: string;
    page: number,
    filters: Array<[Filter['name'], Filter['state']]>,
    sort: Sort | null,
    searchText: string
  }
  | { type: 'fetchItem'; modelName: string; itemKey: ItemKey; }
  | { type: 'createItem'; modelName: string; createData: object; }
  | { type: 'updateItem'; modelName: string; itemKey: ItemKey; updateData: object; }
  | { type: 'deleteItem'; modelName: string; itemKey: ItemKey; }

export const generateRemoteDataModelsServerActionsFunction = (
  dataStoreProvider: DataStoreProvider,
  params: RemoteDataModelsServerActionsParams = {},
) => {
  const pageSize = params.pageSize || PAGE_SIZE;

  return async <R>(callArgs: RemoteDataModelsServerActionsCallArgs): Promise<R> => {
    switch (callArgs.type) {
      case 'getDataModels':
        return (dataStoreProvider.getDataModels() as unknown) as Promise<R>;
      case 'fetchPageOfData':
        return (dataStoreProvider.list(
          callArgs.modelName,
          callArgs.page,
          pageSize,
          callArgs.filters,
          callArgs.searchText,
          callArgs.sort,
        ) as unknown) as Promise<R>;
      case 'fetchItem':
        return (dataStoreProvider.read(callArgs.modelName, callArgs.itemKey) as unknown) as Promise<R>;
      case 'createItem':
        return (dataStoreProvider.create(callArgs.modelName, callArgs.createData) as unknown) as Promise<R>;
      case 'updateItem':
        return (dataStoreProvider.update(callArgs.modelName, callArgs.itemKey, callArgs.updateData) as unknown) as Promise<R>;
      case 'deleteItem':
        return (dataStoreProvider.delete(callArgs.modelName, callArgs.itemKey) as unknown) as Promise<R>;
      default:
        throw new Error(`RemoteDataModelsServerActionsFunction: unknown callArgs.type value of ${(callArgs as any)?.type}!`);
    }
  };
};

export const useGenerateRemoteDataModelsServerActionsClient = (serverActionsFunction: ReturnType<typeof generateRemoteDataModelsServerActionsFunction>) => {
  const fetchRemoteDataModels = useCallback(async (): Promise<RemoteDataModelDefinition> => {
    const definitions = await serverActionsFunction<RemoteDataModelDefinition['definitions']>({ type: 'getDataModels' });

    return {
      definitions,

      fetchPageOfData: (dataModelName) => {
        return async (page, filters, sort, searchText) => {
          return serverActionsFunction<Awaited<ReturnType<ReturnType<RemoteDataModelDefinition['fetchPageOfData']>>>>({
            type: 'fetchPageOfData',
            modelName: dataModelName,
            page,
            filters,
            sort,
            searchText,
          });
        };
      },
      fetchItem: (dataModelName) => {
        return async (itemKey) => {
          return serverActionsFunction<Awaited<ReturnType<ReturnType<RemoteDataModelDefinition['fetchItem']>>>>({
            type: 'fetchItem',
            modelName: dataModelName,
            itemKey,
          });
        };
      },
      createItem: (dataModelName) => {
        return async (createData) => {
          return serverActionsFunction<Awaited<ReturnType<ReturnType<NonNullable<RemoteDataModelDefinition['createItem']>>>>>({
            type: 'createItem',
            modelName: dataModelName,
            createData,
          });
        };
      },
      updateItem: (dataModelName) => {
        return async (itemKey, updateData) => {
          return serverActionsFunction<Awaited<ReturnType<ReturnType<NonNullable<RemoteDataModelDefinition['updateItem']>>>>>({
            type: 'updateItem',
            modelName: dataModelName,
            itemKey,
            updateData,
          });
        };
      },
      deleteItem: (dataModelName) => {
        return async (itemKey) => {
          return serverActionsFunction<Awaited<ReturnType<ReturnType<NonNullable<RemoteDataModelDefinition['deleteItem']>>>>>({
            type: 'deleteItem',
            modelName: dataModelName,
            itemKey,
          });
        };
      },

      // FIXME: consider avoiding camelcase url paths; dataModelName is camelcase!
      listLink: (dataModelName) => ({ type: 'next-link', href: `/admin/${dataModelName}` }),
      detailLinkGenerator: (dataModelName, key) => ({ type: 'next-link', href: `/admin/${dataModelName}/${key}` }),
      createLink: dataModelName => ({ type: 'next-link', href: `/admin/${dataModelName}/new` }),
    };
  }, [serverActionsFunction]);

  const fetchRemoteDataModelsResultRef = useRef<Promise<RemoteDataModelDefinition> | null>(null);

  const output = useMemo(() => {
    // NOTE: fetch the remote data models once, and then share the promise going forward so that it
    // never has to be fetched again.
    const get = () => {
      if (!fetchRemoteDataModelsResultRef.current) {
        const result = fetchRemoteDataModels();
        fetchRemoteDataModelsResultRef.current = result;
        return result;
      } else {
        return fetchRemoteDataModelsResultRef.current;
      }
    };

    return {
      // This `fetchRemoteDataModels` function is meant to be passed as a prop to the `DataModels`
      // component. ie:
      //
      // const { fetchRemoteDataModels } = useGenerateRemoteDataModelsTRPCClient(...);
      // ...
      // <DataModels fetchRemoteDataModels={fetchRemoteDataModels}> ... </DataModels>
      fetchRemoteDataModels: get,

      // This `getPropsForRemoteDataModel` function is meant to be spread into a `DataModel`
      // definition to configure it to talk to the remote data models stuff serverside. This 
      // is important so that one can further customize a remotely driven data model rather than
      // having to fully implement the remote api endpoints required when making a more custom admin
      // page. ie:
      //
      // const { getPropsForRemoteDataModel } = useGenerateRemoteDataModelsTRPCClient(...);
      // ...
      // <DataModel name="foo" {...getPropsForRemoteDataModel('foo')} ... > ... </DataModel>
      getPropsForRemoteDataModel: <
        Item = BaseItem,
        AdditionalFunctionalities extends (keyof Pick<DataModel, 'createItem' | 'updateItem' | 'deleteItem'>) | null = null
      >(
        name: string,
        functionalitiesToImplement: Array<AdditionalFunctionalities> = [],
      ) => {
        const result: Partial<DataModel> = {
          fetchPageOfData: async (page, filters, sort, search, abort) => get().then(
            result => result.fetchPageOfData(name)(page, filters, sort, search, abort)
          ),
          fetchItem: async (itemKey, abort) => get().then(result => result.fetchItem(name)(itemKey, abort)),

          createItem: functionalitiesToImplement.includes('createItem' as FixMe) ? (async (createData, abort) => get().then(result => {
            if (!result.createItem) {
              throw new Error(`getPropsForRemoteDataModel: createItem not implemented on remote data model definition for ${name}! To silence this, remove "createItem" from the getPropsForRemoteDataModel argument.`);
            }
            return result.createItem(name)(createData, abort);
          })) : undefined,
          updateItem: functionalitiesToImplement.includes('updateItem' as FixMe) ? (async (key, updateData, abort) => get().then(result => {
            if (!result.updateItem) {
              throw new Error(`getPropsForRemoteDataModel: updateItem not implemented on remote data model definition for ${name}! To silence this, remove "createItem" from the getPropsForRemoteDataModel argument.`);
            }
            return result.updateItem(name)(key, updateData, abort);
          })) : undefined,
          deleteItem: functionalitiesToImplement.includes('deleteItem' as FixMe) ? (async (key, abort) => get().then(result => {
            if (!result.deleteItem) {
              throw new Error(`getPropsForRemoteDataModel: deleteItem not implemented on remote data model definition for ${name}! To silence this, remove "createItem" from the getPropsForRemoteDataModel argument.`);
            }
            return result.deleteItem(name)(key, abort);
          })) : undefined,
        };

        // NOTE: Do this cast here because the remote data model functions are not generic, and also
        // to get the types right so when spread into a DataModel, erronious type errors won't show
        // up
        return (result as unknown) as Pick<DataModel<Item>, 'fetchItem' | 'fetchPageOfData' | NonNullable<AdditionalFunctionalities>>;
      },
    };
  }, [fetchRemoteDataModelsResultRef]);

  return output;
};
