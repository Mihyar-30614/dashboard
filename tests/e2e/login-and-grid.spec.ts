import { test, expect, type Page } from "@playwright/test";

/** Grid position GridStack writes on a widget (it leaves 0 out). */
async function position(page: Page, id: string) {
  const el = page.locator(`.grid-stack-item[gs-id="${id}"]`);
  return {
    x: (await el.getAttribute("gs-x")) ?? "0",
    y: (await el.getAttribute("gs-y")) ?? "0",
  };
}

test("login then drag a widget and persist", async ({ page, request }) => {
  await request
    .post("/api/test/seed", {
      data: { email: "e2e@example.com", password: "zX9!muPpetDance#Lurking" },
    })
    .catch(() => {});

  await page.goto("/login");
  await page.getByLabel("Email").fill("e2e@example.com");
  await page.getByLabel("Password").fill("zX9!muPpetDance#Lurking");
  await page.click('button[type=submit]');
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  await page.getByRole("link", { name: "Sportly" }).click();
  await expect(page.getByRole("heading", { name: "Sportly" })).toBeVisible();

  // Layouts save themselves shortly after a change; there is no edit mode.
  const item = page.locator(".grid-stack-item").first();
  await expect(item).toBeVisible();
  const id = (await item.getAttribute("gs-id")) as string;
  const before = await position(page, id);

  const handle = item.locator(".widget-drag-handle");
  const box = (await handle.boundingBox())!;
  const saved = page.waitForResponse(
    (r) => r.url().includes("/api/layouts/") && r.request().method() === "PUT" && r.ok(),
  );
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 420, box.y + box.height / 2 + 260, { steps: 25 });
  await page.mouse.up();
  await saved;

  const after = await position(page, id);
  expect(after).not.toEqual(before);

  await page.reload();
  await expect(page.locator(`.grid-stack-item[gs-id="${id}"]`)).toBeVisible();
  expect(await position(page, id)).toEqual(after);
});
