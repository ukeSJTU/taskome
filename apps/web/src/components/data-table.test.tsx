import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { render, screen } from "@/test/render";

import { DataTable, schema } from "./data-table";

function row(overrides: Partial<typeof schema._output>): typeof schema._output {
  return {
    id: 0,
    header: "Untitled",
    type: "Narrative",
    status: "Done",
    target: "0",
    limit: "0",
    reviewer: "Assign reviewer",
    ...overrides,
  };
}

const rows = Array.from({ length: 12 }, (_, index) => row({ id: index, header: `Row ${index}` }));

describe("DataTable", () => {
  it("shows only the first page of rows until the caller pages forward", async () => {
    const user = userEvent.setup();
    render(<DataTable data={rows} />);

    expect(screen.getByText("Row 0")).toBeInTheDocument();
    expect(screen.getByText("Row 9")).toBeInTheDocument();
    expect(screen.queryByText("Row 10")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Go to next page" }));

    expect(screen.getByText("Row 10")).toBeInTheDocument();
    expect(screen.queryByText("Row 0")).not.toBeInTheDocument();
  });

  it("disables paging past the first and last page", async () => {
    const user = userEvent.setup();
    render(<DataTable data={rows} />);

    expect(screen.getByRole("button", { name: "Go to previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Go to first page" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Go to next page" }));

    expect(screen.getByRole("button", { name: "Go to next page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Go to last page" })).toBeDisabled();
  });
});
