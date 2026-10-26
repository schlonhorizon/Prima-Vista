/** A table section in the statistics panel, provided by each exercise. */
export interface StatsGroup {
  readonly title: string;
  /** Headers of the descriptive columns (the numeric columns are added by the table). */
  readonly columns: readonly string[];
  readonly rows: readonly StatsRow[];
  /** Header of the time column (default "Ø Zeit"; rhythm: "Ø Abweichung"). */
  readonly timeLabel?: string;
}

export interface StatsRow {
  /** Descriptive cells, one per column. */
  readonly cells: readonly string[];
  /** Statistics keys aggregated in this row. */
  readonly keys: readonly string[];
}
