import { useAction, useMutation, useQuery } from "convex/react";
import { useRef, useState } from "react";

import { helpIcon } from "@excalidraw/excalidraw/components/icons";

import { api } from "../../convexClient";

import { Button } from "./Button";
import { Dialog, Tooltip } from "./editor";
import { Field, Input } from "./Field";

import "./JayrrProfileDialog.scss";

import type { Id } from "../../../convex/_generated/dataModel";

const PROFILE_INFO =
  "Your name and photo are what other people see in live collaboration.";

const fitPhoto = (file: File, view: Window) =>
  new Promise<Blob>((resolve, reject) => {
    const image = new view.Image();
    const url = view.URL.createObjectURL(file);
    image.onload = () => {
      const max = 256;
      const longest = Math.max(image.width, image.height);
      const scale = longest > max ? max / longest : 1;
      const canvas = view.document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        view.URL.revokeObjectURL(url);
        reject(new Error("Could not read photo"));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          view.URL.revokeObjectURL(url);
          if (!blob) {
            reject(new Error("Could not read photo"));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        0.85,
      );
    };
    image.onerror = () => {
      view.URL.revokeObjectURL(url);
      reject(new Error("Could not read photo"));
    };
    image.src = url;
  });

const errorText = (caught: unknown, fallback: string) => {
  if (caught instanceof Error && caught.message) {
    return caught.message;
  }
  return fallback;
};

