import { useCallback, useMemo, useRef } from "react";
import { z } from "zod";

import { DataModel, DataModelProps, RemoteDataModelDefinition } from "../../datamodel";
import { BaseItem, FixMe, Paginated } from "../../types"
import { DataStoreProvider } from "../datastores";


type RemoteDataModelsTRPCParams = {
  pageSize?: number;
};

const PAGE_SIZE = 20;

// FIXME: somehow figure out how to get the real trpc type definition in here - that would require
// making trpc an optional peer dependency maybe?
type MockTrpc = {
  input: (arg: any) => MockTrpc;
  query: (arg: (arg: { input: any }) => Promise<any>) => MockTrpc;
  mutation: (arg: (arg: { input: any }) => Promise<any>) => MockTrpc;
};

// SERVER-SIDE HALF of the trpc remote data models adapter. As parameters, this requires a reference
// to `publicProcedure` (or whatever you'd like your trpc procedures to "hang off of"), and a data
// store provider to use for perfoming underlying actions.
//
// # Example Usage:
// import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
//
// /* later ... */
// export const appRouter = createTRPCRouter({
//   /* all other app routers would be here ... */
//
//   admin: createTRPCRouter(
//     generateRemoteDataModelsTRPCRouter(
//       publicProcedure,
//       /* data model provider... for example: PrismaRemoteDataModelProvider(...) /*,
//     ),
//   ),
// });
export const generateRemoteDataModelsTRPCRouter = <T extends MockTrpc>(
  trpcProcedure: T,
  dataStoreProvider: DataStoreProvider,
  params: RemoteDataModelsTRPCParams = {},
) => {
  const pageSize = params.pageSize || PAGE_SIZE;

  return {
    dataModelDefinitions: trpcProcedure.query(async () => dataStoreProvider.getDataModels()),

    genericFetchPageOfData: trpcProcedure
      .input(z.object({
        model: z.string(),
        page: z.number(),
        filters: z.array(
          z.tuple([z.array(z.string()), z.string().or(z.number()).or(z.boolean())])
        ),
        sort: z.object({
          fieldName: z.string(),
          direction: z.literal('asc').or(z.literal('desc')),
        }).nullish(),
        searchText: z.string(),
      }))
      .query(async ({ input }) => {
        // FIXME: convert errors thrown by this into trpc errors
        return dataStoreProvider.list(
          input.model,
          input.page,
          pageSize,
          input.filters,
          input.searchText,
          input.sort,
        );
      }),

    genericFetchItem: trpcProcedure
      .input(z.object({ model: z.string(), itemKey: z.string() }))
      .query(async ({ input }) => {
        // FIXME: convert errors thrown by this into trpc errors
        return dataStoreProvider.read(
          input.model,
          input.itemKey,
        );
      }),

    genericCreateItem: trpcProcedure
      .input(z.object({ model: z.string(), createData: z.any() }))
      .mutation(async ({ input }) => {
        // FIXME: convert errors thrown by this into trpc errors
        return dataStoreProvider.create(
          input.model,
          input.createData,
        );
      }),

    genericUpdateItem: trpcProcedure
      .input(z.object({ model: z.string(), itemKey: z.string(), updateData: z.any() }))
      .mutation(async ({ input }) => {
        // FIXME: convert errors thrown by this into trpc errors
        return dataStoreProvider.update(
          input.model,
          input.itemKey,
          input.updateData,
        );
      }),

    genericDeleteItem: trpcProcedure
      .input(z.object({ model: z.string(), itemKey: z.string() }))
      .mutation(async ({ input }) => {
        // FIXME: convert errors thrown by this into trpc errors
        return dataStoreProvider.delete(
          input.model,
          input.itemKey,
        );
      }),
  };
};

