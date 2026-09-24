import { JSDOM } from "jsdom";

const dom = new JSDOM(
  "<!doctype html><html><body><div id='root'></div></body></html>",
  {
    url: "http://localhost:62014/",
    pretendToBeVisual: true,
  }
);
const { window } = dom;

(globalThis as unknown as Record<string, unknown>).window = window;
(globalThis as unknown as Record<string, unknown>).document = window.document;
(globalThis as unknown as Record<string, unknown>).navigator = window.navigator;
(globalThis as unknown as Record<string, unknown>).HTMLElement =
  window.HTMLElement;
(globalThis as unknown as Record<string, unknown>).HTMLInputElement =
  window.HTMLInputElement;
(globalThis as unknown as Record<string, unknown>).HTMLSelectElement =
  window.HTMLSelectElement;
(globalThis as unknown as Record<string, unknown>).Event = window.Event;
(globalThis as unknown as Record<string, unknown>).MouseEvent =
  window.MouseEvent;
(globalThis as unknown as Record<string, unknown>).localStorage =
  window.localStorage;
(globalThis as unknown as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT =
  true;

window.localStorage.clear();

export { window };
