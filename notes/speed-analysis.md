# Playback speed on RF1705 2.0.x: root-cause notes

Source: RF1705/youtube-webos-cobalt-adfree @ 7f9de1d (cloned in ../ref/).

## How speed is set
- `webapp/src/ui.js:83` `adjustPlaybackRate()` uses keys 1 and 3 to set `video.playbackRate = nextRate` from `PLAYBACK_RATES`. YouTube's own speed menu sets the same property.
- Cobalt passes the rate through `FilterBasedPlayerWorkerHandler::SetPlaybackRate` (patch `cobalt-23.lts.6-webos-external-video-controls.patch`). From there it takes one of two paths:
  - **Shared A/V backend**, the default since 2.0.4 for WebM Opus + H.264/VP9/AV1. `starfish_av_components.cc:418` `Rate()` stores `rate_`. `Step()` (around line 737) calls `SetPlayRate({"playRate":r,"audioOutput":true})` once loaded. Rates other than 0 or 0.1–2 call `FailLocked`.
  - **Legacy backend** (`YTAF_SHARED_AV=0` or `/tmp/ytaf-shared-av.enable`=0). `starfish_video_decoder.cc:438` `ApplyPlaybackStateOnDecoderThread()` calls `SetPlayRate` on video only. Cobalt renders audio separately, with its own time-stretch.

## Bug 1: changing speed mid-playback freezes (#81, #87, #103, #106)
- Key observation from #106 (C5, webOS 10.3.1-3006, platform o22n3, the same generation as ours):
  - Changing the rate while playing freezes the video. On the shared backend audio freezes too; on the legacy backend audio keeps playing.
  - **Restarting the same video fixes it, and the new rate is kept.**
- This means `SetPlayRate` works when applied right after load and before `Play()`. It breaks when applied to a session that is already playing.
- The shared backend recreates both native streams on every seek (docs/shared-starfish-av-backend.md). A new session applies `rate_` after load, before `Play()`.
- **Fix A (JS, no native rebuild):** on a rate change while playing, also do `video.currentTime = video.currentTime` (a same-position seek). This forces a session rebuild that starts at the new rate. Hook the `ratechange` event so YouTube's own speed menu is covered too.
- **Fix B (native, proper fix):** in `Step()`, when `session.playing && rate != session.rate`, run Pause, then SetPlayRate, then Play. If Starfish still stalls, request an internal reset at `current_` (the same path a seek takes). Apply the equivalent change in `starfish_video_decoder.cc` for the legacy backend.
- **Manual test, no code needed:** change speed with key 3, then seek a few seconds with left/right on the remote. If playback resumes at the new speed, Fix A is confirmed.

## Bug 2: quality drops to 480p above 1x (#46, #107)
YouTube scales its `MediaSource.isTypeSupported` probe by the playback rate. Two things then fail:
1. The bitrate becomes fractional (`bitrate=4241906.25`), which Cobalt's integer MIME parser rejects. The whole probe returns false.
2. The framerate scales to 62.5 (50 fps) or 75 (60 fps) at 1.25x. That exceeds the platform's `fps <= 60` limit (`cobalt-23.lts.6-webos-hardware-video-capabilities.patch:44`).

**JS fix:** wrap `MediaSource.isTypeSupported`:
- Round a fractional `bitrate=`.
- If `framerate > 60` and `framerate / video.playbackRate <= 60`, query with `framerate / playbackRate`. Optionally limit this to width ≤ 2560 so 4K above 1x stays conservative.
- YouTube's negative probes (`framerate=9999`, `width=99999`) must keep failing, so never relax limits beyond `rate × 60`.

## Fast iteration path (rooted TV)
The webapp ships as plain files in the installed app at `content/web/adblock/adblockMain.js` and `.css` (see `scripts/package-starterless-cobalt.sh:74`). On the rooted TV:
1. Back up the file.
2. Swap in a rebuilt `adblockMain.js`.
3. Fully kill the app and relaunch it.

No Cobalt rebuild or CI is needed for JS fixes or feature ports. `adblockPreload.js` is also read by the binary hook.
