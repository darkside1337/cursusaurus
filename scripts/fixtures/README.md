# Cursusaurus Video Fixtures

This directory contains deterministic, committed video fixtures used by `scripts/seed.ts` to populate the Cursusaurus showcase classroom player.

## Manifest & Specifications
- **Format**: MP4 (H.264 High Profile / AAC-LC)
- **Resolution**: 1280x720 (16:9 widescreen)
- **Duration**: 20.0 seconds per clip
- **Streaming**: FastStart enabled (`moov` atom placed at beginning of container)
- **Clips**:
  - `clip-a.mp4`: Lesson 1 Free Preview Showcase (Blush Peach accent, animated progress bar & timestamp)
  - `clip-b.mp4`: Core Architecture & Deep Dive (Sky blue accent, animated progress bar & timestamp)
  - `clip-c.mp4`: Production Systems & Workshop Synthesis (Emerald accent, animated progress bar & timestamp)

## Generation
These deterministic clips were generated with `ffmpeg` using lavfi synthesis and normalized H.264/AAC encoding.
Exact metadata, byte lengths, and SHA-256 checksums are tracked in `manifest.json`.

License: CC0 / Public Domain. Permissive for test and development showcase.
