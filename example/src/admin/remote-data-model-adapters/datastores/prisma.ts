import { RemoteDataModelDefinitionColumn } from "../../datamodel";
import { Filter, Sort, ItemKey, FixMe } from "../../types";


export default function PrismaDataStoreProvider(
  // Set `prismaRaw` equal to the literal default export from `@prisma/client`
  // ie, the value of `prisma` in `import prisma from '@prisma/client';`
  prismaRaw: any,

  // If a custom PrismaClient constructor is desired, then pass it in here.
  // ie, maybe you want to make it log verbosely, etc
  constructPrismaClient?: () => FixMe /* PrismaClient */
) {
  const globalForPrisma = globalThis as unknown as {
    prismaClient: any;//PrismaClient | undefined;
  };

  const prismaClient: any /*PrismaClient*/ = globalForPrisma.prismaClient ?? (constructPrismaClient ? constructPrismaClient() : new prismaRaw.PrismaClient({
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
            if (first) match = match[0]!.toUpperCase() + match.slice(1);
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
      sort: Sort | null,
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
        if (!fieldName) {
          return false;
        }
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

      // if (searchText.length > 0) {
      //   filters.event = { eventName: { contains: searchText } };
      // }

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
