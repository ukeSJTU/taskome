import * as React from "react";
import type { Column, ReactTable, Row, RowData, TableFeatures } from "@tanstack/react-table";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  Columns3Icon,
} from "lucide-react";

import { Button } from "@taskome/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@taskome/ui/components/dropdown-menu";
import { Empty as EmptyPrimitive } from "@taskome/ui/components/empty";
import { Label } from "@taskome/ui/components/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@taskome/ui/components/select";
import { Skeleton } from "@taskome/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@taskome/ui/components/table";
import { cn } from "@taskome/ui/lib/utils";

type AnyReactTable = ReactTable<any, any, any>;
type AnyRow = Row<any, any>;

type SortableColumn = Pick<Column<any, any, any>, "getCanSort" | "getIsSorted" | "toggleSorting">;

const DataTableContext = React.createContext<unknown>(null);
const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50] as const;

function useDataTable() {
  const table = React.useContext(DataTableContext);

  if (!table) {
    throw new Error("DataTable components must be rendered inside DataTable.Root.");
  }

  return table as AnyReactTable;
}

function getAriaSort(column: SortableColumn): "ascending" | "descending" | undefined {
  const sorting = column.getIsSorted?.();

  if (sorting === "asc") {
    return "ascending";
  }

  if (sorting === "desc") {
    return "descending";
  }

  return undefined;
}

type DataTableRootProps<
  TFeatures extends TableFeatures,
  TData extends RowData,
  TSelected,
> = React.ComponentProps<"div"> & {
  /** Configure the table with a stable domain `getRowId` when row identity matters. */
  table: ReactTable<TFeatures, TData, TSelected>;
};

function DataTableRoot<TFeatures extends TableFeatures, TData extends RowData, TSelected>({
  className,
  table,
  ...props
}: DataTableRootProps<TFeatures, TData, TSelected>) {
  if (typeof table.options.getRowId !== "function") {
    throw new Error("DataTable.Root requires the table to be configured with getRowId.");
  }

  return (
    <DataTableContext value={table}>
      <div
        data-slot="data-table"
        className={cn("flex w-full flex-col gap-4", className)}
        {...props}
      />
    </DataTableContext>
  );
}

type DataTableContentProps = React.ComponentProps<"div"> & {
  empty?: React.ReactNode;
  rows?: React.ReactNode;
};

function DataTableDefaultRow({ row, table }: { row: AnyRow; table: AnyReactTable }) {
  return (
    <TableRow data-state={row.getIsSelected?.() ? "selected" : undefined}>
      {(row.getVisibleCells?.() ?? row.getAllCells()).map((cell) => (
        <TableCell key={cell.id}>
          <table.FlexRender cell={cell} />
        </TableCell>
      ))}
    </TableRow>
  );
}

