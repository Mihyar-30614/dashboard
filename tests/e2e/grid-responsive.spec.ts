import { test, expect, type Page } from "@playwright/test";

type Node = { id: string; x: number; y: number; w: number; h: number };

async function login(page: Page) {
  await page.request
    .post("/api/test/seed", {
      data: { email: "e2e@example.com", password: "zX9!muPpetDance#Lurking" },
    })
    .catch(() => {});
  await page.goto("/login");
  await page.getByLabel("Email").fill("e2e@example.com");
  await page.getByLabel("Password").fill("zX9!muPpetDance#Lurking");
  await page.click("button[type=submit]");
  await expect(page).toHaveURL("/");
}

/** Column count and node geometry straight from the GridStack engine. */
async function grid(page: Page): Promise<{ column: number; nodes: Node[] }> {
  return page.evaluate(() => {
    const g = (document.querySelector(".grid-stack") as any).gridstack;
    return {
      column: g.getColumn(),
      nodes: g.engine.nodes
        .map((n: any) => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h }))
        .sort((a: Node, b: Node) => a.id.localeCompare(b.id)),
    };
  });
}

/** Reading order: top-to-bottom, then left-to-right. */
function order(nodes: Node[]) {
  return [...nodes].sort((a, b) => a.y - b.y || a.x - b.x).map((n) => n.id);
}

async function openBoard(page: Page) {
  await page.getByRole("link", { name: "Sportly" }).click();
  await expect(page.locator(".grid-stack-item").first()).toBeVisible();
}

test("window resizes reflow in reading order and restore the saved layout", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await login(page);
  await openBoard(page);
  const saved = await grid(page);
  expect(saved.column).toBe(12);

  for (const width of [1100, 900, 700, 500, 900, 1400]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(async () => order((await grid(page)).nodes))
      .toEqual(order(saved.nodes));
  }
  await expect.poll(() => grid(page)).toEqual(saved);

  // Leaving edit mode on a narrow window must reflow right away.
  await page.setViewportSize({ width: 700, height: 900 });
  await page.getByRole("button", { name: "Edit layout" }).click();
  await expect.poll(async () => (await grid(page)).column).toBe(12);
  await page.getByRole("button", { name: "Done editing" }).click();
  await expect.poll(async () => (await grid(page)).column).toBeLessThan(12);

  // Loading on a narrow window then widening lands on the saved layout.
  await page.setViewportSize({ width: 500, height: 900 });
  await page.reload();
  await expect(page.locator(".grid-stack-item").first()).toBeVisible();
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect.poll(() => grid(page)).toEqual(saved);
});

test("best fit fills rows, saves, and can be undone", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await login(page);
  await openBoard(page);

  await page.getByRole("button", { name: "Edit layout" }).click();
  const saved = page.waitForResponse(
    (r) => r.url().includes("/api/layouts/") && r.request().method() === "PUT" && r.ok(),
  );
  await page.getByRole("button", { name: "Best fit" }).click();
  await saved;
  const fitted = await grid(page);
  const rows = new Map<number, number>();
  for (const n of fitted.nodes) rows.set(n.y, (rows.get(n.y) ?? 0) + n.w);
  expect([...rows.values()].every((w) => w === 12)).toBe(true);

  await page.reload();
  await expect(page.locator(".grid-stack-item").first()).toBeVisible();
  await expect.poll(() => grid(page)).toEqual(fitted);

  await page.getByRole("button", { name: "Edit layout" }).click();
  await page.getByRole("button", { name: "Best fit" }).click();
  await page.getByRole("button", { name: "Undo best fit" }).click();
  await expect.poll(() => grid(page)).toEqual(fitted);
});
