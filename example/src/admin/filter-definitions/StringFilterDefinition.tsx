import * as React from 'react';
import { useMemo } from 'react';

import { Filter } from '../types';
import { useControls } from '../controls';
import FilterDefinition, { FilterMetadata } from ".";

type StringFilterDefinitionProps = Partial<FilterMetadata<string>> & {
  name: FilterMetadata<string>['name'];
};

const StringFilterDefinition = (props: StringFilterDefinitionProps) => {
  const Controls = useControls();

  const getInitialState = useMemo(() => props.getInitialState || (() => ""), [props.getInitialState]);
  const onIsComplete = useMemo(() => props.onIsComplete || ((state: string) => state.length > 0), [props.onIsComplete]);
  const onIsValid = useMemo(() => props.onIsValid || ((state: string) => state.length > 0), [props.onIsValid]);
  const serialize = useMemo(() => props.serialize || ((state: string) => state), [props.serialize]);
  const deserialize = useMemo(() => props.deserialize || ((state: string) => state), [props.deserialize]);

  const children = useMemo(() => props.children || ((
    state: string,
    setState: (newState: string) => void,
    filter: Filter<string>,
    onBlur: () => void
  ) => (
    <Controls.TextInput
      size="small"
      value={state}
      onChange={setState}
      onBlur={onBlur}
      invalid={!filter.isValid}
    />
  )), [props.children]);

  return (
    <FilterDefinition<string>
      name={props.name}
      getInitialState={getInitialState}
      onIsComplete={onIsComplete}
      onIsValid={onIsValid}
      serialize={serialize}
      deserialize={deserialize}
    >
      {children}
    </FilterDefinition>
  );
};
export default StringFilterDefinition;
