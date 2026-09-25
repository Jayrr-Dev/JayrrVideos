# Jayrr Segmo fork

Required Notice: Copyright Eyal Fishler and Joyous PBC (https://github.com/eyalfishler/segmo)

Local changes for the camera cutout:

- `backgroundMode: "transparent"` writes the real premultiplied person matte,
  without a blue plate or RGB-dependent alpha sharpening
- Skip light wrap and the 13-sample matting loop in that mode
- Keep blur and auto-frame framebuffers small until those modes are used
- Align joint bilateral samples to mask texel centers and honor range sigma
- Expose final erosion radius and typed post-processing controls for thin fingers
- Skip synthetic border filling in transparent mode; it invents foreground and
  contaminates guide samples near the edges of the frame
- The camera imports this fork directly so edits cannot be shadowed by an older
  `file:` dependency copy in node_modules

The camera compositor keeps a physical green-screen key, but no longer keys
blue out of the foreground. It rejects temporal history on color changes as
well as coverage changes. This is local history rejection, not optical flow.

Motion handling admits one worker capture/inference at a time, dropping frames
while busy instead of queueing stale camera images. The cutout requests up to
60 model frames per second; actual throughput remains limited by the camera and
inference time. Small mask changes use stronger smoothing, while large changes
bypass history even when no motion map is available.

Research basis:

- [Joint bilateral upsampling](https://www.microsoft.com/en-us/research/publication/joint-bilateral-upsampling/):
  use full-resolution RGB to guide the low-resolution mask.
- [WebGL alpha transfer rules](https://registry.khronos.org/webgl/specs/latest/1.0/):
  upload straight color and premultiply once when writing the output.
- [Robust Video Matting](https://github.com/PeterL1n/RobustVideoMatting): recurrent
  matting is a candidate for a future model upgrade, not implemented here.
- [Google Meet HD segmentation](https://research.google/blog/high-definition-segmentation-in-google-meet/):
  higher-resolution models improve fine finger boundaries. The present changes
  preserve existing mask evidence; they cannot recover entirely missed fingers.

GPU regression checks: run `npx vite --config excalidraw-app/camera/tests/vite.config.mts`
from the repository root and open `http://127.0.0.1:3001/camera/tests/cutout-gpu.html`.
These exercise the actual shaders and canvas transfers without requesting a
camera or downloading a model. Live-camera quality still needs visual comparison.