export const JayrrProfileDialog = ({ onClose }: { onClose: () => void }) => {
  const viewer = useQuery(api.users.viewer);
  const updateProfile = useMutation(api.users.updateProfile);
  const generatePhotoUploadUrl = useMutation(api.users.generatePhotoUploadUrl);
  const setPhoto = useMutation(api.users.setPhoto);
  const clearPhoto = useMutation(api.users.clearPhoto);
  const changePassword = useAction(api.profile.changePassword);
  const fileRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameBusy, setNameBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const shownName = name ?? viewer?.name ?? "";
  const initial = (shownName.trim().charAt(0) || "?").toUpperCase();

  const saveName = () => {
    const next = shownName.trim();
    if (!next) {
      setNameError("Name is required");
      return;
    }
    setNameBusy(true);
    setNameError(null);
    void updateProfile({ name: next })
      .then(() => {
        setName(next);
      })
      .catch((caught: unknown) => {
        setNameError(errorText(caught, "Could not save name"));
      })
      .finally(() => {
        setNameBusy(false);
      });
  };

  const onPhoto = (file: File | undefined) => {
    const view = rootRef.current?.ownerDocument.defaultView;
    if (!file) {
      return;
    }
    if (!view) {
      return;
    }
    setPhotoBusy(true);
    setPhotoError(null);
    void fitPhoto(file, view)
      .then(async (blob) => {
        const uploadUrl = await generatePhotoUploadUrl();
        const response = await view.fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": blob.type || "image/jpeg" },
          body: blob,
        });
        if (!response.ok) {
          throw new Error("Could not upload photo");
        }
        const payload: unknown = await response.json();
        const storageId =
          payload &&
          typeof payload === "object" &&
          "storageId" in payload &&
          typeof payload.storageId === "string"
            ? payload.storageId
            : "";
        if (!storageId) {
          throw new Error("Could not upload photo");
        }
        await setPhoto({ storageId: storageId as Id<"_storage"> });
      })
      .catch((caught: unknown) => {
        setPhotoError(errorText(caught, "Could not save photo"));
      })
      .finally(() => {
        setPhotoBusy(false);
        if (fileRef.current) {
          fileRef.current.value = "";
        }
      });
  };

  return (
    <Dialog
      className="jayrr-profile"
      size={420}
      autofocus={false}
      onCloseRequest={() => {
        if (!nameBusy && !photoBusy && !passwordBusy) {
          onClose();
        }
      }}
      title={
        <span className="jayrr-profile__title-row">
          Profile
          <Tooltip label={PROFILE_INFO} long position="top">
            <span className="jayrr-profile__info" aria-label="More info">
              {helpIcon}
            </span>
          </Tooltip>
        </span>
      }
    >
      <div ref={rootRef}>
        <p className="visually-hidden">
          {PROFILE_INFO} Display name is what other people see. Your sign-in
          username stays the same. Photo is optional. Changing the password asks
          for the current one.
        </p>
        <div className="jayrr-profile__photo-row">
          {viewer?.image ? (
            <img className="jayrr-profile__photo" alt="" src={viewer.image} />
          ) : (
            <span className="jayrr-profile__photo jayrr-profile__photo--letter">
              {initial}
            </span>
          )}
          <div className="jayrr-profile__photo-actions">
            <input
              ref={fileRef}
              accept="image/*"
              className="visually-hidden"
              type="file"
              onChange={(event) => {
                onPhoto(event.currentTarget.files?.[0]);
              }}
            />
            <Button
              busy={photoBusy}
              variant="secondary"
              onClick={() => {
                fileRef.current?.click();
              }}
            >
              Change photo
            </Button>
            {viewer?.image ? (
              <Button
                disabled={photoBusy}
                variant="ghost"
                onClick={() => {
                  setPhotoBusy(true);
                  setPhotoError(null);
                  void clearPhoto()
                    .catch((caught: unknown) => {
                      setPhotoError(
                        errorText(caught, "Could not remove photo"),
                      );
                    })
                    .finally(() => {
                      setPhotoBusy(false);
                    });
                }}
              >
                Remove
              </Button>
            ) : null}
          </div>
        </div>
        {photoError ? (
          <p className="jayrr-profile__error">{photoError}</p>
        ) : null}
        <form
          className="jayrr-profile__form"
          onSubmit={(event) => {
            event.preventDefault();
            saveName();
          }}
        >
          <Field label="Name">
            <Input
              autoComplete="nickname"
              maxLength={40}
              value={shownName}
              onChange={(event) => {
                setName(event.currentTarget.value);
              }}
            />
          </Field>
          <Field label="Username">
            <Input readOnly value={viewer?.email ?? ""} />
          </Field>
          {nameError ? (
            <p className="jayrr-profile__error">{nameError}</p>
          ) : null}
          <Button busy={nameBusy} type="submit">
            Save name
          </Button>
        </form>
        <form
          className="jayrr-profile__form"
          onSubmit={(event) => {
            event.preventDefault();
            if (passwordBusy) {
              return;
            }
            setPasswordBusy(true);
            setPasswordError(null);
            setPasswordMessage(null);
            void changePassword({ currentPassword, newPassword })
              .then(() => {
                setCurrentPassword("");
                setNewPassword("");
                setPasswordMessage("Password updated");
              })
              .catch((caught: unknown) => {
                setPasswordError(
                  errorText(caught, "Could not change password"),
                );
              })
              .finally(() => {
                setPasswordBusy(false);
              });
          }}
        >
          <Field label="Current password">
            <Input
              autoComplete="current-password"
              minLength={8}
              required
              type="password"
              value={currentPassword}
              onChange={(event) => {
                setCurrentPassword(event.currentTarget.value);
              }}
            />
          </Field>
          <Field label="New password">
            <Input
              autoComplete="new-password"
              minLength={8}
              required
              type="password"
              value={newPassword}
              onChange={(event) => {
                setNewPassword(event.currentTarget.value);
              }}
            />
          </Field>
          {passwordError ? (
            <p className="jayrr-profile__error">{passwordError}</p>
          ) : null}
          {passwordMessage ? (
            <p className="jayrr-profile__message">{passwordMessage}</p>
          ) : null}
          <Button busy={passwordBusy} type="submit">
            Change password
          </Button>
        </form>
      </div>
    </Dialog>
  );
};
