import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import Welcome from "../src/components/Welcome.tsx";

afterEach(cleanup);

describe("Welcome", () => {
  test("submits the prefilled demo profile", async () => {
    const onStart = vi.fn(() => Promise.resolve());
    const { container } = render(<Welcome onStart={onStart} />);

    fireEvent.submit(container.querySelector("form")!);
    await screen.findByText("开始体验");

    expect(onStart).toHaveBeenCalledWith({
      name: "演示主持人",
      handle: "演示账号",
      role: "黑客松",
      bio: "口袋朋友演示账号",
    });
  });

  test("disables the start button while the nickname is blank", () => {
    render(<Welcome onStart={vi.fn()} />);
    const start = screen.getByText("开始体验").closest("button") as HTMLButtonElement;

    fireEvent.change(screen.getByPlaceholderText("你的显示名称"), { target: { value: "  " } });
    expect(start.disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText("你的显示名称"), { target: { value: "小岛" } });
    expect(start.disabled).toBe(false);
  });
});
