import type { CameraCutout } from "../domain/flags/cameraCutoutFlag";

const cutouts = new Map<string, HTMLCanvasElement>();

export const setJayrrCameraCutout = (
  elementId: string,
  canvas: HTMLCanvasElement | null,
) => {
  if (canvas) {
    cutouts.set(elementId, canvas);
    return;
  }
  cutouts.delete(elementId);
};

export const getJayrrCameraCutout = (elementId: string) =>
  cutouts.get(elementId) ?? null;

const MEDIAPIPE_WASM =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm";
const MEDIAPIPE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";

type StopCutout = () => void;

const waitVideo = (video: HTMLVideoElement) =>
  new Promise<void>((resolve) => {
    if (video.readyState >= 2) {
      if (video.videoWidth > 1) {
        resolve();
        return;
      }
    }
    const onReady = () => {
      video.removeEventListener("loadeddata", onReady);
      resolve();
    };
    video.addEventListener("loadeddata", onReady);
  });

const applyPersonMask = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  mask: {
    width: number;
    height: number;
    getAsFloat32Array: () => Float32Array;
  },
) => {
  const weights = mask.getAsFloat32Array();
  const frame = context.getImageData(0, 0, width, height);
  const pixels = frame.data;
  const maskW = mask.width;
  const maskH = mask.height;
  for (let y = 0; y < height; y += 1) {
    const my = Math.min(maskH - 1, Math.floor((y * maskH) / height));
    const row = my * maskW;
    for (let x = 0; x < width; x += 1) {
      const mx = Math.min(maskW - 1, Math.floor((x * maskW) / width));
      const weight = weights[row + mx] ?? 0;
      const unit = weight > 1 ? weight / 255 : weight;
      pixels[(y * width + x) * 4 + 3] = Math.max(
        0,
        Math.min(255, Math.round(unit * 255)),
      );
    }
  }
  context.putImageData(frame, 0, 0);
};

const punchChroma = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) => {
  const frame = context.getImageData(0, 0, width, height);
  const pixels = frame.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i] ?? 0;
    const g = pixels[i + 1] ?? 0;
    const b = pixels[i + 2] ?? 0;
    const rg = Math.max(r, g);
    const blueLead = b - rg;
    if (blueLead > 30) {
      const fade = Math.min(1, (blueLead - 30) / 66);
      pixels[i + 2] = Math.round(b * (1 - fade) + rg * fade);
      pixels[i + 3] = Math.round((pixels[i + 3] ?? 255) * (1 - fade));
    }
  }
  context.putImageData(frame, 0, 0);
};

const CHROMA_VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 1.0 - (a_pos.y * 0.5 + 0.5));
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const CHROMA_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_image;
uniform sampler2D u_prev;
uniform float u_hasPrev;
in vec2 v_uv;
out vec4 outColor;

float blueLead(vec3 c) {
  return c.b - max(c.r, c.g);
}

