import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
test("responsive visual artifacts and overflow checks", async ({ page }) => {
  const device = test.info().project.name;
  mkdirSync("screenshots", { recursive: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  if (device === "mobile")
    await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await expect(
    page.getByRole("textbox", { name: "Your thoughts" }),
  ).toBeVisible();
  await page.screenshot({
    path: `screenshots/capture-${device}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: /Try an example/ }).click();
  await expect(
    page.getByRole("heading", { name: "Everything is connected." }),
  ).toBeVisible();
  if (device === "desktop")
    await expect(page.locator(".thread-node")).toHaveCount(10);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `screenshots/map-${device}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Focus", exact: true }).click();
  await page.screenshot({
    path: `screenshots/focus-${device}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
