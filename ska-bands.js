(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SkaBands = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // El primer instrument obre la cançó. Els altres es poden rellevar a l'estrofa,
  // la tornada i el solo. Els contratemps i la sala formen part del so del grup.
  const profiles = {
    hammond: { name: 'Quartet de Hammond', genres: ['jamaican', 'rocksteady', 'bossreggae'], leads: ['organ'], reply: 'guitar3',
      drums: 'club', bass: 'finger', groove: [3, 6, 0], cymbals: 'hats', push: 'anticipa', guitarMs: 19, bassMs: 7, stroke: 1.16, room: .62, saturation: .95 },
    street: { name: 'Banda de carrer', genres: ['jamaican', 'twotone', 'nutty', 'skaswing'], leads: ['trombone', 'sax'], dialogue: true,
      drums: 'real', bass: 'finger', groove: [6, 5, 0], push: 'puja', guitarMs: 2, stroke: .86, room: 1.16 },
    angular: { name: '2-tone nerviós', genres: ['twotone', 'nutty', 'skapunk'], leads: ['sax'], bassReply: true,
      drums: 'real', bass: 'pick', groove: [0, 2, 1], cymbals: 'hats', push: 'buit', guitarMs: -17, bassMs: -4, stroke: .72, windLength: .76, room: .40, saturation: 1.2 },
    orchestra: { name: 'Orquestra de ball', genres: ['jamaican', 'nutty', 'skaswing'], leads: ['trumpet', 'sax', 'trombone'], keys: 'piano', chorus: true, doubles: 'chorus',
      drums: 'jazz', bass: 'finger', groove: [7, 5, 0], push: 'puja', guitarMs: 5, room: 1.20 },
    dub: { name: 'Trio de dub', genres: ['bossreggae', 'rocksteady'], leads: ['organ'], drums: 'lofi', bass: 'growly',
      groove: [1, 1, 2], cymbals: 'hats', push: 'buit', guitarMs: 23, bassMs: 13, stroke: 1.32, room: 1.40, saturation: .72 },
    rocksteady: { name: 'Combo rocksteady', genres: ['rocksteady', 'bossreggae', 'jamaican'], leads: ['piano', 'trombone'], keys: 'organ',
      drums: 'club', bass: 'finger', groove: [3, 6, 2], cymbals: 'hats', push: 'anticipa', guitarMs: 17, bassMs: 12, windLength: 1.08, room: .68 },
    muted: { name: 'Trompeta amb sordina', genres: ['jamaican', 'rocksteady', 'bossreggae', 'skaswing'], leads: ['trumpet', 'organ'], keys: 'organ',
      trumpet: 'muted', drums: 'brush', bass: 'finger', groove: [3, 3, 2], cymbals: 'hats', push: 'anticipa', guitarMs: 10, room: .78 },
    jump: { name: 'Combo de jump blues', genres: ['skaswing', 'nutty'], leads: ['piano', 'sax'], dialogue: true,
      drums: 'jazz', bass: 'finger', groove: [7, 5, 0], swing: .55, push: 'puja', guitarMs: 8, bassMs: 1, room: .95 },
    piano: { name: 'Piano de taverna', genres: ['nutty', 'twotone', 'skaswing'], leads: ['piano'], reply: 'trombone', keys: 'piano',
      drums: 'room', bass: 'pick', groove: [6, 3, 1], push: 'buit', guitarMs: -6, windLength: .79, room: .63 },
    surf: { name: 'Quartet de guitarra surf', genres: ['jamaican', 'twotone', 'nutty', 'skapunk'], leads: ['guitar3'], keys: 'organ', guitarLead: 'direct',
      drums: 'room', bass: 'pick', groove: [0, 4, 1], push: 'anticipa', guitarMs: -5, stroke: 1.12, room: 1.32 },
    skaJazz: { name: 'Sextet de ska-jazz', genres: ['skaswing', 'jamaican', 'nutty'], leads: ['sax', 'trumpet'], keys: 'piano', dialogue: true, trumpet: 'bright',
      drums: 'jazz', bass: 'finger', groove: [7, 5, 2], swing: .51, push: 'puja', guitarMs: 11, windLength: 1.1, room: .74, saturation: .68 },
    steppers: { name: 'Steppers amb trombó', genres: ['bossreggae', 'rocksteady'], leads: ['trombone', 'organ'], keys: 'organ',
      drums: 'lofi', bass: 'growly', groove: [2, 4, 0], push: 'anticipa', guitarMs: 14, bassMs: 10, stroke: 1.36, windLength: 1.12, room: 1.29 },
    brassPunk: { name: 'Ska-punk de metalls', genres: ['skapunk', 'twotone'], leads: ['trumpet', 'trombone', 'sax'], chorus: true, doubles: 'chorus', heavy: true,
      drums: 'rusty', bass: 'pick', groove: [4, 4, 3], push: 'buit', guitarMs: -8, bassMs: -3, stroke: .82, windLength: .83, room: .80, saturation: 1.12 },
    garage: { name: 'Ska de garatge', genres: ['skapunk', 'twotone', 'nutty'], leads: ['guitar3', 'organ'], keys: 'organ', guitarLead: 'dist1', heavy: true,
      drums: 'rusty', bass: 'growly', groove: [5, 2, 4], cymbals: 'hats', push: 'buit', guitarMs: -10, bassMs: 3, stroke: .78, room: .53, saturation: 1.2 },
    rockers: { name: 'Rockers de saxo tenor', genres: ['bossreggae', 'rocksteady', 'jamaican'], leads: ['sax'], keys: 'organ',
      drums: 'real', bass: 'growly', groove: [8, 6, 2], push: 'anticipa', guitarMs: 15, bassMs: 16, stroke: 1.14, windLength: 1.10, room: .98 },
    dancehall: { name: 'Combo de sala de ball', genres: ['skaswing', 'nutty', 'twotone'], leads: ['trombone', 'piano', 'trumpet'], keys: 'piano', dialogue: true,
      drums: 'room', bass: 'pick', groove: [6, 0, 1], push: 'puja', guitarMs: 0, bassMs: 2, room: 1.06 }
  };

  const get = id => typeof id === 'string' && Object.hasOwn(profiles, id) ? profiles[id] : undefined;
  function choose(genre, recent, random) {
    const candidates = Object.keys(profiles).filter(id => profiles[id].genres.includes(genre));
    const history = recent.filter(entry => get(entry?.bandProfile)).map(entry => entry.bandProfile);
    const fresh = candidates.filter(id => !history.includes(id));
    if (!fresh.length) return candidates.sort((a, b) => history.indexOf(b) - history.indexOf(a))[0];
    // Entre formacions noves, prioritzem les que canvien de solista respecte a l'última.
    const last = get(history[0]);
    const contrast = fresh.filter(id => profiles[id].leads[0] !== last?.leads[0]);
    const pool = contrast.length ? contrast : fresh;
    return pool[Math.floor(random() * pool.length)];
  }
  return { get, choose };
});
