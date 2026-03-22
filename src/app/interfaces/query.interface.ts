// ─────────────────────────────────────────────────────────────────────────────
// Prisma utility types
// These mirror the shapes Prisma generates internally so we can type the
// QueryBuilder without importing from @prisma/client directly.
// ─────────────────────────────────────────────────────────────────────────────

/** Subset of Prisma string filter operators */
export interface PrismaStringFilter {
  equals?: string;
  contains?: string;
  startsWith?: string;
  endsWith?: string;
  mode?: "insensitive" | "default";
  not?: string | PrismaStringFilter;
}

/** Subset of Prisma number/date filter operators */
export interface PrismaNumberFilter {
  equals?: number;
  lt?: number;
  lte?: number;
  gt?: number;
  gte?: number;
  not?: number | PrismaNumberFilter;
  in?: number[];
  notIn?: number[];
}

/**
 * Shape of a Prisma `where` object that can carry OR / AND / NOT
 * plus arbitrary field conditions.
 */
export interface PrismaWhereConditions {
  OR?: Record<string, unknown>[];
  AND?: Record<string, unknown>[];
  NOT?: Record<string, unknown> | Record<string, unknown>[];
  [key: string]: unknown;
}

/**
 * Minimal delegate interface that covers the two Prisma model methods
 * the QueryBuilder calls: `findMany` and `count`.
 *
 * All generated Prisma model delegates (e.g. prisma.classroom,
 * prisma.note) satisfy this shape.
 */
export interface PrismaModelDelegate {
  findMany: (args?: Record<string, unknown>) => Promise<unknown[]>;
  count: (args?: Record<string, unknown>) => Promise<number>;
}

/** Internal shape passed to prisma.model.findMany() */
export interface PrismaFindManyArgs {
  where?: Record<string, unknown>;
  include?: Record<string, unknown>;
  select?: Record<string, boolean | Record<string, unknown>>;
  orderBy?: Record<string, unknown>;
  skip?: number;
  take?: number;
}

/** Internal shape passed to prisma.model.count() */
export interface PrismaCountArgs {
  where?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// QueryBuilder configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration passed to QueryBuilder constructor.
 *
 * - `searchableFields`  — fields the ?searchTerm param will search across.
 *     Supports dot notation: "name", "user.email", "memberships.user.name"
 * - `filterableFields`  — whitelist of fields that ?key=value will filter on.
 *     If omitted, ALL non-excluded query params are treated as filters (open).
 *     If provided, only listed keys are applied (closed/safe).
 */
export interface IQueryConfig {
  searchableFields?: string[];
  filterableFields?: string[];
}

/**
 * Shape of Express `req.query` as the QueryBuilder expects it.
 *
 * All standard pagination / sort / field params are typed explicitly.
 * Arbitrary filter params are captured by the index signature.
 */
export interface IQueryParams {
  searchTerm?: string;
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  /** Comma-separated list of fields to return: ?fields=id,name,createdAt */
  fields?: string;
  /** Comma-separated list of relations to include: ?include=creator,memberships */
  include?: string;
  /** Any additional filter params */
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// QueryBuilder result
// ─────────────────────────────────────────────────────────────────────────────

export interface IQueryMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface IQueryResult<T> {
  data: T[];
  meta: IQueryMeta;
}