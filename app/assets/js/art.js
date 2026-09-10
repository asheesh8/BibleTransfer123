/* ============================================================================
   Illustrations.

   Drawn as inline SVG rather than generated raster art, for reasons that are
   practical before they are aesthetic:

   · The whole set is about 4 KB. Generated art would be megabytes, on a card
     where every megabyte is a chapter of something that did not fit.
   · They use the stylesheet's own custom properties, so they follow light and
     dark instead of shipping two copies of each.
   · They are identical on every card and cost nothing to rebuild.
   · They stay sharp on a 4-inch phone and a projector.

   The mascot is a lantern — نور, "light". It is the one image in the app that
   carries any warmth, so it appears on the home screen and nowhere else, which
   is what keeps it warm rather than decorative.
   ========================================================================= */

(function (ET) {
  'use strict';

  function svg(w, h, body, label) {
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" ' +
      'style="max-width:' + w + 'px;height:auto;margin:0 auto;display:block" ' +
      (label ? 'role="img" aria-label="' + ET.esc(label) + '"' : 'aria-hidden="true"') +
      '>' + body + '</svg>';
  }

  /* The lantern itself, at whatever size. Shared by the mascot and the header. */
  function lanternBody(x, y, s) {
    var g = 'translate(' + x + ',' + y + ') scale(' + s + ')';
    return '<g transform="' + g + '">' +
      '<path d="M18 6h12a2 2 0 0 1 0 4H18a2 2 0 0 1 0-4z" fill="var(--gold-deep)"/>' +
      '<path d="M24 0v6" stroke="var(--gold-deep)" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M14 12h20l3 22a5 5 0 0 1-5 5.6H16A5 5 0 0 1 11 34z" fill="var(--gold)"/>' +
      '<path d="M17 15h14l2.2 17a3 3 0 0 1-3 3.4H17.8a3 3 0 0 1-3-3.4z" fill="var(--gold-wash)"/>' +
      '<ellipse cx="24" cy="27" rx="5.2" ry="6.6" fill="var(--gold)"/>' +
      '<circle cx="21.5" cy="25" r="1.5" fill="var(--purple-deep)"/>' +
      '<circle cx="26.5" cy="25" r="1.5" fill="var(--purple-deep)"/>' +
      '<path d="M21.7 29.6a3.2 3.2 0 0 0 4.6 0" stroke="var(--purple-deep)" ' +
      'stroke-width="1.6" stroke-linecap="round" fill="none"/>' +
      '<path d="M12 41h24" stroke="var(--gold-deep)" stroke-width="3.4" stroke-linecap="round"/>' +
      '</g>';
  }

  /* Home: the lantern, its light, and three things the light falls on —
     a film, a book, a sound. The whole library in one picture. */
  function home() {
    return svg(300, 190,
      // glow
      '<circle cx="150" cy="86" r="74" fill="var(--gold-wash)" opacity=".55"/>' +
      '<circle cx="150" cy="86" r="52" fill="var(--gold-wash)"/>' +
      // rays
      '<g stroke="var(--gold)" stroke-width="3.4" stroke-linecap="round" opacity=".6">' +
      '<path d="M150 24L150 13M192 42L200 34M210 84L221 84M192 126L200 134M150 144L150 155M108 126L100 134M90 84L79 84M108 42L100 34"/></g>' +
      lanternBody(119, 53, 1.3) +
      // film card
      '<g transform="translate(28,96)">' +
      '<rect width="58" height="46" rx="10" fill="var(--surface)" ' +
      'stroke="var(--line-strong)" stroke-width="2.5"/>' +
      '<rect x="12" y="12" width="34" height="22" rx="4" fill="var(--purple-wash)"/>' +
      '<path d="M25 18l12 7-12 7z" fill="var(--purple)"/></g>' +
      // book card — an open book: two leaves meeting at a spine. Fine interior
      // ruling disappears at this size, so there is none.
      '<g transform="translate(121,112)">' +
      '<rect width="58" height="46" rx="10" fill="var(--surface)" ' +
      'stroke="var(--line-strong)" stroke-width="2.5"/>' +
      '<path d="M13 14h14a2 2 0 0 1 2 2v17H15a2 2 0 0 1-2-2z" fill="var(--purple-wash)" ' +
      'stroke="var(--purple)" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<path d="M45 14H31a2 2 0 0 0-2 2v17h12a2 2 0 0 0 2-2z" fill="var(--purple-wash)" ' +
      'stroke="var(--purple)" stroke-width="2.4" stroke-linejoin="round"/></g>' +
      // audio card
      '<g transform="translate(214,96)">' +
      '<rect width="58" height="46" rx="10" fill="var(--surface)" ' +
      'stroke="var(--line-strong)" stroke-width="2.5"/>' +
      '<g stroke="var(--purple)" stroke-width="3" stroke-linecap="round">' +
      '<path d="M17 23h0M23 18v10M29 13v20M35 18v10M41 23h0"/></g></g>',
      'A lantern lighting a film, a book and a recording');
  }

  /* Share: light crossing from one phone to another. The arc is the point —
     the thing being handed over is the light, not the file. */
  function share() {
    return svg(300, 150,
      '<g transform="translate(18,26)">' +
      '<rect width="72" height="104" rx="14" fill="var(--surface)" ' +
      'stroke="var(--line-strong)" stroke-width="3"/>' +
      '<rect x="10" y="12" width="52" height="68" rx="7" fill="var(--purple-wash)"/>' +
      lanternBody(19, 26, 0.7) +
      '<rect x="27" y="88" width="18" height="4" rx="2" fill="var(--line-strong)"/></g>' +
      // the arc
      '<path d="M104 62q46-40 92 0" stroke="var(--gold)" stroke-width="4" ' +
      'stroke-linecap="round" stroke-dasharray="2 11" fill="none"/>' +
      '<circle cx="150" cy="44" r="9" fill="var(--gold)"/>' +
      '<circle cx="150" cy="44" r="16" fill="var(--gold)" opacity=".25"/>' +
      '<g transform="translate(210,26)">' +
      '<rect width="72" height="104" rx="14" fill="var(--surface)" ' +
      'stroke="var(--line-strong)" stroke-width="3"/>' +
      '<rect x="10" y="12" width="52" height="68" rx="7" fill="var(--gold-wash)"/>' +
      '<path d="M24 46l10 10 18-20" stroke="var(--green)" stroke-width="5" ' +
      'stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
      '<rect x="27" y="88" width="18" height="4" rx="2" fill="var(--line-strong)"/></g>',
      'Light passing from one phone to another');
  }

  /* Empty search: the lantern looking, and not finding. Deliberately not sad —
     a dead end should read as "try again", not "you did something wrong". */
  function empty() {
    return svg(220, 130,
      '<circle cx="110" cy="62" r="46" fill="var(--sunk)"/>' +
      lanternBody(86, 34, 0.95) +
      '<g stroke="var(--line-strong)" stroke-width="4" fill="none" ' +
      'stroke-linecap="round"><circle cx="168" cy="46" r="17"/>' +
      '<path d="M180 58l12 12"/></g>',
      'Nothing found');
  }

  ET.art = { home: home, share: share, empty: empty, lanternBody: lanternBody };
})(window.ET);
