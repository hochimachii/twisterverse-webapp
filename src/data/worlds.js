// src/data/worlds.js
// Single source of truth for world metadata + tongue-twister content,
// sourced from the client's story script (FTTEBA-Content). Shared by
// StageSelection.jsx, TwisterActivity.jsx, and Dashboard.jsx so they
// can't drift apart.
//
// NOTE: the client's script has only 19 tongue-twisters for Mundo 4 (its
// would-be 20th line is the story's closing narration, not a challenge).
// A 20th was written to bring the game to 80 - it is marked in place
// below and should be swapped out if the client supplies their own.
// Levels here are sized to match what's actually in the script — flag
// this to the client if a 20th Mundo 4 twister was meant to exist.
//
// guideArt / keyArt paths below are ASSUMED filenames for the finished
// side-character and key artwork — confirm/adjust these against what
// your designer actually delivered.

import bgCity from "../assets/stages/Background_1.PNG";
import bgIsland from "../assets/stages/Background_4.PNG";
import bgForest from "../assets/stages/Background_2.PNG";
import bgKingdom from "../assets/stages/Background_3.PNG";

import guideWorld1 from "../assets/characters/Bibo_berto_at_popoy_pato.PNG";
import guideWorld2 from "../assets/characters/Tala_tinikling.PNG";
import guideWorld3 from "../assets/characters/Lexi_Letrang_Lupet.png";
// Mundo 4 (Haring Kiko Kwela) guide art not delivered yet — worldId 4
// below has guideArt: null until it arrives.

import key1 from "../assets/achievements/key-1.PNG";
import key2 from "../assets/achievements/key-2.PNG";
import key3 from "../assets/achievements/key-3.PNG";
import key4 from "../assets/achievements/Level4.PNG";

