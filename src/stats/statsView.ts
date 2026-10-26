/** A table section in the statistics panel, provided by each exercise. */
export interface StatsGroup {
  readonly title: string;
  /** Headers of the descriptive columns (the numeric columns are added by the table). */
  readonly columns: readonly string[];
  readonly rows: readonly StatsRow[];
}

export interface StatsRow {
  /** Descriptive cells, one per column. */
  readonly cells: readonly string[];
  /** Statistics keys aggregated in this row. */
  readonly keys: readonly string[];
}
