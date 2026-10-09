# Feature diff: webosbrew/youtube-webos and NicholasBly fork vs RF1705 youtube-webos-cobalt-adfree

Read-only research. No repo code was run. All three repos were read as plain files.

## 4. Commit SHAs examined (shallow clones, depth 20)
| Repo | Local path | HEAD |
|---|---|---|
| RF1705/youtube-webos-cobalt-adfree (app version 2.0.2 in appinfo.json) | ref/youtube-webos-cobalt-adfree | 7f9de1da9a1cd97da55c7b7b507fb8f7c47a0fdc |
| webosbrew/youtube-webos | ref/youtube-webos | f1b3b72926bb0cc312b5ceddc6a5b8c8ca081914 |
| NicholasBly/youtube-webos | ref/nb-youtube-webos | 78a374a32774b92a2094e1cda8db4da0d83540d4 |

Paths below are relative to `ref/`. RF = `youtube-webos-cobalt-adfree/webapp/src/`, WB = `youtube-webos/src/`, NB = `nb-youtube-webos/src/`.

Architecture note: RF1705 is a native Cobalt app (appinfo type "native", main "cobalt") that injects a webapp. WB and NB are web apps (webOS browser engine) and use YouTube's player object (`#ytlr-player__player-container-player`, `player_api/`). RF never uses that player object. It uses `document.querySelector('video')`.

## 1. Feature matrix

