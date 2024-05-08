// import "./global.css";

import { DataModel, DataModels } from './datamodel';
export { DataModel, DataModels };

import Field from './fields';
export { Field };

import Launcher from './launcher';
export { Launcher };

import { useListDataContext, useDetailDataContext } from './data-context';
export { useListDataContext, useDetailDataContext };

import ListCSVExport from './csv-export';
export { ListCSVExport };

import { AdminContextProvider, StateCache } from './admin-context';
export { AdminContextProvider };
export type { StateCache };

import FilterDefinition from './filter-definitions';
export { FilterDefinition };

import StringFilterDefinition from './filter-definitions/StringFilterDefinition';
export { StringFilterDefinition };



import List from "./list";
export { List };

import { ListFilterBar } from './list/filter-bar';
export { ListFilterBar };

import ListActionBar from "./list/action-bar";
export { ListActionBar };


import ListTable from './list/table';
export { ListTable };

import ListColumnSetSelector from './list/column-sets';
export { ListColumnSetSelector };

import Detail from './detail';
export { Detail };

import DetailFields from './detail/fields';
export { DetailFields };



import BooleanField from './fields/BooleanField';
export { BooleanField };

import JSONField from './fields/JSONField';
export { JSONField };

import NumberField from './fields/NumberField';
export { NumberField };

import ChoiceField from './fields/ChoiceField';
export { ChoiceField };

import InputField from './fields/InputField';
export { InputField };

import MultiLineInputField from './fields/MultiLineInputField';
export { MultiLineInputField };

import SingleForeignKeyField from './fields/SingleForeignKeyField';
export { SingleForeignKeyField };

import MultiForeignKeyField from './fields/MultiForeignKeyField';
export { MultiForeignKeyField };

import { useContext } from 'react';
import { RemoteDataModelsContext, RemoteDataModelDefinition } from './datamodel';
export const RemoteFields: React.FunctionComponent<{
  name: string;
  include?: Array<keyof RemoteDataModelDefinition["definitions"]>,
  exclude?: Array<keyof RemoteDataModelDefinition["definitions"]>
}> = ({ name, include, exclude }) => {
  const remoteDataModels = useContext(RemoteDataModelsContext);
  if (!remoteDataModels) {
    // FIXME: maybe throw an error here instead of failing silently if the context is empty?
    return null;
  }

  const definitions = remoteDataModels.definitions[name];
  if (!definitions) {
    return null;
  }

  return Object.entries(definitions.columns).map(([fieldName, definition]) => {
    if (exclude && exclude.includes(fieldName)) {
      return null;
    }
    if (include && !include.includes(fieldName)) {
      return null;
    }

    switch (definition.type) {
      case "primaryKey": {
        return (
          <Field
            key={fieldName}
            name={fieldName}
            singularDisplayName={definition.singularDisplayName}
            pluralDisplayName={definition.pluralDisplayName}
            getInitialStateFromItem={user => (user as any)[fieldName]}
            injectAsyncDataIntoInitialStateOnDetailPage={async state => state}
            serializeStateToItem={(item) => item}
            displayMarkup={state => <span>{state}</span>}
            sortable
          />
        );
      }
      case "text": {
        return (
          <InputField
            key={fieldName}
            name={fieldName}
            singularDisplayName={definition.singularDisplayName}
            pluralDisplayName={definition.pluralDisplayName}

            nullable={definition.nullable}
            sortable
          />
        );
      }
      case "number": {
        return (
          <NumberField
            key={fieldName}
            name={fieldName}
            singularDisplayName={definition.singularDisplayName}
            pluralDisplayName={definition.pluralDisplayName}

            nullable={definition.nullable}
            sortable
          />
        );
      }
      case "boolean": {
        return (
          <BooleanField
            key={fieldName}
            name={fieldName}
            singularDisplayName={definition.singularDisplayName}
            pluralDisplayName={definition.pluralDisplayName}

            nullable={definition.nullable}
            sortable

            getInitialStateWhenCreating={() => false}
          />
        );
      }
      case "json": {
        return (
          <JSONField
            key={fieldName}
            name={fieldName}
            singularDisplayName={definition.singularDisplayName}
            pluralDisplayName={definition.pluralDisplayName}

            sortable

            getInitialStateWhenCreating={() => false}
          />
        );
      }
      case "datetime": {
        return (
          <InputField
            key={fieldName}
            name={fieldName}
            singularDisplayName={definition.singularDisplayName}
            pluralDisplayName={definition.pluralDisplayName}

            getInitialStateFromItem={item => {
              const result = (item as any)[fieldName];
              if (definition.nullable && result === null) {
                return null;
              } else {
                return (result as Date).toISOString()
              }
            }}
            getInitialStateWhenCreating={() => new Date().toISOString()}
            serializeStateToItem={(partial, state) => ({ ...partial, [fieldName]: state !== null ? new Date(state) : null })}

            nullable={definition.nullable}
            sortable
          />
        );
      }
      case "singleForeignKey": {
        return (
          <SingleForeignKeyField
            key={fieldName}
            name={fieldName}
            singularDisplayName={definition.singularDisplayName}
            pluralDisplayName={definition.pluralDisplayName}

            nullable={definition.nullable}
            sortable

            relatedName={definition.to}
            getInitialStateFromItem={item => {
              return { type: 'KEY_ONLY', key: (item as any)[fieldName] };
            }}
          />
        );
      }
      case "multiForeignKey": {
        return (
          <MultiForeignKeyField
            key={fieldName}
            name={fieldName}
            singularDisplayName={definition.singularDisplayName}
            pluralDisplayName={definition.pluralDisplayName}

            sortable

            relatedName={definition.to}
            getInitialStateFromItem={item => {
              const value = (item as any)[fieldName];
              if (!Array.isArray(value)) {
                throw new Error(`Error generating MultiForeignKeyField from remote data model: ${name}.${fieldName} is not an array!`);
              }
              return { type: 'KEY_ONLY', key: value };
            }}
          />
        );
      }
      default:
        return null;
    }
  });
};



import { ItemKey } from './types';
export const ListDetailRenderer: React.FunctionComponent<{
  basePath: string;
  name: string;
  view: 'list' | 'detail';
  itemKey?: ItemKey
}> = (props) => {
  switch (props.view) {
    case "list":
      return (
        <List<any>
          name={props.name}
          checkable
        >
          <ListFilterBar searchable>
            {/* TODO: generate filter definitions somehow */}
            {null}
          </ListFilterBar>
          <ListActionBar<any> />
          <ListTable />
        </List>
      );
    case "detail":
      return (
        <Detail<any> name={props.name} itemKey={props.itemKey}>
          <DetailFields />
        </Detail>
      );
  }
};
