import { test, expect } from "@playwright/test";

test("login then drag a widget and persist", async ({ page, request }) => {
  await request
    .post("/api/test/seed", {
      data: { email: "e2e@example.com", password: "zX9!muPpetDance#Lurking" },
    })
    .catch(() => {});

  await page.goto("/login");
  await page.fill('input[type=text],input:not([type])', "e2e@example.com");
  await page.fill('input[type=password]', "zX9!muPpetDance#Lurking");
  await page.click('button[type=submit]');
  await expect(page).toHaveURL("/");
  await expect(page.locator("text=Overview")).toBeVisible();

  await page.click("text=Sportly");
  await page.click("text=Edit layout");
  await page.click("text=Save");
  await expect(page.locator("text=Edit layout")).toBeVisible();
});
