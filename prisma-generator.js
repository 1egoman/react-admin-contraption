const foo = require('@prisma/client');
const pluralize = require('pluralize');

// https://stackoverflow.com/a/11153608/4115328
function capSplit(str){
  return str.replace(
    /(^[a-z]+)|[0-9]+|[A-Z][a-z]+|[A-Z]+(?=[A-Z][a-z]|[0-9])/g,
    function(match, first){
      if (first) match = match[0].toUpperCase() + match.substr(1);
      return match + ' ';
    }
  )
}

const imports = [];

const output = Object.entries(foo)
  .filter(([k, v]) => k.endsWith('ScalarFieldEnum'))
  .map(([k, v]) => [k.replace(/ScalarFieldEnum$/, ''), Object.keys(v)])
  .flatMap(([modelName, columns]) => {
    const name = modelName[0].toLowerCase() + modelName.slice(1);
    const allLowerName = modelName.toLowerCase();
    const allLowerNamePlural = pluralize.plural(allLowerName);

    const singularDisplayName = capSplit(modelName).toLowerCase().trim();
    const pluralDisplayName = pluralize.plural(singularDisplayName);

    imports.push(modelName);

    return [
      `<DataModel<${modelName}>`,
      `  name="${name}"`,
      `  singularDisplayName="${singularDisplayName}"`,
      `  pluralDisplayName="${pluralDisplayName}"`,
      `  fetchPageOfData={async (page, filters, sort, search, /* signal */) => {`,
      `    // FIXME: implement this!`,
      `    return { nextPageAvailable: false, totalCount: 0, data: [] };`,
      `  }}`,
      `  fetchItem={async (id, /* signal */) => {`,
      `    // FIXME: implement this!`,
      `    return {`,
      `      id,`,
      ...columns.filter(c => c !== 'id').map(c => c.endsWith('At') ? `      ${c}: new Date(),` : `      ${c}: '',`),
      `    };`,
      `  }}`,
      `  // createItem`,
      `  // updateItem`,
      `  // deleteItem`,
      `  keyGenerator={${name} => ${name}.id}`,
      `  detailLinkGenerator={${name} => ({ type: 'next-link', href: \`/admin/${allLowerNamePlural}/\${${name}.id}\` })}`,
      `  createLink={{ type: 'next-link', href: \`/admin/${allLowerNamePlural}/new\` }}`,
      `  listLink={{ type: 'next-link', href: \`/admin/${allLowerNamePlural}\` }}`,
      `>`,

      ...columns.flatMap(column => {
        const words = capSplit(column).trim();
        const singularDisplayName = words[0].toUpperCase() + words.slice(1);
        const pluralDisplayName = pluralize.plural(singularDisplayName);

        const titleCaseColumn = column[0].toUpperCase() + column.slice(1);
        if (column === 'id') {
          // The id field is read only
          return [
            `  <Field<${modelName}, "${column}", string>`,
            `    name="${column}"`,
            `    singularDisplayName="${singularDisplayName}"`,
            `    pluralDisplayName="${pluralDisplayName}"`,
            `    columnWidth="250px"`,
            `    getInitialStateFromItem={${name} => ${name}.id}`,
            `    injectAsyncDataIntoInitialStateOnDetailPage={async state => state}`,
            `    serializeStateToItem={(${name}) => ${name}}`,
            `    displayMarkup={state => <span>{state}</span>}`,
            `  />`,
          ];
        } else if (column.endsWith('At')) {
          // Assume a datetime if the column ends in `At`
          return [
            `  <InputField<${modelName}, "${column}">`,
            `    name="${column}"`,
            `    singularDisplayName="${singularDisplayName}"`,
            `    pluralDisplayName="${pluralDisplayName}"`,
            `    sortable`,
            `    getInitialStateFromItem={${name} => ${name}.${column}.toISOString()}`,
            `    getInitialStateWhenCreating={() => new Date().toISOString()}`,
            `    serializeStateToItem={(partial${modelName}, state) => ({ ...partial${modelName}, ${column}: new Date(state) })}`,
            `  />`,
          ];
        } else {
          // Regular string / text field
          return [
            `  <InputField<${modelName}, "${column}" /*, true */>`,
            `    name="${column}"`,
            `    singularDisplayName="${singularDisplayName}"`,
            `    pluralDisplayName="${pluralDisplayName}"`,
            `    sortable`,
            `    // nullable`,
            `    getInitialStateFromItem={${name} => ${name}.${column}}`,
            `    getInitialStateWhenCreating={() => ''}`,
            `    serializeStateToItem={(partial${modelName}, state) => ({ ...partial${modelName}, ${column}: new Date(state) })}`,
            `  />`,
          ];
        }
      }),
      '</DataModel>',
      '',
    ];
  })
  .join('\n');

// console.log(output)
console.log(`import {${imports.join(', ')}} from "@prisma/client";\n${output}`);