| Feature | webosbrew | NicholasBly | RF1705 status | RF1705 file | Notes |
|---|---|---|---|---|---|
| Ad blocking (JSON.parse filter) | yes (WB adblock.js, 90 LOC) | yes, schema-based (NB adblock.js 1026 LOC) | present | RF adblock.js, adblock-preload.js, adblock.css, json-stringify-hook.js | RF also hides `ytlr-ad-slot-renderer` via DOM observer + `isInlinePlaybackNoAd` stringify hook. Config `enableAdBlock`. |
| QR / shop overlay filtering | no | yes | present | RF sponsored-qr-code-block.mjs, sponsored-qr-code-ui.js | Strips `TIMELY_ACTION_TYPE_SHOPPING` from `timelyActionRenderers`. Config `enableSponsoredQrCodeBlock`. |
| SponsorBlock basic skip | yes (WB 405 LOC) | yes (NB 1561 LOC) | present | RF sponsorblock.js (890), sponsorblock-categories.js, sponsorblock-skip-target.mjs | Progress-bar markers drawn as absolutely positioned divs. |
| SponsorBlock all segment types except highlight | 6 types (+preview) | 10 incl. hook, filler, chapter, poi_highlight | partial | RF sponsorblock-categories.js | RF has sponsor, intro, outro, interaction, selfpromo, music_offtopic, preview, filler, hook. Missing `poi_highlight` (and muted/`mute` segments, `chapter`). |
| SponsorBlock highlight (jump) | no | yes (blue button / `sb_manual_skip`) | missing | none | See card 4. |
| Per-segment color picker | no | yes (`<cat>Color` keys) | partial | RF sponsorblock-categories.js | Colors are fixed constants (same defaults as NB), not user-configurable. |
| Per-segment mode (auto/manual/seekbar/disable) | no | yes (`sbMode_*`) | partial | RF config.js | RF only has on/off booleans (`enableSponsorBlock<Cat>`). |
| Segment list UI | no | yes (NB Sponsorblock-UI.js, 165 LOC) | missing | none | See card 5. |
| Skip segments once | no | yes (`skipSegmentsOnce`) | missing | RF sponsorblock.js has `this.skipped` per video only | See card 6. |
| SB full-video label / time-with-skips | no | yes (sponsorblock-labels.js) | missing | none | Extra feature NB README omits. See card 6. |
| Autostart | README luna-send command | same | present (external) | RF README line 20 only | Autostart is an OS-level `luna://com.webos.service.eim/addDevice` call for appId `youtube.leanback.v4`, which RF uses too. Nothing in the app code. RF README claims "Optional autostart integration" but contains no instructions and no code. |
| Force highest video quality | yes (WB video-quality.ts 71 LOC) | yes (NB video-quality.js 502) | missing | none | See card 1. |
| Force video codec | no | yes (NB force-codec.js 357, `forceVideoCodec`) | missing | none | README omits. Card 14. Cobalt native decode, low value. |
| Audio-only mode (blue) | yes (WB ui.js ~50 LOC) | not in README | missing | none | See card 2. |
| Full animation support | yes (WB yt-fixes.css, `app-quality-root` body-class removal in ui.js applyUIFixes) | yes | n/a | n/a | webOS-browser quirk fix. Cobalt has no `app-quality-root` hack. Not applicable. |
| Shorts removal | yes (`removeShorts`, subscriptions only) | yes (`removeGlobalShorts`) | present | RF shorts-response-filter.mjs (175), shorts-block.js, config `enableShorts` (inverted checkbox) | RF covers wider ground (reel shelves, nav entries), live-applied via `__ytafApplyShortsState`. |
| Higher-quality thumbnails | yes (WB thumbnail-quality.ts 156) | yes (NB 1032 LOC) | missing | none | See card 7. |
| On-screen clock | yes (WB watch.js 90 + watch.css) | yes smart clock (NB watch.js 179) | missing | none | See card 3. |
| YouTube logo removal / style | yes (`hideLogo`, ui.js initHideLogo) | yes (`logoStyle`, logo-style.js 90) | missing | none | See card 8. |
| Remove end screens / hide endcards | yes (WB remove-endscreen.ts 34) | yes (`hideEndcards` in adblock.js removeEndcardsOptimized) | missing | RF userScript.js only contains a legacy click handler for `#creator-endscreen`, no removal | See card 9. |
| Bypass account selector | yes (WB auto-account-select.ts 29) | yes (NB auto-login.js 244) | present | RF auto-login.js (252), auto-login.css, config `enableAutoLogin` | Menu label "Automatically skip account selection". |
| Guest mode (hide sign-in prompts) | no | yes (`hideGuestSignInPrompts`, adblock.js hasGuestPromptRenderer) | partial | RF auto-login.js `isGuestMode()` detects guest only | No prompt hiding. Card 10. |
| Menu themes | no | yes (`uiTheme`: blue-force-field, classic-red) | missing | RF ui.css | Cosmetic. Card 11. |
| Programmable 0-9 / color key shortcuts | no | yes (`shortcut_key_*`, 15 actions) | partial | RF ui.js:733-766 | RF hard-codes 0 = subtitles, 1/3 = speed down/up. See card 12. |
| Red-button display off + OLED keepalive | no | yes (`oled_toggle`, `enableOledCareMode`) | missing | none | See card 13. |
| Return YouTube Dislike | no | yes (NB return-dislike.js 851) | present | RF returnyoutubedislike.js (677) + .css, config `enableReturnYouTubeDislike` | |
| Smart clock | no | yes | missing | none | Same as clock, card 3. |
| Description panel fix, comments fix | no | yes (NB comments-fix.js 141, yt-fixes.js 163) | missing | none | Card 14. Targets the webOS-browser web UI quirks. May not apply to Cobalt. |
| UI fixes (multiline titles, shelf opacity) | no | yes (`fixMultilineTitles`, `videoShelfOpacity`, `removeBlackBorders`) | missing | none | Card 14. CSS-only. Class names are obfuscated and per-build. |
| Playback speed | no (disabled in NB too) | NB has playback-speed.js (575 LOC) but its config/shortcut entries are commented out in config.js | present | RF ui.js:44, 74-111, 733-751 | See section 2. |
| Subtitle toggle (key 0) | no | `toggle_subs` shortcut | present | RF subtitle-shortcut.js (169) | RF extra. |
| Startup page | no | no | present | RF utils.js handleInitialLaunch, config `startupPage` | RF-only. |
| Tracking/telemetry block, remove Live / Top Live Games / "Most Relevant" shelves | no | yes | missing | none | README omits. Card 14. |
| Force previews, emoji font fix, webOS cast block, notifications toggle, screensaver fix, perf_mon | partly (cast block, screensaver-fix) | yes | missing / mostly n/a | RF adblock-main.js IIFE keeps `<video>` full-window to avoid screensaver | Mostly web-app specific. n/a for Cobalt. |

