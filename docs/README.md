# EasyTransfer docs

Start here. The repo README covers what EasyTransfer is and how to run it in a
minute; this folder holds everything else, grouped by who reads it.

| Folder | For | What is in it |
|---|---|---|
| [architecture/](architecture/) | Developers | How the app, the packer and the servers fit together, and the rules every change keeps |
| [decisions/](decisions/) | Developers, future maintainers | One short record per architectural decision, with the reason and the status |
| [guides/](guides/) | Whoever does the task | Step-by-step recipes: adding a language, adding a screen, testing, the release checklist, and more as the rebuild lands |
| [design/](design/) | Designers, developers | Tokens, components, motion and Kandili the mascot; the live style guide is `/styleguide.html` |
| [conventions.md](conventions.md) | Anyone writing code | Naming, file headers, size limits, the release checklist |
| [FIELD-GUIDE.md](FIELD-GUIDE.md) | VillageServer volunteers | Handing a card to someone, in person |
| [TRANSLATION-HANDOFF.md](TRANSLATION-HANDOFF.md) | Translators and reviewers | Terminology and status of each interface language |
| [how-it-works.html](how-it-works.html) | Partners | A one-page visual explainer |

## Coming with the rebuild

The front end is being rebuilt on a modular structure (see
[decision 0001](decisions/0001-rebuild-scope.md)). These folders arrive with
their workstreams:

- `board/`: a one-page overview, the architecture picture and a demo script
  for funders.
- `field/`: the field guide and translation hand-off move here once nothing
  links to their current paths.

## Keeping docs true

A doc that is wrong is worse than none. When a change alters something written
here, the same pull request updates the doc. Decision records are never edited
to say something new: a later record supersedes them.
