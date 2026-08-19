// Regression: the Spanish layer must never blank out or mangle player text.
import assert from "node:assert/strict";
import test from "node:test";
import { getLang, setLang, t } from "./i18n.ts";

const SAMPLE = [
  "BLAZING THE TRAIL",
  "PRESS START",
  "START GAME",
  "CONTROLS",
  "HOW TO PLAY",
  "PLAY AGAIN",
  "TRY AGAIN",
  "BACK",
];

test("English passes through untouched", () => {
  setLang("en");
  assert.equal(getLang(), "en");
  for (const s of SAMPLE) assert.equal(t(s), s);
});

test("Spanish translates the core screens and never returns blank", () => {
  setLang("es");
  for (const s of SAMPLE) {
    const out = t(s);
    assert.ok(out.trim().length > 0, `blank translation for "${s}"`);
  }
  assert.notEqual(t("PRESS START"), "PRESS START");
  setLang("en");
});

test("unknown strings fall back to the English source instead of disappearing", () => {
  setLang("es");
  assert.equal(t("a string nobody ever translated"), "a string nobody ever translated");
  setLang("en");
});

test("multi-line blocks keep their line count in both languages", () => {
  const block = "PRESS START\nCONTROLS\nHOW TO PLAY";
  for (const lang of ["en", "es"] as const) {
    setLang(lang);
    assert.equal(t(block).split("\n").length, 3);
  }
  setLang("en");
});

test("dynamic counter strings keep their numbers", () => {
  setLang("es");
  for (const s of ["SCORE 1200", "TIME 244", "LIVES 3"]) {
    const out = t(s);
    const digits = s.match(/\d+/)?.[0];
    assert.ok(digits && out.includes(digits), `lost the number in "${s}" -> "${out}"`);
  }
  setLang("en");
});
