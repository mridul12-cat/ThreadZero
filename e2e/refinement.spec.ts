import { test, expect } from "@playwright/test";
async function loadExample(
  page: import("@playwright/test").Page,
  name: string,
) {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings and local data" }).click();
  await page.getByText("Explore reasoning examples", { exact: true }).click();
  await page.getByRole("button", { name, exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Meet your threads." }),
  ).toBeVisible();
}
async function mapList(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Map", exact: true }).click();
  if (test.info().project.name === "desktop")
    await page
      .getByRole("button", { name: "Show accessible list view" })
      .click();
}
test("science review is compact; bulk explicit confirmation and undo leave inferred links pending", async ({
  page,
}) => {
  await loadExample(page, "Science Fair");
  await expect(
    page.getByText("12 tasks found · 7 connections suggested · 1 question", {
      exact: true,
    }),
  ).toBeVisible();
  const hopes = page.getByRole("group", { name: "Bigger hopes and questions" });
  await expect(page.getByLabel("Edit goal")).toBeHidden();
  await page
    .getByRole("button", { name: "Confirm all explicit (5)", exact: true })
    .click();
  await expect(page.getByText("Inferred · please check")).toHaveCount(2);
  await expect(page.locator(".compact-suggestion")).toHaveCount(2);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".compact-suggestion")).toHaveCount(7);
  await page
    .getByRole("button", { name: "Confirm all explicit (5)", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: /Select connection Email my teacher/ })
    .check();
  await page
    .getByRole("button", { name: "Reject selected suggestions", exact: true })
    .click();
  await expect(page.locator(".compact-suggestion")).toHaveCount(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".compact-suggestion")).toHaveCount(2);
  void hopes;
  await page.getByText("Bigger hopes & questions", { exact: false }).click();
  await expect(page.getByLabel("Edit goal")).toHaveValue(
    "Submit the science fair project",
  );
  await page
    .getByLabel("Edit goal")
    .fill("Submit my carefully tested science project");
  await mapList(page);
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByText("Bigger hopes & questions", { exact: false }).click();
  await expect(page.getByLabel("Edit goal")).toHaveValue(
    "Submit my carefully tested science project",
  );
  await page.screenshot({
    path: `screenshots/refined-review-${test.info().project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("a reminder stays an action and never resolves actual receipt; nullable effort can be confirmed or cleared", async ({
  page,
}) => {
  await loadExample(page, "Science Fair");
  await page
    .getByRole("button", { name: "Confirm all explicit (5)", exact: true })
    .click();
  await mapList(page);
  await page.getByRole("button", { name: /Scheduled Remind Alex/ }).click();
  await expect(page.getByLabel("Thread type")).toHaveValue("ACTION");
  await page.getByLabel("Scheduled start (optional)").fill("");
  const minutes = page.getByRole("spinbutton", {
    name: "Estimated minutes (optional)",
  });
  await expect(minutes).toHaveValue("");
  await minutes.fill("20");
  await expect(minutes).toHaveValue("20");
  await minutes.fill("");
  await expect(minutes).toHaveValue("");
  await page
    .getByRole("button", { name: "Mark complete", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Waiting Receive the circuit diagram/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Blocked Build the prototype/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Waiting Receive the circuit diagram/ })
    .click();
  await page
    .getByRole("button", { name: "Confirm event received", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Blocked Build the prototype/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Waiting Receive the sensor delivery/ })
    .click();
  await page
    .getByRole("button", { name: "Confirm event received", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Ready Build the prototype/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Blocked Order the sensor/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("independent chores stay separate; goals can be added and dismissed", async ({
  page,
}) => {
  await loadExample(page, "Unrelated Tasks");
  await expect(page.locator(".review-card")).toHaveCount(4);
  await expect(
    page.getByText("4 tasks found · 0 connections suggested · 0 questions", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByText("Bigger hopes & questions", { exact: false }).click();
  page.once("dialog", (dialog) => dialog.accept("Launch my portfolio"));
  await page.getByRole("button", { name: "Add goal", exact: true }).click();
  await expect(page.getByLabel("Edit goal")).toHaveValue("Launch my portfolio");
  await page.getByRole("button", { name: "Dismiss goal", exact: true }).click();
  await expect(page.getByLabel("Edit goal")).toHaveCount(0);
  await mapList(page);
  await expect(page.getByRole("button", { name: /^Ready / })).toHaveCount(4);
});
test("constellation controls, selection path and readable nodes", async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== "desktop",
    "Mobile has the equivalent list.",
  );
  await loadExample(page, "Cat Nobel Prize");
  await page
    .getByRole("button", { name: "Confirm all explicit (1)", exact: true })
    .click();
  await page.getByRole("button", { name: "See my thread map" }).click();
  await expect(page.locator(".thread-node")).toHaveCount(4);
  await expect(page.locator(".graph-cluster")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Fit entire map", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Readable view", exact: true })
    .click();
  const buy = page
    .locator(".react-flow__node-thread")
    .filter({ hasText: "Buy tuna" });
  await buy.click();
  await expect(page.locator(".thread-node.path-muted")).toHaveCount(2);
  await page.getByLabel("Map branch").selectOption("path");
  await expect(page.locator(".thread-node")).toHaveCount(2);
  await page.getByLabel("Map branch").selectOption("all");
  await expect(page.locator(".thread-node")).toHaveCount(4);
  await page.getByRole("button", { name: "Reset layout", exact: true }).click();
  const handleWidth = await page
    .locator(".thread-node .react-flow__handle")
    .first()
    .evaluate((node) => node.getBoundingClientRect().width);
  expect(handleWidth).toBeGreaterThanOrEqual(14);
  const width = await page
    .locator(".thread-node")
    .first()
    .evaluate((node) => node.getBoundingClientRect().width);
  expect(width).toBeGreaterThanOrEqual(190);
  await page.screenshot({
    path: "screenshots/refined-map-desktop.png",
    fullPage: true,
  });
});