## 2. Playback speed in RF1705
- File: `ref/youtube-webos-cobalt-adfree/webapp/src/ui.js`.
- Steps: `const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];` at ui.js:44 (inside `userScriptStartUI`). Same list as NB `SPEED_STEPS` (NB playback-speed.js:33).
- Key mapping: `getPlaybackRateShortcut(evt)` at ui.js:74-81. Returns -1 for key `'1'` / `code Digit1` / keyCode 49, returns +1 for `'3'` / `Digit3` / keyCode 51. It is hard-coded. No config key and no menu entry.
- Handler: ui.js:733-751. Inside the shared `eventHandler`, which is registered at ui.js:766-768 on `document` for keydown, keypress and keyup in capture phase. It acts only on `keydown`, `!evt.repeat` and `!menuOpen`, then calls `evt.preventDefault()/stopPropagation()`.
- Applying the rate: `adjustPlaybackRate(direction)` at ui.js:83-112. It does `document.querySelector('video')`, reads `video.playbackRate`, finds the nearest step index, clamps it, and then sets **`video.playbackRate = nextRate` directly** (ui.js:109). It does not call a YouTube player API (no `setPlaybackRate`). It shows `showNotification("Playback speed: Nx", 1800, 'green')`.
- Gaps: there is no re-apply on `ratechange`, so YouTube may reset the rate on seek, quality switch or next video (NB handles this in `onRateChange`, playback-speed.js:115). The rate is not persisted. Key 2 is not used. Key 0 = subtitles (subtitle-shortcut.js:156, keyCode 48).

## 3. Porting cards for missing / partial features

Cobalt caveat (applies to every card): RF's webapp is already proven in this runtime with `div`, `h1`, `span`, `MutationObserver`, `fetch`, `localStorage`, `getComputedStyle`, inline `style.setProperty(..., 'important')`, `position:absolute/relative`, and `overflow:hidden`. RF's ui.js comment says Cobalt resets an overflow container's `scrollTop` after focus. Anything beyond that (`<img>`, `<canvas>`, `<input>`, `filter`, `backdrop-filter`, CSS animations or transitions, `Intl`) is unproven. Cobalt docs page (developers.google.com/youtube/cobalt/docs/development/reference/supported-features) only says "Blink supported features" without detail. I could not verify an element list there, so treat the risk ratings as judgment. YouTube Cobalt DOM selectors (`ytlr-*`, `[idomkey=...]`) are the same TVHTML5 UI as WB/NB target, because RF's adblock.js already uses `ytlr-ad-slot-renderer`. Obfuscated class names (NB uses e.g. `.Jx9xPc`) are per-build and fragile.

Hook points in RF: add keys in `config.js` `defaultConfig` (note the `CONFIG_KEY` is `ytaf-configuration-cobalt-adfree-v2`; missing keys are auto-populated by `configRead`). Add menu rows in `ui.js` with `checkboxTools.add(...)` / `choiceTools.add(...)` before the `sponsorBlock` block (ui.js ~255-420) and add strings to all 8 `languages/*.js` files. Add key handling in `eventHandler` in `ui.js` (before line 733). Start hooks in `adblock-main.js` `startUserScript` via `startOptionalHook(configKey, fn)`. Live-apply on change by listening to the `ytaf-config-changed` event (dispatched on `document` and `window` by `configWrite`).

### Card 1. Force highest video quality
- Legacy: WB `video-quality.ts` (71 LOC): `setPlaybackQuality` calls `player.setPlaybackQualityRange('highres','highres')` on the `playbackStart` event, then polls `getPlaybackQualityLabel`. NB `video-quality.js` (502 LOC): `setLocalStorageQuality()` writes `localStorage['yt-player-quality']` = `{data: '{"quality":4320,"previousQuality":4320}', creation, expiration}`, plus `setQualityOnPlayer()`, `interceptAndUpgradeQuality`, state polling and a webOS 25 kickstart workaround.
- Dependencies: config `forceHighResVideo`. YouTube player object (`getPlayerManager`, `#ytlr-player__player-container-player`) and `player_api/` (about 300 LOC more in WB). No remote key. No CSS.
- Cobalt risk: **MED**. The localStorage write (NB approach, about 50 LOC) needs no player object and no DOM, so it is the portable path. It must run before the player reads it (preload/early). The player-object path is uncertain on Cobalt. The Cobalt native app may also pick resolution from the platform's decoder limits. No unsupported tags.
- Hook: config.js `forceHighResVideo`, ui.js checkbox, new `video-quality.js` started from adblock-main.js. The localStorage write can run in `adblock-preload.js` or at the top of startUserScript.

