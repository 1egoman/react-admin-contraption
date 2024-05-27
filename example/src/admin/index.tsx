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

import { AdminContextProvider } from './admin-context';
export { AdminContextProvider };

import { StateCache } from './state-cache';
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

import RemoteFields from './fields/RemoteFields';
export { RemoteFields };



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
