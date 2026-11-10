// Unser eigener kleiner Otter – als SVG gezeichnet, damit er überall scharf ist.
// mood: 'normal' | 'happy' | 'sleepy'   hold: 'coin' | 'heart' | 'none'

const EYES = {
  normal: `<circle cx="82" cy="58" r="5.5" fill="#3b2418"/><circle cx="118" cy="58" r="5.5" fill="#3b2418"/>
    <circle cx="84" cy="56" r="1.8" fill="#fff"/><circle cx="120" cy="56" r="1.8" fill="#fff"/>`,
  happy: `<path d="M75 60q7-9 14 0M111 60q7-9 14 0" fill="none" stroke="#3b2418" stroke-width="3.2" stroke-linecap="round"/>`,
  sleepy: `<path d="M75 58q7 6 14 0M111 58q7 6 14 0" fill="none" stroke="#3b2418" stroke-width="3.2" stroke-linecap="round"/>`,
};

const HOLD = {
  coin: `<circle cx="100" cy="121" r="15" fill="#ffd166" stroke="#e0a82e" stroke-width="2.5"/>
    <text x="100" y="127.5" text-anchor="middle" font-size="18" font-weight="800" font-family="system-ui,sans-serif" fill="#a8741a">½</text>`,
  heart: `<path d="M100 134c-16-10-19-20-13-26 5-5 11-2 13 3 2-5 8-8 13-3 6 6 3 16-13 26z" fill="#ff7b7b" stroke="#e05a5a" stroke-width="2"/>`,
  none: '',
};

export function otter({ mood = 'normal', hold = 'coin', water = true, size = 120, cls = '' } = {}) {
  return `<svg class="otter ${cls}" width="${size}" height="${size * 0.85}" viewBox="0 0 200 170" aria-hidden="true">
  <ellipse cx="100" cy="128" rx="42" ry="38" fill="#9b6b4a"/>
  <ellipse cx="100" cy="134" rx="27" ry="28" fill="#f3dfc8"/>
  <circle cx="60" cy="34" r="11" fill="#7d5238"/><circle cx="60" cy="35" r="5.5" fill="#c9987a"/>
  <circle cx="140" cy="34" r="11" fill="#7d5238"/><circle cx="140" cy="35" r="5.5" fill="#c9987a"/>
  <ellipse cx="100" cy="62" rx="50" ry="41" fill="#9b6b4a"/>
  <ellipse cx="100" cy="73" rx="35" ry="26" fill="#f3dfc8"/>
  ${EYES[mood] || EYES.normal}
  <ellipse cx="70" cy="74" rx="8" ry="5" fill="#ff8f8f" opacity=".55"/>
  <ellipse cx="130" cy="74" rx="8" ry="5" fill="#ff8f8f" opacity=".55"/>
  <ellipse cx="100" cy="68" rx="7.5" ry="5.5" fill="#3b2418"/>
  <path d="M100 73v4M100 77q-6 7-12 1M100 77q6 7 12 1" fill="none" stroke="#3b2418" stroke-width="2.4" stroke-linecap="round"/>
  ${mood === 'sleepy' ? '<text x="150" y="30" font-size="20" font-weight="800" font-family="system-ui,sans-serif" fill="#7fb8c4">z</text><text x="164" y="16" font-size="14" font-weight="800" font-family="system-ui,sans-serif" fill="#7fb8c4">z</text>' : ''}
  ${HOLD[hold] || ''}
  ${hold === 'none' ? '' : '<ellipse cx="80" cy="120" rx="10" ry="7.5" fill="#7d5238" transform="rotate(-25 80 120)"/><ellipse cx="120" cy="120" rx="10" ry="7.5" fill="#7d5238" transform="rotate(25 120 120)"/>'}
  ${water ? `<path d="M22 150q13-10 26 0t26 0 26 0 26 0 26 0 26 0v20H22z" fill="#8fd3dc"/>
  <path d="M30 158q10-6 20 0t20 0M118 160q10-6 20 0t20 0" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>` : ''}
</svg>`;
}
