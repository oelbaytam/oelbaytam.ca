export interface DatedContentEntry {
  id: string;
  data: {
    date: Date;
  };
}

export function sortByDateDesc<T extends DatedContentEntry>(entries: T[]) {
  return [...entries].sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}
