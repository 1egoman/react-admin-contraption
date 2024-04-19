import { useContext } from "react";

import { DataModelsContext } from "./datamodel";
import { NavigationButton } from "./controls/Button";

const Launcher = () => {
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
              <NavigationButton navigatable={datamodel.listLink}>{datamodel.pluralDisplayName}</NavigationButton>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default Launcher;
