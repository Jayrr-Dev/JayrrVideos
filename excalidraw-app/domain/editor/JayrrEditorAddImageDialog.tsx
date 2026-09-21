import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import { helpIcon } from "@excalidraw/excalidraw/components/icons";
import { useAction, useQuery } from "convex/react";
import {
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import type { BinaryFileData } from "@excalidraw/excalidraw/types";

import { Button } from "../../components/ui/Button";
import { Dialog, Tooltip } from "../../components/ui/editor";
import { Field, Input } from "../../components/ui/Field";
import { api } from "../../convexClient";
import { LocalData } from "../../data/LocalData";
import { formatRecordingQuality } from "../recordings/formatRecording";

import "../../present/JayrrPresentPanel.scss";

import "./JayrrEditorAddStockDialog.scss";

import {
  EDITOR_STATIC_DURATION_MS,
  editorStaticMediaKindFromMime,
  type EditorStaticMediaKind,
} from "./buildEditorTimeline";

const INFO =
  "Pick an image from this board or Docs, search free Pexels photos, or generate one with OpenRouter. Generating uses credits.";

export type EditorStaticPick = {
  url: string;
  label: string;
  durationMs: number;
  mediaKind: EditorStaticMediaKind;
  width?: number;
  height?: number;
};

type ImageSource = "docs" | "search" | "generate";

const GENERATE_ASPECTS = ["16:9", "9:16", "1:1", "4:3", "3:4"] as const;

type GenerateAspect = typeof GENERATE_ASPECTS[number];

type ImageModelRow = {
  id: string;
  name: string;
  supportedAspectRatios: string[];
  supportedResolutions: string[];
};

type GeneratedStill = {
  url: string;
  label: string;
  durationMs: number;
  width?: number;
  height?: number;
};

const isGenerateAspect = (value: string): value is GenerateAspect =>
  GENERATE_ASPECTS.some((item) => item === value);

type StockImage = {
  id: number;
  width: number;
  height: number;
  image: string;
  url: string;
  author: string;
};

type RecordingRow = {
  _id: string;
  mimeType: string;
  url: string;
  width: number | null;
  height: number | null;
  name: string | null;
};

type DocsStill = {
  id: string;
  url: string;
  image: string;
  label: string;
  mediaKind: EditorStaticMediaKind;
  width: number;
  height: number;
};

const labelFromMime = (mime: string) => {
  const lower = mime.toLowerCase();
  if (lower.includes("gif")) {
    return "GIF";
  }
  if (lower.includes("svg")) {
    return "SVG";
  }
  if (lower.includes("webp")) {
    return "WebP";
  }
  if (lower.includes("jpeg") || lower.includes("jpg")) {
    return "JPEG";
  }
  if (lower.includes("png")) {
    return "PNG";
  }
  return "Image";
};

const stillFromFile = (file: BinaryFileData): DocsStill | null => {
  const mime = file.mimeType.toLowerCase();
  if (
    !mime.startsWith("image/") ||
    !file.dataURL ||
    file.dataURL === "data:,"
  ) {
    return null;
  }
  return {
    id: `local-${file.id}`,
    url: file.dataURL,
    image: file.dataURL,
    label: labelFromMime(mime),
    mediaKind: editorStaticMediaKindFromMime(mime),
    width: 0,
    height: 0,
  };
};

const stillFromRecording = (row: RecordingRow): DocsStill | null => {
  const mime = row.mimeType.toLowerCase();
  if (!mime.startsWith("image/")) {
    return null;
  }
  return {
    id: `doc-${row._id}`,
    url: row.url,
    image: row.url,
    label: row.name?.trim() || labelFromMime(mime),
    mediaKind: editorStaticMediaKindFromMime(mime),
    width: row.width && row.width > 0 ? row.width : 0,
    height: row.height && row.height > 0 ? row.height : 0,
  };
};

const PickImageCard = ({
  image,
  label,
  quality,
  selected,
  onSelect,
  onAdd,
}: {
  image: string;
  label: string;
  quality: string | null;
  selected: boolean;
  onSelect: () => void;
  onAdd: () => void;
}) => {
  const itemClass = selected
    ? "jayrr-present__recording is-selected"
    : "jayrr-present__recording";

  return (
    <li className={itemClass}>
      <span className="jayrr-present__recording-name">{label}</span>
      <button
        type="button"
        className="jayrr-present__recording-thumb"
        aria-pressed={selected}
        aria-label={`Select ${label}`}
        onClick={onSelect}
        onDoubleClick={onAdd}
      >
        <img src={image} alt="" />
        <span className="jayrr-present__recording-badges">
          {quality ? (
            <span className="jayrr-present__recording-quality">{quality}</span>
          ) : null}
        </span>
      </button>
    </li>
  );
};

type JayrrEditorAddImageDialogProps = {
  canQuery: boolean;
  onClose: () => void;
  onPick: (row: EditorStaticPick) => void;
};

export const JayrrEditorAddImageDialog = ({
  canQuery,
  onClose,
  onPick,
}: JayrrEditorAddImageDialogProps) => {
  const descriptionId = useId();
  const excalidrawAPI = useExcalidrawAPI();
  const searchImages = useAction(api.stockImages.search);
  const listImageModels = useAction(api.editorAi.generateImage.listModels);
  const generateImage = useAction(api.editorAi.generateImage.generate);
  const [source, setSource] = useState<ImageSource>("docs");
  const [query, setQuery] = useState("");
  const [photos, setPhotos] = useState<StockImage[]>([]);
  const [localFiles, setLocalFiles] = useState<BinaryFileData[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [localReady, setLocalReady] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [models, setModels] = useState<ImageModelRow[]>([]);
  const [modelId, setModelId] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [generated, setGenerated] = useState<GeneratedStill | null>(null);

  const recordings = useQuery(
    api.presentRecordings.listImages,
    canQuery && source === "docs" ? {} : "skip",
  );

  useEffect(() => {
    let cancelled = false;
    void LocalData.listLocalImageFiles().then((files) => {
      if (cancelled) {
        return;
      }
      setLocalFiles(files);
      setLocalReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const trimmed = query.trim();
  const docsStills = useMemo(() => {
    const byId = new Map<string, DocsStill>();
    for (const file of Object.values(excalidrawAPI?.getFiles() ?? {})) {
      const still = stillFromFile(file);
      if (still) {
        byId.set(still.id, still);
      }
    }
    for (const file of localFiles) {
      const still = stillFromFile(file);
      if (still && !byId.has(still.id)) {
        byId.set(still.id, still);
      }
    }
    for (const row of recordings ?? []) {
      const still = stillFromRecording(row);
      if (still) {
        byId.set(still.id, still);
      }
    }
    return [...byId.values()];
  }, [excalidrawAPI, localFiles, recordings]);

  useEffect(() => {
    if (!canQuery || source !== "generate") {
      return;
    }
    let cancelled = false;
    void listImageModels({})
      .then((rows) => {
        if (cancelled) {
          return;
        }
        setModels(rows);
        setModelId((current) => current || rows[0]?.id || "");
      })
      .catch((caught: unknown) => {
        if (cancelled) {
          return;
        }
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load image models.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [canQuery, listImageModels, source]);

  const selectedModel = models.find((model) => model.id === modelId) ?? null;
  const aspectOptions = useMemo(() => {
    if (selectedModel && selectedModel.supportedAspectRatios.length > 0) {
      const matched =
        selectedModel.supportedAspectRatios.filter(isGenerateAspect);
      if (matched.length > 0) {
        return matched;
      }
      return selectedModel.supportedAspectRatios;
    }
    return [...GENERATE_ASPECTS];
  }, [selectedModel]);

  useEffect(() => {
    if (aspectOptions.includes(aspectRatio)) {
      return;
    }
    const next = aspectOptions[0];
    if (next) {
      setAspectRatio(next);
    }
  }, [aspectOptions, aspectRatio]);

  const selectedPhoto =
    photos.find((photo) => String(photo.id) === selectedKey) ?? null;
  const selectedDoc = docsStills.find((row) => row.id === selectedKey) ?? null;

  const generatePrompt = prompt.trim();
  let canSearch = false;
  if (canQuery && source === "search" && trimmed.length > 0 && !busy) {
    canSearch = true;
  }
  let canGenerate = false;
  if (canQuery && source === "generate" && generatePrompt.length > 0 && !busy) {
    canGenerate = true;
  }
  let canAdd = false;
  if (!busy) {
    if (source === "search" && selectedPhoto) {
      canAdd = true;
    }
    if (source === "docs" && selectedDoc) {
      canAdd = true;
    }
    if (source === "generate" && generated) {
      canAdd = true;
    }
  }

  const setImageSource = (next: ImageSource) => {
    setSource(next);
    setSelectedKey(null);
    setError("");
  };

  const runSearch = async () => {
    if (!canSearch) {
      return;
    }
    setBusy(true);
    setError("");
    setSelectedKey(null);
    try {
      const rows = await searchImages({ query: trimmed });
      setPhotos(rows);
      setSearched(true);
    } catch (caught) {
      setPhotos([]);
      setSearched(true);
      setError(
        caught instanceof Error ? caught.message : "Image search failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const pickPhoto = (photo: StockImage) => {
    onPick({
      url: photo.url,
      label: photo.author,
      durationMs: EDITOR_STATIC_DURATION_MS,
      mediaKind: "image",
      ...(photo.width > 0 ? { width: photo.width } : {}),
      ...(photo.height > 0 ? { height: photo.height } : {}),
    });
  };

  const pickDoc = (row: DocsStill) => {
    onPick({
      url: row.url,
      label: row.label,
      durationMs: EDITOR_STATIC_DURATION_MS,
      mediaKind: row.mediaKind,
      ...(row.width > 0 ? { width: row.width } : {}),
      ...(row.height > 0 ? { height: row.height } : {}),
    });
  };

  const pickGenerated = (row: GeneratedStill) => {
    onPick({
      url: row.url,
      label: row.label,
      durationMs: row.durationMs,
      mediaKind: "image",
      ...(row.width && row.width > 0 ? { width: row.width } : {}),
      ...(row.height && row.height > 0 ? { height: row.height } : {}),
    });
  };

  const runGenerate = async () => {
    if (!canGenerate) {
      return;
    }
    setBusy(true);
    setError("");
    setGenerated(null);
    try {
      const row = await generateImage({
        prompt: generatePrompt,
        aspectRatio,
        modelId: modelId || undefined,
      });
      setGenerated(row);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Image generation failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (source === "search") {
      await runSearch();
      return;
    }
    if (source === "generate") {
      await runGenerate();
      return;
    }
    if (!selectedDoc) {
      return;
    }
    pickDoc(selectedDoc);
  };

  const renderPhotoGrid = (rows: StockImage[]) => (
    <ul className="jayrr-present__recordings-list">
      {rows.map((photo) => (
        <PickImageCard
          key={photo.id}
          image={photo.image}
          label={photo.author}
          quality={formatRecordingQuality(photo.width, photo.height)}
          selected={String(photo.id) === selectedKey}
          onSelect={() => setSelectedKey(String(photo.id))}
          onAdd={() => pickPhoto(photo)}
        />
      ))}
    </ul>
  );

  const renderDocsGrid = (rows: DocsStill[]) => (
    <ul className="jayrr-present__recordings-list">
      {rows.map((row) => (
        <PickImageCard
          key={row.id}
          image={row.image}
          label={row.label}
          quality={formatRecordingQuality(row.width, row.height)}
          selected={row.id === selectedKey}
          onSelect={() => setSelectedKey(row.id)}
          onAdd={() => pickDoc(row)}
        />
      ))}
    </ul>
  );

  let listBody;
  if (source === "generate") {
    if (!canQuery) {
      listBody = (
        <p className="jayrr-editor-add-stock__empty">
          Sign in to generate images.
        </p>
      );
    } else if (busy) {
      listBody = (
        <p className="jayrr-editor-add-stock__empty">Generating image…</p>
      );
    } else if (generated) {
      listBody = (
        <div className="jayrr-editor-add-stock__preview">
          <img src={generated.url} alt={generated.label} />
        </div>
      );
    } else if (error) {
      listBody = <p className="jayrr-editor-add-stock__empty">{error}</p>;
    } else {
      listBody = (
        <p className="jayrr-editor-add-stock__empty">
          Describe an image, then generate it.
        </p>
      );
    }
  } else if (source === "search") {
    if (!canQuery) {
      listBody = (
        <p className="jayrr-editor-add-stock__empty">
          Sign in to search images.
        </p>
      );
    } else if (busy && photos.length === 0) {
      listBody = <p className="jayrr-editor-add-stock__empty">Searching…</p>;
    } else if (error && photos.length === 0) {
      listBody = <p className="jayrr-editor-add-stock__empty">{error}</p>;
    } else if (!searched) {
      listBody = (
        <p className="jayrr-editor-add-stock__empty">Search for a photo.</p>
      );
    } else if (photos.length === 0) {
      listBody = (
        <p className="jayrr-editor-add-stock__empty">
          No photos for that search.
        </p>
      );
    } else {
      listBody = renderPhotoGrid(photos);
    }
  } else if (!localReady || (canQuery && recordings === undefined)) {
    listBody = <p className="jayrr-editor-add-stock__empty">Loading images…</p>;
  } else if (docsStills.length === 0) {
    listBody = (
      <p className="jayrr-editor-add-stock__empty">
        No images on this board or in Docs. Drop an image on the canvas, search
        stock photos, or generate one.
      </p>
    );
  } else {
    listBody = renderDocsGrid(docsStills);
  }

  return (
    <Dialog
      className="jayrr-editor-add-stock"
      size={560}
      onCloseRequest={onClose}
      title={
        <span className="jayrr-editor-add-stock__title-row">
          Add image
          <Tooltip label={INFO} long position="top">
            <span
              className="jayrr-editor-add-stock__info"
              aria-label="More info"
            >
              {helpIcon}
            </span>
          </Tooltip>
        </span>
      }
    >
      <p id={descriptionId} className="visually-hidden">
        {INFO}
      </p>
      <form
        className="jayrr-editor-add-stock__form"
        aria-describedby={descriptionId}
        onSubmit={onSubmit}
      >
        <div
          className="jayrr-editor-add-stock__sources"
          role="group"
          aria-label="Image source"
        >
          <button
            type="button"
            className={`jayrr-editor-add-stock__source${
              source === "docs" ? " is-active" : ""
            }`}
            aria-pressed={source === "docs"}
            onClick={() => setImageSource("docs")}
          >
            Docs
          </button>
          <button
            type="button"
            className={`jayrr-editor-add-stock__source${
              source === "search" ? " is-active" : ""
            }`}
            aria-pressed={source === "search"}
            onClick={() => setImageSource("search")}
          >
            Search
          </button>
          <button
            type="button"
            className={`jayrr-editor-add-stock__source${
              source === "generate" ? " is-active" : ""
            }`}
            aria-pressed={source === "generate"}
            onClick={() => setImageSource("generate")}
          >
            Generate
          </button>
        </div>
        {source === "search" ? (
          <Field label="Search">
            <Input
              value={query}
              placeholder="City, ocean, office"
              disabled={!canQuery || busy}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
          </Field>
        ) : null}
        {source === "generate" ? (
          <>
            <div className="jayrr-editor-add-stock__generate-bar">
              <select
                className="jayrr-editor-add-stock__opt"
                value={aspectRatio}
                disabled={busy}
                aria-label="Aspect ratio"
                onChange={(event) => setAspectRatio(event.currentTarget.value)}
              >
                {aspectOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select
                className="jayrr-editor-add-stock__model"
                value={modelId}
                disabled={busy || models.length === 0}
                aria-label="Image model"
                onChange={(event) => setModelId(event.currentTarget.value)}
              >
                {models.length === 0 ? (
                  <option value="">{error ? "Auto" : "Loading…"}</option>
                ) : (
                  models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <textarea
              className="jayrr-ui-input jayrr-editor-add-stock__prompt"
              value={prompt}
              rows={3}
              disabled={!canQuery || busy}
              placeholder="Describe the image…"
              aria-label="Image prompt"
              onChange={(event) => setPrompt(event.currentTarget.value)}
              onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  void runGenerate();
                }
              }}
            />
          </>
        ) : null}
        <div className="jayrr-editor-add-stock__body">{listBody}</div>
        {error &&
        ((source === "search" && photos.length > 0) ||
          (source === "generate" && generated)) ? (
          <p className="jayrr-editor-add-stock__error">{error}</p>
        ) : null}
        <div className="jayrr-editor-add-stock__buttons">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {source === "search" ? (
            <Button type="submit" variant="secondary" disabled={!canSearch}>
              Search
            </Button>
          ) : null}
          {source === "generate" ? (
            <Button
              type="submit"
              variant={generated ? "secondary" : "primary"}
              busy={busy}
              disabled={!canGenerate}
            >
              {busy ? "Generating…" : generated ? "Generate again" : "Generate"}
            </Button>
          ) : null}
          <Button
            type={source === "docs" ? "submit" : "button"}
            variant="primary"
            disabled={!canAdd}
            onClick={() => {
              if (source === "search") {
                if (!selectedPhoto) {
                  return;
                }
                pickPhoto(selectedPhoto);
                return;
              }
              if (source === "generate") {
                if (!generated) {
                  return;
                }
                pickGenerated(generated);
              }
            }}
          >
            Add
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
