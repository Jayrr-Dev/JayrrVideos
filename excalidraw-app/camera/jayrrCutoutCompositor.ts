const CUTOUT_VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 1.0 - (a_pos.y * 0.5 + 0.5));
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const CUTOUT_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_image;
uniform sampler2D u_prev;
uniform float u_hasPrev;
uniform float u_frameScale;
in vec2 v_uv;
out vec4 outColor;

void main() {
  vec4 c = texture(u_image, v_uv);
  float greenLead = c.g - max(c.r, c.b);
  float greenSpill = smoothstep(0.10, 0.30, greenLead);
  // Segmo supplies coverage directly. Never infer it from an artificial plate:
  // that loses fractional edges and punches holes in blue foreground objects.
  // Retain the physical greenscreen key, independently of the person matte.
  float alpha = c.a * (1.0 - greenSpill);
  vec3 foreground = vec3(c.r, mix(c.g, min(c.g, max(c.r, c.b)), greenSpill), c.b);
  // Spill on dark hair is far below the screen-removal threshold. Clean its
  // color separately from coverage so we don't erode hair, ears, or fingers.
  vec2 texel = 1.0 / vec2(textureSize(u_image, 0));
  float neighborAlpha = min(
    min(texture(u_image, v_uv + vec2(2.0 * texel.x, 0.0)).a,
        texture(u_image, v_uv - vec2(2.0 * texel.x, 0.0)).a),
    min(texture(u_image, v_uv + vec2(0.0, 2.0 * texel.y)).a,
        texture(u_image, v_uv - vec2(0.0, 2.0 * texel.y)).a));
  float boundary = 1.0 - smoothstep(0.85, 0.99, min(c.a, neighborAlpha));
  // Green spill can become cyan after camera white balance. Remove the shared
  // green/blue excess too, but protect blue objects and opaque interior colors.
  float cyanExcess = max(0.0, min(c.g, c.b) - c.r);
  float greenExcess = max(0.0, greenLead);
  float notBlue = 1.0 - smoothstep(0.01, 0.06, c.b - c.g);
  float despill = boundary * notBlue * smoothstep(0.008, 0.045, greenExcess + cyanExcess);
  foreground.g = max(0.0, foreground.g - despill * (greenExcess + cyanExcess));
  foreground.b = max(0.0, foreground.b - despill * cyanExcess);
  if (u_hasPrev > 0.5) {
    vec4 previous = texture(u_prev, vec2(v_uv.x, 1.0 - v_uv.y));
    float prevA = previous.a;
    float edge = 1.0 - abs(alpha * 2.0 - 1.0);
    // Small changes are usually edge noise. Large changes must follow hands
    // immediately, rather than accumulating a second trail after Segmo's EMA.
    float change = smoothstep(0.06, 0.24, abs(alpha - prevA));
    // Reject history when RGB changes even if coverage is similar: a moving
    // finger should not inherit the previous surface's fractional silhouette.
    vec3 previousColor = previous.rgb / max(prevA, 0.001);
    vec3 colorDelta = foreground - previousColor;
    float colorChange = smoothstep(0.0025, 0.025, dot(colorDelta, colorDelta));
    change = max(change, colorChange * step(0.1, min(alpha, prevA)));
    float rate = mix(mix(0.72, 0.35, edge), 1.0, change);
    rate = 1.0 - pow(1.0 - rate, u_frameScale);
    prevA = clamp(prevA, alpha - 0.12, alpha + 0.12);
    alpha = mix(prevA, alpha, rate);
  }
  outColor = vec4(foreground * alpha, alpha);
}`;

type CutoutKey = {
  canvas: HTMLCanvasElement;
  apply: (
    source: TexImageSource,
    width: number,
    height: number,
    timestamp: number,
  ) => void;
  destroy: () => void;
};

export const createCutoutKey = (ownerDocument: Document): CutoutKey | null => {
  const canvas = ownerDocument.createElement("canvas");
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
  const compile = (type: number, source: string) => {
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
  const vert = compile(gl.VERTEX_SHADER, CUTOUT_VERT);
  const frag = compile(gl.FRAGMENT_SHADER, CUTOUT_FRAG);
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
  const frameScaleLoc = gl.getUniformLocation(program, "u_frameScale");
  let hasPrev = false;
  let lastTimestamp = 0;
  const setupTex = (target: WebGLTexture) => {
    gl.bindTexture(gl.TEXTURE_2D, target);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  setupTex(prev);
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
  setupTex(texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  // Upload straight RGB + alpha, then premultiply exactly once in the shader.
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);

  return {
    canvas,
    apply: (source, width, height, timestamp) => {
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        hasPrev = false;
      }
      const elapsed = timestamp - lastTimestamp;
      // Do not blend with a stale frame after a paused/backgrounded camera.
      if (elapsed > 250 || elapsed <= 0) {
        hasPrev = false;
      }
      lastTimestamp = timestamp;
      gl.viewport(0, 0, width, height);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(hasPrevLoc, hasPrev ? 1 : 0);
      gl.uniform1f(
        frameScaleLoc,
        Math.max(0.25, Math.min(3, elapsed / (1000 / 30))),
      );
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
      if (hasPrev) {
        gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, width, height);
      } else {
        gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, width, height, 0);
      }
      hasPrev = true;
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
