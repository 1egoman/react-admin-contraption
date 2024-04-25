export type FixMe = any;

export type JSONValue = 
 | string
 | number
 | boolean
 | null
 | Array<JSONValue>
 | {[key: string]: JSONValue}

// BaseItem is a generic type representing an entity shown on the list or detail page.
// Typically this would be a database row's schema.
export type BaseItem = object;

// BaseFieldName is a generic type representing a field within a `BaseItem`.
// Typically, this would be a database column's name.
export type BaseFieldName = string;

// BaseFieldState is a generic type representing the local state within a `Field` resulting in data
// accessed within a `BaseItem`'s at a certain `BaseFieldName` being transformed.
//
// If for example the type of `BaseItem[BaseFieldName]` is `number`, this might be a `string` of the
// same data to facilutate editing.
export type BaseFieldState = any;

// ItemKey is a generic type that represents the type of the primary key of each `BaseItem`.
export type ItemKey = string;

export const ALL_ITEMS = 'all';
export type CheckedItemKeys = Array<ItemKey> | typeof ALL_ITEMS;

export type Paginated<T> = {
  totalCount: number;
  nextPageAvailable: boolean;
  data: Array<T>;
};


// This value is kinda weird, maybe it should be a Symbol or something like that
//
// Given it is possible for the state of a filter to be set to `null` (ie, the way the filter works,
// this may be a valid value for state) there needs to be another token value that can be used to
// indicate that a filter has not been defined yet.
export const FILTER_NOT_SET_YET = 'NOT SET YET' as const;

// A Filter defines an instance of a `FilterMetadata` that is applied to a given list of items. When
// making a request to the server to get a list of items, an array of these are included which
// should be applied to the query to get the list of items.
//
// A Filter's interface inputs change the `workingState` value, and once the input is blured, that
// `workingState` is copied to `state` and the data is refetched.
export type Filter<FilterState extends JSONValue = JSONValue> = {
  name: Array<string | typeof FILTER_NOT_SET_YET>;
  isComplete: boolean;
  isValid: boolean;
  workingState: FilterState | typeof FILTER_NOT_SET_YET;
  state: FilterState | typeof FILTER_NOT_SET_YET;
};

// A Sort defines a sort order that should be applied to a given list of items.
export type Sort<FieldName = BaseFieldName> = {
  fieldName: FieldName;
  direction: 'asc' | 'desc';
};

// Used by foreign key fields to indicate different ways a model can be configured to be attached
// to a related model
export type ForeignKeyKeyOnlyItem<Key = ItemKey> = { type: "KEY_ONLY", key: Key };
export type ForeignKeyFullItem<Item> = { type: "FULL", item: Item };
export type ForeignKeyUnset = { type: "UNSET" };
