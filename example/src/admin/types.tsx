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


export const FILTER_NOT_SET_YET = 'NOT SET YET' as const;

export type Filter<S extends JSONValue = JSONValue> = {
  name: Array<string | typeof FILTER_NOT_SET_YET>;
  isComplete: boolean;
  isValid: boolean;
  workingState: S | typeof FILTER_NOT_SET_YET;
  state: S | typeof FILTER_NOT_SET_YET;
};

export type Sort<F = BaseFieldName> = {
  fieldName: F;
  direction: 'asc' | 'desc';
};