void main() {
  vec4 c = texture(u_image, v_uv);
  float lead = blueLead(c.rgb);
  float spill = smoothstep(0.12, 0.38, lead);
  float alpha = 1.0 - spill;
  float keptB = mix(c.b, min(c.b, max(c.r, c.g)), spill);
  vec3 rgb = vec3(c.r, c.g, keptB);
  if (u_hasPrev > 0.5) {
    float prevA = texture(u_prev, vec2(v_uv.x, 1.0 - v_uv.y)).a;
    float mid = 1.0 - abs(alpha * 2.0 - 1.0);
    float rate = mix(0.85, 0.4, mid);
    alpha = mix(prevA, alpha, rate);
  }
  outColor = vec4(rgb * alpha, alpha);
}`;

const compileShader = (
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
) => {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

type ChromaKey = {
  canvas: HTMLCanvasElement;
  apply: (source: TexImageSource, width: number, height: number) => boolean;
  destroy: () => void;
};

const createChromaKey = (): ChromaKey | null => {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
  });
  if (!gl) {
    return null;
  }
  const vert = compileShader(gl, gl.VERTEX_SHADER, CHROMA_VERT);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, CHROMA_FRAG);
  if (!vert || !frag) {
    return null;
  }
  const program = gl.createProgram();
  if (!program) {
    return null;
  }
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    return null;
  }
  const buffer = gl.createBuffer();
  const texture = gl.createTexture();
  const prev = gl.createTexture();
  if (!buffer || !texture || !prev) {
    return null;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const loc = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.useProgram(program);
  gl.uniform1i(gl.getUniformLocation(program, "u_image"), 0);
  gl.uniform1i(gl.getUniformLocation(program, "u_prev"), 1);
  const hasPrevLoc = gl.getUniformLocation(program, "u_hasPrev");
  let hasPrev = false;
  gl.bindTexture(gl.TEXTURE_2D, prev);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 0]),
  );
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.clearColor(0, 0, 0, 0);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);

  return {
    canvas,
    apply: (source, width, height) => {
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        hasPrev = false;
      }
      gl.viewport(0, 0, width, height);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(hasPrevLoc, hasPrev ? 1 : 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, prev);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source,
      );
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindTexture(gl.TEXTURE_2D, prev);
      gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, width, height, 0);
      hasPrev = true;
      return true;
    },
    destroy: () => {
      gl.deleteTexture(prev);
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
    },
  };
};

const loopVideo = (
  video: HTMLVideoElement,
  cancelled: () => boolean,
  tick: () => void,
) => {
  let handle = 0;
  const step = () => {
    if (cancelled()) {
      return;
    }
    tick();
    if ("requestVideoFrameCallback" in video) {
      handle = video.requestVideoFrameCallback(step);
      return;
    }
    handle = requestAnimationFrame(step);
  };
  step();
  return () => {
    if ("cancelVideoFrameCallback" in video && handle) {
      video.cancelVideoFrameCallback(handle);
      return;
    }
    cancelAnimationFrame(handle);
  };
};

const startMediaPipe = async (
  elementId: string,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  cancelled: () => boolean,
): Promise<StopCutout> => {
  const visionMod = await import("@mediapipe/tasks-vision");
  if (cancelled()) {
    return () => undefined;
  }
  const fileset = await visionMod.FilesetResolver.forVisionTasks(
    MEDIAPIPE_WASM,
  );
  let segmenter: Awaited<
    ReturnType<typeof visionMod.ImageSegmenter.createFromOptions>
  >;
  try {
    segmenter = await visionMod.ImageSegmenter.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MEDIAPIPE_MODEL,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      outputCategoryMask: false,
      outputConfidenceMasks: true,
    });
  } catch {
    segmenter = await visionMod.ImageSegmenter.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MEDIAPIPE_MODEL,
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      outputCategoryMask: false,
      outputConfidenceMasks: true,
    });
  }
  if (cancelled()) {
    segmenter.close();
    return () => undefined;
  }

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    segmenter.close();
    return () => undefined;
  }

  let lastTs = -1;
  let published = false;
  const stopLoop = loopVideo(video, cancelled, () => {
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (width < 2 || height < 2) {
      return;
    }
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const timestamp = Math.max(lastTs + 1, performance.now());
    lastTs = timestamp;
    try {
      segmenter.segmentForVideo(video, timestamp, (result) => {
        if (cancelled()) {
          return;
        }
        // Class 0 is the person. The other class is the room, which was
        // being kept and turning the person into a white hole.
        const mask = result.confidenceMasks?.[0];
        if (!mask) {
          return;
        }
        context.clearRect(0, 0, width, height);
        context.drawImage(video, 0, 0, width, height);
        applyPersonMask(context, width, height, mask);
        result.close();
        if (!published) {
          published = true;
          setJayrrCameraCutout(elementId, canvas);
        }
      });
    } catch {
      // Keep the last good frame if a tick fails.
    }
  });

  return () => {
    stopLoop();
    segmenter.close();
  };
};

const startSegmo = async (
  elementId: string,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  cancelled: () => boolean,
): Promise<StopCutout> => {
  const { SegmentationProcessor } = await import("segmo");
  if (cancelled()) {
    return () => undefined;
  }
  const caps = SegmentationProcessor.checkCapabilities();
  if (!caps.supported) {
    return () => undefined;
  }
  const width = video.videoWidth || 640;
  const height = video.videoHeight || 360;
  const processor = new SegmentationProcessor({
    backgroundMode: "color",
    backgroundColor: "#0033CC",
    quality: "high",
    adaptive: false,
    modelFps: 30,
    useWorker: true,
    outputFps: 30,
  });
  await processor.init(width, height);
  if (cancelled()) {
    processor.destroy();
    return () => undefined;
  }
  const chroma = createChromaKey();
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!chroma && !context) {
    processor.destroy();
    return () => undefined;
  }

  let published = false;
  const publish = (target: HTMLCanvasElement) => {
    if (published) {
      return;
    }
    published = true;
    setJayrrCameraCutout(elementId, target);
  };

  const stopLoop = loopVideo(video, cancelled, () => {
    if (video.videoWidth < 2 || video.videoHeight < 2) {
      return;
    }
    const output = processor.processFrame(video, performance.now());
    if (!output) {
      return;
    }
    if (chroma) {
      chroma.apply(output, output.width, output.height);
      publish(chroma.canvas);
      return;
    }
    if (!context) {
      return;
    }
    if (canvas.width !== output.width || canvas.height !== output.height) {
      canvas.width = output.width;
      canvas.height = output.height;
    }
    context.clearRect(0, 0, output.width, output.height);
    context.drawImage(output, 0, 0, output.width, output.height);
    punchChroma(context, output.width, output.height);
    publish(canvas);
  });
  return () => {
    stopLoop();
    chroma?.destroy();
    processor.destroy();
  };
};

export const startJayrrCameraCutout = (
  elementId: string,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  engine: CameraCutout,
): StopCutout => {
  if (engine === "off") {
    setJayrrCameraCutout(elementId, null);
    return () => undefined;
  }
  let cancelled = false;
  let stopEngine: StopCutout = () => undefined;
  void waitVideo(video)
    .then(() => {
      if (cancelled) {
        return;
      }
      if (engine === "mediapipe") {
        return startMediaPipe(elementId, video, canvas, () => cancelled);
      }
      return startSegmo(elementId, video, canvas, () => cancelled);
    })
    .then((stop) => {
      if (!stop) {
        return;
      }
      if (cancelled) {
        stop();
        return;
      }
      stopEngine = stop;
    })
    .catch(() => undefined);

  return () => {
    cancelled = true;
    stopEngine();
    setJayrrCameraCutout(elementId, null);
  };
};