### Card 2. Audio-only mode (blue button)
- Legacy: WB `ui.js` `initAudioOnlyToggle()` (about 50 LOC, ui.js:312-362): toggles `video.style.visibility='hidden'`, applies `filter: brightness(0)` to `.ytLrAudioPlayerOverlayAudioMode`, inserts an overlay div into `[idomkey="controls"]`, and uses a MutationObserver. Triggered by color keycodes 406 / 167 / 191 in eventHandler (WB ui.js:16-27, 196-205).
- Dependencies: remote key blue (406; RF comment ui.js lists blue as 191 and its Cobalt codes are 172 for green, so verify codes on device). Selectors `.ytLrAudioPlayerOverlayAudioMode`, `[idomkey="controls"]`. The CSS `filter` property.
- Cobalt risk: **MED-HIGH**. `visibility:hidden` on the `<video>` may not stop decode or composite on Cobalt/Starboard (video is a punch-out plane, not a DOM-composited element), so it may not hide the picture or may show a black plane. Real audio-only needs a server-side stream choice. `filter: brightness(0)` is likely unsupported. Selectors are unverified on Cobalt.
- Hook: new blue-key branch in ui.js eventHandler (next to `isGreenKey`), `isBlueKey(evt)` for keyCode 406 / 191.

### Card 3. On-screen clock / smart clock
- Legacy: WB `watch.js` (90 LOC) + `watch.css` (11): fixed-position div `.webOs-watch` (top-right, rgba background, border-radius), updated each minute via `Intl.DateTimeFormat(navigator.language,{hour,minute})`. Hides when `ytlr-watch-default` has `hybridnavfocusable="true"` (player focused). NB `watch.js` (179 LOC) adds hiding in fullscreen and when the description panel is open, plus OLED mode.
- Dependencies: config `showWatch`; selector `ytlr-watch-default` + attribute `hybridnavfocusable`; CSS `position:fixed`, `border-radius`, rgba.
- Cobalt risk: **LOW**. It is a plain div, the same pattern as RF's `.ytaf-notification-container`. Only unknowns are `Intl.DateTimeFormat` availability (fall back to `Date.getHours()`), `position:fixed`, and whether the `hybridnavfocusable` attribute exists in Cobalt DOM.
- Hook: config `showWatch`, ui.js checkbox, new `clock.js` + css, start in adblock-main.js; listen to `ytaf-config-changed`.

