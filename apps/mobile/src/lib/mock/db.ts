// In-memory Supabase shim. Implements the narrow subset of the supabase-js
// query builder API used in v0. Not a fidelity replica — demo surface only.

export class QueryBuilder<T> implements PromiseLike<{ data: T[]; error: null }> {
  private _mode: 'select' | 'update' | 'delete' = 'select';
  private _filters: Array<[string, unknown]> = [];
  private _updateVals?: Record<string, unknown>;

  constructor(
    private readonly store: Map<string, unknown[]>,
    private readonly table: string,
  ) {}

  select(_cols = '*'): this {
    return this;
  }

  eq(col: string, val: unknown): this {
    this._filters.push([col, val]);
    return this;
  }

  update(vals: Record<string, unknown>): this {
    this._mode = 'update';
    this._updateVals = vals;
    return this;
  }

  delete(): this {
    this._mode = 'delete';
    return this;
  }

  async insert(vals: Partial<T> | Array<Partial<T>>): Promise<{ data: T[]; error: null }> {
    const existing = this.store.get(this.table) ?? [];
    const arr = Array.isArray(vals) ? vals : [vals];
    const inserted = arr.map((v, i) => ({
      id: `mock-${Date.now()}-${i}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...(v as Record<string, unknown>),
    }));
    this.store.set(this.table, [...existing, ...inserted]);
    return { data: inserted as T[], error: null };
  }

  async single(): Promise<{ data: T | null; error: null }> {
    const rows = this._filterRows();
    return { data: (rows[0] as T) ?? null, error: null };
  }

  then<TResult1 = { data: T[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: T[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this._execute()).then(onfulfilled, onrejected as never);
  }

  private _filterRows(): unknown[] {
    const rows = this.store.get(this.table) ?? [];
    return rows.filter(row =>
      this._filters.every(([col, val]) => (row as Record<string, unknown>)[col] === val),
    );
  }

  private _execute(): { data: T[]; error: null } {
    if (this._mode === 'select') {
      return { data: this._filterRows() as T[], error: null };
    }
    if (this._mode === 'update' && this._updateVals) {
      const vals = this._updateVals;
      const updated = (this.store.get(this.table) ?? []).map(row =>
        this._filters.every(([col, val]) => (row as Record<string, unknown>)[col] === val)
          ? { ...(row as Record<string, unknown>), ...vals, updated_at: new Date().toISOString() }
          : row,
      );
      this.store.set(this.table, updated);
      return {
        data: updated.filter(row =>
          this._filters.every(([col, val]) => (row as Record<string, unknown>)[col] === val),
        ) as T[],
        error: null,
      };
    }
    if (this._mode === 'delete') {
      const remaining = (this.store.get(this.table) ?? []).filter(
        row => !this._filters.every(([col, val]) => (row as Record<string, unknown>)[col] === val),
      );
      this.store.set(this.table, remaining);
      return { data: [], error: null };
    }
    return { data: [], error: null };
  }
}

export class MockDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly store = new Map<string, any[]>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  seed(tables: Record<string, any[]>): void {
    for (const [table, rows] of Object.entries(tables)) {
      this.store.set(table, [...rows]);
    }
  }

  from<T>(table: string): QueryBuilder<T> {
    return new QueryBuilder<T>(this.store, table);
  }
}
