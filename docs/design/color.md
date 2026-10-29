# Colour plan

The library is read outdoors, on shared and cracked phones, by people who may
be reading slowly. Colour has to do two jobs there: make the next tap obvious,
and tell kinds of things apart at a glance. Everything else is quiet.

This plan came out of a review of the "Sunrise" theme against a common list of
things that make a site look machine-made: harsh two-colour gradients, violet
on near-black, a rainbow of button colours, glowing radial orbs, coloured
stripes down the side of cards, pastel on pastel. The old theme had most of
them. The values below replace it in `app/assets/css/app.css` (the live pages)
and `app/assets/css/tokens.css` (the `--et-` kit). Old variable names are kept
so nothing breaks: read `--purple` as "brand" and `--sky` as "teal".

## 60 · 30 · 10

| Share | Role | Light | Dark |
|---|---|---|---|
| 60 | Ground: warm paper | `#FBF7F1` | `#1A1316` |
| 60 | Cards: a step lighter, never stark white | `#FFFDF9` | `#231B1E` |
| 30 | Ink: cocoa, not violet-black | `#2A1E22` | `#F7EFE7` |
| 30 | Brand: lantern-lit plum (`--purple`) | `#7A2C5E` | `#D88AB9` |
| 10 | Gold: Share and the one thing we most want tapped | `#FFBE1A` | `#F5BC45` |

Gold is rare on purpose. If two gold things are on one screen, one of them is
wrong.

## One colour per kind, the same on every screen

| Kind | Colour | Light | Dark |
|---|---|---|---|
| Films | clay (`--clay`) | `#B04E2A` | `#F09C76` |
| Scripture | plum (`--purple`) | `#7A2C5E` | `#D88AB9` |
| Audio Bibles and audio | teal (`--sky`) | `#1C6B6A` | `#74C6BF` |
| Books and guides | gold (`--gold`) | `#FFBE1A` | `#F5BC45` |

The four hues sit at matched strength (similar lightness and saturation), which
is what lets them share a screen without shouting. Home quick picks, Library
kind tiles, Home shelf icons and generated covers all use this table. Before
this pass the same kind had a different colour on each of those screens.

## Verbs

Watch, Listen, Read and Save are all the brand plum. The word tells them apart;
a list of rows with four different pill colours reads as noise. Share is gold.
WhatsApp keeps its green and Facebook its blue, because people look for those.

## Status

Green (`#2B7A4B` / `#77C994`) means done, saved or works offline, nothing else.
Red is for errors only.

## Rules

- Gradients only within one hue (gold fading into paper), never two hues.
- No glow orbs or radial highlights. Generated covers are one hue getting
  deeper, with no white "shine".
- Notes are a whole soft tint with a matching border, not a stripe on one side.
- Depth comes from the ledge under a pressable control and the paper/card
  step. Shadows are faint and tinted with the ink, never purple or grey.
- Celebrations use the lantern's own colours (gold, clay, glow), not confetti
  in every colour.
- Every text/ground pair is at least 4.5:1 in both themes. Dark-theme buttons
  have pale faces with near-black words (`--on-face`, `--on-gold`).
- Kandili's colours (`--et-k-*`, `brand/mascot.js`) are fixed and are not part
  of this plan.

## Contrast (checked)

Light: ink on ground 15.1:1, soft ink 6.5:1, plum 8.4:1, white on plum 8.9:1,
white on clay 5.3:1, white on teal 6.3:1, dark words on gold 8.7:1, clay text
on its wash 5.3:1, teal text on its wash 6.0:1.

Dark: ink on ground 16.1:1, soft ink 8.3:1, plum 7.2:1, dark words on plum
7.1:1, on gold 10.4:1, on teal 9.1:1, on clay 8.3:1.

## Native apps

The iPhone and Android shells should use the same values: status bar and
splash background `#FBF7F1` (dark `#1A1316`), accent `#7A2C5E`, and gold only
for Share. `theme-color` in every page and in `manifest.webmanifest` is the
brand plum `#7A2C5E`.
