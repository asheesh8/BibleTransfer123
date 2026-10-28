/* ============================================================================
   ET.ui.icon: the icon set, as inline stroke SVG.

   Depends on: nothing. One 24 px grid, 2 px round strokes, currentColor, so
   an icon takes the colour and size of the text beside it. Icons are always
   decorative (aria-hidden): the word next to them carries the meaning for a
   screen reader. Icons that point (back, next) carry .et-flip so they turn
   round in right-to-left pages.

     ET.ui.icon('play')            -> '<svg class="et-icon" …>'
     ET.ui.icon('back', 'et-flip')

   Paths for the shared names match core.js icon() so old and new screens
   look the same during the migration.
   ========================================================================= */

(function (ET) {
  'use strict';

  var P = {
    play:     '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
    pause:    '<path d="M8 5v14M16 5v14"/>',
    save:     '<path d="M12 4v11"/><path d="M7 10.5l5 5 5-5"/><path d="M5 19.5h14"/>',
    share:    '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>',
    qr:       '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2"/>',
    scan:     '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M4 12h16"/>',
    check:    '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    close:    '<path d="M6 6l12 12M18 6L6 18"/>',
    search:   '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    back:     '<path d="M15 5l-7 7 7 7"/>',
    next:     '<path d="M9 5l7 7-7 7"/>',
    home:     '<path d="M4 11l8-7 8 7"/><path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9"/>',
    library:  '<rect x="4" y="4" width="4" height="16" rx="1"/><rect x="10" y="4" width="4" height="16" rx="1"/><path d="M16.5 5.2l3.3-.9 3 14.5-3.3.9z"/>',
    film:     '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4"/>',
    audio:    '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4.5" height="6" rx="1.5"/><rect x="16.5" y="14" width="4.5" height="6" rx="1.5"/>',
    book:     '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>',
    phone:    '<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/>',
    wifi:     '<path d="M4.5 9.5a12 12 0 0 1 15 0"/><path d="M7.5 13a8 8 0 0 1 9 0"/><path d="M10.5 16.5a3.5 3.5 0 0 1 3 0"/><circle cx="12" cy="20" r="1"/>',
    offline:  '<path d="M4.5 9.5a12 12 0 0 1 4-2.2M19.5 9.5a12 12 0 0 0-6.4-2.4"/><path d="M7.5 13a8 8 0 0 1 3-1.3"/><circle cx="12" cy="20" r="1"/><path d="M3 3l18 18"/>',
    globe:    '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z"/>',
    sun:      '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/>',
    moon:     '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
    help:     '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .9-1 1.6v.6"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
    copy:     '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
    mail:     '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
    folder:   '<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    heart:    '<path d="M12 19.5s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.4-7.5 10-7.5 10z"/>',
    nearby:   '<circle cx="12" cy="12" r="2"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>',
    warn:     '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.2v.1"/>'
  };

  function icon(name, cls) {
    return '<svg class="et-icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" focusable="false">' + (P[name] || P.help) + '</svg>';
  }

  // Fill every <i data-icon="name"> placeholder in a subtree.
  function hydrate(root) {
    var els = (root || document).querySelectorAll('i[data-icon]');
    for (var i = 0; i < els.length; i++) {
      els[i].outerHTML = icon(els[i].getAttribute('data-icon'), els[i].className);
    }
  }

  ET.ui = ET.ui || {};
  ET.ui.icon = icon;
  ET.ui.icon.names = Object.keys(P);
  ET.ui.icons = { hydrate: hydrate };
})(window.ET = window.ET || {});
