import { test, expect } from "@playwright/test";
test("cycles, confirmed scenario application, and JSON round trip", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/");
  await page.getByRole("button", { name: /Try an example/ }).click();
  if (test.info().project.name === "desktop")
    await page
      .getByRole("button", { name: "Show accessible list view" })
      .click();
  await page
    .getByRole("button", { name: /Ready Choose a presentation topic/ })
    .click();
  await page
    .getByLabel("Choose prerequisite")
    .selectOption({ label: "Build the slides" });
  await page
    .getByRole("button", { name: "Add prerequisite", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("circle");
  await page.getByRole("button", { name: "Dismiss error" }).click();
  await page.getByRole("button", { name: "What if I finish this?" }).click();
  await page.getByRole("button", { name: "Apply to workspace" }).click();
  await expect(
    page.getByRole("button", { name: /Complete Choose a presentation topic/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings and local data" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const download = await downloadPromise;
  await page
    .getByLabel("Import workspace JSON")
    .setInputFiles((await download.path())!);
  await expect(page.getByRole("status")).toContainText("Workspace imported");
  await expect(
    page.getByRole("button", { name: /Complete Choose a presentation topic/ }),
  ).toBeVisible();
});
test("malformed import is rejected without replacing existing data", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Your thoughts" }).fill("Buy milk");
  await page.getByRole("button", { name: "Settings and local data" }).click();
  await page.getByLabel("Import workspace JSON").setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":999}'),
  });
  await expect(page.getByRole("alert")).toContainText("Import failed");
  await page.getByRole("button", { name: "Dismiss error" }).click();
  await page.getByRole("button", { name: "Close settings" }).click();
  await expect(
    page.getByRole("textbox", { name: "Your thoughts" }),
  ).toHaveValue("Buy milk");
});
test("voice permission denial offers retry and text alternative", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: () =>
          Promise.reject(
            new DOMException("Denied for test", "NotAllowedError"),
          ),
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Speak instead/ }).click();
  await page.getByRole("button", { name: "Start recording" }).click();
  await expect(page.getByRole("status")).toContainText("permission was denied");
  await expect(
    page.getByRole("button", { name: "Try recording again" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close voice capture" }).click();
  await expect(
    page.getByRole("textbox", { name: "Your thoughts" }),
  ).toBeVisible();
});
