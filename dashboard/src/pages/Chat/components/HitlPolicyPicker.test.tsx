import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HitlPolicyPicker from "./HitlPolicyPicker";

describe("HitlPolicyPicker", () => {
  it("stays visible while asking every time", () => {
    render(<HitlPolicyPicker policy={{ mode: "ask" }} onChange={vi.fn()} />);
    expect(screen.getByTestId("hitl-policy-picker")).toBeInTheDocument();
  });

  it("shows the current bypass and can reset to ask", async () => {
    const onChange = vi.fn();
    render(
      <HitlPolicyPicker policy={{ mode: "allow_all" }} onChange={onChange} />,
    );
    fireEvent.click(screen.getByTestId("hitl-policy-picker"));
    expect(
      document.querySelectorAll(".ant-popover svg").length,
    ).toBeGreaterThan(0);
    fireEvent.click(await screen.findByText("chat.hitl.policy.ask"));
    expect(onChange).toHaveBeenCalledWith({ mode: "ask" });
  });

  it("announces which approval mode is in force (A11Y-11)", async () => {
    // The active mode was carried by a CSS class alone, so a screen reader
    // could not tell "ask" from "allow all".
    render(
      <HitlPolicyPicker policy={{ mode: "allow_all" }} onChange={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("hitl-policy-picker"));

    const allowAll = await screen.findByText("chat.hitl.policy.allowAll");
    const allowAllBtn = allowAll.closest("button");
    expect(allowAllBtn).toHaveAttribute("aria-pressed", "true");

    const ask = await screen.findByText("chat.hitl.policy.ask");
    expect(ask.closest("button")).toHaveAttribute("aria-pressed", "false");
  });

  it("groups the mode buttons under a label (A11Y-11)", async () => {
    render(<HitlPolicyPicker policy={{ mode: "ask" }} onChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId("hitl-policy-picker"));
    // find the group by its label to prove the relationship resolves
    expect(
      await screen.findByRole("group", { name: "chat.hitl.policy.picker" }),
    ).toBeInTheDocument();
  });

  it("can remove one allowed tool without closing the menu", async () => {
    const onChange = vi.fn();
    render(
      <HitlPolicyPicker
        policy={{ mode: "allow_tools", tools: ["execute", "write_file"] }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByTestId("hitl-policy-picker"));
    const removeButtons = await screen.findAllByRole("button", {
      name: "chat.hitl.policy.removeTool",
    });
    fireEvent.click(removeButtons[0]);
    expect(onChange).toHaveBeenCalledWith({
      mode: "allow_tools",
      tools: ["write_file"],
    });
    expect(document.querySelector(".ant-popover")).toBeInTheDocument();
  });
});
