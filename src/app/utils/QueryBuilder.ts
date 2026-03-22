import {
  IQueryConfig,
  IQueryParams,
  IQueryResult,
  PrismaCountArgs,
  PrismaFindManyArgs,
  PrismaModelDelegate,
  PrismaNumberFilter,
  PrismaStringFilter,
  PrismaWhereConditions,
} from "../interfaces/query.interface";

/**
 * QueryBuilder
 *
 * A fluent, chainable builder that translates Express query params into a
 * Prisma `findMany` + `count` call pair, returning paginated results.
 *
 * Typical usage in a service:
 *
 * ```ts
 * const result = await new QueryBuilder<Classroom>(
 *   prisma.classroom,
 *   req.query,
 *   {
 *     searchableFields: ["name", "institutionName", "creator.email"],
 *     filterableFields: ["status", "level", "institutionName"],
 *   },
 * )
 *   .search()
 *   .filter()
 *   .where({ isDeleted: false })        // always-on hard filter
 *   .sort()
 *   .paginate()
 *   .include({ creator: true })
 *   .execute();
 * ```
 *
 * Type parameters:
 *  - `T`            — the Prisma model type (e.g. `Classroom`)
 *  - `TWhereInput`  — the Prisma `WhereInput` type for that model (optional)
 *  - `TInclude`     — the Prisma `Include` type for that model (optional)
 */
export class QueryBuilder<
  T,
  TWhereInput = Record<string, unknown>,
  TInclude = Record<string, unknown>,
