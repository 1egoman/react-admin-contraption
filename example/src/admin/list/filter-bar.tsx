import { useContext, useMemo, useEffect, useState, Fragment } from "react";
import { BaseItem, Filter, ALL_ITEMS, FILTER_NOT_SET_YET } from "../types";
import { useControls } from "../controls";
import { FilterMetadata, FilterMetadataContext } from '../filter-definitions';
import { useListDataContext } from "..";

import styles from '../styles.module.css';

export const SearchInput: React.FunctionComponent<{
  pluralDisplayName: string;
  size: 'regular' | 'small';
  value: string;
  onChange: (text: string) => void;
}> = ({ pluralDisplayName, size, value, onChange }) => {
  const Controls = useControls();

  const [text, setText] = useState('');
  useEffect(() => {
    setText(value);
  }, [value]);

  return (
    <Controls.TextInput
      size={size}
      placeholder={`Search ${pluralDisplayName.toLowerCase()}...`}
      value={text}
      onChange={setText}
      onBlur={() => onChange(text)}
    />
  );
}


type ListFilterBarProps = {
  addable?: boolean;
  searchable?: boolean;
  filterPresets?: { [name: string]: (old: Array<Filter>) => Array<Filter> };
  children: React.ReactNode;
};

export const ListFilterBar = <Item = BaseItem>({
  addable = true,
  searchable,
  filterPresets = {},
  children,
}: ListFilterBarProps) => {
  const listDataContextData = useListDataContext<Item>('ListFilterBar');

  const Controls = useControls();

  const filterMetadataContextData = useContext(FilterMetadataContext);
  if (!filterMetadataContextData) {
    throw new Error('Error: <Filter ... /> was not rendered inside of a container component! Try rendering this inside of a <ListFilterBar> ... </ListFilterBar>.');
  }
  const [filterMetadata, _setFilterMetadata] = filterMetadataContextData;

  // Create a tree structure of possible filter names
  const filterMetadataNameHierarchy = useMemo(() => {
    type Hierarchy = Map<string, Hierarchy | true>;
    let hierarchy: Hierarchy = new Map();

    for (const entry of filterMetadata) {
      if (entry.name.length === 0) {
        throw new Error('<FilterDefinition /> name prop must be at least 1 string long!');
      }

      let lastPointer = hierarchy;
      let pointer = hierarchy;

      for (const nameSection of entry.name) {
        let nextPointer = pointer.get(nameSection);
        if (!nextPointer) {
          nextPointer = new Map();
          pointer.set(nameSection, nextPointer);
        }
        if (nextPointer === true) {
          nextPointer = new Map([
            ["default", true],
          ]);
          pointer.set(nameSection, nextPointer);
        }
        lastPointer = pointer;
        pointer = nextPointer;
      }

      lastPointer.set(entry.name.at(-1), true);
    }

    return hierarchy;
  }, [filterMetadata]);

  // This control is hidden when nothing is checked
  if (listDataContextData.checkedItemKeys === ALL_ITEMS) {
    return null;
  }
  if (listDataContextData.checkedItemKeys.length > 0) {
    return null;
  }

  const filterPresetButtons = Object.entries(filterPresets).map(([name, filterPresetCallback]) => {
    return (
      <Controls.Button
        key={name}
        size="small"
        onClick={() => listDataContextData.onChangeFilters(filterPresetCallback(listDataContextData.filters))}
      >{name}</Controls.Button>
    );
  });


  return (
    <Fragment>
      <Controls.AppBar
        intent="header"
        size="regular"
        title={
          <span className={styles.listFilterBarTitle}>
            {listDataContextData.pluralDisplayName.slice(0, 1).toUpperCase()}
            {listDataContextData.pluralDisplayName.slice(1)}
          </span>
        }
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', overflow: 'visible' }}>
            {addable && listDataContextData.createLink ? (
              <Controls.NavigationButton variant="primary" navigatable={listDataContextData.createLink}>
                &#65291; Add {listDataContextData.singularDisplayName}
              </Controls.NavigationButton>
            ) : null}

            {filterMetadata.length > 0 ? (
              <Controls.Popover
                target={toggle => (
                  <Controls.Button onClick={toggle}>
                    {listDataContextData.filters.length > 0 ? `Filters (${listDataContextData.filters.length})` : 'Filters'}
                  </Controls.Button>
                )}
              >
                {close => (
                  <div className={styles.filterPopup}>
                    <Controls.AppBar
                      intent="header"
                      size="small"
                      title={<span className={styles.filterPopupHeaderName}>Filters</span>}
                      actions={
                        <Controls.IconButton size="small" onClick={close}>
                          &times;
                        </Controls.IconButton>
                      }
                    />

                    <div className={styles.filterPopupBody}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 128 }}>
                        {listDataContextData.filters.map((filter, filterIndex) => {
                          const getPeerOptionsForFilterPath = (path: Array<string>) => {
                            let pointer: typeof filterMetadataNameHierarchy | true = filterMetadataNameHierarchy;
                            let lastPointer = pointer;

                            for (const entry of path) {
                              if (typeof pointer === 'undefined') {
                                return [];
                              }
                              if (pointer === true) {
                                return [];
                              }
                              lastPointer = pointer;
                              pointer = pointer.get(entry);
                            }

                            return Array.from(lastPointer.keys());
                          };

                          // Attempt to find a filter definition that matches this new name selection
                          let metadata: FilterMetadata | null = null;
                          for (const item of filterMetadata) {
                            const nameMatches = filter.name.every((e, i) => e === item.name[i]);
                            if (nameMatches) {
                              metadata = item;
                              break;
                            }
                          }

                          return (
                            <div key={filterIndex} style={{ display: 'flex', justifyContent: 'space-between', gap: 4, alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: 14, width: 48 }}>
                                  {filterIndex === 0 ? 'where' : 'and'}
                                </span>
                                {filter.name.map((entry, entryIndex) => (
                                  <Controls.Select
                                    size="small"
                                    value={entry}
                                    key={entryIndex}
                                    onChange={newValue => {
                                      // Given the adjustment in filter name, figure out what the new filter name
                                      // would be
                                      const newFilterNamePrefix = filter.name.slice(0, entryIndex);
                                      newFilterNamePrefix[entryIndex] = newValue;

                                      // Attempt to find a filter definition that matches this new name selection
                                      let newFilterMetadata: FilterMetadata | null = null;
                                      for (const item of filterMetadata) {
                                        const namePrefixMatches = newFilterNamePrefix.every((e, i) => e === item.name[i]);
                                        if (namePrefixMatches) {
                                          newFilterMetadata = item;
                                          break;
                                        }
                                      }
                                      if (!newFilterMetadata) {
                                        return;
                                      }
                                      const newFilterMetadataNonNull = newFilterMetadata;

                                      // Update the given filter to now be of type `newFilterMetadata`
                                      listDataContextData.onChangeFilters(
                                        listDataContextData.filters.map((f, i) => {
                                          if (i === filterIndex) {
                                            const initialState = newFilterMetadataNonNull.getInitialState();
                                            const isValid = newFilterMetadataNonNull.onIsValid(initialState);
                                            return {
                                              name: newFilterMetadataNonNull.name,
                                              isValid,
                                              isComplete: isValid && newFilterMetadataNonNull.onIsComplete(initialState),
                                              workingState: initialState,
                                              state: initialState,
                                            };
                                          } else {
                                            return f;
                                          }
                                        }),
                                      );
                                    }}
                                    options={[
                                      { value: FILTER_NOT_SET_YET, disabled: true, label: "Pick filter..." },
                                      ...getPeerOptionsForFilterPath(filter.name.slice(0, entryIndex+1)).map(choice => ({
                                        value: choice,
                                        label: choice,
                                      })),
                                    ]}
                                  />
                                ))}
                                {metadata ? metadata.children(
                                  filter.workingState,
                                  // Call this function to change the state
                                  (newState) => {
                                    listDataContextData.onChangeFilters(
                                      listDataContextData.filters.map((f, i) => {
                                        if (i === filterIndex) {
                                          return { ...f, workingState: newState };
                                        } else {
                                          return f;
                                        }
                                      }),
                                    );
                                  },
                                  filter,
                                  // Call this function to indicate that editing is complete
                                  () => {
                                    listDataContextData.onChangeFilters(
                                      listDataContextData.filters.map((f, i) => {
                                        if (i === filterIndex) {
                                          const isValid = metadata.onIsValid(f.workingState);
                                          return {
                                            ...f,
                                            state: f.workingState,
                                            isValid,
                                            isComplete: isValid && metadata.onIsComplete(f.workingState),
                                          };
                                        } else {
                                          return f;
                                        }
                                      }),
                                    );
                                  },
                                ) : null}
                              </div>
                              <Controls.IconButton size="small" onClick={() => {
                                listDataContextData.onChangeFilters(
                                  listDataContextData.filters.filter((_f, i) => i !== filterIndex)
                                );
                              }}>&times;</Controls.IconButton>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <Controls.AppBar
                      intent="footer"
                      size="small"
                      title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, userSelect: 'none' }}>
                          <Controls.Button
                            size="small"
                            variant="primary"
                            onClick={() => {
                              listDataContextData.onChangeFilters([
                                ...listDataContextData.filters,
                                {
                                  name: [FILTER_NOT_SET_YET],
                                  workingState: FILTER_NOT_SET_YET,
                                  state: FILTER_NOT_SET_YET,
                                  isValid: false,
                                  isComplete: false,
                                },
                              ])
                            }}
                          >Add filter</Controls.Button>
                          <div style={{
                            borderLeft: `1.5px solid var(--gray-12)`,
                            paddingLeft: 8,
                            display: 'flex',
                            gap: 8,
                          }}>
                            {filterPresetButtons.length === 0 ? (
                              <small style={{color: 'var(--gray-10)', marginTop: 3}}>No presets</small>
                            ) : filterPresetButtons}
                          </div>
                        </div>
                      }
                    />
                  </div>
                )}
              </Controls.Popover>
            ) : null}

            {searchable ? (
              <div className={styles.listFilterBarSearch}>
                <SearchInput
                  pluralDisplayName={listDataContextData.pluralDisplayName}
                  value={listDataContextData.searchText}
                  size="regular"
                  onChange={text => listDataContextData.onChangeSearchText(text)}
                />
              </div>
            ) : null}
          </div>
        }
      />

      {/* The children should not render anything, this should purely be Filters */}
      {children}
    </Fragment>
  );
};

