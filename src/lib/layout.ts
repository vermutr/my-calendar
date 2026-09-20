export interface Span {
  start: number;
  end: number;
}

export interface Placed<T> {
  item: T;
  /** Номер колонки внутри группы пересекающихся задач */
  column: number;
  /** Сколько колонок в группе */
  columns: number;
}

/** Раскладывает пересекающиеся по времени задачи по колонкам, как в Google Calendar. */
export function layoutDay<T extends Span>(items: T[]): Placed<T>[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const result: Placed<T>[] = [];

  let cluster: Placed<T>[] = [];
  let columnEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    for (const placed of cluster) placed.columns = columnEnds.length;
    result.push(...cluster);
    cluster = [];
    columnEnds = [];
  };

  for (const item of sorted) {
    if (item.start >= clusterEnd) flush();
    let column = columnEnds.findIndex((end) => end <= item.start);
    if (column === -1) column = columnEnds.length;
    columnEnds[column] = item.end;
    cluster.push({ item, column, columns: 1 });
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();
  return result;
}
