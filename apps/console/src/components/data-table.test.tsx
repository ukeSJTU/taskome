import { useState, type ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  columnVisibilityFeature,
  createColumnHelper,
  createPaginatedRowModel,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  createSortedRowModel,
  type SortingState,
  type Row,
} from "@tanstack/react-table";
import { expect, test } from "vitest";

import { DataTable } from "@/components/data-table";
import { Checkbox } from "@taskome/ui/components/checkbox";

const features = tableFeatures({});

type ProjectRow = {
  id: string;
  name: string;
};

const columnHelper = createColumnHelper<typeof features, ProjectRow>();
const columns = columnHelper.columns([
  columnHelper.accessor("name", {
    header: "Name",
  }),
]);

const visibilityFeatures = tableFeatures({
  columnMeta: {} as { label: string },
  columnVisibilityFeature,
});
const visibilityColumnHelper = createColumnHelper<typeof visibilityFeatures, ProjectRow>();
const visibilityColumns = visibilityColumnHelper.columns([
  visibilityColumnHelper.accessor("name", {
    header: "Name",
    meta: { label: "Project name" },
  }),
]);

function TableHarness({
  data,
  empty,
  renderRow,
}: {
  data: ProjectRow[];
  empty?: ReactNode;
  renderRow?: (row: Row<typeof features, ProjectRow>) => ReactNode;
}) {
  const table = useTable({
    columns,
    data,
    features,
    getRowId: (row) => row.id,
  });
  const contentProps = renderRow
    ? { rows: table.getRowModel().rows.map((row) => renderRow(row)) }
    : {};

  return (
    <DataTable.Root table={table}>
      <DataTable.Content empty={empty} {...contentProps} />
    </DataTable.Root>
  );
}

function renderProjectRow(row: Row<typeof features, ProjectRow>) {
  return (
    <tr key={row.id}>
      <td>{row.original.name} with project controls</td>
    </tr>
  );
}

const paginationFeatures = tableFeatures({
  paginatedRowModel: createPaginatedRowModel(),
  rowPaginationFeature,
});
const paginationColumnHelper = createColumnHelper<typeof paginationFeatures, ProjectRow>();
const paginationColumns = paginationColumnHelper.columns([
  paginationColumnHelper.accessor("name", {
    header: "Name",
  }),
]);
const paginationData: ProjectRow[] = [
  { id: "project-1", name: "Pocket detection" },
  { id: "project-2", name: "Structure preparation" },
];

const sortingFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});
const sortingColumnHelper = createColumnHelper<typeof sortingFeatures, ProjectRow>();
const sortingColumns = sortingColumnHelper.columns([
  sortingColumnHelper.accessor("name", {
    header: ({ column }) => (
      <DataTable.SortableHeader column={column} label="Name">
        Name
      </DataTable.SortableHeader>
    ),
  }),
]);
const sortingData: ProjectRow[] = [
  { id: "project-2", name: "Structure preparation" },
  { id: "project-1", name: "Pocket detection" },
];

const selectionFeatures = tableFeatures({
  paginatedRowModel: createPaginatedRowModel(),
  rowPaginationFeature,
  rowSelectionFeature,
});
const selectionColumnHelper = createColumnHelper<typeof selectionFeatures, ProjectRow>();
const selectionColumns = selectionColumnHelper.columns([
  selectionColumnHelper.display({
    id: "select",
    header: ({ table }) => (
      <Checkbox
        aria-label="Select all rows on this page"
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label={`Select ${row.original.name}`}
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
      />
    ),
  }),
  selectionColumnHelper.accessor("name", { header: "Name" }),
]);
const selectionData: ProjectRow[] = [
  { id: "project-1", name: "Pocket detection" },
  { id: "project-2", name: "Structure preparation" },
];

function PaginationHarness() {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 1 });
  const table = useTable({
    columns: paginationColumns,
    data: paginationData,
    features: paginationFeatures,
    getRowId: (row) => row.id,
    onPaginationChange: (updater) => {
      setPagination((current) => (typeof updater === "function" ? updater(current) : updater));
    },
    state: { pagination },
  });

  return (
    <DataTable.Root table={table}>
      <DataTable.Content />
      <DataTable.Pagination pageSizeOptions={[1, 2]} />
      <output>External page {pagination.pageIndex + 1}</output>
    </DataTable.Root>
  );
}

function SortingHarness() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useTable({
    columns: sortingColumns,
    data: sortingData,
    features: sortingFeatures,
    getRowId: (row) => row.id,
    onSortingChange: (updater) => {
      setSorting((current) => (typeof updater === "function" ? updater(current) : updater));
    },
    state: { sorting },
  });

  return (
    <DataTable.Root table={table}>
      <DataTable.Content />
      <output>{sorting[0]?.desc === false ? "Name sorted ascending" : "Name not sorted"}</output>
    </DataTable.Root>
  );
}

