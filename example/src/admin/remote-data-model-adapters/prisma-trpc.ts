import { useCallback, useMemo, useRef } from "react";
import { z } from "zod";
// import { PrismaClient } from "@prisma/client";

import { DataModel, RemoteDataModelDefinition, RemoteDataModelDefinitionColumn } from "../datamodel";

import { Filter, Sort, ItemKey, BaseItem, Paginated, FixMe } from "../types"





export function PrismaRemoteDataModelProvider(
  // Set `prismaRaw` equal to the literal default export from `@prisma/client`
  // ie, the value of `prisma` in `import prisma from '@prisma/client';`
  prismaRaw: any,

  // If a custom PrismaClient constructor is desired, then pass it in here.
  // ie, maybe you want to make it log verbosely, etc
  constructPrismaClient?: () => any
) {
  const globalForPrisma = globalThis as unknown as {
    prismaClient: any;//PrismaClient | undefined;
  };

  const prismaClient: any /*PrismaClient*/ = globalForPrisma.prismaClient ?? (constructPrismaClient ? constructPrismaClient() : new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  }));

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prismaClient = prismaClient;
  }

  return {
    async getDataModels() {
      // FIXME: check auth to make sure user can access admin?

      // https://stackoverflow.com/a/11153608/4115328                                                                                                             
      function capSplit(str: string) {                                                       
        return str.replace(
          /(^[a-z]+)|[0-9]+|[A-Z][a-z]+|[A-Z]+(?=[A-Z][a-z]|[0-9])/g,
          function(match, first){
            if (first) match = match[0].toUpperCase() + match.substr(1);
            return match + ' ';
          }
        )
      }

      return Object.fromEntries(
        // ref: https://github.com/prisma/prisma/discussions/11006#discussioncomment-1927352
        prismaRaw.Prisma.dmmf.datamodel.models
          .map((model: FixMe) => {
          const columns = Object.fromEntries(model.fields.flatMap((field: FixMe): Array<[string, RemoteDataModelDefinitionColumn]> => {
            const singularDisplayName = capSplit(field.name).trim();
            const pluralDisplayName = `${capSplit(field.name).trim()}s`;

            if (field.isId) {
              return [[field.name, { type: 'primaryKey', singularDisplayName, pluralDisplayName }]];
            }

            const nullable = !field.isRequired;

            if (field.relationFromFields && field.relationFromFields.length > 0) {
              return [[field.relationFromFields[0]!, { type: 'singleForeignKey', to: field.type, singularDisplayName, pluralDisplayName, nullable }]];
            }

            switch (field.type) {
              case "Boolean": 
                return [[field.name, { type: 'boolean', singularDisplayName, pluralDisplayName, nullable }]];
              case "DateTime":
                return [[field.name, { type: 'datetime', singularDisplayName, pluralDisplayName, nullable }]];
              case "Decimal":
              case "Float":
              case "Int":
              case "BigInt":
                return [[field.name, { type: 'number', singularDisplayName, pluralDisplayName, nullable }]];
              case "Json":
                return [[field.name, { type: 'json', singularDisplayName, pluralDisplayName, /* nullable */ }]];
              case "Bytes":
              case "String":
                return [[field.name, { type: 'text', singularDisplayName, pluralDisplayName, nullable }]];
              default:
                return [];
            }
          }));

          return [model.name, {
            singularDisplayName: capSplit(model.name).trim(),
            pluralDisplayName: `${capSplit(model.name).trim()}s`,
            columns,
          }];
        }));
    },
    async create(modelName: string, createData: object) {
      const modelPrisma: any = prismaClient[modelName];
      if (!modelPrisma) {
        throw new Error(`PrismaRemoteDataModelProvider: Cannot find prisma model with name ${modelName}!`);
      }

      return modelPrisma.create({ data: createData });
    },
    async read(modelName: string, key: ItemKey) {
      const modelPrisma: any = prismaClient[modelName as any];
      if (!modelPrisma) {
        throw new Error(`PrismaRemoteDataModelProvider: Cannot find prisma model with name ${modelName}!`);
      }

      const item = await modelPrisma.findFirst({ where: { id: key } });

      if (!item) {
        throw new Error(`Cannot find ${modelName} row with key ${key}!`);
      }

      return item;
    },
    async update(modelName: string, key: ItemKey, updateData: object) {
      const modelPrisma: any = prismaClient[modelName];
      if (!modelPrisma) {
        throw new Error(`PrismaRemoteDataModelProvider: Cannot find prisma model with name ${modelName}!`);
      }

      const item = await modelPrisma.update({ where: { id: key }, data: updateData });

      if (!item) {
        throw new Error(`Cannot update ${modelName} row with key ${key}!`);
      }

      return item;
    },
    async delete(modelName: string, key: ItemKey) {
      const modelPrisma: any = prismaClient[modelName];
      if (!modelPrisma) {
        throw new Error(`PrismaRemoteDataModelProvider: Cannot find prisma model with name ${modelName}!`);
      }

      const item = await modelPrisma.delete({ where: { id: key } });

      if (!item) {
        throw new Error(`Cannot delete ${modelName} row with key ${key}!`);
      }

      return item;
    },
    async list(
      modelName: string,
      page: number,
      pageSize: number,
      filters: Array<[Filter['name'], Filter['state']]>,
      searchText: string,
      sort: Sort,
    ) {
      const modelPrisma: any = prismaClient[modelName as any];
      if (!modelPrisma) {
        throw new Error(`PrismaRemoteDataModelProvider: Cannot find prisma model with name ${modelName}!`);
      }

      const fields = (await this.getDataModels())[modelName];
      if (!fields) {
        throw new Error(`PrismaRemoteDataModelProvider: Cannot find prisma fields for model with name ${modelName}!`);
      }

      const where = filters.reduce((where, [nameList, state]) => {
        if (nameList.length > 1) {
          return false;
        }

        const [fieldName, fieldOperator] = nameList;
        const field = fields[fieldName];
        if (!field) {
          throw new Error(`Cannot find prisma field ${fieldName} within model with name ${modelName}!`);
        }

        switch (field.type) {
          case "boolean": 
            if (fieldOperator) {
              throw new Error(`Unknown field operator ${fieldOperator} for prisma field ${fieldName} within model with name ${modelName}!`);
            }
            return { ...where, [fieldName]: state };
          case "datetime":
            if (typeof state !== "string") {
              throw new Error(`State for filter on ${fieldName} ${fieldOperator} within model with name ${modelName} was not string, found ${typeof state}!`);
            }
            switch (fieldOperator) {
              case "isnull":
                return { ...where, [fieldName]: state ? null : {not: {equals: null}} };
              case "lessthan":
                return { ...where, [fieldName]: { lt: state } };
              case "lessthanequals":
                return { ...where, [fieldName]: { lte: state } };
              case "greaterthan":
                return { ...where, [fieldName]: { gt: state } };
              case "greaterthanequals":
                return { ...where, [fieldName]: { gte: state } };
              case "equals":
              case undefined:
                return { ...where, [fieldName]: state };
              default:
                throw new Error(`Unknown field operator ${fieldOperator} for prisma field ${fieldName} within model with name ${modelName}!`);
            }
          case "number":
            switch (fieldOperator) {
              case "isnull":
                return { ...where, [fieldName]: state ? null : {not: {equals: null}} };
              case "lessthan":
                return { ...where, [fieldName]: { lt: state } };
              case "lessthanequals":
                return { ...where, [fieldName]: { lte: state } };
              case "greaterthan":
                return { ...where, [fieldName]: { gt: state } };
              case "greaterthanequals":
                return { ...where, [fieldName]: { gte: state } };
              case "equals":
              case undefined:
                return { ...where, [fieldName]: state };
              default:
                throw new Error(`Unknown field operator ${fieldOperator} for prisma field ${fieldName} within model with name ${modelName}!`);
            }
          case "json":
            switch (fieldOperator) {
              case "isnull":
                return { ...where, [fieldName]: state ? null : {not: {equals: null}} };
              default:
                throw new Error(`Unknown field operator ${fieldOperator} for prisma field ${fieldName} within model with name ${modelName}!`);
            }
          case "text":
            switch (fieldOperator) {
              case "isnull":
                return { ...where, [fieldName]: state ? null : {not: {equals: null}} };
              case "equals":
              case undefined:
                return { ...where, [fieldName]: state };
              default:
                throw new Error(`Unknown field operator ${fieldOperator} for prisma field ${fieldName} within model with name ${modelName}!`);
            }
          case "singleForeignKey":
            switch (fieldOperator) {
              case "isnull":
                return { ...where, [fieldName]: state ? null : {not: {equals: null}} };
              case "equals":
              case undefined:
                return { ...where, [fieldName]: state };
              default:
                throw new Error(`Unknown field operator ${fieldOperator} for prisma field ${fieldName} within model with name ${modelName}!`);
            }
          default:
            throw new Error(`Unknown field type ${field.type}!`);
        }
      }, {});

      if (searchText.length > 0) {
        filters.event = { eventName: { contains: input.searchText } };
      }

      const orderBy = sort ? {
        [sort.fieldName]: sort.direction
      } : undefined;

      const skip = (page-1) * pageSize;

      const results = await modelPrisma.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
      });

      const count = await modelPrisma.count({ where });

      return {
        nextPageAvailable: skip + results.length !== count,
        data: results,
        totalCount: count,
      };
    },
  };
};
type RemoteDataModelProvider = ReturnType<typeof PrismaRemoteDataModelProvider>;

