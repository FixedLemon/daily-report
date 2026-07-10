import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("fires onClick when clicked by the user", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(<Button onClick={handleClick}>送信</Button>);

    await user.click(screen.getByRole("button", { name: "送信" }));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