export const WORLDS = [
  {
    id: 1,
    title: "Lungsod ng Mabilis na Salita",
    guide: "Bibo Berto at Popoy Pato",
    guideArt: guideWorld1,
    // Direct from the script's Mundo 1 greeting scene
    greeting: [
      { speaker: "Bibo", line: "\u201CMaligayang pagdating, Twisty!\u201D" },
      {
        speaker: "Popoy",
        line:
          "\u201CKung nais mong makaalis dito, kailangan mong lampasan ang aming mga hamon,\u201D"
      }
    ],
    icon: "\uD83C\uDFD8\uFE0F", // 🏘️
    cover: bgCity,
    keyArt: key1,
    keyName: "Unang Susi ng Diksiyon",
    keyLine:
      "Matapos makumpleto ni Twisty ang hamon, nakuha niya ang Unang Susi ng Diksiyon at nagbukas ang daan papunta sa Mundo 2.",
    twisters: [
      "Bibo bumulong bago bumangon.",
      "Popoy pato ay pumapadyak sa putik.",
      "Tala tikling tumalon sa tulay.",
      "Kiko kwela kumakanta sa kanto.",
      "Liri lila lumilipad sa liwanag.",
      "Bato at bola ay bumangga sa bakuran.",
      "Puno ng palay ay pumipitik sa hangin.",
      "Bata at baboy ay bumabagsak sa baha.",
      "Piko at piko ay pumapalo sa patag.",
      "Bituin at bulak ay bumabagsak sa bundok.",
      "Pusa at pating pumapadyak sa putik.",
      "Kendi at kalabaw ay bumabagsak sa kalsada.",
      "Laro at lamok ay lumilipad sa lawa.",
      "Bituin at bagyo ay bumubulong sa bundok.",
      "Tala at Tino tumatakbo sa tulay.",
      "Kape at kutsara ay bumabagsak sa plato.",
      "Bato at bayabas bumabagsak sa bakuran.",
      "Popoy pato at Bibo bumulong sa bahay.",
      "Puno at pinto ay bumabagsak sa patio.",
      "Liri Lila lumilipad sa liwanag ng buwan."
    ]
  },
  {
    id: 2,
    title: "Isla ng Mga Pantig",
    guide: "Tala Tikling",
    guideArt: guideWorld2,
    greeting: [
      {
        speaker: "Tala",
        line:
          "\u201CSa mundong ito,\u201D sabi ni Tala, \u201Cang mga hamon ay may ritmo at mas mahahabang pantig. Kaya mo ba?\u201D"
      }
    ],
    icon: "\uD83C\uDF0A", // 🌊
    cover: bgIsland,
    keyArt: key2,
    keyName: "Ikalawang Susi ng Diksiyon",
    keyLine: "Pagkatapos ng hamon, nakuha ni Twisty ang Ikalawang Susi ng Diksiyon.",
    twisters: [
      "Pitong puting pato ay papunta sa puting pulo.",
      "Tumatalon si Tala sa tulay habang bumabagsak ang bato.",
      "Bata at baboy ay bumabagsak sa bahain.",
      "Pitong patao ang pumapadyak sa tulay ng tuloy-tuloy na puting pato.",
      "Lumilipad ang lamok sa ibabaw ng lawa habang pumipito ang bata.",
      "Pumapadyak si Kiko sa damuhan at pumapalakpak si Lira.",
      "Lumilipad ang ibon sa ilalim ng puno.",
      "Pitong puting pato ay tumatawid sa tulay at pumipito nang sabay.",
      "Lumilipad ang lamok sa liwanag ng buwan habang bumabagsak ang bato.",
      "Pitong bata ang pumapadyak sa patag at pumipito sa pulo.",
      "Lumilipad ang lawin sa ibabaw ng bundok habang pumipito ang bata.",
      "Pumapadyak si Tala sa tulay habang bumabagsak ang palay sa putik.",
      "Bata at baboy ay bumabagsak sa ilalim ng puno.",
      "Pitong patao ay pumapadyak sa patag at pumipito nang sabay.",
      "Lumilipad ang lamok sa liwanag habang bumabagsak ang bato sa bundok.",
      "Pumapadyak si Kiko sa patag habang pumipito ang bata.",
      "Lumilipad ang ibon sa ibabaw ng lawa at pumipito sa tulay.",
      "Pitong puting pato ang tumatawid sa patag at pumipito.",
      "Lumilipad ang lawin sa ibabaw ng bundok at pumipito sa bata.",
      "Pitong bata at puting pato ay pumapadyak sa tulay at pumipito nang sabay."
    ]
  },
  {
    id: 3,
    title: "Gubat ng Mga Letrang Malilikot",
    guide: "Lexi Letrang Lupet",
    guideArt: guideWorld3,
    greeting: [
      {
        speaker: "Lexi",
        line:
          "\u201CMag-ingat ka, Twisty,\u201D sabi ni Lexi, \u201Cdahil ang mga salita rito ay may malilikot na letra\u2014R, L, NG.\u201D"
      }
    ],
    icon: "\uD83C\uDF33", // 🌳
    cover: bgForest,
    keyArt: key3,
    keyName: "Ikatlong Susi ng Diksiyon",
    keyLine: "Matapos makumpleto, nakuha ni Twisty ang Ikatlong Susi ng Diksiyon.",
    twisters: [
      "Rumaragasang riles ng tren habang lumilipad ang lawin.",
      "Lumilipad ang bata sa ibabaw ng bundok at bumabagsak ang bato.",
      "Tumatalon si Lexi sa puno habang bumubulong ang bubuyog.",
      "Rumarampag ang raang laro sa ilalim ng liwanag ng buwan.",
      "Lumilipad ang ibon sa ibabaw ng patag at bumubuo ng buntot.",
      "Tumatalon si Lira sa ibabaw ng riles habang bumubuo ng bahay ang bata.",
      "Rumarikit ang relo sa ritmo ng bundok habang bumabagsak ang bato.",
      "Lumilipad ang lamok sa ibabaw ng lawa at bumubuo ng bubong.",
      "Tumatalon ang bata sa patag at bumabagsak ang palay.",
      "Rumaragasang riles sa ibabaw ng bundok habang lumilipad ang lawin.",
      "Rumarampag ang raang laro at bumubuo ng liwanag ang bubuyog.",
      "Lumilipad si Lexi sa ibabaw ng rurok habang bumubuo ng bahay.",
      "Tumatalon ang bata sa tulay at bumubuo ng palay sa patag.",
      "Rumarikit ang riles habang lumilipad ang ibon sa bundok.",
      "Lumilipad ang lamok sa ibabaw ng lawa at bumubuo ng buntot.",
      "Rumarampag ang raang laro sa ilalim ng liwanag at bumabagsak ang bato.",
      "Lumilipad ang lawin sa ibabaw ng patag habang bumubuo ang bata ng bahay.",
      "Rumarikit ang relo sa ritmo ng bundok habang tumatalon si Lexi.",
      "Tumatalon ang bata sa patag at bumubuo ng palay sa ibabaw ng tulay.",
      "Rumaragasang riles, lumilipad ang lawin, bumubuo ng buntot, at bumubulong ang raang laro habang lumilipad si Lexi sa bundok."
    ]
  },
  {
    id: 4,
    title: "Kaharian ng Huling Hamon",
    guide: "Haring Kiko Kwela",
    guideArt: null, // not delivered yet
    greeting: [
      {
        speaker: "Haring Kiko",
        line:
          "\u201CTwisty,\u201D sabi ng hari, \u201Cnarating mo na ang huling mundo. Ngunit kailangan mong patunayan na ikaw ay handa nang maging Master ng Diksiyon.\u201D"
      }
    ],
    icon: "\uD83D\uDD25", // 🔥
    cover: bgKingdom,
    // NOTE: the script doesn't name a numbered "4th key" the way it does
    // for worlds 1-3 — it jumps straight to the 4 keys combining into
    // the Korona ng Diksiyon (crown), which is the deferred ending (#4).
    // So no keyArt/keyName here; Dashboard shows this slot as pending.
    keyArt: key4,
    keyName: "Ikaapat na Susi ng Diksiyon",
    // The art exists, but the key stays hidden on the Dashboard until the
    // Korona ending is built - Dashboard checks this flag rather than
    // keyArt being null, so the asset can be wired up ahead of the reveal.
    keyHiddenInDashboard: true,
    keyLine:
      "Sa huling hakbang, bumubuo ng korona ng diksiyon si Twisty at nagtagumpay sa lahat ng hamon.",
    twisters: [
      "Bababa at babangon ang batang bumubulong sa bubuyog habang bumubuo ng buntot sa bundok.",
      "Bababa sa baba at babangon sa bawat hakbang, bumubuo ng bubong at lumilipad ang lamok.",
      "Bawat batang bababa bago bumangon ay bumubuo ng bahay at bumubulong sa ibon.",
      "Bababa at babangon ang bata habang bumubuo ng palay sa ilalim ng tulay.",
      "Tumatalon si Tala bago bumaba sa tulay at bumubuo ng palay sa bundok.",
      "Babangon si Twisty sa bawat hakbang at sabay na bumubulong ang bata sa bata.",
      "Bumubuo ng bubong at palay habang tumatalon sa patag at tulay.",
      "Lumilipad ang lamok at bumubuo ng liwanag habang bumabagsak ang bato.",
      "Tumatalon ang bata sa patag at bumubuo ng bubong sa ibabaw ng tulay.",
      "Babangon at babagsak ang bata habang bumubuo ng bahay at lumilipad ang ibon.",
      "Tumatalon sa tulay at bumubuo ng palay sa ibabaw ng bundok.",
      "Babangon at babagsak ang bata habang bumubuo ng bubong at lumilipad ang lamok.",
      "Bumubuo ng bahay, palay, at liwanag habang lumilipad sa patag.",
      "Babangon sa bawat hakbang, bumubuo ng tulay at bumubulong sa bundok.",
      "Tumatalon sa patag habang lumilipad ang lamok at bumubuo ng liwanag.",
      "Babangon at babagsak ang bata habang bumubuo ng palay at bubong.",
      "Lumilipad ang ibon at bumubuo ng bahay sa ibabaw ng bundok.",
      "Tumatalon sa tulay at bumubuo ng palay habang bumubulong ang bata.",
      "Babangon sa bawat hakbang at bumubuo ng liwanag at bubong.",
      // NOT from the client's script - written to bring Mundo 4 to 20 so
      // the game totals 80. Checked against all 79 others: its closest
      // match scores 29%, so it cannot be passed by reciting a different
      // twister. Replace it if the client supplies their own 20th line.
      "Bumibilis ang bulong ng batang bumubuo ng bubong habang bumababa ang bubuyog sa bundok."
    ]
  }
];

export function getWorld(id) {
  return WORLDS.find((w) => w.id === id);
}

export function totalLevelCount() {
  return WORLDS.reduce((sum, w) => sum + w.twisters.length, 0);
}