### Card 4. SponsorBlock highlight (poi_highlight) + jump key
- Legacy: NB `sponsorblock.js`: `highlightSegment = segments.find(category==='poi_highlight')` (line 544), mode switch on `sbMode_highlight` (auto_skip / ask / seek_bar / disable, line 569), jump function at ~1323-1330 (`video.currentTime = highlightSegment.segment[0]`), seek-bar drawing at ~931-972 (class `previewbar highlight`, color `poi_highlightColor` #ff1684). Triggered by the blue shortcut `sb_manual_skip`.
- Dependencies: config `sbMode_highlight`, `poi_highlightColor`; `poi_highlight` added to the API request categories (RF requests only `sponsorBlockCategories`); blue key.
- Cobalt risk: **LOW-MED**. Pure logic plus divs. RF marker rendering (sponsorblock.js:700-760) can be reused. Note that SponsorBlock API returns `actionType: "poi"` for highlights; RF filters `entry.actionType !== 'skip'` at sponsorblock.js:91, so that filter must be loosened.
- Hook: add `poi_highlight` to RF sponsorblock-categories.js (list, config map, color), a menu row, and blue/other key in ui.js.

### Card 5. Segment list UI
- Legacy: NB `Sponsorblock-UI.js` (165 LOC) + `sponsorblock-ui.css` (114): popup div `.sb-segments-popup` with header, an `<img>` icon (`icons/sponsorblock-icon.png` bundled via webpack, line 64), list rows with color-dot divs, times (`formatTime` via `Date.toISOString`).
- Dependencies: segments array from SponsorBlockHandler, a key to open (NB wires it through shortcuts), CSS for overlay and focus.
- Cobalt risk: **LOW-MED**. Replace the `<img>` icon with a text/div label. Popup uses only divs and spans. Needs focus handling similar to RF's menu (see RF `guardMenuFocus`, ui.js ~771).
- Hook: new `segment-list.js`; open key via ui.js eventHandler; data from RF sponsorblock.js `this.segments`.

### Card 6. Skip-once, per-segment mode, full-video label, time with skips
- Legacy: NB `sponsorblock.js` `skippedSegmentIndices` set (line 1229, config `skipSegmentsOnce`); per-category `sbMode_*` (auto_skip / manual_skip / seek_bar / disable); `sponsorblock-labels.js` (331 LOC) injects CSS (`buildCss`) for an "entire video is ad" icon and a time-with-skips label.
- Dependencies: configs `skipSegmentsOnce`, `sbMode_<cat>`, `<cat>Color`, `sbFullVideoLabel`, `sbShowTimeWithSkips`; a seek-back detection so manual rewind into a skipped segment does not skip again.
- Cobalt risk: skip-once/per-segment mode **LOW** (logic only; needs a 4-way choice control, and RF `choiceTools` already exists). Labels **MED** (injected CSS targeting obfuscated player DOM).
- Hook: RF sponsorblock.js `skipCurrentSegment()` (line 770) already has a per-video `skipped` map keyed by segment; extend it. Replace `enableSponsorBlock<Cat>` booleans with a mode, keeping backward-compat migration in config.js.

### Card 7. Higher-quality thumbnails
- Legacy: WB `thumbnail-quality.ts` (156 LOC): rewrites thumbnail URLs in `fetch`/XHR responses/DOM (`rewriteURL`, regex for `vi(_webp)?/<id>/<name>.jpg`) to `sddefault`, with a WebP feature test done by loading a data-URI `new Image()` (lines 1-33). NB version (1032 LOC) adds probing with HEAD requests, caching in localStorage, and `eager` mode (`maxresdefault`).
- Dependencies: config `upgradeThumbnails` (+ NB `thumbnailQualityMode`); hooks into response JSON or image `src`.
- Cobalt risk: **HIGH**. The WebP test uses `new Image()` / `<img>` and data-URIs; Cobalt may not expose `Image` the same way and its image pipeline is native with its own decode. The response-rewrite part (JSON thumbnail URLs) is portable, because RF already rewrites responses in a `JSON.parse` hook. Probing with HEAD requests increases network use on a weak TV CPU.
- Hook: could be done as an extra step in RF's `JSON.parse` hook (`adblock-preload.js` ~line 232-245); config `upgradeThumbnails`; skip the Image-based WebP probe and always assume jpg.

### Card 8. Hide / restyle YouTube logo
- Legacy: WB `ui.js` `initHideLogo()` (about 15 LOC, ui.js:238-258): injects a `<style>` with `ytlr-redux-connect-ytlr-logo-entity { visibility: hidden }`. NB `logo-style.js` (90 LOC) adds styles.
- Dependencies: config `hideLogo` (NB `logoStyle`); selector `ytlr-redux-connect-ytlr-logo-entity`; `<style>` injection.
- Cobalt risk: **LOW**. Uses CSS `visibility` only. Verify the element exists in Cobalt DOM and that Cobalt honours dynamically inserted `<style>` text (RF already imports CSS via webpack, so likely).
- Hook: config `hideLogo`, ui.js checkbox, small module in adblock-main.js.

### Card 9. Remove end screens / hide endcards
- Legacy: WB `remove-endscreen.ts` (34 LOC): wraps `JSON.parse`, deletes `res.endscreen` when it contains `endscreenRenderer`. NB `adblock.js` `removeEndcardsOptimized(data)` (line 905) does the same inside its schema filter (gate at line 575).
- Dependencies: config `removeEndscreen` / `hideEndcards`. No DOM, no CSS, no key.
- Cobalt risk: **LOW**. Pure JSON manipulation, same layer as RF's existing response filter. Caveat: Cobalt's own end-screen UI (`#creator-endscreen`, which RF's userScript.js touches) may come from a different data path, so test.
- Hook: add one branch to RF's JSON.parse hook in `adblock-preload.js`/`adblock.js`; config key; ui.js checkbox.

### Card 10. Guest mode: hide sign-in prompts
- Legacy: NB `adblock.js` `hasGuestPromptRenderer(item, hideGuestPrompts)` (line 790), applied in `processSectionListOptimized` and `filterItemsOptimized`; the menu shows the toggle only when `isGuestMode()` (NB ui.js:580). Config `hideGuestSignInPrompts`. About 30 LOC. `disablePromoUpsell` in NB auto-login.js (lines 77-135) is related.
- Dependencies: config key; renderer name checks in the JSON schema (see NB lines 57-95 for names).
- Cobalt risk: **LOW**. JSON filtering only. RF `auto-login.js` `isGuestMode()` (line 68) can gate the menu row.
- Hook: RF JSON.parse hook plus menu.

### Card 11. Menu themes
- Legacy: NB `ui.js` `applyTheme`/`toggleTheme` (lines 549-557, 1484-1490), `ui.css` (614 LOC) theme classes, three logo `<img>` elements (line 557).
- Dependencies: config `uiTheme`; CSS class toggle `theme-classic-red`.
- Cobalt risk: **LOW** if only recolouring via class toggles in RF ui.css (115 LOC). Drop the `<img>` logos (**HIGH** if kept).
- Hook: RF ui.css + a `choiceTools` row.

### Card 12. Programmable shortcuts (0-9, red, green, blue)
- Legacy: NB config.js `shortcutActions` (lines 41-60: refresh_page, chapter_skip, chapter_skip_prev, sb_skip_prev, seek_15_fwd/back, play_pause, toggle_subs, toggle_comments, toggle_description, save_to_playlist, oled_toggle, sb_manual_skip, config_menu), 13 keys `shortcut_key_<k>`, `shortcutCache`, 100 ms debounce (`shortcutDebounceTime`), executor around ui.js:1160-1330 (about 200 LOC), and a settings page of cycle controls. Some actions `sendKey()` synthetic key events or click DOM buttons using obfuscated selectors.
- Dependencies: config `shortcut_key_*`; keyCodes 48-57, 403/404/406; selectors for comments/description/playlist buttons.
- Cobalt risk: **MED**. Key capture is proven (RF uses it for 0, 1, 3, green). Actions that click YouTube DOM, or synthesize key events, are uncertain. `play_pause`, seek via `video.currentTime`, subtitles (already in RF) and the OLED toggle only need `<video>` or divs.
- Hook: replace `getPlaybackRateShortcut` and the subtitle branch in ui.js eventHandler (lines 719-752) with a lookup into `configRead('shortcut_key_<n>')`; add `choiceTools` rows. Keep defaults 0 = subtitles, 1 = speed down, 3 = speed up to preserve current behaviour.

### Card 13. Red-button display off + OLED keepalive / OLED care mode
- Legacy: NB `ui.js` `oled_toggle` action (lines 1169-1190): a fixed full-screen `#oled-black-overlay` div (z-index 9999, `#000`) and a `setInterval` keepalive that sends keys to prevent the screensaver; `enableOledCareMode` is a CSS block gated by `html.oled-theme-active` (ui.js:1343-1382, obfuscated class selectors). NB `screensaver-fix.js` (196 LOC) sends keepalive key bursts (keycodes 170/405) via `sendKey`.
- Dependencies: red key 403 / 166; config `enableOledCareMode`, `videoShelfOpacity`; synthetic key dispatch.
- Cobalt risk: **MED**. The black overlay is a single div (safe), but video on Cobalt/Starboard is often a punch-through plane under the DOM, so a DOM overlay may not cover it. The keepalive depends on webOS screensaver rules, and RF already forces the video element to window size to avoid the screensaver (adblock-main.js). The OLED CSS uses build-specific obfuscated class names, so skip it.
- Hook: red-key branch in ui.js eventHandler (keyCode 403), plus a small overlay module.

### Card 14. Lower-value / webOS-browser-specific extras (README omits most)
- NB `comments-fix.js` (141), `yt-fixes.js` (163, search-history fix), `emoji-font.js/css` (264), `force-codec.js` (357), `lang-settings-fix.ts`, `block-webos-cast.ts`, `perf_mon.js` (4626, debug), `polyfills.js` (596), `spatial-navigation*.js`. Config: `enableTrackingBlock`, `removeLiveVideos`, `removeTopLiveGames`, `removeMostRelevant`, `forcePreviews`, `removeBlackBorders`, `fixMultilineTitles`, `videoShelfOpacity`, `disableNotifications`.
- Cobalt risk: **HIGH** to port as-is. They patch problems of the webOS browser engine (emoji fonts, spatial navigation, cast prompts, description panel), which Cobalt's native app does not have. `removeLiveVideos`, `removeMostRelevant`, `removeTopLiveGames` and tracking block are JSON filters (**LOW**) and could be added to the RF response hook. `force-codec.js` is **HIGH** (Cobalt/Starboard picks codecs natively; RF docs/shared-starfish-av-backend.md covers decode paths).
- Hook: JSON-filter ones go in RF `adblock-preload.js`; CSS ones need device-side selector discovery.

## 5. Summary of RF1705 gaps
Missing: force max quality, audio-only, clock, thumbnails upgrade, logo hide, end-screen removal, segment list UI, highlight, skip-once, OLED/red button, themes, description/UI fixes, tracking and Live/shelf filters.
Partial: SponsorBlock categories (no highlight/chapter/mute, fixed colors, boolean modes only), guest mode (detects, no prompt hiding), shortcuts (hard-coded 0/1/3), autostart (docs only, OS-level).
Present: ad block, QR filter, SponsorBlock core, Shorts removal, account bypass, RYD, playback speed, subtitles key, startup page.