type RemoteDataModelsTRPCParams = {
  pageSize?: number;
};







const PAGE_SIZE = 20;

export const generateRemoteDataModelsTRPCRouter = <T extends any>(
  trpcProcedure: T,
  dataModelProvider: RemoteDataModelProvider,
  params: RemoteDataModelsTRPCParams = {},
) => {
  const pageSize = params.pageSize || PAGE_SIZE;

  return {
    dataModelDefinitions: trpcProcedure.query(async () => dataModelProvider.getDataModels()),

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
        return dataModelProvider.list(
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
        return dataModelProvider.read(
          input.model,
          input.page,
          pageSize,
          input.filters,
          input.searchText,
          input.sort,
        );
      }),

    genericCreateItem: trpcProcedure
      .input(z.object({ model: z.string(), createData: z.any() }))
      .mutation(async ({ input }) => {
        // FIXME: convert errors thrown by this into trpc errors
        return dataModelProvider.create(
          input.model,
          input.createData,
        );
      }),

    genericUpdateItem: trpcProcedure
      .input(z.object({ model: z.string(), itemKey: z.string(), updateData: z.any() }))
      .mutation(async ({ input }) => {
        // FIXME: convert errors thrown by this into trpc errors
        return dataModelProvider.create(
          input.model,
          input.itemKey,
          input.updateData,
        );
      }),

    genericDeleteItem: trpcProcedure
      .input(z.object({ model: z.string(), itemKey: z.string() }))
      .mutation(async ({ input }) => {
        // FIXME: convert errors thrown by this into trpc errors
        return dataModelProvider.delete(
          input.model,
          input.itemKey,
        );
      }),
  };
};