// CLIENT-SIDE HALF of the trpc remote data models adapter. This provides an implementation of
// `fetchRemoteDataModels` that can be passed into the `DataModels` component.
//
// # Example Usage:
// const { fetchRemoteDataModels } = useGenerateRemoteDataModelsTRPCClient(api, api.useUtils(), ['admin2']);
// /* or, for older trpc versions: */
// const { fetchRemoteDataModels } = useGenerateRemoteDataModelsTRPCClient(api, api.useContext(), ['admin2']);
//
// /* and then, later ... */
// <DataModels fetchRemoteDataModels={fetchRemoteDataModels}> ... </DataModels>
//
// # Alternate Example Usage:
// const { getPropsForRemoteDataModel } = useGenerateRemoteDataModelsTRPCClient(api, api.useUtils(), ['admin']);
// /* or, for older trpc versions: */
// const { getPropsForRemoteDataModel } = useGenerateRemoteDataModelsTRPCClient(api, api.useContext(), ['admin']);
//
// /* and then, later ... */
// <DataModel
//   /* other data model props here */
//
//   /* Then, at the end, to provide implementations for the data fetching related props: */
//   {...getPropsForRemoteDataModel('ExampleModelName', ['createItem', 'updateItem', 'deleteItem'])}
// >
//   /* fields go here */
// </DataModels>
export const useGenerateRemoteDataModelsTRPCClient = (rawApi: any, rawUtils: any, routerPath: Array<string>) => {
  const [api, utils] = useMemo(() => {
    let api = rawApi;
    let utils = rawUtils;
    for (const key of routerPath) {
      api = api[key];
      utils = utils[key];
    }
    return [api, utils];
  }, [rawApi, rawUtils]);

  // This function would make a request to the server and get `definitions`, plus then inject all
  // this extra context about how one could query the server to get information about the given datamodels
  //
  // This would be what that "bread specific custom adapter" thing would do:
  const { mutate: genericCreateItem } = api.genericCreateItem.useMutation();
  const { mutate: genericUpdateItem } = api.genericUpdateItem.useMutation();
  const { mutate: genericDeleteItem } = api.genericDeleteItem.useMutation();
  const fetchRemoteDataModels = useCallback(async (): Promise<RemoteDataModelDefinition> => {
    const definitions = await utils.dataModelDefinitions.fetch();

    return {
      definitions,

      fetchPageOfData: (dataModelName) => {
        return async (page, filters, sort, searchText): Promise<Paginated<any>> => {
          const castedFilters = filters as Array<[Array<string>, string | number | boolean]>;

          return utils.genericFetchPageOfData.fetch({
            model: dataModelName,
            page,
            filters: castedFilters,
            sort,
            searchText,
          });
        };
      },
      fetchItem: (dataModelName) => {
        return async (itemKey) => {
          return utils.genericFetchItem.fetch({ model: dataModelName, itemKey });
        };
      },
      createItem: (dataModelName) => {
        return async (createData) => {
          return genericCreateItem({ model: dataModelName, createData });
        };
      },
      updateItem: (dataModelName) => {
        return async (itemKey, updateData) => {
          return genericUpdateItem({ model: dataModelName, itemKey, updateData });
        };
      },
      deleteItem: (dataModelName) => {
        return async (itemKey) => {
          return genericDeleteItem({ model: dataModelName, itemKey });
        };
      },

      // FIXME: consider avoiding camelcase url paths; dataModelName is camelcase!
      listLink: (dataModelName) => ({ type: 'next-link', href: `/admin/${dataModelName}` }),
      detailLinkGenerator: (dataModelName, key) => ({ type: 'next-link', href: `/admin/${dataModelName}/${key}` }),
      createLink: dataModelName => ({ type: 'next-link', href: `/admin/${dataModelName}/new` }),
    };
  }, [utils, genericCreateItem, genericUpdateItem, genericDeleteItem]);

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
        const result: Partial<DataModelProps> = {
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
        return (result as unknown) as Pick<DataModelProps<Item>, 'fetchItem' | 'fetchPageOfData' | NonNullable<AdditionalFunctionalities>>;
      },
    };
  }, [fetchRemoteDataModelsResultRef]);

  return output;
};