function SelectionHarness() {
  const table = useTable({
    columns: selectionColumns,
    data: selectionData,
    enableRowSelection: true,
    features: selectionFeatures,
    getRowId: (row) => row.id,
    initialState: { pagination: { pageIndex: 0, pageSize: 1 } },
  });

  return (
    <DataTable.Root table={table}>
      <DataTable.Content />
      <DataTable.Pagination pageSizeOptions={[1]} />
    </DataTable.Root>
  );
}

function ColumnVisibilityHarness() {
  const table = useTable({
    columns: visibilityColumns,
    data: [{ id: "project-1", name: "Pocket detection" }],
    features: visibilityFeatures,
    getRowId: (row) => row.id,
  });

  return (
    <DataTable.Root table={table}>
      <DataTable.Toolbar>
        <DataTable.ColumnVisibility />
      </DataTable.Toolbar>
      <DataTable.Content />
    </DataTable.Root>
  );
}

function MissingRowIdHarness() {
  const table = useTable({
    columns,
    data: [{ id: "project-1", name: "Pocket detection" }],
    features,
  });

  return <DataTable.Root table={table} />;
}

test("renders headers and rows through the data table seam", () => {
  render(<TableHarness data={[{ id: "project-1", name: "Pocket detection" }]} />);

  expect(screen.getByRole("columnheader", { name: "Name" })).toBeDefined();
  expect(screen.getByRole("cell", { name: "Pocket detection" })).toBeDefined();
});

test("requires a stable row id configuration", () => {
  expect(() => render(<MissingRowIdHarness />)).toThrow(
    "DataTable.Root requires the table to be configured with getRowId.",
  );
});

test("renders caller-owned empty content when there are no rows", () => {
  render(
    <TableHarness
      data={[]}
      empty={<DataTable.Empty>No projects match these filters.</DataTable.Empty>}
    />,
  );

  expect(screen.getByText("No projects match these filters.")).toBeDefined();
});

test("lets a caller own specialized row rendering", () => {
  render(
    <TableHarness
      data={[{ id: "project-1", name: "Pocket detection" }]}
      renderRow={renderProjectRow}
    />,
  );

  expect(
    screen.getByRole("cell", { name: "Pocket detection with project controls" }),
  ).toBeDefined();
});

test("shows column controls only when composed and hides a selected column", async () => {
  const user = userEvent.setup();
  const { unmount } = render(
    <TableHarness data={[{ id: "project-1", name: "Pocket detection" }]} />,
  );

  expect(screen.queryByRole("button", { name: "Columns" })).toBeNull();
  unmount();

  render(<ColumnVisibilityHarness />);
  await user.click(screen.getByRole("button", { name: "Columns" }));
  await user.click(await screen.findByRole("menuitemcheckbox", { name: "Project name" }));

  expect(screen.queryByRole("cell", { name: "Pocket detection" })).toBeNull();
});

test("drives caller-owned pagination state", async () => {
  const user = userEvent.setup();
  render(<PaginationHarness />);

  expect(screen.getByText("Page 1 of 2")).toBeDefined();
  await user.click(screen.getByRole("button", { name: "Go to next page" }));

  expect(await screen.findByText("Page 2 of 2")).toBeDefined();
  expect(screen.getByText("External page 2")).toBeDefined();
  expect(screen.getByRole("cell", { name: "Structure preparation" })).toBeDefined();
});

test("keeps page-size labels unique across multiple tables", () => {
  render(
    <>
      <PaginationHarness />
      <PaginationHarness />
    </>,
  );

  const pageSizeControls = screen.getAllByRole("combobox", { name: "Rows per page" });
  expect(pageSizeControls).toHaveLength(2);
  expect(new Set(pageSizeControls.map((control) => control.id)).size).toBe(2);
});

test("drives caller-owned sorting and exposes the sort direction", async () => {
  const user = userEvent.setup();
  render(<SortingHarness />);

  await user.click(screen.getByRole("button", { name: "Sort by Name" }));

  expect(screen.getByText("Name sorted ascending")).toBeDefined();
  expect(screen.getByRole("columnheader", { name: /Name/ }).getAttribute("aria-sort")).toBe(
    "ascending",
  );
  expect(screen.getAllByRole("row")[1]?.textContent).toContain("Pocket detection");
});

test("renders an accessible loading skeleton without a table instance", () => {
  render(<DataTable.Skeleton columnCount={2} rowCount={3} />);

  const loadingTable = screen.getByRole("status", { name: "Loading data" });
  expect(within(loadingTable).getAllByRole("row")).toHaveLength(4);
});

test("reports selection for the current page only", async () => {
  const user = userEvent.setup();
  render(<SelectionHarness />);

  await user.click(screen.getByRole("checkbox", { name: "Select all rows on this page" }));
  expect(screen.getByText("1 of 1 row selected.")).toBeDefined();

  await user.click(screen.getByRole("button", { name: "Go to next page" }));
  expect(screen.getByText("0 of 1 row selected.")).toBeDefined();
});