function DataTableContent({ className, empty, rows: customRows, ...props }: DataTableContentProps) {
  const table = useDataTable();
  const rows = table.getRowModel().rows;

  return (
    <div
      data-slot="data-table-content"
      className={cn("overflow-hidden rounded-lg border", className)}
      {...props}
    >
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-muted">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  aria-sort={getAriaSort(header.column)}
                  key={header.id}
                  colSpan={header.colSpan}
                >
                  {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length > 0 ? (
            (customRows ??
            rows.map((row) => <DataTableDefaultRow key={row.id} row={row} table={table} />))
          ) : (
            <TableRow>
              <TableCell className="p-0" colSpan={table.getAllLeafColumns().length}>
                {empty}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function DataTableEmpty({ className, ...props }: React.ComponentProps<typeof EmptyPrimitive>) {
  return (
    <EmptyPrimitive className={cn("min-h-32 rounded-none border-0 p-8", className)} {...props} />
  );
}

function DataTableToolbar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="data-table-toolbar"
      className={cn("flex items-center justify-between gap-2", className)}
      {...props}
    />
  );
}

function getColumnLabel(
  column: AnyReactTable["getAllColumns"] extends () => (infer TColumn)[] ? TColumn : never,
) {
  const meta: unknown = column.columnDef.meta;

  if (
    typeof meta === "object" &&
    meta !== null &&
    "label" in meta &&
    typeof meta.label === "string"
  ) {
    return meta.label;
  }

  return typeof column.columnDef.header === "string" ? column.columnDef.header : column.id;
}

function DataTableColumnVisibility({ label = "Columns" }: { label?: string }) {
  const table = useDataTable();
  const columns = table
    .getAllColumns()
    .filter((column) => column.accessorFn !== undefined && column.getCanHide?.());

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <Columns3Icon data-icon="inline-start" />
        {label}
        <ChevronDownIcon data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32">
        <DropdownMenuGroup>
          {columns.map((column) => (
            <DropdownMenuCheckboxItem
              checked={column.getIsVisible()}
              key={column.id}
              onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
            >
              {getColumnLabel(column)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type DataTableSortableHeaderProps = {
  children: React.ReactNode;
  column: SortableColumn;
  label: string;
};

function DataTableSortableHeader({ children, column, label }: DataTableSortableHeaderProps) {
  const sorting = column.getIsSorted();
  const Icon =
    sorting === "asc" ? ArrowUpIcon : sorting === "desc" ? ArrowDownIcon : ArrowUpDownIcon;
  const ariaLabel =
    sorting === "asc"
      ? `${label}, sorted ascending`
      : sorting === "desc"
        ? `${label}, sorted descending`
        : `Sort by ${label}`;

  return (
    <Button
      aria-label={ariaLabel}
      disabled={!column.getCanSort()}
      onClick={() => column.toggleSorting()}
      size="sm"
      type="button"
      variant="ghost"
    >
      {children}
      <Icon data-icon="inline-end" />
    </Button>
  );
}

type DataTableSkeletonProps = React.ComponentProps<"div"> & {
  columnCount: number;
  label?: string;
  rowCount?: number;
};

function DataTableSkeleton({
  className,
  columnCount,
  label = "Loading data",
  rowCount = 5,
  ...props
}: DataTableSkeletonProps) {
  const columns = Array.from({ length: Math.max(1, columnCount) });
  const rows = Array.from({ length: Math.max(1, rowCount) });

  return (
    <div
      aria-label={label}
      aria-live="polite"
      className={cn("overflow-hidden rounded-lg border", className)}
      data-slot="data-table-skeleton"
      role="status"
      {...props}
    >
      <Table>
        <TableHeader className="bg-muted">
          <TableRow>
            {columns.map((_, columnIndex) => (
              <TableHead key={columnIndex}>
                <Skeleton className="h-4 w-20" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {columns.map((__, columnIndex) => (
                <TableCell key={columnIndex}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

type DataTablePaginationProps = React.ComponentProps<"div"> & {
  pageSizeOptions?: readonly number[];
};

function DataTablePagination({
  className,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  ...props
}: DataTablePaginationProps) {
  const table = useDataTable();
  const pageSizeId = React.useId();
  const pageCount = Math.max(table.getPageCount(), 1);
  const pageIndex = table.state.pagination.pageIndex;
  const pageSize = table.state.pagination.pageSize;
  const currentPageRows = table.getRowModel().rows;
  const supportsSelection = typeof table.getIsAllPageRowsSelected === "function";
  const selectedRowCount = supportsSelection
    ? currentPageRows.filter((row) => row.getIsSelected()).length
    : 0;
  const pageSizeItems = pageSizeOptions.map((option) => ({
    label: String(option),
    value: String(option),
  }));

  return (
    <div
      data-slot="data-table-pagination"
      className={cn("flex items-center justify-between px-4", className)}
      {...props}
    >
      {supportsSelection ? (
        <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
          {/* TODO: Add query-wide selection only after the server bulk-operation API
              defines its filter and exclusion model. */}
          {selectedRowCount} of {currentPageRows.length}{" "}
          {currentPageRows.length === 1 ? "row" : "rows"} selected.
        </div>
      ) : null}
      <div className="flex w-full items-center gap-8 lg:w-fit">
        <div className="hidden items-center gap-2 lg:flex">
          <Label htmlFor={pageSizeId} className="text-sm font-medium">
            Rows per page
          </Label>
          <Select
            items={pageSizeItems}
            onValueChange={(value) => table.setPageSize(Number(value))}
            value={String(pageSize)}
          >
            <SelectTrigger className="w-20" id={pageSizeId} size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top">
              <SelectGroup>
                {pageSizeItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-fit items-center justify-center text-sm font-medium">
          Page {pageIndex + 1} of {pageCount}
        </div>
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <Button
            className="hidden lg:flex"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.firstPage()}
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronsLeftIcon />
            <span className="sr-only">Go to first page</span>
          </Button>
          <Button
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronLeftIcon />
            <span className="sr-only">Go to previous page</span>
          </Button>
          <Button
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronRightIcon />
            <span className="sr-only">Go to next page</span>
          </Button>
          <Button
            className="hidden lg:flex"
            disabled={!table.getCanNextPage()}
            onClick={() => table.lastPage()}
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronsRightIcon />
            <span className="sr-only">Go to last page</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

export const DataTable = {
  ColumnVisibility: DataTableColumnVisibility,
  Content: DataTableContent,
  Empty: DataTableEmpty,
  Pagination: DataTablePagination,
  Root: DataTableRoot,
  Skeleton: DataTableSkeleton,
  SortableHeader: DataTableSortableHeader,
  Toolbar: DataTableToolbar,
};
