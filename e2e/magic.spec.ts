import { test, expect } from "@playwright/test";
import { magicFixture } from "../src/tests/magic-fixture";
test("Magic requires explicit consent, preserves current text, and activates only accepted connections", async ({
  page,
}) => {
  let calls = 0;
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/untangle", async (route) => {
    calls++;
    const body = route.request().postDataJSON();
    expect(body.consent).toBe(true);
    expect(Object.keys(body).sort()).toEqual([
      "consent",
      "text",
      "timeZone",
      "today",
    ]);
    expect(body.text).not.toContain("My private saved task");
    await pending;
    await route.fulfill({ json: { proposal: magicFixture() } });
  });
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Your thoughts" })
    .fill("Write my private saved task");
  await page
    .getByRole("button", { name: "Untangle my thoughts", exact: true })
    .click();
  await page.getByRole("button", { name: "Dump", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Your thoughts" })
    .fill("Buy tuna before feeding my cat. My cat wants a Nobel Prize.");
  await page
    .getByRole("button", { name: "Magic Untangle", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Magic Untangle sends your text to Groq",
  );
  expect(calls).toBe(0);
  await page.getByRole("button", { name: "Send this text to Groq" }).click();
  await page
    .getByRole("textbox", { name: "Your thoughts" })
    .fill("A new private draft I edited while waiting.");
  release();
  await expect(
    page.getByRole("heading", { name: "Meet your threads." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "6 little things to untangle" }),
  ).toBeVisible();
  await page.getByText("Bigger hopes & questions", { exact: false }).click();
  await expect(page.getByLabel("Edit goal")).toHaveValue(
    "Cat wins a Nobel Prize",
  );
  await expect(page.getByText("Inferred · please check")).toBeVisible();
  await page.getByRole("button", { name: "See my thread map" }).click();
  if (test.info().project.name === "desktop")
    await expect(page.locator(".react-flow__edge")).toHaveCount(2);
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page
    .locator(".suggestion")
    .filter({ hasText: "You said to buy tuna" })
    .getByRole("button", { name: /Confirm connection/ })
    .click();
  await page.getByRole("button", { name: "Map", exact: true }).click();
  if (test.info().project.name === "desktop")
    await page
      .getByRole("button", { name: "Show accessible list view" })
      .click();
  await expect(
    page.getByRole("button", { name: /Blocked Feed the cat/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Waiting Wait for the school/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dump", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Your thoughts" }),
  ).toHaveValue("A new private draft I edited while waiting.");
});
test("Groq quota errors offer a working local fallback without losing text", async ({
  page,
}) => {
  await page.route("**/api/untangle", (route) =>
    route.fulfill({
      status: 429,
      headers: { "Retry-After": "65" },
      json: { error: "Groq quota is exhausted. Use the local parser." },
    }),
  );
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Your thoughts" })
    .fill("Buy tuna. Email my teacher.");
  await page
    .getByRole("button", { name: "Magic Untangle", exact: true })
    .click();
  await page.getByRole("button", { name: "Send this text to Groq" }).click();
  await expect(page.getByRole("alert")).toContainText("quota");
  await page
    .getByRole("button", { name: /Use the local parser instead/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "2 little things to untangle" }),
  ).toBeVisible();
});
test("staying local never calls the API", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/untangle", (route) => {
    calls++;
    return route.abort();
  });
  await page.goto("/");
  await page.getByRole("textbox", { name: "Your thoughts" }).fill("Buy milk");
  await page
    .getByRole("button", { name: "Magic Untangle", exact: true })
    .click();
  await page.getByRole("button", { name: "Stay local" }).click();
  await expect(
    page.getByRole("heading", { name: "1 little things to untangle" }),
  ).toBeVisible();
  expect(calls).toBe(0);
});