> {
  private query: PrismaFindManyArgs;
  private countQuery: PrismaCountArgs;

  // Pagination state — stored so execute() can build the meta object
  private page: number = 1;
  private limit: number = 10;

  // Tracks whether fields() has been called.
  // When true, include() and dynamicInclude() are no-ops because Prisma
  // does not allow `select` and `include` to coexist on the same query.
  private hasSelectFields: boolean = false;

  constructor(
    private model: PrismaModelDelegate,
    private queryParams: IQueryParams,
    private config: IQueryConfig = {},
  ) {
    this.query = {
      where: {},
      include: {},
      orderBy: {},
      skip: 0,
      take: 10,
    };

    this.countQuery = {
      where: {},
    };
  }

  // ─── Search ────────────────────────────────────────────────────────────────

  /**
   * Applies a full-text `OR` search across `config.searchableFields`.
   *
   * Supports dot-notation for relations:
   *   "name"                 → { name: { contains, mode } }
   *   "creator.email"        → { creator: { email: { contains, mode } } }
   *   "memberships.user.name"→ { memberships: { some: { user: { name: ... } } } }
   *
   * Merges with any existing `OR` conditions rather than overwriting them.
   * No-op when ?searchTerm is absent or searchableFields is empty.
   */
  search(): this {
    const { searchTerm } = this.queryParams;
    const { searchableFields } = this.config;

    if (!searchTerm || !searchableFields || searchableFields.length === 0) {
      return this;
    }

    const searchConditions: Record<string, unknown>[] = searchableFields.map(
      (field: string) => {
        const stringFilter: PrismaStringFilter = {
          contains: searchTerm,
          mode: "insensitive",
        };

        if (!field.includes(".")) {
          // Direct field: { name: { contains, mode } }
          return { [field]: stringFilter };
        }

        const parts = field.split(".");

        if (parts.length === 2) {
          // One-level relation: { creator: { email: { contains, mode } } }
          const [relation, nestedField] = parts;
          return { [relation]: { [nestedField]: stringFilter } };
        }

        if (parts.length === 3) {
          // Two-level relation via array (some):
          // { memberships: { some: { user: { name: { contains, mode } } } } }
          const [relation, nestedRelation, nestedField] = parts;
          return {
            [relation]: {
              some: { [nestedRelation]: { [nestedField]: stringFilter } },
            },
          };
        }

        // Deeper nesting not supported — treat as direct field fallback
        return { [field]: stringFilter };
      },
    );

    // Merge with existing OR conditions instead of overwriting
    const whereConditions = this.query.where as PrismaWhereConditions;
    const countWhereConditions = this.countQuery.where as PrismaWhereConditions;

    whereConditions.OR = [
      ...(whereConditions.OR ?? []),
      ...searchConditions,
    ];
    countWhereConditions.OR = [
      ...(countWhereConditions.OR ?? []),
      ...searchConditions,
    ];

    return this;
  }

  // ─── Filter ────────────────────────────────────────────────────────────────

  /**
   * Maps remaining query params to Prisma `where` conditions.
   *
   * Reserved params that are always excluded:
   *   searchTerm, page, limit, sortBy, sortOrder, fields, include
   *
   * Supports:
   *   - Direct value:    ?status=APPROVED        → { status: "APPROVED" }
   *   - Boolean strings: ?isDeleted=false         → { isDeleted: false }
   *   - Dot notation:    ?creator.name=John       → { creator: { name: "John" } }
   *   - Range operators: ?createdAt[gte]=2024-01  → { createdAt: { gte: ... } }
   *   - Array values:    ?status[in][]=A&...      → { status: { in: [...] } }
   *
   * If `config.filterableFields` is set, only those keys are applied (whitelist).
   * If omitted, all non-reserved params are applied (open — useful in dev).
   *
   * Note on dot-notation fields:
   *   They are only applied when the key exists in `filterableFields` (if set).
   *   This prevents clients from filtering on arbitrary nested relations.
   */
  filter(): this {
    const { filterableFields } = this.config;

    // These params are handled by other builder methods — not filter conditions
    const reservedParams = new Set([
      "searchTerm",
      "page",
      "limit",
      "sortBy",
      "sortOrder",
      "fields",
      "include",
    ]);

    const queryWhere = this.query.where as Record<string, unknown>;
    const countQueryWhere = this.countQuery.where as Record<string, unknown>;

    Object.entries(this.queryParams).forEach(([key, value]) => {
      // Skip reserved params and empty values
      if (reservedParams.has(key)) return;
      if (value === undefined || value === "") return;

      // ── Dot-notation: nested relation filters ─────────────────────────────
      if (key.includes(".")) {
        // Dot-notation fields require explicit allowance — a client should not
        // be able to filter on arbitrary nested fields they enumerate
        if (filterableFields && !filterableFields.includes(key)) return;

        const parts = key.split(".");

        if (parts.length === 2) {
          // ?creator.name=John → { creator: { name: "John" } }
          const [relation, nestedField] = parts;

          if (!queryWhere[relation]) {
            queryWhere[relation] = {};
            countQueryWhere[relation] = {};
          }

          (queryWhere[relation] as Record<string, unknown>)[nestedField] =
            this.parseFilterValue(value);
          (countQueryWhere[relation] as Record<string, unknown>)[nestedField] =
            this.parseFilterValue(value);
        } else if (parts.length === 3) {
          // ?memberships.user.name=John
          // → { memberships: { some: { user: { name: "John" } } } }
          const [relation, nestedRelation, nestedField] = parts;

          if (!queryWhere[relation]) {
            queryWhere[relation] = { some: {} };
            countQueryWhere[relation] = { some: {} };
          }

          const querySome = (
            queryWhere[relation] as Record<string, unknown>
          ).some as Record<string, unknown>;
          const countSome = (
            countQueryWhere[relation] as Record<string, unknown>
          ).some as Record<string, unknown>;

          if (!querySome[nestedRelation]) querySome[nestedRelation] = {};
          if (!countSome[nestedRelation]) countSome[nestedRelation] = {};

          (querySome[nestedRelation] as Record<string, unknown>)[nestedField] =
            this.parseFilterValue(value);
          (countSome[nestedRelation] as Record<string, unknown>)[nestedField] =
            this.parseFilterValue(value);
        }

        return;
      }

      // ── Whitelist check for direct fields ─────────────────────────────────
      const isAllowed =
        !filterableFields ||
        filterableFields.length === 0 ||
        filterableFields.includes(key);

      if (!isAllowed) return;

      // ── Range / operator filter ───────────────────────────────────────────
      // e.g. ?createdAt[gte]=2024-01-01 arrives as { createdAt: { gte: "..." } }
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        const parsed = this.parseRangeFilter(
          value as Record<string, string | number>,
        );
        queryWhere[key] = parsed;
        countQueryWhere[key] = parsed;
        return;
      }

      // ── Direct value ──────────────────────────────────────────────────────
      queryWhere[key] = this.parseFilterValue(value);
      countQueryWhere[key] = this.parseFilterValue(value);
    });

    return this;
  }

  // ─── Paginate ──────────────────────────────────────────────────────────────

  /**
   * Applies `skip` / `take` from ?page and ?limit params.
   * Defaults: page = 1, limit = 10.
   * Always call this AFTER search() and filter() so count reflects filters.
   */
  paginate(): this {
    const page = Math.max(1, Number(this.queryParams.page) || 1);
    const limit = Math.min(
      100, // hard cap — prevents clients requesting 10 000 rows
      Math.max(1, Number(this.queryParams.limit) || 10),
    );

    this.page = page;
    this.limit = limit;

    this.query.skip = (page - 1) * limit;
    this.query.take = limit;

    return this;
  }

  // ─── Sort ──────────────────────────────────────────────────────────────────

  /**
   * Applies `orderBy` from ?sortBy and ?sortOrder params.
   * Defaults: sortBy = "createdAt", sortOrder = "desc".
   *
   * Supports dot notation:
   *   ?sortBy=creator.name    → orderBy: { creator: { name: "asc" } }
   *   ?sortBy=createdAt       → orderBy: { createdAt: "desc" }
   *
   * Note: two-level nested sort (3 parts) is not supported by Prisma's
   * standard orderBy — only one level of relation is valid.
   */
  sort(): this {
    const sortBy = this.queryParams.sortBy || "createdAt";
    const sortOrder: "asc" | "desc" =
      this.queryParams.sortOrder === "asc" ? "asc" : "desc";

    if (sortBy.includes(".")) {
      const parts = sortBy.split(".");

      if (parts.length === 2) {
        // One-level relation sort: { creator: { name: "asc" } }
        const [relation, nestedField] = parts;
        this.query.orderBy = { [relation]: { [nestedField]: sortOrder } };
      } else {
        // Prisma does not support deeper nested orderBy in a single object.
        // Fall back to createdAt so the query never errors silently.
        console.warn(
          `[QueryBuilder] sort: "${sortBy}" has more than 2 parts. ` +
            `Deep nested orderBy is not supported by Prisma. Falling back to createdAt.`,
        );
        this.query.orderBy = { createdAt: sortOrder };
      }
    } else {
      this.query.orderBy = { [sortBy]: sortOrder };
    }

    return this;
  }

  // ─── Fields (select) ──────────────────────────────────────────────────────

  /**
   * Applies a `select` projection from ?fields=id,name,createdAt.
   * Only top-level fields are supported (no nested relation projection).
   *
   * ⚠️  Calling fields() removes the `include` block because Prisma does not
   * allow `select` and `include` on the same query level. Call fields() OR
   * include() / dynamicInclude() — not both.
   */
  fields(): this {
    const fieldsParam = this.queryParams.fields;

    if (!fieldsParam || typeof fieldsParam !== "string") {
      return this;
    }

    const selectFields: Record<string, boolean> = {};

    fieldsParam
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean)
      .forEach((field) => {
        selectFields[field] = true;
      });

    if (Object.keys(selectFields).length === 0) {
      return this;
    }

    this.hasSelectFields = true;
    this.query.select = selectFields;
    delete this.query.include; // Prisma constraint: select and include are mutually exclusive

    return this;
  }

  // ─── Include ──────────────────────────────────────────────────────────────

  /**
   * Statically includes a relation or set of relations.
   * No-op if fields() was already called (select takes precedence).
   *
   * Usage:
   *   .include({ creator: true })
   *   .include({ creator: { select: { id: true, name: true } } })
   */
  include(relation: TInclude): this {
    if (this.hasSelectFields) return this;

    this.query.include = {
      ...(this.query.include as Record<string, unknown>),
      ...(relation as Record<string, unknown>),
    };

    return this;
  }

  /**
   * Dynamically includes relations based on ?include=rel1,rel2 query param
   * and/or a `defaultInclude` list that is always included.
   *
   * `includeConfig` maps relation names to their Prisma include shape:
   * ```ts
   * {
   *   creator: { select: { id: true, name: true } },
   *   memberships: true,
   * }
   * ```
   *
   * Only relations present in `includeConfig` can be included — unknown
   * relation names from the query param are silently ignored (safe).
   *
   * No-op if fields() was already called.
   */
  dynamicInclude(
    includeConfig: Record<string, unknown>,
    defaultInclude?: string[],
  ): this {
    if (this.hasSelectFields) return this;

    const result: Record<string, unknown> = {};

    // Always-on relations
    defaultInclude?.forEach((field) => {
      if (includeConfig[field] !== undefined) {
        result[field] = includeConfig[field];
      }
    });

    // Client-requested relations
    const includeParam = this.queryParams.include;
    if (includeParam && typeof includeParam === "string") {
      includeParam
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean)
        .forEach((relation) => {
          if (includeConfig[relation] !== undefined) {
            result[relation] = includeConfig[relation];
          }
        });
    }

    this.query.include = {
      ...(this.query.include as Record<string, unknown>),
      ...result,
    };

    return this;
  }

  // ─── Where (hard filter) ──────────────────────────────────────────────────

  /**
   * Merges a hard-coded condition into the `where` clause.
   * Use for business rules that clients must not override:
   *   .where({ isDeleted: false })
   *   .where({ classroomId: "abc" })
   *
   * Supports deep merge — calling where() multiple times accumulates conditions.
   */
  where(condition: TWhereInput): this {
    this.query.where = this.deepMerge(
      this.query.where as Record<string, unknown>,
      condition as Record<string, unknown>,
    );

    this.countQuery.where = this.deepMerge(
      this.countQuery.where as Record<string, unknown>,
      condition as Record<string, unknown>,
    );

    return this;
  }

  // ─── Execute ──────────────────────────────────────────────────────────────

  /**
   * Runs `findMany` and `count` in parallel and returns paginated results.
   * Always call this last after all builder methods.
   */
  async execute(): Promise<IQueryResult<T>> {
    const [total, data] = await Promise.all([
      this.model.count(
        this.countQuery as Parameters<typeof this.model.count>[0],
      ),
      this.model.findMany(
        this.query as Parameters<typeof this.model.findMany>[0],
      ),
    ]);

    return {
      data: data as T[],
      meta: {
        page: this.page,
        limit: this.limit,
        total,
        totalPages: Math.ceil(total / this.limit),
      },
    };
  }

  // ─── Count only ──────────────────────────────────────────────────────────

  /**
   * Runs only the count query — useful for existence checks or
   * dashboards that only need totals.
   */
  async count(): Promise<number> {
    return this.model.count(
      this.countQuery as Parameters<typeof this.model.count>[0],
    );
  }

  // ─── Inspect ─────────────────────────────────────────────────────────────

  /**
   * Returns the built query object without executing it.
   * Useful for debugging or passing to a raw Prisma call.
   */
  getQuery(): PrismaFindManyArgs {
    return this.query;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Deep-merges two plain objects.
   * Arrays are replaced (not concatenated) — this is intentional for
   * Prisma where-clause arrays like `OR` and `AND`.
   * For OR merging in search(), the caller handles concatenation explicitly.
   */
  private deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ): Record<string, unknown> {
    const result = { ...target };

    for (const key in source) {
      const sourceVal = source[key];
      const targetVal = result[key];

      if (
        sourceVal !== null &&
        typeof sourceVal === "object" &&
        !Array.isArray(sourceVal) &&
        targetVal !== null &&
        typeof targetVal === "object" &&
        !Array.isArray(targetVal)
      ) {
        result[key] = this.deepMerge(
          targetVal as Record<string, unknown>,
          sourceVal as Record<string, unknown>,
        );
      } else {
        result[key] = sourceVal;
      }
    }

    return result;
  }

  /**
   * Coerces a raw query param value to the most appropriate JS type.
   *
   * Rules (in order):
   *  1. "true" / "false"   → boolean
   *  2. Strict numeric string (no leading zeros, no scientific notation,
   *     no whitespace) → number
   *  3. Array             → { in: [...coerced items] }
   *  4. Anything else     → returned as-is (string)
   *
   * Intentionally conservative about numeric coercion — "007", "1e5",
   * " 3" are left as strings to avoid corrupting string IDs.
   */
  private parseFilterValue(value: unknown): unknown {
    if (value === "true") return true;
    if (value === "false") return false;

    if (typeof value === "string" && value !== "") {
      // Strict numeric check: digits only, optional leading minus,
      // optional single decimal point — no leading zeros except "0" itself
      const strictNumeric = /^-?(0|[1-9]\d*)(\.\d+)?$/.test(value);
      if (strictNumeric) return Number(value);
    }

    if (Array.isArray(value)) {
      return { in: value.map((item) => this.parseFilterValue(item)) };
    }

    return value;
  }

  /**
   * Converts a range-operator object from the query string into a Prisma
   * filter object.
   *
   * Supported operators:
   *   Comparison : lt, lte, gt, gte, equals, not
   *   String     : contains, startsWith, endsWith
   *   Set        : in, notIn (value becomes an array)
   *
   * Unknown operators are dropped silently.
   * Returns the original value unchanged if no valid operators were found.
   */
  private parseRangeFilter(
    value: Record<string, string | number>,
  ): PrismaNumberFilter | PrismaStringFilter | Record<string, unknown> {
    const rangeQuery: Record<
      string,
      string | number | (string | number)[]
    > = {};

    for (const [operator, rawValue] of Object.entries(value)) {
      const parsed: string | number =
        typeof rawValue === "string" &&
        !isNaN(Number(rawValue)) &&
        rawValue !== ""
          ? Number(rawValue)
          : rawValue;

      switch (operator) {
        case "lt":
        case "lte":
        case "gt":
        case "gte":
        case "equals":
        case "not":
        case "contains":
        case "startsWith":
        case "endsWith":
          rangeQuery[operator] = parsed;
          break;

        case "in":
        case "notIn":
          rangeQuery[operator] = Array.isArray(rawValue)
            ? rawValue
            : [parsed];
          break;

        // Unknown operators are intentionally ignored
        default:
          break;
      }
    }

    return Object.keys(rangeQuery).length > 0 ? rangeQuery : value;
  }
}