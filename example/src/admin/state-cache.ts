import { Filter, Sort } from "./types";

export type StateCache = {
  // When called, stores the current state of the list view into a location where it can be fetched
  // back later
  store: (
    filters: Array<[Filter['name'], string]>,
    sort: Sort | null,
    searchText: string,
    columnSet: 'all' | string | Array<string>,
  ) => Promise<void>;

  // When called, fetches the current list view state so it can be rehydrated when reloading the
  // page
  read: () => Promise<[
    Array<[Filter['name'], string]>,
    Sort | null,
    string,
    'all' | string | Array<string>,
  ]>;
};

// Stores the current filter, sort, search, and column set data into the page's query parameters.
// When freshly reloading the page, look here for this data so that the list view can be rehydrated.
//
// NOTE: there probably should be a second, next.js specific implementation of this that can use the
// next.js specific apis. It's possible that this implementation (which used history.pushState) may
// subtly non interoperable.
export const queryParameterStateCache: StateCache = {
  store: async (filters, sort, searchText, _columnSet) => {
    const url = new URL(window.location.href);

    if (filters.length > 0) {
      url.searchParams.set('filters', JSON.stringify(filters));
    } else {
      url.searchParams.delete('filters');
    }

    if (sort) {
      url.searchParams.set('sort', JSON.stringify(sort));
    } else {
      url.searchParams.delete('sort');
    }

    if (searchText.length > 0) {
      url.searchParams.set('searchtext', JSON.stringify(searchText));
    } else {
      url.searchParams.delete('searchtext');
    }

    window.history.pushState({}, "", url.toString());
  },
  read: async () => {
    const url = new URL(window.location.href);
    const filters = JSON.parse(url.searchParams.get('filters') || '[]');
    const sort = JSON.parse(url.searchParams.get('sort') || 'null');
    const searchText = JSON.parse(url.searchParams.get('searchtext') || '""');
    const columnSet = 'all';

    return [filters, sort, searchText, columnSet];
  },
};
