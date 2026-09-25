import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { ALL_USERS, useDbUsers } from "@/analytics/hooks/useDbUsers";
import { llm, type DbUsers } from "@/api/llm";

const PER_USER: DbUsers = {
  db_name: "debtapp",
  per_user_rows: true,
  owner_table: "users",
  users: [
    { id: "1", label: "one@example.com" },
    { id: "2", label: "two@example.com" },
  ],
  can_read_all: false,
};

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(llm, "listUsers").mockImplementation(async (db) =>
    db === "debtapp" ? PER_USER : { ...PER_USER, db_name: db, per_user_rows: false, owner_table: null, users: [] },
  );
  fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ databases: [], count: 0 }), { status: 200 }),
  );
});

afterEach(() => vi.restoreAllMocks());

const sentSubject = () => {
  const init = fetchSpy.mock.calls.at(-1)?.[1] as RequestInit | undefined;
  return (init?.headers as Record<string, string> | undefined)?.["x-seer-subject"];
};

describe("useDbUsers", () => {
  it("asks for a user on databases that keep rows per user", async () => {
    const { result } = renderHook(() => useDbUsers("debtapp"));
    await waitFor(() => expect(result.current.info?.users).toHaveLength(2));
    expect(result.current.needsChoice).toBe(true);

    act(() => result.current.setSubject("2"));
    expect(result.current.needsChoice).toBe(false);
    await llm.listDatabases();
    expect(sentSubject()).toBe("2");
  });

  it("remembers the pick per database", async () => {
    localStorage.setItem("analytics:seer_subject:debtapp", "1");
    const { result } = renderHook(() => useDbUsers("debtapp"));
    await waitFor(() => expect(result.current.subject).toBe("1"));
    expect(result.current.needsChoice).toBe(false);
  });

  it("drops a remembered pick the key may no longer use", async () => {
    localStorage.setItem("analytics:seer_subject:debtapp", ALL_USERS);
    const { result } = renderHook(() => useDbUsers("debtapp"));
    await waitFor(() => expect(result.current.info).not.toBeNull());
    expect(result.current.subject).toBe("");
    expect(result.current.needsChoice).toBe(true);
  });

  it("needs no choice and sends no user elsewhere", async () => {
    const { result, rerender } = renderHook(({ db }) => useDbUsers(db), { initialProps: { db: "debtapp" } });
    await waitFor(() => expect(result.current.info).not.toBeNull());
    act(() => result.current.setSubject("1"));
    rerender({ db: "sportly" });
    await waitFor(() => expect(result.current.info?.db_name).toBe("sportly"));
    expect(result.current.needsChoice).toBe(false);
    await llm.listDatabases();
    expect(sentSubject()).toBeUndefined();
  });
});
