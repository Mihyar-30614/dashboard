import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useConversation } from "@/analytics/hooks/useConversation";
import { llm } from "@/api/llm";

const THREADS = [
  { conversation_id: "tab-old", title: "orders in March?", turns: 2, started_at: null, last_at: null },
];

beforeEach(() => {
  sessionStorage.clear();
  vi.spyOn(llm, "listConversations").mockResolvedValue({ db_name: "sportly", conversations: THREADS, count: 1 });
  vi.spyOn(llm, "getConversation").mockImplementation(async (_db, id) => ({
    db_name: "sportly",
    history: id === "tab-old" ? [{ question: "orders in March?", answer: "12", sql: "SELECT 1" }] : [],
    count: id === "tab-old" ? 1 : 0,
  }));
});

afterEach(() => vi.restoreAllMocks());

describe("useConversation threads", () => {
  it("gives each tab its own thread and keeps it across reloads", async () => {
    const first = renderHook(() => useConversation("sportly"));
    await waitFor(() => expect(first.result.current.threadId).toMatch(/^tab-[a-z0-9]+$/));
    const id = first.result.current.threadId;
    expect(llm.getConversation).toHaveBeenCalledWith("sportly", id);

    const reloaded = renderHook(() => useConversation("sportly"));
    await waitFor(() => expect(reloaded.result.current.threadId).toBe(id));
  });

  it("resumes a past thread and starts new ones", async () => {
    const { result } = renderHook(() => useConversation("sportly"));
    await waitFor(() => expect(result.current.threads).toHaveLength(1));

    act(() => result.current.switchThread("tab-old"));
    await waitFor(() => expect(result.current.history.map((q) => q.question)).toEqual(["orders in March?"]));
    expect(sessionStorage.getItem("seer-thread:sportly")).toBe("tab-old");

    act(() => result.current.newThread());
    await waitFor(() => expect(result.current.threadId).not.toBe("tab-old"));
    await waitFor(() => expect(result.current.history).toEqual([]));
  });

  it("clears only the current thread", async () => {
    const clear = vi.spyOn(llm, "clearConversation").mockResolvedValue({ db_name: "sportly", message: "ok" });
    const { result } = renderHook(() => useConversation("sportly"));
    await waitFor(() => expect(result.current.threadId).toBeTruthy());
    await act(() => result.current.clear());
    expect(clear).toHaveBeenCalledWith("sportly", result.current.threadId);
  });
});
