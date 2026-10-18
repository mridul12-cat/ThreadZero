import { test, expect } from "@playwright/test";
test("capture → review → dependency map → focus → persistence", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Your thoughts" })
    .fill("I need to choose a topic. I need to build slides. Email my teacher");
  await page.getByRole("button", { name: "Untangle my thoughts" }).click();
  await expect(
    page.getByRole("heading", { name: "3 little things to untangle" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "See my thread map" }).click();
  if (test.info().project.name === "desktop")
    await page
      .getByRole("button", { name: "Show accessible list view" })
      .click();
  await page.getByRole("button", { name: /Ready Build slides/ }).click();
  await page
    .getByLabel("Choose prerequisite")
    .selectOption({ label: "Choose a topic" });
  await page
    .getByRole("button", { name: "Add prerequisite", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Blocked Build slides/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Find my first thread" }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Choose a topic" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mark complete", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("1 new task is ready");
  await page.waitForTimeout(700);
  await page.reload();
  await page.getByRole("button", { name: "Focus", exact: true }).click();
  await expect(page.getByText("1 of 3 complete")).toBeVisible();
});
test("example, non-destructive simulation, undo and export", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Try an example/ }).click();
  await expect(
    page.getByRole("heading", { name: "Everything is connected." }),
  ).toBeVisible();
  if (test.info().project.name === "desktop")
    await page
      .getByRole("button", { name: "Show accessible list view" })
      .click();
  await page
    .getByRole("button", { name: /Ready Choose a presentation topic/ })
    .click();
  await page.getByRole("button", { name: "What if I finish this?" }).click();
  await expect(
    page.getByRole("region", { name: "What if preview" }),
  ).toContainText("PREVIEW ONLY");
  await page.getByRole("button", { name: "Exit preview", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Ready Choose a presentation topic/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mark complete", exact: true })
    .click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Ready Choose a presentation topic/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings and local data" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  expect((await download).suggestedFilename()).toBe(
    "threadzero-workspace.json",
  );
});
test("keyboard capture and no horizontal overflow", async ({ page }) => {
  await page.goto("/");
  const textbox = page.getByRole("textbox", { name: "Your thoughts" });
  await textbox.focus();
  await page.keyboard.type("Buy milk");
  await page.keyboard.press("Control+Enter");
  await expect(
    page.getByRole("heading", { name: "Meet your threads." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
