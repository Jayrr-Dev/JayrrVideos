# Jayrr Segmo fork

Required Notice: Copyright Eyal Fishler and Joyous PBC (https://github.com/eyalfishler/segmo)

Local changes for the camera cutout:

- `backgroundMode: "transparent"` writes a premultiplied person over a blue plate
- Skip light wrap and the 13-sample matting loop in that mode
- Keep blur and auto-frame framebuffers small until those modes are used
