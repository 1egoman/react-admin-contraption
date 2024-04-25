import * as React from 'react';

import styles from '../styles.module.css';
import { BaseItem, BaseFieldName } from '../types';
import { useControls } from '../controls';
import { FieldMetadata, FieldCollection } from '../fields';

const ListColumnSetSelector = <Item = BaseItem, FieldName = BaseFieldName>(props: {
  fields: FieldCollection<FieldMetadata<Item, FieldName>>;
  columnSets: { [name: string]: Array<FieldName> }
  columnSet: 'all' | string | Array<FieldName>;
  onChangeColumnSet: (newColumnSet: 'all' | string | Array<FieldName>) => void;
}) => {
  const Controls = useControls();
  return (
    <Controls.Popover
      target={toggle => (
        <Controls.IconButton onClick={toggle}>&#9707;</Controls.IconButton>
      )}
    >
      {close => (
        <div className={styles.listColumnSetPopup}>
          <Controls.AppBar
            intent="header"
            size="small"
            title={<span className={styles.listColumnSetPopupHeaderName}>Column Sets</span>}
            actions={
              <Controls.IconButton size="small" onClick={close}>
                &times;
              </Controls.IconButton>
            }
          />

          <div className={styles.listColumnSetBody}>
            <h3>All columns</h3>
            <ul>
              <li
                onClick={() => props.onChangeColumnSet('all')}
                style={{cursor: 'pointer', backgroundColor: props.columnSet === 'all' ? 'red' : 'transparent'}}
              >
                All
              </li>
            </ul>
            <br />

            <h3>Server defined column sets</h3>
            <ul>
              {Object.entries(props.columnSets).map(([name, columns]) => {
                return (
                  <li
                    key={name}
                    onClick={() => props.onChangeColumnSet(name)}
                    style={{cursor: 'pointer', backgroundColor: props.columnSet === name ? 'red' : 'transparent'}}
                  >
                    {name}<br/>
                    <small>{columns.map(name => props.fields.metadata.find(f => f.name === name)?.singularDisplayName || name).join(', ')}</small>
                  </li>
                );
              })}
            </ul>
            <br />

            <h3>Custom Columns</h3>
            TODO
          </div>
        </div>
      )}
    </Controls.Popover>
  );
};

export default ListColumnSetSelector;