// ie, useGenerateRemoteDataModelsTRPCClient(api, utils, ['admin']);
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
      getPropsForRemoteDataModel: <Item = BaseItem>(
        name: string,
        functionalitiesToImplement: Array<'createItem' | 'updateItem' | 'deleteItem'> = [],
      ) => {
        const result: Partial<DataModel> = {
          fetchPageOfData: async (page, filters, sort, search, abort) => get().then(
            result => result.fetchPageOfData(name)(page, filters, sort, search, abort)
          ),
          fetchItem: async (itemKey, abort) => get().then(result => result.fetchItem(name)(itemKey, abort)),

          createItem: functionalitiesToImplement.includes('createItem') ? (async (createData, abort) => get().then(result => {
            if (!result.createItem) {
              throw new Error(`getPropsForRemoteDataModel: createItem not implemented on remote data model definition for ${name}! To silence this, remove "createItem" from the getPropsForRemoteDataModel argument.`);
            }
            return result.createItem(name)(createData, abort);
          })) : undefined,
          updateItem: functionalitiesToImplement.includes('updateItem') ? (async (key, updateData, abort) => get().then(result => {
            if (!result.updateItem) {
              throw new Error(`getPropsForRemoteDataModel: updateItem not implemented on remote data model definition for ${name}! To silence this, remove "createItem" from the getPropsForRemoteDataModel argument.`);
            }
            return result.updateItem(name)(key, updateData, abort);
          })) : undefined,
          deleteItem: functionalitiesToImplement.includes('deleteItem') ? (async (key, abort) => get().then(result => {
            if (!result.deleteItem) {
              throw new Error(`getPropsForRemoteDataModel: deleteItem not implemented on remote data model definition for ${name}! To silence this, remove "createItem" from the getPropsForRemoteDataModel argument.`);
            }
            return result.deleteItem(name)(key, abort);
          })) : undefined,
        };

        // NOTE: Do this cast here because the remote data model functions are not generic
        return (result as unknown) as Partial<DataModel<Item>>;
      },
    };
  }, [fetchRemoteDataModelsResultRef]);

  return output;
};
