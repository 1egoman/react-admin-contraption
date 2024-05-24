import { useContext } from "react";

import { DataModelsContext } from "./datamodel";
import { useControls } from "./controls";

const Launcher = () => {
  const Controls = useControls();

  const dataModelsContextData = useContext(DataModelsContext);
  if (!dataModelsContextData) {
    throw new Error('Error: <Launcher ... /> was not rendered inside of a container component! Try rendering this inside of a <DataModels> ... </DataModels>.');
  }

  const [dataModels, _setter] = dataModelsContextData;

  return (
    <div style={{ padding: 8 }}>
      <h1 style={{ paddingBottom: 16 }}>Admin Pages:</h1>
      <ul style={{ paddingLeft: 16 }}>
        {Array.from(dataModels).map(([name, datamodel]) => {
          if (!datamodel.listLink) {
            return null;
          }

          return (
            <li key={name}>
              <Controls.NavigationLink navigatable={datamodel.listLink}>
                {datamodel.pluralDisplayName}
              </Controls.NavigationLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default Launcher;
