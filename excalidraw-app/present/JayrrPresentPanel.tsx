import {
  CaptureUpdateAction,
  Sidebar,
  newElementWith,
  useExcalidrawAPI,
} from "@excalidraw/excalidraw";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import {
  HelpIcon,
  presentationIcon,
} from "@excalidraw/excalidraw/components/icons";
import { Tooltip } from "@excalidraw/excalidraw/components/Tooltip";
import { useCallback } from "react";

import {
  JAYRR_PRESENT_SIDEBAR,
  movePresentIds,
  stepCaption,
  writePresentOrder,
  type PresentDeck,
} from "./buildPresentDeck";

import "./JayrrPresentPanel.scss";

const PRESENT_HELP =
  "Each frame is a slide. Shapes inside get a reveal order. Present, then Right or Space for the next beat, Left to go back, Esc to exit.";

export const JayrrPresentPanel = ({
  deck,
  presenting,
  stepIndex,
  selectedElementIds,
  startPresent,
  stopPresent,
}: {
  deck: PresentDeck;
  presenting: boolean;
  stepIndex: number;
  selectedElementIds: Record<string, boolean>;
  startPresent: () => void;
  stopPresent: () => void;
}) => {
  const api = useExcalidrawAPI();

  const writeOrders = useCallback(
    (orderedIds: readonly string[]) => {
      if (!api) {
        return;
      }
      const all = api.getSceneElementsIncludingDeleted();
      const next = all.map((element) => {
        const order = orderedIds.indexOf(element.id);
        if (order === -1) {
          return element;
        }
        return newElementWith(element, {
          customData: writePresentOrder(element, order + 1),
        });
      });
      api.updateScene({
        elements: next,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    },
    [api],
  );

  const selectId = (id: string) => {
    if (!api || presenting) {
      return;
    }
    api.updateScene({
      appState: {
        selectedElementIds: { [id]: true },
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    });
  };

  const moveFrames = (fromIndex: number, direction: -1 | 1) => {
    writeOrders(
      movePresentIds(
        deck.frames.map((frame) => frame.id),
        fromIndex,
        direction,
      ),
    );
  };

  const moveObjects = (
    frameId: string,
    fromIndex: number,
    direction: -1 | 1,
  ) => {
    const frame = deck.frames.find((item) => item.id === frameId);
    if (!frame) {
      return;
    }
    writeOrders(
      movePresentIds(
        frame.objects.map((object) => object.id),
        fromIndex,
        direction,
      ),
    );
  };

  return (
    <Sidebar name={JAYRR_PRESENT_SIDEBAR} className="jayrr-present-sidebar">
      <Sidebar.Header>
        <div className="jayrr-present__title-row">
          <h2 className="jayrr-present__title">Present</h2>
          <Tooltip label={PRESENT_HELP} long>
            <span className="jayrr-present__info" aria-label={PRESENT_HELP}>
              {HelpIcon}
            </span>
          </Tooltip>
          <span className="jayrr-present__sr">
            Nested reveal order for frames and the shapes inside them.
          </span>
        </div>
      </Sidebar.Header>
      <div className="jayrr-present">
        <div className="jayrr-present__actions">
          {presenting ? (
            <FilledButton
              color="muted"
              variant="outlined"
              label="Exit"
              onClick={stopPresent}
              fullWidth
            >
              Exit
            </FilledButton>
          ) : (
            <FilledButton
              color="primary"
              label="Present"
              icon={presentationIcon}
              onClick={startPresent}
              fullWidth
              disabled={deck.frames.length === 0}
            >
              Present
            </FilledButton>
          )}
        </div>
        {deck.frames.length === 0 ? (
          <p className="jayrr-present__empty">
            Draw a frame, drop shapes in it, then set the order here.
          </p>
        ) : (
          <ol className="jayrr-present__frames">
            {deck.frames.map((frame, frameIndex) => (
              <li key={frame.id} className="jayrr-present__frame">
                <div className="jayrr-present__row">
                  <button
                    type="button"
                    className={
                      selectedElementIds[frame.id]
                        ? "jayrr-present__name is-selected"
                        : "jayrr-present__name"
                    }
                    onClick={() => selectId(frame.id)}
                  >
                    {frameIndex + 1}. {frame.label}
                  </button>
                  <div className="jayrr-present__move">
                    <button
                      type="button"
                      aria-label="Move frame up"
                      disabled={presenting || frameIndex === 0}
                      onClick={() => moveFrames(frameIndex, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label="Move frame down"
                      disabled={
                        presenting || frameIndex === deck.frames.length - 1
                      }
                      onClick={() => moveFrames(frameIndex, 1)}
                    >
                      ↓
                    </button>
                  </div>
                </div>
                {frame.objects.length === 0 ? (
                  <p className="jayrr-present__empty">
                    No shapes in this frame.
                  </p>
                ) : (
                  <ol className="jayrr-present__objects">
                    {frame.objects.map((object, objectIndex) => (
                      <li key={object.id} className="jayrr-present__row">
                        <button
                          type="button"
                          className={
                            selectedElementIds[object.id]
                              ? "jayrr-present__name is-selected"
                              : "jayrr-present__name"
                          }
                          onClick={() => selectId(object.id)}
                        >
                          {objectIndex + 1}. {object.label}
                        </button>
                        <div className="jayrr-present__move">
                          <button
                            type="button"
                            aria-label="Move shape up"
                            disabled={presenting || objectIndex === 0}
                            onClick={() =>
                              moveObjects(frame.id, objectIndex, -1)
                            }
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            aria-label="Move shape down"
                            disabled={
                              presenting ||
                              objectIndex === frame.objects.length - 1
                            }
                            onClick={() =>
                              moveObjects(frame.id, objectIndex, 1)
                            }
                          >
                            ↓
                          </button>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ol>
        )}
        {presenting ? (
          <p className="jayrr-present__status" aria-live="polite">
            {stepCaption(deck, stepIndex)}
          </p>
        ) : null}
      </div>
    </Sidebar>
  );
};

export const JayrrPresentHud = ({
  caption,
  onExit,
}: {
  caption: string;
  onExit: () => void;
}) => {
  return (
    <div className="jayrr-present-hud">
      <span>{caption}</span>
      <span className="jayrr-present-hud__keys">
        → next · ← back · Esc exit
      </span>
      <button type="button" onClick={onExit}>
        Exit
      </button>
    </div>
  );
};
