/* ============================================================================
   ET covers: how an item looks in a list.

   Depends on: core.js. Generated cover art for anything without artwork,
   the publisher's cover laid over it when it loads, and the three shapes an
   item takes on a shelf: a row (library and search), a poster (home) and a
   thumbnail (the item page). Only pages that show items load this file.
   Keeps its pre-rebuild names: ET.row, ET.poster, ET.thumb, ET.typeIcon.
   ========================================================================= */

window.ET.module('ui/covers', ['core'], function (ET) {
  'use strict';

  var esc = ET.esc, scopedUrl = ET.scopedUrl, displayTitle = ET.displayTitle;

  /* Generated cover art, for everything DBS has no artwork for.

     A plain grey tile with an icon reads as "missing". Instead every item gets
     a cover of its own: a colour family by kind, shifted per title so a shelf
     of Bibles is not one repeated swatch, a large motif, and the title in its
     own script. It is CSS and a few SVG paths — no image to fetch, so it is
     there offline and on the first paint, and a real cover simply lands on
     top of it when one loads. */
  var COVER = {
    film:          [[292, 48, 22], [338, 55, 34]],
    scripture:     [[232, 45, 22], [258, 50, 34]],
    'audio-bible': [[186, 55, 18], [200, 60, 30]],
    audio:         [[26, 70, 22], [40, 78, 36]],
    historic:      [[32, 38, 20], [40, 45, 34]],
    link:          [[214, 25, 20], [222, 30, 32]]
  };
  var MOTIF = {
    // sunrise over hills
    film: '<circle cx="50" cy="58" r="20" fill="currentColor" opacity=".35"/>' +
          '<path d="M0 78 Q25 58 50 72 T100 66 V100 H0z" fill="currentColor" opacity=".28"/>' +
          '<path d="M0 88 Q30 74 60 86 T100 82 V100 H0z" fill="currentColor" opacity=".22"/>',
    // open book
    scripture: '<path d="M50 34 C38 26 22 26 12 30 V74 C22 70 38 70 50 78 C62 70 78 70 88 74 V30 C78 26 62 26 50 34z" ' +
               'fill="none" stroke="currentColor" stroke-width="3" opacity=".45"/>' +
               '<path d="M50 34 V78" stroke="currentColor" stroke-width="2.5" opacity=".45"/>' +
               '<path d="M20 40h20M20 48h20M20 56h16M60 40h20M60 48h20M60 56h16" stroke="currentColor" stroke-width="2" opacity=".3"/>',
    // book and sound
    'audio-bible': '<path d="M30 38 C24 34 16 34 10 36 V68 C16 66 24 66 30 70 C36 66 44 66 50 68 V36 C44 34 36 34 30 38z" fill="currentColor" opacity=".3"/>' +
                   '<path d="M62 40 Q70 52 62 64 M72 32 Q86 52 72 72 M82 24 Q102 52 82 80" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".42"/>',
    // sound waves
    audio: '<circle cx="50" cy="52" r="8" fill="currentColor" opacity=".45"/>' +
           '<circle cx="50" cy="52" r="20" fill="none" stroke="currentColor" stroke-width="3" opacity=".35"/>' +
           '<circle cx="50" cy="52" r="33" fill="none" stroke="currentColor" stroke-width="3" opacity=".24"/>' +
           '<circle cx="50" cy="52" r="46" fill="none" stroke="currentColor" stroke-width="3" opacity=".14"/>',
    // scroll
    historic: '<rect x="22" y="22" width="56" height="60" rx="3" fill="currentColor" opacity=".18"/>' +
              '<path d="M18 22h64M18 82h64" stroke="currentColor" stroke-width="6" stroke-linecap="round" opacity=".35"/>' +
              '<path d="M30 36h40M30 45h40M30 54h34M30 63h38" stroke="currentColor" stroke-width="2.2" opacity=".32"/>',
    // globe
    link: '<circle cx="50" cy="52" r="30" fill="none" stroke="currentColor" stroke-width="3" opacity=".4"/>' +
          '<ellipse cx="50" cy="52" rx="13" ry="30" fill="none" stroke="currentColor" stroke-width="2.5" opacity=".32"/>' +
          '<path d="M20 52h60M25 37h50M25 67h50" stroke="currentColor" stroke-width="2.2" opacity=".28"/>'
  };
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h;
  }
  function genCover(r, withTitle) {
    var ty = COVER[r.type] ? r.type : 'link';
    var c = COVER[ty], h = hash(r.id || r.title || '');
    var shift = (h % 40) - 20, angle = 130 + (h % 80);
    // The motif sits in the upper part, clear of the title, at a slight tilt
    // that differs per title so a shelf of one kind still varies.
    var tilt = ((h >> 8) % 17) - 8, size = withTitle ? .62 : .8;
    var off = (100 - 100 * size) / 2;
    var a = 'hsl(' + (c[0][0] + shift) + ' ' + c[0][1] + '% ' + c[0][2] + '%)';
    var b = 'hsl(' + (c[1][0] + shift) + ' ' + c[1][1] + '% ' + c[1][2] + '%)';
    var year = ty === 'historic' && r.year ? '<span class="gen-year">' + esc(r.year) + '</span>' : '';
    var glow = 'radial-gradient(circle at ' + (20 + h % 60) + '% ' + (10 + (h >> 4) % 30) + '%, rgba(255,255,255,.16), transparent 55%)';
    return '<span class="gen" style="background:' + glow + ',linear-gradient(' + angle + 'deg,' + a + ',' + b + ')" aria-hidden="true">' +
      '<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMin meet"><g transform="translate(' + off + ' ' + (withTitle ? 4 : off) + ') ' +
      'rotate(' + tilt + ' ' + (50 * size) + ' ' + (50 * size) + ') scale(' + size + ')">' + MOTIF[ty] + '</g></svg>' + year +
      (withTitle ? '<span class="gen-title" dir="auto">' + esc(displayTitle(r)) + '</span>' : '') +
      '</span>';
  }
  function artHTML(r, withTitle) {
    var art = r.cover || r.coverOnline;
    return genCover(r, withTitle) +
      (art ? '<img src="' + esc(art) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : '');
  }

  /* A row: artwork, what it is, what it is called, and one pill saying what a
     tap does. The library, the shelves and search all render the same one. */
  function row(r, action) {
    return '<a class="rowi" href="' + esc(scopedUrl('item.html', { id: r.id })) + '">' +
      '<span class="art">' + artHTML(r, false) + '</span>' +
      '<span class="meta">' +
        '<span class="kicker">' + esc(action.kicker) + '</span>' +
        '<span class="name" dir="auto">' + esc(displayTitle(r)) + '</span>' +
        '<span class="sub latin">' + esc(action.sub) + '</span>' +
      '</span>' +
      '<span class="go' + (action.tone ? ' go--' + action.tone : '') + '">' + esc(action.verb) + '</span></a>';
  }

  function poster(r, sub) {
    return '<a class="poster" href="' + esc(scopedUrl('item.html', { id: r.id })) + '">' +
      '<span class="art">' + artHTML(r, true) + '</span>' +
      '<span class="name" dir="auto">' + esc(displayTitle(r)) + '</span>' +
      (sub ? '<span class="sub">' + esc(sub) + '</span>' : '') + '</a>';
  }

  /* Artwork with a guaranteed fallback.

     Online-only resources carry the publisher's cover URL. With no connection
     that load fails, and a CSS background-image fails silently into an empty
     grey box. Instead the type icon is always drawn, and the cover is an <img>
     laid over it that removes itself on error — so offline the icon shows
     through, and online the artwork covers it. */
  function thumb(r, extraStyle) {
    return '<div class="thumb"' + (extraStyle ? ' style="' + extraStyle + '"' : '') + '>' +
      artHTML(r, false) + '</div>';
  }

  function typeIcon(t) {
    return { film: 'film', 'audio-bible': 'book', audio: 'wave',
             scripture: 'book', historic: 'scan', link: 'link' }[t] || 'link';
  }

  var api = { genCover: genCover, artHTML: artHTML, row: row, poster: poster, thumb: thumb, typeIcon: typeIcon };
  ET.row = row; ET.poster = poster; ET.thumb = thumb; ET.typeIcon = typeIcon;
  return api;
});
