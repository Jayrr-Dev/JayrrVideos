import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import type { ElementRenderOverrides } from "@excalidraw/excalidraw";

import {
  boundIdsForElement,
  JAYRR_PRESENT_REVEAL_MS,
  JAYRR_PRESENT_SLIDE_Y,
  type PresentDeck,
} from "./buildPresentDeck";

type OverrideValues = {
  opacity: number;
  offset: { x: number; y: number };
};

const HIDDEN: OverrideValues = {
  opacity: 0,
  offset: { x: 0, y: JAYRR_PRESENT_SLIDE_Y },
};

const SHOWN: OverrideValues = {
  opacity: 100,
  offset: { x: 0, y: 0 },
};

const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

const toOverrides = (
  values: Map<string, OverrideValues>,
): ElementRenderOverrides => {
  const next = new Map<
    string,
    { opacity: number; offset: { x: number; y: number } }
  >();
  for (const [id, value] of values) {
    if (value.opacity >= 100 && value.offset.x === 0 && value.offset.y === 0) {
      continue;
    }
    next.set(id, {
      opacity: value.opacity,
      offset: { x: value.offset.x, y: value.offset.y },
    });
  }
  return next;
};

const targetForDeck = (
  deck: PresentDeck,
  stepIndex: number,
  elements: readonly NonDeletedExcalidrawElement[],
): Map<string, OverrideValues> => {
  const revealed = new Set<string>();
  for (let i = 0; i <= stepIndex; i++) {
    const step = deck.steps[i];
    if (step?.type === "reveal") {
      revealed.add(step.elementId);
    }
  }

  const values = new Map<string, OverrideValues>();
  for (const frame of deck.frames) {
    for (const object of frame.objects) {
      const shown = revealed.has(object.id);
      const element = elements.find((item) => item.id === object.id);
      if (!element) {
        continue;
      }
      const pose = shown ? SHOWN : HIDDEN;
      for (const id of boundIdsForElement(element, elements)) {
        values.set(id, pose);
      }
    }
  }
  return values;
};

export class PresentPlayer {
  private raf = 0;
  private current = new Map<string, OverrideValues>();

  stop(api: ExcalidrawImperativeAPI | null) {
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    this.current = new Map();
    api?.setElementRenderOverrides(null);
  }

  goTo(opts: {
    api: ExcalidrawImperativeAPI;
    deck: PresentDeck;
    stepIndex: number;
    elements: readonly NonDeletedExcalidrawElement[];
    animate: boolean;
  }) {
    const { api, deck, stepIndex, elements, animate } = opts;
    const target = targetForDeck(deck, stepIndex, elements);
    const step = deck.steps[stepIndex];
    if (step) {
      const frame = elements.find((element) => element.id === step.frameId);
      if (frame) {
        api.setViewport({
          target: frame,
          fit: "contain",
          animation: true,
        });
      }
    }

    if (!animate || this.current.size === 0) {
      this.current = target;
      api.setElementRenderOverrides(toOverrides(target));
      return;
    }

    const from = new Map(this.current);
    const ids = new Set([...from.keys(), ...target.keys()]);
    const start = performance.now();
    if (this.raf) {
      cancelAnimationFrame(this.raf);
    }

    const tick = (now: number) => {
      const t = easeOutQuad(
        Math.min(1, (now - start) / JAYRR_PRESENT_REVEAL_MS),
      );
      const mixed = new Map<string, OverrideValues>();
      for (const id of ids) {
        const a = from.get(id) ?? SHOWN;
        const b = target.get(id) ?? SHOWN;
        mixed.set(id, {
          opacity: lerp(a.opacity, b.opacity, t),
          offset: {
            x: lerp(a.offset.x, b.offset.x, t),
            y: lerp(a.offset.y, b.offset.y, t),
          },
        });
      }
      this.current = mixed;
      api.setElementRenderOverrides(toOverrides(mixed));
      if (t < 1) {
        this.raf = requestAnimationFrame(tick);
        return;
      }
      this.raf = 0;
      this.current = target;
      api.setElementRenderOverrides(toOverrides(target));
    };

    this.raf = requestAnimationFrame(tick);
  }
}
