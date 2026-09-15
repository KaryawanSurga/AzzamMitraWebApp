import { render, screen } from "@testing-library/react";
import { StatusShell } from "./status-shell";

describe("StatusShell", () => {
  it("announces that the application foundation is ready", () => {
    render(<StatusShell />);

    expect(screen.getByRole("heading", { name: "Azzam Mitra" })).toBeInTheDocument();
    expect(screen.getByText(/fondasi aplikasi siap dikembangkan/i)).toBeInTheDocument();
  });
});
