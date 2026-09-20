/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as canvasAi_chatHttp from "../canvasAi/chatHttp.js";
import type * as canvasAi_chatNode from "../canvasAi/chatNode.js";
import type * as canvasAi_colors from "../canvasAi/colors.js";
import type * as canvasAi_createTools from "../canvasAi/createTools.js";
import type * as canvasAi_jev from "../canvasAi/jev.js";
import type * as canvasAi_jevClient from "../canvasAi/jevClient.js";
import type * as canvasAi_prompt from "../canvasAi/prompt.js";
import type * as canvasAi_schemas from "../canvasAi/schemas.js";
import type * as canvasAi_skeletons from "../canvasAi/skeletons.js";
import type * as embedProxy from "../embedProxy.js";
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as libraries from "../libraries.js";
import type * as passwords from "../passwords.js";
import type * as presentBlob from "../presentBlob.js";
import type * as presentRecordingFolders from "../presentRecordingFolders.js";
import type * as presentRecordings from "../presentRecordings.js";
import type * as sceneFolders from "../sceneFolders.js";
import type * as scenes from "../scenes.js";
import type * as soundFolders from "../soundFolders.js";
import type * as soundSeed from "../soundSeed.js";
import type * as sounds from "../sounds.js";
import type * as transcription from "../transcription.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  "canvasAi/chatHttp": typeof canvasAi_chatHttp;
  "canvasAi/chatNode": typeof canvasAi_chatNode;
  "canvasAi/colors": typeof canvasAi_colors;
  "canvasAi/createTools": typeof canvasAi_createTools;
  "canvasAi/jev": typeof canvasAi_jev;
  "canvasAi/jevClient": typeof canvasAi_jevClient;
  "canvasAi/prompt": typeof canvasAi_prompt;
  "canvasAi/schemas": typeof canvasAi_schemas;
  "canvasAi/skeletons": typeof canvasAi_skeletons;
  embedProxy: typeof embedProxy;
  health: typeof health;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  libraries: typeof libraries;
  passwords: typeof passwords;
  presentBlob: typeof presentBlob;
  presentRecordingFolders: typeof presentRecordingFolders;
  presentRecordings: typeof presentRecordings;
  sceneFolders: typeof sceneFolders;
  scenes: typeof scenes;
  soundFolders: typeof soundFolders;
  soundSeed: typeof soundSeed;
  sounds: typeof sounds;
  transcription: typeof transcription;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
