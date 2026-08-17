import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { fireEvent, render, screen } from "@/test/render";

import { FpocketJobForm } from "./fpocket-job-form";

describe("FpocketJobForm", () => {
  it("explains invalid PDB input before starting an upload", async () => {
    const user = userEvent.setup();
    render(<FpocketJobForm />);

    await user.upload(screen.getByLabelText(/structure/i), new File(["x"], "structure.txt"));
    fireEvent.submit(screen.getByRole("button", { name: "Run fpocket" }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent("non-empty PDB file");
  });
});
