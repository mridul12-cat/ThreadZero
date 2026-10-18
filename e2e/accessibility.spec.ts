import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("core screens have no accessibility violations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const issues: unknown[] = [];
  for (const stage of ["Dump", "Review", "Map", "Focus", "Voice", "Settings"]) {
    if (stage === "Review") {
      await page
        .getByRole("textbox", { name: "Your thoughts" })
        .fill("Choose a topic. Email my teacher");
      await page.getByRole("button", { name: "Untangle my thoughts" }).click();
    } else if (stage === "Voice") {
      await page.getByRole("button", { name: "Dump", exact: true }).click();
      await page.getByRole("button", { name: /Speak instead/ }).click();
    } else if (stage === "Settings")
      await page
        .getByRole("button", { name: "Settings and local data" })
        .click();
    else if (stage !== "Dump")
      await page.getByRole("button", { name: stage, exact: true }).click();
    const report = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    for (const v of report.violations)
      issues.push({
        stage,
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      });
  }
  expect(JSON.stringify(issues, null, 2)).toBe("[]");
});
