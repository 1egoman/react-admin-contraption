export type FixMe = any;

export type JSONValue = 
 | string
 | number
 | boolean
 | null
 | Array<JSONValue>
 | {[key: string]: JSONValue}




export type BaseItem = object;
export type BaseFieldName = string;
export type BaseFieldState = any;

export type ItemKey = string;
export const ALL_ITEMS = 'all';

export type CheckedItemKeys = Array<ItemKey> | typeof ALL_ITEMS;

export type Paginated<T> = {
  totalCount: number;
  nextPageAvailable: boolean;
  data: Array<T>;
};
