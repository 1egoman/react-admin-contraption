import { useContext } from 'react';
import { RemoteDataModelsContext, RemoteDataModelDefinition } from '../datamodel';

import Field from '.';
import BooleanField from './BooleanField';
import JSONField from './JSONField';
import NumberField from './NumberField';
import InputField from './InputField';
import SingleForeignKeyField from './SingleForeignKeyField';
import MultiForeignKeyField from './MultiForeignKeyField';
import PrimaryKeyField from './PrimaryKeyField';

const RemoteFields: React.FunctionComponent<{
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
          <PrimaryKeyField
            key={fieldName}
            name={fieldName}
            singularDisplayName={definition.singularDisplayName}
            pluralDisplayName={definition.pluralDisplayName}
            getInitialStateFromItem={user => (user as any)[fieldName]}
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

export default RemoteFields;
