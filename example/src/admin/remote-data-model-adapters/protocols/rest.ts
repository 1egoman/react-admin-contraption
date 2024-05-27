import { useCallback, useMemo, useRef } from "react";
import express from "express";
import bodyParser from "body-parser";

import { DataModel, RemoteDataModelDefinition, RemoteDataModelDefinitionColumn } from "../../datamodel";
import { BaseItem, FixMe, Paginated, Sort } from "../../types"
import { DataStoreProvider } from "../datastores";


type RemoteDataModelsRestEndpointsParams = {
  pageSize?: number;
};

const PAGE_SIZE = 20;

export const generateRemoteDataModelsRestEndpoints = (
  dataStoreProvider: DataStoreProvider,
  params: RemoteDataModelsRestEndpointsParams = {},
) => {
  const pageSize = params.pageSize || PAGE_SIZE;

  const router = express.Router();

  router.get('/_definitions', (_req, res) => {
    dataStoreProvider.getDataModels().then(dataModels => {
      res.status(200).send(dataModels);
    }).catch(err => {
      console.error('Error getting data models:', err);
      res.status(500).send({ error: 'Error getting data models!' });
    });
  });

  router.get('/:model', (req, res) => {
    const page = parseInt(`${req.query.page}`);
    const filters = JSON.parse(`${req.query.filters || '[]'}`);
    const sort = req.query.sortField && req.query.sortDirection ? {
      fieldName: `${req.query.sortField}` as Sort['fieldName'],
      direction: `${req.query.direction}` as Sort['direction'],
    } : null;
    const searchText = `${req.query.searchText}`;

    dataStoreProvider.list(
      req.params.model,
      page,
      pageSize,
      filters,
      searchText,
      sort,
    ).then(data => {
      res.status(200).send(data);
    }).catch(err => {
      console.error(`Error getting data model ${req.params.model} list:`, err);
      res.status(500).send(`Error getting data model ${req.params.model} list!`);
    });
  });

  router.get('/:model/:key', (req, res) => {
    dataStoreProvider.read(
      req.params.model,
      req.params.key,
    ).then(data => {
      res.status(200).send(data);
    }).catch(err => {
      console.error(`Error getting data model ${req.params.model} with key ${req.params.key}:`, err);
      res.status(500).send(`Error getting data model ${req.params.model} with key ${req.params.key}!`);
    });
  });

  router.post('/:model', bodyParser.json(), (req, res) => {
    dataStoreProvider.create(
      req.params.model,
      req.body,
    ).then(data => {
      res.status(201).send(data);
    }).catch(err => {
      console.error(`Error creating data model ${req.params.model} with data ${JSON.stringify(req.body)}:`, err);
      res.status(500).send(`Error getting data model ${req.params.model} with data ${JSON.stringify(req.body)}!`);
    });
  });

  router.patch('/:model/:key', bodyParser.json(), (req, res) => {
    dataStoreProvider.update(
      req.params.model,
      req.params.key,
      req.body,
    ).then(data => {
      res.status(200).send(data);
    }).catch(err => {
      console.error(`Error updating data model ${req.params.model} with key ${req.params.key} and data ${JSON.stringify(req.body)}:`, err);
      res.status(500).send(`Error updating data model ${req.params.model} with key ${req.params.key} and data ${JSON.stringify(req.body)}!`);
    });
  });

  router.delete('/:model/:key', (req, res) => {
    dataStoreProvider.delete(
      req.params.model,
      req.params.key,
    ).then(data => {
      if (!data) {
        res.status(204).end();
      } else {
        res.status(200).send(data);
      }
    }).catch(err => {
      console.error(`Error deleting data model ${req.params.model} with key ${req.params.key}:`, err);
      res.status(500).send(`Error deleting data model ${req.params.model} with key ${req.params.key}!`);
    });
  });

  return router;
};

type GenerateRemoteDataModelsRestEndpointsParams = {
  fetchDefinitions?: boolean;
  updateRequestMethod?: 'PUT' | 'PATCH'
};

export const useGenerateRemoteDataModelsRestEndpoints = (
  baseUrl: string,
  customFetchFn: (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch> = fetch,
  params: GenerateRemoteDataModelsRestEndpointsParams = {},
) => {
  const fetchRemoteDataModels = useCallback(async (): Promise<RemoteDataModelDefinition> => {
    let definitions: {
      [dataModelName: string]: {
        singularDisplayName: DataModel['singularDisplayName'];
        pluralDisplayName: DataModel['pluralDisplayName'];
        columns: { [fieldName: string]: RemoteDataModelDefinitionColumn };
      };
    } = {};

    if (params.fetchDefinitions) {
      const response = await customFetchFn(`${baseUrl}/_definitions`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Error making request to get data model definitions: ${response.status} ${await response.text()}`);
      }
      definitions = await response.json();
    }

    return {
      definitions,

      fetchPageOfData: (dataModelName) => {
        return async (page, filters, sort, searchText): Promise<Paginated<any>> => {
          const queryString = new URLSearchParams();
          queryString.append('page', `${page}`);
          queryString.append('filters', `${JSON.stringify(filters)}`);
          if (sort) {
            queryString.append('sortField', `${sort.fieldName}`);
            queryString.append('sortDirection', `${sort.direction}`);
          }
          queryString.append('searchText', `${searchText}`);

          const response = await customFetchFn(`${baseUrl}/${dataModelName}?${queryString}`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            },
          });

          if (!response.ok) {
            throw new Error(`Error making request to get list of ${dataModelName}: ${response.status} ${await response.text()}`);
          }
          return response.json();
        };
      },
      fetchItem: (dataModelName) => {
        return async (itemKey) => {
          const response = await customFetchFn(`${baseUrl}/${dataModelName}/${itemKey}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          });

          if (!response.ok) {
            throw new Error(`Error making request to get ${dataModelName} with key ${itemKey}: ${response.status} ${await response.text()}`);
          }
          return response.json();
        };
      },
      createItem: (dataModelName) => {
        return async (createData) => {
          const response = await customFetchFn(`${baseUrl}/${dataModelName}`, {
            method: 'POST',
            body: JSON.stringify(createData),
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          });

          if (!response.ok) {
            throw new Error(`Error making request to create ${dataModelName}: ${response.status} ${await response.text()}`);
          }
          return response.json();
        };
      },
      updateItem: (dataModelName) => {
        return async (itemKey, updateData) => {
          const response = await customFetchFn(`${baseUrl}/${dataModelName}/${itemKey}`, {
            method: params.updateRequestMethod || 'PATCH',
            body: JSON.stringify(updateData),
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          });

          if (!response.ok) {
            throw new Error(`Error making request to update ${dataModelName} with key ${itemKey}: ${response.status} ${await response.text()}`);
          }
          return response.json();
        };
      },
      deleteItem: (dataModelName) => {
        return async (itemKey) => {
          const response = await customFetchFn(`${baseUrl}/${dataModelName}/${itemKey}`, { method: 'DELETE' });

          if (!response.ok) {
            throw new Error(`Error making request to delete ${dataModelName} with key ${itemKey}: ${response.status} ${await response.text()}`);
          }
        };
      },

      // FIXME: consider avoiding camelcase url paths; dataModelName is camelcase!
      listLink: (dataModelName) => ({ type: 'next-link', href: `/admin/${dataModelName}` }),
      detailLinkGenerator: (dataModelName, key) => ({ type: 'next-link', href: `/admin/${dataModelName}/${key}` }),
      createLink: dataModelName => ({ type: 'next-link', href: `/admin/${dataModelName}/new` }),
    };
  }, [baseUrl, customFetchFn, params]);

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
